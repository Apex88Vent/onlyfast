#import "OnlyFastAdMob.h"
#import <AppTrackingTransparency/AppTrackingTransparency.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
#import <UserMessagingPlatform/UserMessagingPlatform.h>

static NSString *const BridgeName = @"onlyfastAdmob";
static const NSTimeInterval OpportunitySeconds = 0.5;
static const NSTimeInterval CacheSeconds = 50 * 60;
// The release binary stays closed until native geographic exclusion is verified.
static const BOOL LiveRegionVerified = NO;
static NSMutableArray<dispatch_block_t> *SDKWaiters;
static BOOL SDKStarting;
static BOOL SDKReady;

@interface OnlyFastAdMob () <WKScriptMessageHandlerWithReply, GADBannerViewDelegate>
@property (nonatomic, weak) UIViewController *host;
@property (nonatomic, weak) WKWebView *webView;
@property (nonatomic, weak) UIView *slot;
@property (nonatomic, weak) NSLayoutConstraint *boundary;
@property (nonatomic, strong) GADBannerView *banner;
@property (nonatomic, strong) NSLayoutConstraint *bannerHeight;
@property (nonatomic, strong) GADInterstitialAd *cached;
@property (nonatomic, copy) NSString *document;
@property (nonatomic) NSTimeInterval cachedAt;
@property (nonatomic) NSTimeInterval lastLoad;
@property (nonatomic) NSUInteger revision;
@property (nonatomic) BOOL loading;
@property (nonatomic) BOOL bannerRequested;
@property (nonatomic) BOOL updating;
@property (nonatomic) BOOL updated;
@property (nonatomic) BOOL formOpen;
@property (nonatomic) BOOL consentComplete;
@property (nonatomic, strong) NSMutableArray *consentWaiters;
@end

@implementation OnlyFastAdMob
- (instancetype)initWithHost:(UIViewController *)host webView:(WKWebView *)webView
                        slot:(UIView *)slot boundary:(NSLayoutConstraint *)boundary {
    self = [super init];
    if (self) {
        _host = host;
        _webView = webView;
        _slot = slot;
        _boundary = boundary;
        _consentWaiters = [NSMutableArray array];
    }
    return self;
}

- (void)attach {
    [self.webView.configuration.userContentController addScriptMessageHandlerWithReply:self
        contentWorld:WKContentWorld.pageWorld name:BridgeName];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(backgrounded:)
        name:UIApplicationDidEnterBackgroundNotification object:nil];
    [self updateConsent:^(BOOL success) {}];
}

- (void)detach {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self.webView.configuration.userContentController removeScriptMessageHandlerForName:BridgeName
        contentWorld:WKContentWorld.pageWorld];
    [self reset];
    self.webView = nil;
}

- (void)backgrounded:(NSNotification *)notification { [self reset]; }

- (BOOL)isQA:(NSURL *)url {
#if DEBUG
    return [url.scheme isEqualToString:@"http"] && [url.host isEqualToString:@"127.0.0.1"] &&
        url.port.integerValue == 4179;
#else
    return NO;
#endif
}

- (BOOL)current:(NSString *)url {
    NSURL *actual = self.webView.URL;
    BOOL canonical = [actual.scheme isEqualToString:@"https"] && [actual.host isEqualToString:@"onlyfast.app"] &&
        (!actual.port || actual.port.integerValue == 443) && !actual.user && !actual.password;
    return (canonical || [self isQA:actual]) && [actual.absoluteString isEqualToString:url] &&
        self.host.viewIfLoaded.window != nil && self.webView.window != nil &&
        UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
}

- (BOOL)sameOrigin:(NSURL *)frameURL {
    NSURL *actual = self.webView.URL;
    return [frameURL.scheme isEqualToString:actual.scheme] && [frameURL.host isEqualToString:actual.host] &&
        (frameURL.port == actual.port || [frameURL.port isEqual:actual.port]);
}

- (BOOL)canLoad:(NSString *)url {
#if DEBUG
    BOOL live = NO;
#else
    BOOL live = LiveRegionVerified && UMPConsentInformation.sharedInstance.consentStatus == UMPConsentStatusNotRequired;
#endif
    return [self current:url] && ([self isQA:self.webView.URL] || live) &&
        self.consentComplete && !self.formOpen && UMPConsentInformation.sharedInstance.canRequestAds;
}

- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message
                  replyHandler:(void (^)(id, NSString *))reply {
    if (!message.frameInfo.isMainFrame || message.webView != self.webView ||
        ![message.body isKindOfClass:NSDictionary.class]) { reply(@"unavailable", nil); return; }
    NSDictionary *payload = message.body;
    NSString *url = payload[@"url"];
    NSString *action = payload[@"action"];
    if (![url isKindOfClass:NSString.class] || ![action isKindOfClass:NSString.class] ||
        ![self sameOrigin:message.frameInfo.request.URL] || ![self current:url]) {
        reply(@"unavailable", nil);
        return;
    }
    void (^done)(NSString *) = ^(NSString *value) { reply(value, nil); };
    if ([action isEqualToString:@"status"]) {
        [self updateConsent:^(BOOL success) {
            done(!success ? @"unavailable" : [self privacyRequired] ? @"required" : @"not-required");
        }];
    }
    else if ([action isEqualToString:@"consent"]) [self collect:NO completion:done];
    else if ([action isEqualToString:@"privacy"]) [self collect:YES completion:done];
    else if ([action isEqualToString:@"tracking"]) {
        [ATTrackingManager requestTrackingAuthorizationWithCompletionHandler:^(ATTrackingManagerAuthorizationStatus status) {
            dispatch_async(dispatch_get_main_queue(), ^{ done(@"completed"); });
        }];
    } else if ([action isEqualToString:@"banner.enable"]) {
        if ([self canLoad:url]) {
            if (![self.document isEqualToString:url]) [self reset];
            self.document = url;
            self.bannerRequested = YES;
            __weak typeof(self) weakSelf = self;
            [self startSDK:^{ [weakSelf loadAds:url]; }];
        }
        done(@"ok");
    } else if ([action isEqualToString:@"banner.disable"]) {
        [self hideBanner];
        done(@"ok");
    } else if ([action isEqualToString:@"invalidate"]) {
        [self reset];
        done(@"ok");
    } else if ([action isEqualToString:@"showInterstitialIfReady"]) [self show:payload completion:done];
    else done(@"unavailable");
}

- (void)updateConsent:(void (^)(BOOL))done {
    if (self.updated) { done(YES); return; }
    [self.consentWaiters addObject:[done copy]];
    if (self.updating) return;
    self.updating = YES;
    UMPRequestParameters *parameters = [[UMPRequestParameters alloc] init];
    [UMPConsentInformation.sharedInstance requestConsentInfoUpdateWithParameters:parameters
        completionHandler:^(NSError *error) {
            self.updating = NO;
            self.updated = error == nil;
            NSArray *waiters = [self.consentWaiters copy];
            [self.consentWaiters removeAllObjects];
            for (void (^waiter)(BOOL) in waiters) waiter(self.updated);
        }];
}

- (BOOL)privacyRequired {
    return self.updated && UMPConsentInformation.sharedInstance.privacyOptionsRequirementStatus ==
        UMPPrivacyOptionsRequirementStatusRequired;
}

- (void)collect:(BOOL)privacy completion:(void (^)(NSString *))done {
    if (self.formOpen) { done(@"unavailable"); return; }
    self.formOpen = YES;
    [self reset];
    [self updateConsent:^(BOOL success) {
        if (!success || !self.webView.window || !self.host.viewIfLoaded.window ||
            UIApplication.sharedApplication.applicationState != UIApplicationStateActive) {
            self.formOpen = NO;
            self.consentComplete = NO;
            done(@"unavailable");
            return;
        }
        if (privacy && ![self privacyRequired]) { self.formOpen = NO; done(@"not-required"); return; }
        void (^finish)(NSError *) = ^(NSError *error) {
            self.formOpen = NO;
            self.consentComplete = error == nil;
            done(error ? @"unavailable" : @"completed");
        };
        if (privacy) [UMPConsentForm presentPrivacyOptionsFormFromViewController:self.host completionHandler:finish];
        else [UMPConsentForm loadAndPresentIfRequiredFromViewController:self.host completionHandler:finish];
    }];
}

- (void)startSDK:(dispatch_block_t)done {
    if (SDKReady) { done(); return; }
    if (!SDKWaiters) SDKWaiters = [NSMutableArray array];
    [SDKWaiters addObject:[done copy]];
    if (SDKStarting) return;
    SDKStarting = YES;
    [GADMobileAds.sharedInstance startWithCompletionHandler:^(GADInitializationStatus *status) {
        dispatch_async(dispatch_get_main_queue(), ^{
            SDKReady = YES;
            NSArray *waiters = [SDKWaiters copy];
            [SDKWaiters removeAllObjects];
            for (dispatch_block_t waiter in waiters) waiter();
        });
    }];
}

- (void)loadAds:(NSString *)url {
    if (!self.bannerRequested || ![self.document isEqualToString:url] || ![self canLoad:url]) return;
    BOOL qa = [self isQA:self.webView.URL];
    if (!self.banner && self.slot && self.boundary && [self canLoad:url]) {
        CGFloat width = CGRectGetWidth(self.webView.bounds);
        GADAdSize size = width > 0 ? GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(width) : GADAdSizeBanner;
        GADBannerView *view = [[GADBannerView alloc] initWithAdSize:size];
        view.adUnitID = qa ? @"ca-app-pub-3940256099942544/2435281174" :
            [NSBundle.mainBundle objectForInfoDictionaryKey:@"OnlyFastBannerUnit"];
        view.rootViewController = self.host;
        view.delegate = self;
        view.hidden = YES;
        view.translatesAutoresizingMaskIntoConstraints = NO;
        [self.slot addSubview:view];
        self.bannerHeight = [self.slot.heightAnchor constraintEqualToConstant:size.size.height];
        [NSLayoutConstraint activateConstraints:@[[view.centerXAnchor constraintEqualToAnchor:self.slot.centerXAnchor],
            [view.topAnchor constraintEqualToAnchor:self.slot.topAnchor]]];
        self.banner = view;
        [view loadRequest:[GADRequest request]];
    }
    NSTimeInterval now = NSProcessInfo.processInfo.systemUptime;
    if (self.cached && now - self.cachedAt >= CacheSeconds) self.cached = nil;
    if (self.loading || self.cached || (self.lastLoad > 0 && now - self.lastLoad < 30) || ![self canLoad:url]) return;
    self.loading = YES;
    self.lastLoad = now;
    NSUInteger revision = self.revision;
    NSString *unit = qa ? @"ca-app-pub-3940256099942544/4411468910" :
        [NSBundle.mainBundle objectForInfoDictionaryKey:@"OnlyFastInterstitialUnit"];
    [GADInterstitialAd loadWithAdUnitID:unit request:[GADRequest request]
        completionHandler:^(GADInterstitialAd *ad, NSError *error) {
            if (revision != self.revision) return;
            self.loading = NO;
            if (ad && self.bannerRequested && [self canLoad:url]) {
                self.cached = ad;
                self.cachedAt = NSProcessInfo.processInfo.systemUptime;
            }
        }];
}

- (void)bannerViewDidReceiveAd:(GADBannerView *)view {
    if (view != self.banner || !self.bannerRequested || ![self canLoad:self.document]) return;
    view.hidden = NO;
    self.bannerHeight.active = YES;
    self.boundary.active = YES;
}

- (void)show:(NSDictionary *)payload completion:(void (^)(NSString *))done {
    NSString *url = payload[@"url"];
    NSString *token = payload[@"token"];
    NSNumber *issued = payload[@"issued"];
    if (![token isKindOfClass:NSString.class] || ![issued isKindOfClass:NSNumber.class] ||
        [token rangeOfString:@"^[0-9]{1,16}$" options:NSRegularExpressionSearch].location == NSNotFound ||
        ![self canLoad:url] || ![self.document isEqualToString:url] || !self.cached ||
        NSProcessInfo.processInfo.systemUptime - self.cachedAt >= CacheSeconds) { done(@"skipped"); return; }
    NSTimeInterval age = NSDate.date.timeIntervalSince1970 - issued.doubleValue / 1000;
    if (age < 0 || age > OpportunitySeconds) { done(@"skipped"); return; }
    NSUInteger revision = self.revision;
    GADInterstitialAd *ad = self.cached;
    WKWebView *source = self.webView;
    NSString *probe = [NSString stringWithFormat:@"window.onlyfastAdOpportunity?.(\"%@\") === true", token];
    [source evaluateJavaScript:probe completionHandler:^(id value, NSError *error) {
        NSTimeInterval elapsed = NSDate.date.timeIntervalSince1970 - issued.doubleValue / 1000;
        if (error || ![value isEqual:@YES] || revision != self.revision || source != self.webView ||
            self.cached != ad || elapsed < 0 || elapsed > OpportunitySeconds || ![self canLoad:url] ||
            self.host.presentedViewController) { done(@"skipped"); return; }
        self.cached = nil;
        [ad presentFromRootViewController:self.host];
        done(@"requested");
    }];
}

- (void)hideBanner {
    self.bannerRequested = NO;
    if (!self.banner) return;
    self.banner.delegate = nil;
    [self.banner removeFromSuperview];
    self.banner = nil;
    self.bannerHeight.active = NO;
    self.bannerHeight = nil;
    self.boundary.active = NO;
}

- (void)reset {
    self.revision++;
    self.document = nil;
    self.loading = NO;
    self.cached = nil;
    [self hideBanner];
}
@end
