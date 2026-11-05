package co.median.android;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;
import android.widget.RelativeLayout;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;
import java.net.URI;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

/** OnlyFast's origin-bound AdMob bridge. All commands and callbacks run on the UI thread. */
final class OnlyFastAdMob {
    private static final String BRIDGE = "onlyfastAdmob";
    private static final String PRODUCTION_ORIGIN = "https://onlyfast.app";
    private static final String QA_ORIGIN = "http://10.0.2.2:4179";
    private static final long CACHE_LIFETIME_MS = 50 * 60_000L;
    private static final long OPPORTUNITY_MS = 500;
    private static final String RELEASE_CAPABILITY = "onlyfast-admob-v1-android-release";
    private static final long REGION_RECHECK_MS = 60_000L;
    private static boolean sdkStarting;
    private static boolean sdkReady;
    private static final ArrayList<Runnable> sdkWaiters = new ArrayList<>();
    private final MainActivity activity;
    private final ConsentInformation consent;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ArrayList<Consumer<Boolean>> consentWaiters = new ArrayList<>();
    private WebView webView;
    private boolean foreground;
    private boolean updating;
    private boolean updated;
    private boolean formOpen;
    private boolean consentComplete;
    private boolean bannerRequested;
    private boolean loading;
    private int context;
    private String document;
    private AdView banner;
    private InterstitialAd cached;
    private long cachedAt;
    private long lastLoad;
    private long regionAllowedUntil;
    private int regionRequest;
    private boolean checkingRegion;
    private final Runnable checkRegionAgain = () -> {
        if (bannerRequested && document != null) verifyRegion(document);
    };
    private final Runnable expireRegion = () -> {
        regionAllowedUntil = 0;
        cached = null;
        clearBanner();
    };

    OnlyFastAdMob(MainActivity activity) {
        this.activity = activity;
        consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    void attach(WebView view) {
        if (webView == view || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        detach();
        webView = view;
        Set<String> origins = BuildConfig.ONLYFAST_TEST_ADS
            ? new HashSet<>(Arrays.asList(PRODUCTION_ORIGIN, QA_ORIGIN))
            : Collections.singleton(PRODUCTION_ORIGIN);
        WebViewCompat.addWebMessageListener(view, BRIDGE, origins, (source, message, origin, mainFrame, reply) -> {
            if (!mainFrame || source != webView || !allowedUrl(source.getUrl()) ||
                    !origin.toString().equals(originOf(source.getUrl()))) return;
            try {
                JSONObject payload = new JSONObject(message.getData());
                handle(payload, reply);
            } catch (Exception ignored) { /* Invalid message; never forward to another bridge. */ }
        });
    }

    void resume() {
        foreground = true;
        updateConsent(ok -> {});
    }

    void pause() {
        foreground = false;
        invalidate();
    }

    void navigationStarted(WebView view) {
        if (view == webView) invalidate();
    }

    void detach() {
        invalidate();
        if (webView != null) WebViewCompat.removeWebMessageListener(webView, BRIDGE);
        webView = null;
    }

    private static String originOf(String url) {
        if (url == null) return "";
        Uri uri = Uri.parse(url);
        return uri.getScheme() + "://" + uri.getEncodedAuthority();
    }

    private static boolean allowedUrl(String url) {
        String origin = originOf(url);
        return PRODUCTION_ORIGIN.equals(origin) || (BuildConfig.ONLYFAST_TEST_ADS && QA_ORIGIN.equals(origin));
    }

    private boolean current(String url) {
        return foreground && !activity.isFinishing() && !activity.isDestroyed() &&
            webView != null && webView.isShown() && allowedUrl(url) && url.equals(webView.getUrl());
    }

    private boolean canLoad(String url) {
        boolean qa = BuildConfig.ONLYFAST_TEST_ADS && QA_ORIGIN.equals(originOf(url));
        boolean live = BuildConfig.ONLYFAST_RELEASE_ADS && regionAllowedUntil > SystemClock.elapsedRealtime() &&
            consent.getConsentStatus() == ConsentInformation.ConsentStatus.NOT_REQUIRED;
        return current(url) && (qa || live) &&
            consentComplete && !formOpen && consent.canRequestAds();
    }

    private void handle(JSONObject payload, JavaScriptReplyProxy reply) {
        int id = payload.optInt("id");
        if (id <= 0) return;
        String url = payload.optString("url");
        String action = payload.optString("action");
        if ("releaseCapability".equals(action)) {
            respond(reply, id, BuildConfig.ONLYFAST_RELEASE_ADS && PRODUCTION_ORIGIN.equals(originOf(url)) &&
                url.equals(webView.getUrl()) ? RELEASE_CAPABILITY : "unavailable");
            return;
        }
        if (!current(url)) { respond(reply, id, "unavailable"); return; }
        switch (action) {
            case "status":
                updateConsent(ok -> respond(reply, id, !ok ? "unavailable" : privacyRequired() ? "required" : "not-required"));
                break;
            case "consent": collect(false, value -> respond(reply, id, value)); break;
            case "privacy": collect(true, value -> respond(reply, id, value)); break;
            case "banner.enable":
                if (!consentComplete || formOpen || !consent.canRequestAds()) {
                    respond(reply, id, "blocked"); return;
                }
                if (!url.equals(document)) invalidate();
                document = url;
                bannerRequested = true;
                if (canLoad(url)) {
                    startSdk(() -> loadAds(url));
                    if (BuildConfig.ONLYFAST_RELEASE_ADS &&
                            regionAllowedUntil - SystemClock.elapsedRealtime() <= 15_000) verifyRegion(url);
                }
                else if (BuildConfig.ONLYFAST_RELEASE_ADS &&
                        consent.getConsentStatus() == ConsentInformation.ConsentStatus.NOT_REQUIRED) verifyRegion(url);
                else { respond(reply, id, "blocked"); return; }
                respond(reply, id, "ok");
                break;
            case "banner.disable": hideBanner(); respond(reply, id, "ok"); break;
            case "invalidate": invalidate(); respond(reply, id, "ok"); break;
            case "showInterstitialIfReady": show(payload, value -> respond(reply, id, value)); break;
            default: respond(reply, id, "unavailable");
        }
    }

    private void verifyRegion(String url) {
        if (checkingRegion || !bannerRequested || !current(url) || !consentComplete ||
                formOpen || !consent.canRequestAds()) return;
        checkingRegion = true;
        int request = ++regionRequest;
        new Thread(() -> {
            HttpsURLConnection connection = null;
            boolean approved = false;
            try {
                connection = (HttpsURLConnection) URI.create(PRODUCTION_ORIGIN + "/api/admob-region").toURL().openConnection();
                connection.setConnectTimeout(3500);
                connection.setReadTimeout(3500);
                connection.setUseCaches(false);
                connection.setInstanceFollowRedirects(false);
                approved = connection.getResponseCode() == 204;
            } catch (Exception ignored) { /* No live ads without a region decision. */ }
            finally { if (connection != null) connection.disconnect(); }
            final boolean eligible = approved;
            main.post(() -> {
                if (request != regionRequest) return;
                checkingRegion = false;
                if (!bannerRequested || !url.equals(document) || !current(url)) return;
                main.removeCallbacks(expireRegion);
                if (eligible) {
                    regionAllowedUntil = SystemClock.elapsedRealtime() + REGION_RECHECK_MS;
                    main.postDelayed(expireRegion, REGION_RECHECK_MS);
                    if (canLoad(url)) startSdk(() -> loadAds(url));
                } else {
                    regionAllowedUntil = 0;
                    cached = null;
                    clearBanner();
                }
                main.removeCallbacks(checkRegionAgain);
                main.postDelayed(checkRegionAgain, REGION_RECHECK_MS - 15_000);
            });
        }, "OnlyFastAdRegion").start();
    }

    private static void respond(JavaScriptReplyProxy reply, int id, String value) {
        reply.postMessage("{\"id\":" + id + ",\"value\":" + JSONObject.quote(value) + "}");
    }

    private void updateConsent(Consumer<Boolean> done) {
        if (updated) { done.accept(true); return; }
        consentWaiters.add(done);
        if (updating) return;
        updating = true;
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
            () -> finishUpdate(true), error -> finishUpdate(false));
    }

    private void finishUpdate(boolean success) {
        updating = false;
        updated = success;
        var waiters = new ArrayList<>(consentWaiters);
        consentWaiters.clear();
        waiters.forEach(waiter -> waiter.accept(success));
    }

    private boolean privacyRequired() {
        return updated && consent.getPrivacyOptionsRequirementStatus() ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    private void collect(boolean privacy, Consumer<String> done) {
        if (formOpen) { done.accept("unavailable"); return; }
        formOpen = true;
        invalidate();
        updateConsent(ok -> {
            if (!ok || !foreground || activity.isFinishing() || activity.isDestroyed()) {
                formOpen = false;
                consentComplete = false;
                done.accept("unavailable");
                return;
            }
            if (privacy && !privacyRequired()) {
                formOpen = false;
                done.accept("not-required");
                return;
            }
            if (privacy) UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> finishForm(error == null, done));
            else UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, error -> finishForm(error == null, done));
        });
    }

    private void finishForm(boolean ok, Consumer<String> done) {
        formOpen = false;
        consentComplete = ok;
        done.accept(ok ? "completed" : "unavailable");
    }

    private void startSdk(Runnable ready) {
        if (sdkReady) { ready.run(); return; }
        sdkWaiters.add(ready);
        if (sdkStarting) return;
        sdkStarting = true;
        MobileAds.initialize(activity.getApplicationContext(), status -> activity.runOnUiThread(() -> {
            sdkReady = true;
            var waiters = new ArrayList<>(sdkWaiters);
            sdkWaiters.clear();
            waiters.forEach(Runnable::run);
        }));
    }

    private void loadAds(String url) {
        if (!bannerRequested || !url.equals(document) || !canLoad(url)) return;
        boolean qa = BuildConfig.ONLYFAST_TEST_ADS;
        if (banner == null) {
            RelativeLayout slot = activity.findViewById(R.id.pluginView);
            if (slot != null && canLoad(url)) {
                AdView view = new AdView(activity);
                view.setAdUnitId(qa ? "ca-app-pub-3940256099942544/9214589741" : BuildConfig.ONLYFAST_BANNER_UNIT);
                int width = (int) (webView.getWidth() / activity.getResources().getDisplayMetrics().density);
                view.setAdSize(width > 0 ? AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, width) : AdSize.BANNER);
                var layout = new RelativeLayout.LayoutParams(-2, -2);
                layout.addRule(RelativeLayout.CENTER_HORIZONTAL);
                slot.addView(view, layout);
                banner = view;
                view.setAdListener(new AdListener() {
                    @Override public void onAdLoaded() {
                        if (banner == view && bannerRequested && canLoad(url)) {
                            slot.setVisibility(View.VISIBLE);
                            if (qa) Log.d("OnlyFastAdMob", "Test banner loaded");
                        }
                    }
                    @Override public void onAdFailedToLoad(LoadAdError error) {
                        if (qa) Log.d("OnlyFastAdMob", "Test banner failed: " + error.getCode());
                    }
                });
                view.loadAd(new AdRequest.Builder().build());
            }
        }
        long now = SystemClock.elapsedRealtime();
        if (cached != null && now - cachedAt >= CACHE_LIFETIME_MS) cached = null;
        if (loading || cached != null || (lastLoad != 0 && now - lastLoad < 30_000L) || !canLoad(url)) return;
        loading = true;
        lastLoad = now;
        int revision = context;
        InterstitialAd.load(activity, qa ? "ca-app-pub-3940256099942544/1033173712" : BuildConfig.ONLYFAST_INTERSTITIAL_UNIT,
            new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(InterstitialAd ad) {
                    if (revision != context) return;
                    loading = false;
                    if (bannerRequested && canLoad(url)) {
                        cached = ad;
                        cachedAt = SystemClock.elapsedRealtime();
                        if (qa) Log.d("OnlyFastAdMob", "Test interstitial cached");
                    }
                }
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (revision == context) loading = false;
                    if (qa) Log.d("OnlyFastAdMob", "Test interstitial failed: " + error.getCode());
                }
            });
    }

    private void show(JSONObject payload, Consumer<String> done) {
        String url = payload.optString("url");
        String token = payload.optString("token");
        long age = System.currentTimeMillis() - payload.optLong("issued");
        if (!token.matches("[0-9]{1,16}") || age < 0 || age > OPPORTUNITY_MS || !current(url)) {
            done.accept("skipped");
            return;
        }
        if (!canLoad(url) || !url.equals(document) || cached == null ||
                SystemClock.elapsedRealtime() - cachedAt >= CACHE_LIFETIME_MS) {
            done.accept("no-fill");
            return;
        }
        int revision = context;
        InterstitialAd ad = cached;
        WebView source = webView;
        source.evaluateJavascript("window.onlyfastAdOpportunity?.(" + JSONObject.quote(token) + ") === true", result -> {
            long elapsed = System.currentTimeMillis() - payload.optLong("issued");
            if (!"true".equals(result) || revision != context || source != webView || cached != ad ||
                    elapsed < 0 || elapsed > OPPORTUNITY_MS || !canLoad(url) || !activity.hasWindowFocus()) {
                done.accept("skipped");
                return;
            }
            cached = null;
            ad.show(activity);
            done.accept("requested");
        });
    }

    private void hideBanner() {
        bannerRequested = false;
        checkingRegion = false;
        regionRequest++;
        clearBanner();
    }

    private void clearBanner() {
        if (banner == null) return;
        RelativeLayout slot = (RelativeLayout) banner.getParent();
        if (slot != null) { slot.removeView(banner); if (slot.getChildCount() == 0) slot.setVisibility(View.GONE); }
        banner.destroy();
        banner = null;
    }

    private void invalidate() {
        context++;
        document = null;
        loading = false;
        cached = null;
        regionAllowedUntil = 0;
        main.removeCallbacks(checkRegionAgain);
        main.removeCallbacks(expireRegion);
        hideBanner();
    }
}
