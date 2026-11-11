import { isMedianUserAgent } from './nativeEnvironment.ts';

type KeyboardBridge = {
  info?: () => Promise<unknown>;
  listen?: (callback: ((value: unknown) => void) | '') => void;
};
type BannerWindow = Window & { median?: { keyboard?: KeyboardBridge } };
type KeyboardState = {
  visible?: boolean; height: number; width: number;
  check: 'not-started' | 'pending' | 'current' | 'unavailable' | 'error';
  staleVisibleCorrected: boolean;
};
const keyboardStates = new WeakMap<Window, KeyboardState>();

function visibleBlocker(host: Window, element: Element) {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]') || !element.getClientRects().length) return false;
  const style = host.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.pointerEvents !== 'none';
}

const overlaySelectors = '[role="dialog"], .fixed.inset-0, [data-native-banner-unsafe="true"]';

export function houseInterstitialIsSafe(host: Window, page: Document): boolean {
  return !Array.from(page.querySelectorAll(`${overlaySelectors}, [data-house-interstitial-unsafe]`))
    .some(element => visibleBlocker(host, element));
}

/** Median places the native banner BELOW the WebView, not over HTML content. */
function nativeScreenBlocker(host: Window, page: Document, banner: boolean): string | null {
  if (!page.querySelector('[data-native-banner-layout]')) return 'authenticated-layout-unavailable';
  const blockers = page.querySelectorAll(overlaySelectors);
  if (Array.from(blockers).some(element => visibleBlocker(host, element))) return 'visible-overlay-or-scan';
  const active = page.activeElement as HTMLElement | null;
  const viewport = host.visualViewport;
  const height = viewport?.height ?? host.innerHeight;
  if (banner && height < 320) return 'banner-viewport-too-small';
  const keyboard = keyboardStates.get(host);
  const editing = active?.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select') || active?.isContentEditable;
  // A hidden keyboard can leave an editor focused. Do not open a consent form
  // over active input, even though the existing banner policy permits Done.
  if (!banner && editing) return 'editing-input-focused';
  if (keyboard?.visible === true) return 'native-keyboard-visible';
  // Median's explicit hidden event wins over retained input focus / stale iOS
  // viewport geometry after tapping Done. This does not alter interstitials.
  if (keyboard?.visible === false) return null;
  // An overlay keyboard can shrink the visual viewport without resizing layout.
  if (viewport && host.innerHeight - viewport.height - viewport.offsetTop > 150) return 'keyboard-viewport-occluded';
  if (keyboard && keyboard.width === host.innerWidth && keyboard.height - height > 150) return 'keyboard-viewport-occluded';
  // Without an installed monitor/usable geometry, fail conservatively. Focus
  // itself is not a permanent keyboard-visible signal on supported packages.
  if (editing) return 'editing-input-focused';
  return null;
}

export const nativeBannerBlocker = (host: Window, page: Document) => nativeScreenBlocker(host, page, true);
// UMP is a native form, not a banner. Keep editing/overlay/onboarding safeguards
// without requiring banner-sized geometry before either format can initialize.
export const nativeConsentScreenBlocker = (host: Window, page: Document) => nativeScreenBlocker(host, page, false);
export const nativeBannerIsSafe = (host: Window, page: Document) => nativeBannerBlocker(host, page) === null;

export function nativeScreenDiagnostics(host: Window, page: Document) {
  const keyboard = keyboardStates.get(host);
  return {
    blocker: nativeConsentScreenBlocker(host, page),
    keyboardVisibility: keyboard?.visible === true ? 'visible' : keyboard?.visible === false ? 'hidden' : 'unknown',
    keyboardCheck: keyboard?.check ?? 'not-started',
    staleKeyboardVisibilityCorrected: keyboard?.staleVisibleCorrected ?? false,
  };
}

/** Banner-only refreshes; never suspend, re-ticket, or dispatch interstitials. */
export function watchNativeBannerSafety(controller: { refresh(): void }, host: Window, page: Document, includeWeb = false): () => void {
  const isMedian = isMedianUserAgent(host.navigator.userAgent);
  if (!isMedian && !includeWeb) return () => {};
  let frame: number | null = null;
  let active = true;
  let subscribed: KeyboardBridge | undefined;
  let nativeRevision = 0;
  let pendingInfo: KeyboardBridge | undefined;
  let recheckRequested = true;
  let lastScreen = '';
  const state: KeyboardState = { height: host.visualViewport?.height ?? host.innerHeight, width: host.innerWidth,
    check: 'not-started', staleVisibleCorrected: false };
  keyboardStates.set(host, state);
  const keyboardUpdate = (value: unknown, fromInfo = false) => {
    if (!active || !value || typeof value !== 'object' || typeof (value as { visible?: unknown }).visible !== 'boolean') return;
    nativeRevision++;
    const visible = (value as { visible: boolean }).visible;
    if (visible) state.staleVisibleCorrected = false;
    else if (fromInfo && state.visible === true) state.staleVisibleCorrected = true;
    state.visible = visible;
    state.check = 'current';
    refresh();
  };
  const prepareKeyboard = () => {
    if (!isMedian || page.visibilityState === 'hidden') return;
    const bridge = (host as BannerWindow).median?.keyboard;
    if (!bridge) { state.check = 'unavailable'; return; }
    try {
      if (bridge !== subscribed) {
        subscribed?.listen?.('');
        nativeRevision++;
        subscribed = bridge;
        bridge.listen?.(value => { if (subscribed === bridge) keyboardUpdate(value); });
        recheckRequested = true;
      }
      if (!recheckRequested || pendingInfo === bridge) return;
      recheckRequested = false;
      if (typeof bridge.info !== 'function') { state.check = 'unavailable'; return; }
      const revision = nativeRevision;
      // Documented Median APIs: https://docs.median.co/docs/keyboard-state-tracking
      const info = bridge.info();
      if (!info || typeof info.then !== 'function') { state.check = 'unavailable'; return; }
      pendingInfo = bridge;
      state.check = 'pending';
      void info.then(value => {
        if (!active || bridge !== subscribed || revision !== nativeRevision) return;
        if (!value || typeof value !== 'object' || typeof (value as { visible?: unknown }).visible !== 'boolean') {
          state.check = 'unavailable';
        } else keyboardUpdate(value, true);
      }, () => {
        if (active && bridge === subscribed && revision === nativeRevision) state.check = 'error';
      }).finally(() => {
        if (pendingInfo === bridge) pendingInfo = undefined;
        if (active) refresh();
      });
    } catch { state.check = 'error'; /* Never clear a visible state on a failed native read. */ }
  };
  const refresh = () => {
    if (frame !== null) return;
    frame = host.requestAnimationFrame(() => {
      frame = null;
      const height = host.visualViewport?.height ?? host.innerHeight;
      if (state.width !== host.innerWidth) { state.width = host.innerWidth; state.height = height; }
      else state.height = Math.max(state.height, height);
      // Semantic changes only: diagnostic text mutations must not form a
      // native-info -> React render -> native-info request loop.
      const signature = [!!page.querySelector('[data-native-banner-layout]'),
        page.querySelector('[data-house-ad-page]')?.getAttribute?.('data-house-ad-page'),
        nativeConsentScreenBlocker(host, page) === 'visible-overlay-or-scan',
        height, host.innerWidth].join('|');
      if (signature !== lastScreen) { lastScreen = signature; nativeRevision++; recheckRequested = true; }
      prepareKeyboard(); controller.refresh();
    });
  };
  const recheck = () => { nativeRevision++; recheckRequested = true; refresh(); };
  const observer = new MutationObserver(refresh);
  observer.observe(page.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['role', 'aria-modal', 'hidden', 'aria-hidden', 'inert', 'class', 'style', 'data-native-banner-layout', 'data-native-banner-unsafe', 'data-house-ad-page'],
  });
  page.addEventListener('focusin', refresh);
  page.addEventListener('focusout', recheck);
  page.addEventListener('visibilitychange', recheck);
  host.addEventListener('focus', recheck);
  host.addEventListener('pageshow', recheck);
  host.addEventListener('membership-updated', recheck);
  host.addEventListener('resize', recheck);
  host.visualViewport?.addEventListener('resize', recheck);
  host.visualViewport?.addEventListener('scroll', refresh);
  refresh();
  return () => {
    active = false;
    if (keyboardStates.get(host) === state) keyboardStates.delete(host);
    try { subscribed?.listen?.(''); } catch { /* Native shell may already be unloading. */ }
    observer.disconnect();
    if (frame !== null) host.cancelAnimationFrame(frame);
    page.removeEventListener('focusin', refresh);
    page.removeEventListener('focusout', recheck);
    page.removeEventListener('visibilitychange', recheck);
    host.removeEventListener('focus', recheck);
    host.removeEventListener('pageshow', recheck);
    host.removeEventListener('membership-updated', recheck);
    host.removeEventListener('resize', recheck);
    host.visualViewport?.removeEventListener('resize', recheck);
    host.visualViewport?.removeEventListener('scroll', refresh);
  };
}
