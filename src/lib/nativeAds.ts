import { shouldShowAds } from './ads';
import { isMedianUserAgent, nativePlatform } from './nativeEnvironment';
import { getAdvertisingAuthorizationExpiry, invalidateAdvertisingMembership } from './trustedMembership';

// Verified commands: https://docs.median.co/docs/admob-native-ads
// Readiness: https://docs.median.co/docs/javascript-bridge
export interface MedianAdmobBridge {
  banner?: { enable?: () => void; disable?: () => void };
  showInterstitialIfReady?: () => void;
  request?: { consent?: () => Promise<unknown>; tracking?: () => Promise<unknown> };
}

export const INTERSTITIAL_COOLDOWN_MS = 600_000;
// Resolved read-only from production Auth, not an email or editable metadata claim.
export const NATIVE_ADS_ROLLOUT_USER_ID = '58a1db2f-8d4d-412e-afe5-abadf57f6ae1';
export function nativeAdsRolloutEnabled(value: unknown, userId: string | null): boolean {
  return nativeAdsFeatureEnabled(value) && userId === NATIVE_ADS_ROLLOUT_USER_ID;
}

type NativePlatform = 'android' | 'ios';
type DeviceHost = { deviceInfo?: () => Promise<unknown> };
const registeredDeviceHashes: Record<NativePlatform, readonly string[]> = {
  // SHA-256 of the Android advertising ID verified in AdMob's Test devices list.
  android: ['b852c51655b137b99f626bce5bb63a4757787247d602e6954cb6afc042eb29f4'],
  ios: [], // No iOS test device is registered. Never substitute the Android ID.
};

/** Uses only documented median.deviceInfo(); no ID is sent to another service. */
export class NativeAdTestDevice {
  private request: DeviceHost['deviceInfo'];
  private host: DeviceHost | undefined;
  private platform: NativePlatform | null = null;
  private revision = 0;
  private status = 'idle';
  constructor(private readonly hashes = registeredDeviceHashes) {}

  getStatus() { return this.status; }
  reset() {
    this.revision++; this.request = undefined; this.host = undefined; this.platform = null; this.status = 'idle';
  }
  allowed(platform: NativePlatform | null, host: DeviceHost | undefined) {
    return this.status === 'matched' && platform === this.platform && host === this.host && host?.deviceInfo === this.request;
  }
  prepare(platform: NativePlatform | null, host: DeviceHost | undefined, updated: () => void) {
    if (this.platform === platform && this.host === host && this.request === host?.deviceInfo && this.status !== 'idle') return;
    const revision = ++this.revision;
    this.platform = platform; this.host = host; this.request = host?.deviceInfo;
    if (!platform || !this.hashes[platform].length) { this.status = 'no-registered-device'; return; }
    const request = this.request;
    if (typeof request !== 'function') { this.status = 'device-info-unavailable'; return; }
    this.status = 'pending';
    let timer: ReturnType<typeof setTimeout>;
    void (async () => {
      try {
        const operation = request.call(host);
        if (!operation || typeof operation.then !== 'function') throw Error('Device info Promise unavailable');
        const info = await Promise.race([operation, new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(Error('Device info timed out')), 10_000);
        })]);
        if (revision !== this.revision) return;
        if (!info || typeof info !== 'object') { this.status = 'advertising-id-unavailable'; return; }
        const device = info as Record<string, unknown>;
        if (device.platform !== platform || device.appId !== 'app.onlyfast') { this.status = 'app-or-platform-mismatch'; return; }
        const raw = platform === 'android' ? device.gaid : device.idfa;
        const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) {
          this.status = 'advertising-id-unavailable'; return;
        }
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        if (revision === this.revision) this.status = this.hashes[platform].includes(hash) ? 'matched' : 'unregistered-device';
      } catch { if (revision === this.revision) this.status = 'device-info-error'; }
      finally { clearTimeout(timer); if (revision === this.revision) updated(); }
    })();
  }
}

export function nativeAdsFeatureEnabled(value: unknown): boolean { return value === 'true'; }

export interface NativeAdsDependencies {
  enabled(userId: string | null): boolean;
  userAgent(): string;
  bridge(): MedianAdmobBridge | undefined;
  eligible(userId: string): boolean;
  storage(): Pick<Storage, 'getItem' | 'setItem'>;
  now(): number;
  maxTouchPoints?(): number;
  deviceAllowed?(platform: NativePlatform | null): boolean;
  prepareDevice?(platform: NativePlatform | null, updated: () => void): void;
  deviceStatus?(): string;
  resetDevice?(): void;
  diagnostic?(value: ReturnType<NativeAdsController['getDiagnostics']>): void;
}

type SaveTicket = Readonly<{ userId: string; generation: number; activity: number }>;
export type PostSaveAdResult = 'house' | 'suppressed' | 'requested';
export type NativeConsentStatus = 'idle' | 'pending' | 'unverified' | 'unavailable' | 'error';

/** One native banner per WebView; no DOM ad containers or ad-unit overrides. */
export class NativeAdsController {
  private userId: string | null = null;
  private generation = 0;
  private activity = 0;
  private foreground = false;
  private routeSupported = false;
  private placement: { userId: string; view: string } | null = null;
  private suspensions = new Set<object>();
  private banner: MedianAdmobBridge | null = null;
  private disabledBanner: MedianAdmobBridge | null = null;
  private pendingSave: SaveTicket | null = null;
  private requesting = false;
  private consentStatus: NativeConsentStatus = 'idle';
  private consentResponse: unknown;
  private trackingResponse: unknown;
  private consentAttempt: { bridge: MedianAdmobBridge; generation: number } | null = null;
  private consentRequest: Promise<NativeConsentStatus> | null = null;
  private bannerDispatches = 0;
  private interstitialDispatches = 0;

  constructor(private readonly deps: NativeAdsDependencies) {}

  setUser(userId: string | null) {
    if (userId !== this.userId) {
      this.deps.resetDevice?.();
      this.generation++;
      this.pendingSave = null;
      this.consentStatus = 'idle';
      this.consentResponse = undefined;
      this.trackingResponse = undefined;
      this.consentAttempt = null;
      this.bannerDispatches = 0;
      this.interstitialDispatches = 0;
      this.hideBanner();
      this.userId = userId;
    }
    this.refresh();
  }

  setForeground(visible: boolean) {
    if (!visible) { this.noteActivity(); this.deps.resetDevice?.(); }
    this.foreground = visible;
    this.refresh();
  }

  setRouteSupported(supported: boolean) {
    this.routeSupported = supported;
    this.noteActivity();
    this.refresh();
  }

  setPlacement(userId: string | null, view: string): () => void {
    const placement = userId ? { userId, view } : null;
    this.placement = placement;
    this.noteActivity();
    this.refresh();
    return () => {
      if (this.placement !== placement) return;
      this.placement = null;
      this.noteActivity();
      this.refresh();
    };
  }

  suspend(): () => void {
    const token = {};
    this.suspensions.add(token);
    this.noteActivity();
    this.refresh();
    return () => { this.suspensions.delete(token); this.refresh(); };
  }

  noteActivity() { this.activity++; }

  canRequestConsent(): boolean {
    try {
      // Manual privacy access is independent of advertising eligibility/display.
      return !!this.userId && this.platform() !== null && this.foreground &&
        typeof this.deps.bridge()?.request?.consent === 'function';
    } catch { return false; }
  }

  /** Native diagnostics only; never persisted or interpreted as a personalization choice. */
  getConsentStatus() { return { status: this.consentStatus, response: this.consentResponse, trackingResponse: this.trackingResponse }; }

  /** Command diagnostics are not a native impression or personalization callback. */
  getDiagnostics() {
    const bridge = this.deps.bridge();
    return {
      rolloutAccount: this.userId === NATIVE_ADS_ROLLOUT_USER_ID,
      eligible: !!this.userId && this.deps.eligible(this.userId),
      enabled: this.deps.enabled(this.userId),
      platform: this.platform(),
      bridgeAvailable: typeof bridge?.banner?.enable === 'function' && typeof bridge?.banner?.disable === 'function',
      interstitialBridgeAvailable: typeof bridge?.showInterstitialIfReady === 'function',
      device: this.deps.deviceStatus?.() ?? 'not-configured',
      deviceAllowed: this.deps.deviceAllowed?.(this.platform()) ?? true,
      consent: this.consentStatus,
      consentRequestCompleted: this.consentStatus === 'unverified',
      advertisingPermission: 'not-exposed-by-native-bridge',
      bannerCommandDispatched: this.bannerDispatches > 0,
      interstitialCommandDispatched: this.interstitialDispatches > 0,
      bannerCommandDispatches: this.bannerDispatches,
      interstitialCommandDispatches: this.interstitialDispatches,
      adDisplayed: 'unknown',
    };
  }

  private diagnose() {
    try { this.deps.diagnostic?.(this.getDiagnostics()); } catch { /* Diagnostics cannot affect advertising behavior. */ }
  }

  /** Re-request only the documented native consent flow, including from Settings. */
  requestConsent(): Promise<NativeConsentStatus> {
    if (this.consentRequest) return this.consentRequest;
    if (!this.canRequestConsent()) return Promise.resolve('unavailable');
    const bridge = this.deps.bridge();
    const generation = this.generation;
    this.consentAttempt = { bridge, generation };
    this.consentStatus = 'pending';
    this.consentResponse = undefined;
    this.noteActivity(); // A consent prompt must never precede a delayed save ad.
    this.hideBanner();
    let timer: ReturnType<typeof setTimeout>;
    let nativePending = false;
    let nativeCompletion: Promise<unknown> | null = null;
    const request = (async (): Promise<NativeConsentStatus> => {
      try {
        // The Promise form is explicitly documented by Median. Do not manufacture
        // success for older/callback-only bridge implementations returning void.
        const requestConsent = () => {
          const consent = bridge.request.consent();
          if (!consent || typeof consent.then !== 'function') throw new Error('Native consent Promise unavailable');
          return consent;
        };
        let result: Promise<unknown>;
        if (this.platform() === 'ios') {
          if (typeof bridge.request.tracking !== 'function') return 'unavailable';
          // ATT is separate from UMP. Denied/restricted ATT is not an ad-display
          // failure and never becomes authorization to track or personalize ads.
          const tracking = bridge.request.tracking();
          if (!tracking || typeof tracking.then !== 'function') return 'unavailable';
          result = Promise.resolve(tracking).then(response => {
            if (generation !== this.generation || bridge !== this.deps.bridge()) throw new Error('Native identity changed');
            this.trackingResponse = response;
            if (!this.foreground) throw new Error('Native app backgrounded');
            return requestConsent();
          });
        } else result = requestConsent();
        if (!result || typeof result.then !== 'function') return 'unavailable';
        nativePending = true;
        nativeCompletion = Promise.resolve(result).then(
          response => { nativePending = false; return response; },
          error => { nativePending = false; throw error; },
        );
        const response = await Promise.race([
          nativeCompletion,
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Native consent timed out')), 15_000); }),
        ]);
        if (generation !== this.generation || bridge !== this.deps.bridge()) return 'unavailable';
        this.consentResponse = response;
        // This records completion of the native flow, NOT permission to request
        // ads, track, or personalize. Median exposes no documented canRequestAds
        // getter. Subsequent banner/interstitial commands leave UMP eligibility
        // and limited/nonpersonalized serving to the native plugin; no response
        // field is converted into an authorization or SDK consent override.
        return 'unverified';
      } catch { return 'error'; }
      finally { clearTimeout(timer); }
    })();
    const operation = request.then(status => {
      try {
        if (generation === this.generation && bridge === this.deps.bridge()) this.consentStatus = status;
      } catch { this.consentStatus = 'error'; }
      const release = () => {
        if (this.consentRequest !== operation) return;
        this.consentRequest = null;
        this.refresh();
      };
      // Timing out a JS wait cannot cancel a native dialog. Keep the lock until
      // that native operation settles, so Settings cannot stack another form.
      if (nativePending && nativeCompletion) void nativeCompletion.then(release, release);
      else release();
      return status;
    });
    this.consentRequest = operation;
    return this.consentRequest;
  }

  private platform(): 'android' | 'ios' | null {
    const ua = this.deps.userAgent();
    if (!isMedianUserAgent(ua)) return null;
    const platform = nativePlatform(ua, this.deps.maxTouchPoints?.() ?? 0);
    return platform === 'android' || platform === 'ios' ? platform : null;
  }

  private allowed() {
    return !!this.userId && this.deps.enabled(this.userId) && this.platform() !== null && this.foreground &&
      (this.deps.deviceAllowed?.(this.platform()) ?? true) &&
      this.routeSupported && this.suspensions.size === 0 && this.consentStatus === 'unverified' &&
      this.consentAttempt?.bridge === this.deps.bridge() && this.consentAttempt.generation === this.generation &&
      this.deps.eligible(this.userId);
  }

  private hideBanner(available?: MedianAdmobBridge) {
    const bridge = this.banner ?? available;
    this.banner = null;
    if (!bridge || bridge === this.disabledBanner) return;
    try {
      bridge.banner?.disable?.();
      this.disabledBanner = bridge;
    } catch { /* Missing/stopped native plugin; retry on the next lifecycle event. */ }
  }

  refresh() {
    try {
      const bridge = this.deps.bridge();
      // Run UMP at an eligible, non-editing screen, before either native format.
      // Once per account/bridge attempt; Settings may explicitly retry errors or
      // re-request the flow. Do not loop when a native form cannot be displayed.
      if (this.deps.enabled(this.userId) && this.canRequestConsent() && this.routeSupported && this.suspensions.size === 0 &&
          this.deps.eligible(this.userId) && this.placement?.userId === this.userId &&
          ['home', 'schedule', 'saved'].includes(this.placement.view) &&
          (!this.consentAttempt || this.consentAttempt.bridge !== bridge || this.consentAttempt.generation !== this.generation)) {
        void this.requestConsent();
      }
      if (this.deps.enabled(this.userId) && this.userId && this.deps.eligible(this.userId) &&
          this.consentStatus === 'unverified' && this.foreground && this.routeSupported && this.suspensions.size === 0) {
        this.deps.prepareDevice?.(this.platform(), () => this.refresh());
      }
      const show = this.allowed() && this.placement?.userId === this.userId &&
        ['home', 'schedule', 'saved'].includes(this.placement.view) &&
        typeof bridge?.banner?.enable === 'function' && typeof bridge?.banner?.disable === 'function';
      // Also clear a banner retained by the native shell across a page reload.
      if (!show || this.banner !== bridge) this.hideBanner(this.platform() !== null ? bridge : undefined);
      if (show && !this.banner) {
        this.banner = bridge;
        this.disabledBanner = null;
        bridge.banner.enable();
        this.bannerDispatches++;
      }
    } catch { this.hideBanner(); }
    this.diagnose();
  }

  beginManualSave(userId: string | null): SaveTicket | null {
    this.pendingSave = userId && userId === this.userId
      ? { userId, generation: this.generation, activity: this.activity } : null;
    return this.pendingSave;
  }

  /** Called synchronously at the completed save modal's natural pause. Never queued for later. */
  completeManualSave(ticket: SaveTicket | null, outcome: {
    persisted: boolean; queued: boolean; editing: boolean;
  }): PostSaveAdResult {
    if (!ticket || ticket !== this.pendingSave) return 'suppressed';
    this.pendingSave = null;
    if (!outcome.persisted || outcome.queued || outcome.editing || ticket.userId !== this.userId ||
        ticket.generation !== this.generation || ticket.activity !== this.activity ||
        !this.foreground || !this.routeSupported || this.suspensions.size > 0 || this.requesting) return 'suppressed';

    try {
      if (!this.deps.eligible(ticket.userId)) return 'suppressed';
      const bridge = this.deps.bridge();
      if (!this.deps.enabled(this.userId) || this.platform() === null || typeof bridge?.showInterstitialIfReady !== 'function') return 'house';
      if (!this.allowed()) return 'suppressed';
      const key = `onlyfast_admob_interstitial_v1:${encodeURIComponent(ticket.userId)}`;
      const storage = this.deps.storage();
      const raw = storage.getItem(key);
      const now = this.deps.now();
      if (!Number.isFinite(now) || now < 0) return 'suppressed';
      if (raw !== null) {
        const last = Number(raw);
        // Unknown/corrupt storage and clock rollback fail closed.
        if (!raw.trim() || !Number.isFinite(last) || last < 0 || now - last < INTERSTITIAL_COOLDOWN_MS) return 'suppressed';
      }
      // Recheck identity/eligibility immediately before persisting and dispatching.
      if (ticket.userId !== this.userId || !this.allowed()) return 'suppressed';
      this.requesting = true;
      storage.setItem(key, String(now));
      // Count attempts: Median supplies no reliable display-success callback.
      bridge.showInterstitialIfReady();
      this.interstitialDispatches++;
      return 'requested';
    } catch {
      // A thrown bridge call may already have dispatched. Never stack a house modal.
      return 'suppressed';
    } finally { this.requesting = false; this.diagnose(); }
  }

  stop() {
    this.setForeground(false);
    this.setUser(null);
    this.placement = null;
  }
}

type NativeAdsWindow = Window & { median?: DeviceHost & { admob?: MedianAdmobBridge }; median_library_ready?: () => void };

const testDevice = new NativeAdTestDevice();
let lastDiagnostic = '';

export const nativeAds = new NativeAdsController({
  enabled: userId => nativeAdsRolloutEnabled(import.meta.env.VITE_MEDIAN_ADMOB_ENABLED, userId),
  deviceAllowed: platform => testDevice.allowed(platform, (window as NativeAdsWindow).median),
  prepareDevice: (platform, updated) => testDevice.prepare(platform, (window as NativeAdsWindow).median, updated),
  deviceStatus: () => testDevice.getStatus(),
  resetDevice: () => testDevice.reset(),
  diagnostic: value => {
    if (!value.rolloutAccount || import.meta.env.VITE_MEDIAN_ADMOB_DIAGNOSTICS !== 'true') return;
    const current = JSON.stringify(value);
    if (current !== lastDiagnostic) console.debug('[OnlyFast AdMob]', value);
    lastDiagnostic = current;
  },
  maxTouchPoints: () => navigator.maxTouchPoints,
  userAgent: () => navigator.userAgent,
  bridge: () => (window as NativeAdsWindow).median?.admob,
  eligible: userId => shouldShowAds({ id: userId }),
  storage: () => window.localStorage,
  now: Date.now,
});

export interface NativeAdsAuthSource {
  session(): Promise<string | null>;
  onAuthChange(listener: (id: string | null) => void): () => void;
}

export function watchNativeAds(controller: NativeAdsController, auth: NativeAdsAuthSource,
  host: NativeAdsWindow, page: Document): () => void {
  let active = true;
  let revision = 0;
  let userId: string | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const updateUser = (id: string | null, invalidate = true) => {
    if (!active) return;
    revision++;
    userId = id;
    if (invalidate) invalidateAdvertisingMembership(id);
    controller.setUser(id);
  };
  const unsubscribe = auth.onAuthChange(updateUser);
  const initialRevision = revision;
  void auth.session().then(id => {
    // A late initial session read must not invalidate a verification that the
    // independent membership lifecycle has already completed for this identity.
    if (active && revision === initialRevision) updateUser(id, false);
  }).catch(() => {});
  const membership = () => {
    clearTimeout(expiryTimer);
    controller.refresh();
    const expiry = getAdvertisingAuthorizationExpiry();
    if (expiry !== null) expiryTimer = setTimeout(() => invalidateAdvertisingMembership(userId), Math.max(0, expiry - Date.now()));
  };
  const background = () => {
    controller.setForeground(false);
    invalidateAdvertisingMembership(userId);
  };
  const visibility = () => {
    if (page.visibilityState !== 'visible') background();
    else controller.setForeground(true); // Membership lifecycle revalidates on resume.
  };
  const activity = () => controller.noteActivity();
  const previousReady = host.median_library_ready;
  const ready = () => { try { previousReady?.call(host); } finally { if (active) controller.refresh(); } };
  host.median_library_ready = ready;
  host.addEventListener('membership-updated', membership);
  host.addEventListener('blur', background);
  host.addEventListener('pagehide', background);
  host.addEventListener('focus', visibility);
  host.addEventListener('pageshow', visibility);
  page.addEventListener('visibilitychange', visibility);
  for (const event of ['pointerdown', 'keydown', 'input']) page.addEventListener(event, activity, true);
  visibility();
  membership(); // Also handles a bridge/membership that resolved before mounting.
  return () => {
    active = false;
    unsubscribe();
    clearTimeout(expiryTimer);
    host.removeEventListener('membership-updated', membership);
    host.removeEventListener('blur', background);
    host.removeEventListener('pagehide', background);
    host.removeEventListener('focus', visibility);
    host.removeEventListener('pageshow', visibility);
    page.removeEventListener('visibilitychange', visibility);
    for (const event of ['pointerdown', 'keydown', 'input']) page.removeEventListener(event, activity, true);
    if (host.median_library_ready === ready) host.median_library_ready = previousReady;
    controller.stop();
  };
}
