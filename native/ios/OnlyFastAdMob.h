#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface OnlyFastAdMob : NSObject
- (instancetype)initWithHost:(UIViewController *)host webView:(WKWebView *)webView
                        slot:(UIView *)slot boundary:(NSLayoutConstraint *)boundary;
- (void)attach;
- (void)detach;
- (void)reset;
@end
