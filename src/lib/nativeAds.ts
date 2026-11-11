import { shouldShowAds } from './ads';
import { isMedianUserAgent, nativePlatform } from './nativeEnvironment';
import { getAdvertisingAuthorizationExpiry, invalidateAdvertisingMembership, getTrustedAdvertisingMembership } from './trustedMembership';
import { supabase } from './supabase';
import { nativeBannerIsSafe, nativeBannerBlocker, nativeConsentScreenBlocker, houseInterstitialIsSafe } from './nativeBannerSafety';
import { resolveNativeAdsMode, nativeAdsAccountEnabled, type NativeAdsMode } from './nativeAdsMode';

// Verified commands: https://docs.median.co/docs/admob-native-ads
// Readiness: https://docs.median.co/docs/javascript-bridge
export interface MedianAdmobBridge {
  banner?: { enable?: () => void; disable?: () => void };
  showInterstitialIfReady?: () => void;
  request?: { consent?: () => Promise<unknown>; tracking?: () => Promise<unknown> };
}

export const INTERSTITIAL_COOLDOWN_MS = 600_000;
// Resolved read-only from production Auth, not an email or editable metadata claim.
export const NATIVE_ADS_ROLLOUT_USER_ID = '4b9864ff-2195-4be0-83a4-39308446577e';
export function nativeAdsRolloutEnabled(value: unknown, userId: string | null): boolean {
  return nativeAdsFeatureEnabled(value) && userId === NATIVE_ADS_ROLLOUT_USER_ID;
}

type NativePlatform = 'android' | 'ios';
const BANNER_VIEWS = ['home', 'setup', 'saved', 'compare', 'create-base', 'todo', 'parts', 'schedule'];
type DeviceHost = { deviceInfo?: () => Promise<unknown> };
const registeredDeviceHashes: Record<NativePlatform, readonly string[]> = {
  // SHA-256 of the Android advertising ID verified in AdMob's Test devices list.
  android: ['b852c51655b137b99f626bce5bb63a4757787247d602e6954cb6afc042eb29f4'],
  ios: [], // No iOS test device is registered. Never substitute the Android ID.
};

async function identifierHash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// The previous authorization belonged to the removed rookie@test.com login.
// A new account/session needs separate confirmation on the registered phone.
const registeredPhoneSessionHash: string | null = null;
type SessionAuth = Pick<typeof supabase.auth, 'getSession' | 'getUser'>;
export async function verifyNativeAdPhoneSession(auth: SessionAuth, userId: string, expectedHash: string): Promise<boolean> {
  try {
    const initial = await auth.getSession();
    const session = initial.data.session;
    if (initial.error || !session?.access_token || session.user.id !== userId) return false;
    // Validate the ORIGINAL token remotely before reading its signed session claim.
    // https://supabase.com/docs/reference/javascript/auth-getuser
    const verified = await auth.getUser(session.access_token);
    if (verified.error || verified.data.user?.id !== userId) return false;
    const sessionId = (token: string) => {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
      return claims.sub === userId && typeof claims.session_id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(claims.session_id)
        ? claims.session_id : null;
    };
    const id = sessionId(session.access_token);
    if (!id || await identifierHash(id) !== expectedHash) return false;
    const current = await auth.getSession();
    return !current.error && current.data.session?.user.id === userId &&
      sessionId(current.data.session.access_token) === id;
  } catch { return false; }
}

/** Documented deviceInfo plus a separately approved, verified phone-session fallback. */
export class NativeAdTestDevice {
  private request: DeviceHost['deviceInfo'];
  private host: DeviceHost | undefined;
  private platform: NativePlatform | null = null;
  private revision = 0;
  private status = 'idle';
  constructor(private readonly hashes = registeredDeviceHashes,
    private readonly verifyPhoneSession?: () => Promise<boolean>) {}

  getStatus() { return this.status; }
  reset() {
    this.revision++; this.request = undefined; this.host = undefined; this.platform = null; this.status = 'idle';
  }
  allowed(platform: NativePlatform | null, host: DeviceHost | undefined) {
    return ['matched', 'registered-phone-session'].includes(this.status) &&
      platform === this.platform && host === this.host && host?.deviceInfo === this.request;
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
        const verification = async () => {
          const info = await operation;
          if (!info || typeof info !== 'object') return 'advertising-id-unavailable';
          const device = info as Record<string, unknown>;
          if (device.platform !== platform || device.appId !== 'app.onlyfast') return 'app-or-platform-mismatch';
          const raw = platform === 'android' ? device.gaid : device.idfa;
          // AdMob alone does not expose GAID through Median deviceInfo. Only an
          // OMITTED identifier may use the owner-confirmed Android session. Never
          // override a zeroed, malformed or different advertising identifier.
          if (raw === undefined && platform === 'android') {
            if (!this.verifyPhoneSession) return 'phone-session-authorization-required';
            return await this.verifyPhoneSession() ? 'registered-phone-session' : 'phone-session-not-authorized';
          }
          const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) {
            return 'advertising-id-unavailable';
          }
          return this.hashes[platform].includes(await identifierHash(id)) ? 'matched' : 'unregistered-device';
        };
        const status = await Promise.race([verification(), new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(Error('Device info timed out')), 10_000);
        })]);
        if (revision === this.revision) this.status = status;
      } catch { if (revision === this.revision) this.status = 'device-info-error'; }
      finally { clearTimeout(timer); if (revision === this.revision) updated(); }
    })();
  }
}

export function nativeAdsFeatureEnabled(value: unknown): boolean { return value === 'true'; }

export interface NativeAdsDependencies {
  houseOnly?: boolean;
  houseInterstitialSafe?(): boolean;
  enabled(userId: string | null): boolean;
  /** Read current UMP permission from a verified native source, independently of the form response. */
  nativeAdPermission?(bridge: MedianAdmobBridge): NativeAdPermission;
  adRegion?(): 'US' | 'excluded' | 'unknown';
  prepareRegion?(updated: () => void): void;
  resetRegion?(): void;
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
  bannerSafe?(): boolean;
  bannerBlocker?(): string | null;
  consentScreenBlocker?(): string | null;
  mode?(): NativeAdsMode;
  diagnostic?(value: ReturnType<NativeAdsController['getDiagnostics']>): void;
}

type InterstitialTrigger = 'manual-save' | 'setup-assist' | 'development-test';
export type NativeAdTestCommand = 'banner' | 'hide-banner' | 'automatic' | 'interstitial';
type SaveTicket = Readonly<{ userId: string; generation: number; activity: number; trigger: InterstitialTrigger }>;
export type PostSaveAdResult = 'house' | 'suppressed' | 'requested';
export type NativeConsentStatus = 'idle' | 'pending' | 'unverified' | 'unavailable' | 'error';
export type NativeAdPermission = 'allowed' | 'disallowed' | 'unknown';
type AdRegion = 'US' | 'excluded' | 'unknown';

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
  private bannerDisableUncertain = false;
  private pendingSave: SaveTicket | null = null;
  private requesting = false;
  private house = { bannerUser: null as string | null, interstitialUser: null as string | null, nativeBannerUser: null as string | null };
  private developmentBannerHidden = false;
  private houseListeners = new Set<() => void>();
  private consentStatus: NativeConsentStatus = 'idle';
  private consentResponse: unknown;
  private trackingResponse: unknown;
  private consentAttempt: { bridge: MedianAdmobBridge; generation: number } | null = null;
  private consentRequest: Promise<NativeConsentStatus> | null = null;
  private bannerDispatches = 0;
  private interstitialDispatches = 0;
  private lastInterstitialTrigger: InterstitialTrigger | null = null;
  private lastInterstitialRequestDispatched = false;
  private lastInterstitialSuppression: string | null = null;
  private lastScreenInitializationBlockers: string[] = [];
  private diagnosticListeners = new Set<(value: ReturnType<NativeAdsController['getDiagnostics']>) => void>();

  constructor(private readonly deps: NativeAdsDependencies) {}

  getHouseAds = () => this.house;

  subscribeHouseAds = (listener: () => void) => {
    this.houseListeners.add(listener);
    return () => { this.houseListeners.delete(listener); };
  };

  closeHouseInterstitial = () => { this.updateHouseAds(this.house.bannerUser, null); this.refresh(); };

  private updateHouseAds(bannerUser: string | null, interstitialUser: string | null, nativeBannerUser: string | null = null) {
    if (bannerUser === this.house.bannerUser && interstitialUser === this.house.interstitialUser && nativeBannerUser === this.house.nativeBannerUser) return;
    this.house = { bannerUser, interstitialUser, nativeBannerUser };
    this.houseListeners.forEach(listener => listener());
  }

  setUser(userId: string | null) {
    // Auth changes can replace a session without changing its user ID.
    this.deps.resetDevice?.();
    if (userId !== this.userId) {
      this.updateHouseAds(null, null);
      this.deps.resetRegion?.();
      this.generation++;
      this.developmentBannerHidden = false;
      this.pendingSave = null;
      this.consentStatus = 'idle';
      this.consentResponse = undefined;
      this.trackingResponse = undefined;
      this.consentAttempt = null;
      this.bannerDispatches = 0;
      this.interstitialDispatches = 0;
      this.lastInterstitialTrigger = null;
      this.lastInterstitialRequestDispatched = false;
      this.lastInterstitialSuppression = null;
      this.lastScreenInitializationBlockers = [];
      this.hideBanner();
      this.userId = userId;
    }
    this.refresh();
  }

  setForeground(visible: boolean) {
    if (!visible) { this.noteActivity(); this.deps.resetDevice?.(); this.deps.resetRegion?.(); }
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
    this.closeHouseInterstitial();
    this.noteActivity();
    this.refresh();
    return () => {
      if (this.placement !== placement) return;
      this.placement = null;
      this.closeHouseInterstitial();
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
      // The stock consent check is independent of ad eligibility and display.
      return !!this.userId && this.platform() !== null && this.foreground &&
        typeof this.deps.bridge()?.request?.consent === 'function';
    } catch { return false; }
  }

  /** Native diagnostics only; never persisted or interpreted as a personalization choice. */
  getConsentStatus() { return { status: this.consentStatus, response: this.consentResponse, trackingResponse: this.trackingResponse }; }

  usesConfirmedNativeBannerExperience(userId: string | null): boolean {
    try {
      // The owner visually confirmed a Google Test Ad in this exact approved
      // Android phone session. This is rollout policy, not a native impression
      // callback: a dispatched command on another device/session is insufficient.
      return userId === NATIVE_ADS_ROLLOUT_USER_ID && this.userId === userId &&
        this.platform() === 'android' && this.deps.deviceStatus?.() === 'registered-phone-session' &&
        this.allowed() && !!this.banner && this.banner === this.deps.bridge() &&
        this.placement?.userId === userId && ['home', 'schedule', 'saved'].includes(this.placement.view);
    } catch { return false; }
  }

  canViewDiagnostics(userId: string | null) {
    return ['test', 'android-test'].includes(this.deps.mode?.() ?? 'test') &&
      userId === NATIVE_ADS_ROLLOUT_USER_ID && this.userId === userId;
  }

  subscribeDiagnostics(listener: (value: ReturnType<NativeAdsController['getDiagnostics']>) => void): () => void {
    this.diagnosticListeners.add(listener);
    listener(this.getDiagnostics());
    return () => { this.diagnosticListeners.delete(listener); };
  }

  /** Command diagnostics are not a native impression or personalization callback. */
  getDiagnostics() {
    const bridge = this.deps.bridge();
    const enabled = !this.deps.houseOnly && this.deps.enabled(this.userId);
    const eligible = !!this.userId && this.deps.eligible(this.userId);
    const platform = this.platform();
    const bridgeAvailable = typeof bridge?.banner?.enable === 'function' && typeof bridge?.banner?.disable === 'function';
    const consentBridgeAvailable = typeof bridge?.request?.consent === 'function';
    const permission = this.nativeAdPermission(bridge);
    const region = this.deps.adRegion?.() ?? 'unknown';
    const device = this.deps.deviceStatus?.() ?? 'not-configured';
    const deviceAllowed = this.deps.deviceAllowed?.(platform) ?? true;
    const initializationBlockers = this.automaticConsentBlockers();
    const consentCompleted = this.consentStatus === 'unverified' &&
      this.consentAttempt?.bridge === bridge && this.consentAttempt?.generation === this.generation;
    const consentInitialization = this.consentStatus === 'pending' ? 'consent-pending' : consentCompleted ? 'consent-completed' :
      ['error', 'unavailable'].includes(this.consentStatus) ? 'consent-failed' :
        this.userId ? 'waiting-for-prerequisites' : 'not-started';
    const deviceInitialization = device === 'pending' ? 'authorization-pending' : deviceAllowed ? 'authorized' :
      device !== 'idle' ? 'authorization-failed' : this.userId ? 'waiting-for-prerequisites' : 'not-started';
    const deviceWaitingFor = device === 'idle' ? [
      ...initializationBlockers,
      ...(!consentCompleted ? [`native-consent-${this.consentStatus}`] : []),
      ...(this.deps.nativeAdPermission && permission !== 'allowed' ? [`native-ad-permission-${permission}`] : []),
    ] : [];
    const bannerBlockers = [
      ...(!enabled ? [this.deps.houseOnly ? 'house-only-mode' : 'advertising-disabled-for-account'] : []),
      ...(this.deps.nativeAdPermission && permission !== 'allowed' ? [`native-ad-permission-${permission}`] : []),
      ...(this.deps.adRegion && region !== 'US' ? [`ad-region-${region}`] : []),
      ...(this.developmentBannerHidden ? ['development-banner-hidden'] : []),
      ...(this.bannerDisableUncertain ? ['native-banner-disable-unconfirmed'] : []),
      ...(!eligible ? ['membership-not-verified-rookie'] : []),
      ...(!platform ? ['not-median-android-or-ios'] : []),
      ...(!bridgeAvailable ? ['banner-bridge-unavailable'] : []),
      ...(!consentBridgeAvailable ? ['consent-bridge-unavailable'] : []),
      ...(!this.foreground ? ['not-foreground'] : []),
      ...(!this.routeSupported ? ['unsupported-route'] : []),
      ...(this.suspensions.size ? ['overlay-open'] : []),
      ...(!(this.deps.bannerSafe?.() ?? true) ? [this.deps.bannerBlocker?.() ?? 'banner-space-or-input-unsafe'] : []),
      ...(this.placement?.userId !== this.userId || !BANNER_VIEWS.includes(this.placement?.view)
        ? ['not-banner-placement'] : []),
      ...(this.consentStatus !== 'unverified' ? [`native-consent-${this.consentStatus}`] : []),
      ...(!deviceAllowed ? [`device-${device}`] : []),
    ];
    return {
      rolloutAccount: this.userId === NATIVE_ADS_ROLLOUT_USER_ID,
      mode: this.deps.mode?.() ?? 'test',
      eligible, enabled, platform, bridgeAvailable, consentBridgeAvailable,
      interstitialBridgeAvailable: typeof bridge?.showInterstitialIfReady === 'function',
      device, deviceAllowed,
      consentInitialization, deviceInitialization, initializationBlockers, deviceWaitingFor,
      lastScreenInitializationBlockers: [...this.lastScreenInitializationBlockers],
      nativeRequestState: this.bannerDispatches || this.interstitialDispatches ? 'native-request-dispatched' : 'not-dispatched',
      foreground: this.foreground,
      routeSupported: this.routeSupported,
      placement: this.placement?.view ?? 'none',
      overlayOpen: this.suspensions.size > 0,
      bannerBlockers,
      consent: this.consentStatus,
      consentRequestCompleted: this.consentStatus === 'unverified',
      advertisingPermission: permission,
      permissionEnforcement: this.deps.nativeAdPermission ? 'native-permission-reader' : 'median-native-sdk',
      advertisingRegion: region,
      bannerCommandDispatched: this.bannerDispatches > 0,
      interstitialCommandDispatched: this.interstitialDispatches > 0,
      bannerCommandDispatches: this.bannerDispatches,
      interstitialCommandDispatches: this.interstitialDispatches,
      lastInterstitialTrigger: this.lastInterstitialTrigger,
      lastInterstitialRequestDispatched: this.lastInterstitialRequestDispatched,
      lastInterstitialSuppression: this.lastInterstitialSuppression,
      interstitialCooldownRemainingMs: this.interstitialCooldown().remainingMs,
      adDisplayed: 'unknown',
    };
  }

  private diagnose() {
    let value: ReturnType<NativeAdsController['getDiagnostics']>;
    try { value = this.getDiagnostics(); } catch { return; }
    try { this.deps.diagnostic?.(value); } catch { /* Diagnostics cannot affect advertising behavior. */ }
    for (const listener of Array.from(this.diagnosticListeners)) {
      try { listener(value); } catch { /* One observer cannot interrupt other observers or ads. */ }
    }
  }

  /** Run the stock consent check without treating its result as permission to load ads. */
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
    this.diagnose();
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

  private nativeAdPermission(bridge = this.deps.bridge()): NativeAdPermission {
    if (!bridge) return 'unknown';
    try {
      const value = this.deps.nativeAdPermission?.(bridge);
      return value === 'allowed' || value === 'disallowed' ? value : 'unknown';
    } catch { return 'unknown'; }
  }

  private permissionAllowsCommands() {
    // The documented stock bridge has no UMP canRequestAds getter. Do not invent
    // one or equate a completed form with permission. The native SDK enforces
    // consent when loading/serving. Honor a real permission reader if supplied.
    return !this.deps.nativeAdPermission || this.nativeAdPermission() === 'allowed';
  }

  private regionAllowsCommands() { return !this.deps.adRegion || this.deps.adRegion() === 'US'; }

  private automaticConsentBlockers(): string[] {
    const screen = this.deps.consentScreenBlocker ? this.deps.consentScreenBlocker() :
      this.deps.bannerSafe?.() === false ? 'banner-space-or-input-unsafe' : null;
    return [
      ...(!this.userId ? ['not-authenticated'] : []),
      ...(this.deps.houseOnly || !this.deps.enabled(this.userId) ? ['advertising-disabled-for-account'] : []),
      ...(!this.userId || !this.deps.eligible(this.userId) ? ['membership-not-verified-rookie'] : []),
      ...(!this.platform() ? ['not-median-android-or-ios'] : []),
      ...(typeof this.deps.bridge()?.request?.consent !== 'function' ? ['consent-bridge-unavailable'] : []),
      ...(!this.foreground ? ['not-foreground'] : []),
      ...(!this.routeSupported ? ['unsupported-route'] : []),
      ...(this.suspensions.size ? ['overlay-open'] : []),
      ...(this.placement?.userId !== this.userId || !BANNER_VIEWS.includes(this.placement?.view) ? ['not-initialization-placement'] : []),
      ...(!this.regionAllowsCommands() ? [`ad-region-${this.deps.adRegion?.() ?? 'unknown'}`] : []),
      ...(screen ? [screen] : []),
    ];
  }

  private allowed() {
    return !!this.userId && this.deps.enabled(this.userId) && this.platform() !== null && this.foreground &&
      (this.deps.deviceAllowed?.(this.platform()) ?? true) &&
      this.regionAllowsCommands() && this.permissionAllowsCommands() &&
      this.routeSupported && this.suspensions.size === 0 && this.consentStatus === 'unverified' &&
      this.consentAttempt?.bridge === this.deps.bridge() && this.consentAttempt.generation === this.generation &&
      this.deps.eligible(this.userId);
  }

  private hideBanner(available?: MedianAdmobBridge) {
    const bridge = this.banner ?? available;
    this.banner = null;
    if (this.deps.houseOnly || !bridge || bridge === this.disabledBanner) return;
    try {
      bridge.banner?.disable?.();
      this.disabledBanner = bridge;
      this.bannerDisableUncertain = false;
    } catch { this.bannerDisableUncertain = true; /* Retry without stacking a house banner. */ }
  }

  refresh() {
    if (this.deps.houseOnly) {
      const eligible = !!this.userId && this.foreground && this.routeSupported && this.deps.eligible(this.userId);
      const banner = eligible && !this.house.interstitialUser && this.suspensions.size === 0 &&
        this.placement?.userId === this.userId && BANNER_VIEWS.includes(this.placement.view) &&
        (this.deps.bannerSafe?.() ?? true);
      this.updateHouseAds(banner ? this.userId : null, eligible ? this.house.interstitialUser : null);
      this.diagnose();
      return;
    }
    try {
      const bridge = this.deps.bridge();
      const eligible = !!bridge && !!this.userId && this.deps.enabled(this.userId) && this.deps.eligible(this.userId) &&
        this.platform() !== null && this.foreground && this.routeSupported && this.suspensions.size === 0;
      if (eligible && this.deps.adRegion) this.deps.prepareRegion?.(() => this.refresh());
      const initializationBlockers = this.automaticConsentBlockers();
      // Preserve the last ordinary-screen observation when Settings itself
      // pauses initialization, rather than masking it with its own overlay.
      if (!this.suspensions.size && !initializationBlockers.includes('visible-overlay-or-scan')) {
        this.lastScreenInitializationBlockers = initializationBlockers;
      }
      // Run UMP at an eligible, non-editing screen, before either native format.
      // Once per account/bridge attempt; Settings may explicitly retry errors or
      // re-request the flow. Do not loop when a native form cannot be displayed.
      if (initializationBlockers.length === 0 && this.canRequestConsent() &&
          (!this.consentAttempt || this.consentAttempt.bridge !== bridge || this.consentAttempt.generation !== this.generation)) {
        void this.requestConsent();
      }
      if (eligible && this.regionAllowsCommands() && this.permissionAllowsCommands() &&
          this.consentStatus === 'unverified') {
        this.deps.prepareDevice?.(this.platform(), () => this.refresh());
      }
      const show = !this.developmentBannerHidden && !this.house.interstitialUser && this.allowed() && this.placement?.userId === this.userId &&
        (this.deps.bannerSafe?.() ?? true) && BANNER_VIEWS.includes(this.placement.view) &&
        typeof bridge?.banner?.enable === 'function' && typeof bridge?.banner?.disable === 'function';
      // Also clear a banner retained by the native shell across a page reload.
      if (!show || this.banner !== bridge) this.hideBanner(this.platform() !== null ? bridge : undefined);
      if (show && !this.banner) {
        // Reserve the native banner lane before calling the bridge. No native
        // display/no-fill callback exists; this selection is not an impression.
        this.updateHouseAds(null, null, this.userId);
        this.banner = bridge;
        this.disabledBanner = null;
        bridge.banner.enable();
        this.bannerDispatches++;
      }
    } catch { this.hideBanner(); }
    const houseEligible = !!this.userId && this.foreground && this.routeSupported && this.deps.eligible(this.userId);
    const houseBanner = houseEligible && !this.banner && !this.bannerDisableUncertain && !this.house.interstitialUser && this.suspensions.size === 0 &&
      this.placement?.userId === this.userId && BANNER_VIEWS.includes(this.placement.view) && (this.deps.bannerSafe?.() ?? true);
    this.updateHouseAds(houseBanner ? this.userId : null, houseEligible ? this.house.interstitialUser : null,
      this.banner || this.bannerDisableUncertain ? this.userId : null);
    this.diagnose();
  }

  /** DEV console only: same device/consent/membership guards and shared cooldown. */
  runDevelopmentTest(command: NativeAdTestCommand) {
    if (!import.meta.env.DEV || this.deps.mode?.() !== 'test' || this.deps.houseOnly) {
      return { result: 'suppressed', reason: 'development-test-mode-required', diagnostics: this.getDiagnostics() };
    }
    if (command === 'interstitial') {
      if (this.deps.bannerSafe?.() === false) {
        return { result: 'suppressed', reason: 'banner-space-or-input-unsafe', diagnostics: this.getDiagnostics() };
      }
      const result = this.completeInterstitial(this.beginInterstitial(this.userId, 'development-test'), 'development-test');
      return { result, reason: this.lastInterstitialSuppression, diagnostics: this.getDiagnostics() };
    }
    this.developmentBannerHidden = command === 'hide-banner';
    const before = this.bannerDispatches;
    this.refresh();
    return { result: this.bannerDispatches > before ? 'requested' : command === 'hide-banner' ? 'hidden' : 'unchanged',
      diagnostics: this.getDiagnostics() };
  }

  beginManualSave(userId: string | null): SaveTicket | null {
    return this.beginInterstitial(userId, 'manual-save');
  }

  /** Called only when the user dismisses a successfully completed Assist result. */
  beginSetupAssistDismissal(userId: string | null): SaveTicket | null {
    return this.beginInterstitial(userId, 'setup-assist');
  }

  private beginInterstitial(userId: string | null, trigger: InterstitialTrigger): SaveTicket | null {
    this.pendingSave = userId && userId === this.userId
      ? { userId, generation: this.generation, activity: this.activity, trigger } : null;
    return this.pendingSave;
  }

  /** Called after the successful save dialog has been removed by React. */
  completeManualSave(ticket: SaveTicket | null, outcome: {
    persisted: boolean; queued: boolean; editing: boolean;
  }): PostSaveAdResult {
    return this.completeInterstitial(ticket, 'manual-save', outcome.queued ? 'offline-save-queued' :
      !outcome.persisted ? 'save-failed-or-no-write' : outcome.editing ? 'editing-or-context-changed' : null);
  }

  completeSetupAssistDismissal(ticket: SaveTicket | null): PostSaveAdResult {
    return this.completeInterstitial(ticket, 'setup-assist');
  }

  private interstitialCooldown(): { remainingMs: number | null; reason: string | null } {
    if (!this.userId) return { remainingMs: 0, reason: null };
    try {
      const raw = this.deps.storage().getItem(`onlyfast_admob_interstitial_v1:${encodeURIComponent(this.userId)}`);
      const now = this.deps.now();
      if (!Number.isFinite(now) || now < 0) return { remainingMs: null, reason: 'cooldown-clock-invalid' };
      if (raw === null) return { remainingMs: 0, reason: null };
      const last = Number(raw);
      if (!raw.trim() || !Number.isFinite(last) || last < 0 || last > now) return { remainingMs: null, reason: 'cooldown-storage-invalid' };
      const remainingMs = Math.max(0, INTERSTITIAL_COOLDOWN_MS - (now - last));
      return { remainingMs, reason: remainingMs > 0 ? 'cooldown' : null };
    } catch { return { remainingMs: null, reason: 'cooldown-storage-unavailable' }; }
  }

  private completeInterstitial(ticket: SaveTicket | null, trigger: InterstitialTrigger,
    invalidOutcome: string | null = null): PostSaveAdResult {
    this.lastInterstitialTrigger = trigger;
    this.lastInterstitialRequestDispatched = false;
    this.lastInterstitialSuppression = null;
    const suppress = (reason: string, result: PostSaveAdResult = 'suppressed') => {
      this.lastInterstitialSuppression = reason;
      return result;
    };
    // A reentrant call must not release the outer dispatch lock.
    let ownsRequest = false;
    try {
      if (!ticket || ticket !== this.pendingSave || ticket.trigger !== trigger) return suppress('invalid-or-consumed-opportunity');
      this.pendingSave = null;
      if (invalidOutcome) return suppress(invalidOutcome);
      if (ticket.userId !== this.userId || ticket.generation !== this.generation) return suppress('account-changed');
      if (ticket.activity !== this.activity) return suppress('activity-changed');
      if (!this.foreground) return suppress('not-foreground');
      if (!this.routeSupported) return suppress('unsupported-route');
      if (this.suspensions.size > 0) return suppress('overlay-open');
      if (this.requesting) return suppress('request-in-progress');
      if (!this.deps.eligible(ticket.userId)) return suppress('membership-not-verified-rookie');
      const claimCooldown = () => {
        const cooldown = this.interstitialCooldown();
        if (cooldown.reason) return cooldown.reason;
        this.requesting = true;
        ownsRequest = true;
        const key = `onlyfast_admob_interstitial_v1:${encodeURIComponent(ticket.userId)}`;
        this.deps.storage().setItem(key, String(this.deps.now()));
        return null;
      };
      const houseFallback = (reason: string) => {
        if (trigger !== 'manual-save') return suppress(reason);
        const blocked = claimCooldown();
        if (blocked) return suppress(blocked);
        this.updateHouseAds(null, ticket.userId);
        return suppress(reason, 'house');
      };
      if (this.deps.houseOnly) {
        if (this.house.interstitialUser) return suppress('house-interstitial-open');
        if (this.placement?.userId !== ticket.userId || this.placement.view !== 'setup') return suppress('not-setup-placement');
        if (this.deps.houseInterstitialSafe?.() === false) return suppress('house-interstitial-unsafe');
        const blocked = claimCooldown();
        if (blocked) return suppress(blocked);
        this.updateHouseAds(null, ticket.userId);
        return 'house';
      }
      if (!this.deps.enabled(this.userId)) return houseFallback('advertising-disabled-for-account');
      if (this.platform() === null) return houseFallback('not-median-android-or-ios');
      const bridge = this.deps.bridge();
      if (typeof bridge?.showInterstitialIfReady !== 'function') return houseFallback('interstitial-bridge-unavailable');
      if (this.consentRequest || this.consentStatus === 'pending') return suppress('native-consent-pending');
      const permission = this.nativeAdPermission(bridge);
      if (!this.permissionAllowsCommands()) return houseFallback(`native-ad-permission-${permission}`);
      const region = this.deps.adRegion?.() ?? 'unknown';
      if (!this.regionAllowsCommands()) return houseFallback(`ad-region-${region}`);
      if (!(this.deps.deviceAllowed?.(this.platform()) ?? true)) return suppress(`device-${this.deps.deviceStatus?.() ?? 'not-authorized'}`);
      if (this.consentStatus !== 'unverified') return suppress(`native-consent-${this.consentStatus}`);
      if (!this.allowed()) return suppress('native-consent-or-authorization-changed');
      if (ticket.userId !== this.userId || !this.allowed()) return suppress('authorization-changed');
      const blocked = claimCooldown();
      if (blocked) return suppress(blocked);
      bridge.showInterstitialIfReady();
      this.interstitialDispatches++;
      this.lastInterstitialRequestDispatched = true;
      this.lastInterstitialSuppression = null;
      return 'requested';
    } catch {
      // A thrown bridge call may already have dispatched. Never stack a house modal.
      return suppress(ownsRequest ? 'storage-write-or-native-command-error' : 'interstitial-check-error');
    } finally { if (ownsRequest) this.requesting = false; this.diagnose(); }
  }

  stop() {
    this.setForeground(false);
    this.setUser(null);
    this.placement = null;
  }
}

type NativeAdsWindow = Window & { median?: DeviceHost & { admob?: MedianAdmobBridge }; median_library_ready?: () => void };

const testDevice = new NativeAdTestDevice(registeredDeviceHashes,
  registeredPhoneSessionHash ? () => verifyNativeAdPhoneSession(supabase.auth, NATIVE_ADS_ROLLOUT_USER_ID, registeredPhoneSessionHash) : undefined);
let lastDiagnostic = '';
const currentAdsMode = () => resolveNativeAdsMode({
  enabled: import.meta.env.VITE_MEDIAN_ADMOB_ENABLED,
  mode: import.meta.env.VITE_MEDIAN_ADMOB_MODE,
  productionBuild: import.meta.env.PROD === true,
  deployment: import.meta.env.ONLYFAST_ADS_DEPLOYMENT,
  origin: typeof window !== 'undefined' ? window.location?.origin ?? '' : '',
});

const AD_REGION_TTL_MS = 60_000;
let regionCheck: AbortController | undefined;
let regionExpiryTimer: ReturnType<typeof setTimeout> | undefined;
let regionExpiresAt = 0;
let resolvedAdRegion: AdRegion = 'unknown';

function resetAdRegion() {
  regionCheck?.abort();
  regionCheck = undefined;
  clearTimeout(regionExpiryTimer);
  regionExpiresAt = 0;
  resolvedAdRegion = 'unknown';
}

function prepareAdRegion(updated: () => void) {
  if (regionCheck || regionExpiresAt > Date.now()) return;
  const controller = new AbortController();
  regionCheck = controller;
  const timeout = setTimeout(() => controller.abort(), 5000);
  void (async () => {
    let region: AdRegion = 'unknown';
    try {
      const response = await fetch('/api/admob-region', {
        signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
      const value = response.ok ? (await response.json())?.region : undefined;
      if (value === 'US' || value === 'excluded') region = value;
    } catch { /* Unknown region does not authorize advertising. */ }
    finally { clearTimeout(timeout); }
    if (regionCheck !== controller) return;
    regionCheck = undefined;
    resolvedAdRegion = region;
    regionExpiresAt = Date.now() + AD_REGION_TTL_MS;
    if (region === 'US') regionExpiryTimer = setTimeout(updated, AD_REGION_TTL_MS);
    updated();
  })();
}

export const nativeAds = new NativeAdsController({
  // Stock Median owns UMP enforcement; a completed request is not permission.
  // Keep the existing US release policy. DEV tests use registered Google test
  // devices and native privacy prompts without pretending to know their region.
  adRegion: import.meta.env.DEV ? undefined : () => regionExpiresAt > Date.now() ? resolvedAdRegion : 'unknown',
  prepareRegion: prepareAdRegion,
  resetRegion: resetAdRegion,
  mode: currentAdsMode,
  enabled: userId => nativeAdsAccountEnabled(currentAdsMode(), userId, NATIVE_ADS_ROLLOUT_USER_ID,
    isMedianUserAgent(navigator.userAgent) ? nativePlatform(navigator.userAgent, navigator.maxTouchPoints) : null),
  // Production keeps trusted Rookie membership + native consent enforcement,
  // but does not turn advertising identifiers or test allowlists into ad consent.
  deviceAllowed: platform => currentAdsMode() === 'production' ||
    testDevice.allowed(platform, (window as NativeAdsWindow).median),
  prepareDevice: (platform, updated) => {
    if (['test', 'android-test'].includes(currentAdsMode())) testDevice.prepare(platform, (window as NativeAdsWindow).median, updated);
  },
  deviceStatus: () => currentAdsMode() === 'production' ? 'production-device-check-not-required' : testDevice.getStatus(),
  resetDevice: () => testDevice.reset(),
  diagnostic: value => {
    if (!['test', 'android-test'].includes(currentAdsMode()) || !value.rolloutAccount || import.meta.env.VITE_MEDIAN_ADMOB_DIAGNOSTICS !== 'true') return;
    const current = JSON.stringify(value);
    if (current !== lastDiagnostic) console.debug('[OnlyFast AdMob]', value);
    lastDiagnostic = current;
  },
  maxTouchPoints: () => navigator.maxTouchPoints,
  userAgent: () => navigator.userAgent,
  bridge: () => (window as NativeAdsWindow).median?.admob,
  eligible: userId => {
    // A test-tier selector may reduce displayed access, but cannot authorize
    // native ads against an underlying paid/admin/promotional exemption.
    const actual = getTrustedAdvertisingMembership(userId, Date.now(), false);
    return actual?.membership_tier === 'rookie' && !actual.has_admin_full_access &&
      !actual.promo_access_level && shouldShowAds({ id: userId });
  },
  storage: () => window.localStorage,
  now: Date.now,
  bannerSafe: () => typeof document !== 'undefined' && nativeBannerIsSafe(window, document),
  bannerBlocker: () => typeof document === 'undefined' ? 'authenticated-layout-unavailable' : nativeBannerBlocker(window, document),
  consentScreenBlocker: () => typeof document === 'undefined' ? 'authenticated-layout-unavailable' : nativeConsentScreenBlocker(window, document),
  houseInterstitialSafe: () => typeof document !== 'undefined' && houseInterstitialIsSafe(window, document),
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
