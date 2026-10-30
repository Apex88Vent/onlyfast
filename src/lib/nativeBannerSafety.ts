import { isMedianUserAgent } from './nativeEnvironment.ts';

type KeyboardBridge = {
  info?: () => Promise<unknown>;
  listen?: (callback: ((value: unknown) => void) | '') => void;
};
type BannerWindow = Window & { median?: { keyboard?: KeyboardBridge } };
type KeyboardState = { visible?: boolean; height: number; width: number };
const keyboardStates = new WeakMap<Window, KeyboardState>();

function visibleBlocker(host: Window, element: Element) {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]') || !element.getClientRects().length) return false;
  const style = host.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.pointerEvents !== 'none';
}

/** Median places the native banner BELOW the WebView, not over HTML content. */
export function nativeBannerIsSafe(host: Window, page: Document): boolean {
  if (!page.querySelector('[data-native-banner-layout]')) return false;
  const blockers = page.querySelectorAll('[role="dialog"], .fixed.inset-0, [data-native-banner-unsafe="true"]');
  if (Array.from(blockers).some(element => visibleBlocker(host, element))) return false;
  const active = page.activeElement as HTMLElement | null;
  const viewport = host.visualViewport;
  const height = viewport?.height ?? host.innerHeight;
  if (height < 320) return false;
  const keyboard = keyboardStates.get(host);
  if (keyboard?.visible === true) return false;
  // Median's explicit hidden event wins over retained input focus / stale iOS
  // viewport geometry after tapping Done. This does not alter interstitials.
  if (keyboard?.visible === false) return true;
  // An overlay keyboard can shrink the visual viewport without resizing layout.
  if (viewport && host.innerHeight - viewport.height - viewport.offsetTop > 150) return false;
  if (keyboard && keyboard.width === host.innerWidth && keyboard.height - height > 150) return false;
  const editing = active?.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select') || active?.isContentEditable;
  // Without an installed monitor/usable geometry, fail conservatively. Focus
  // itself is not a permanent keyboard-visible signal on supported packages.
  if (editing && !keyboard) return false;
  return true;
}

/** Banner-only refreshes; never suspend, re-ticket, or dispatch interstitials. */
export function watchNativeBannerSafety(controller: { refresh(): void }, host: Window, page: Document): () => void {
  if (!isMedianUserAgent(host.navigator.userAgent)) return () => {};
  let frame: number | null = null;
  let active = true;
  let subscribed: KeyboardBridge | undefined;
  let nativeRevision = 0;
  const state: KeyboardState = { height: host.visualViewport?.height ?? host.innerHeight, width: host.innerWidth };
  keyboardStates.set(host, state);
  const keyboardUpdate = (value: unknown) => {
    if (!active || !value || typeof value !== 'object' || typeof (value as { visible?: unknown }).visible !== 'boolean') return;
    nativeRevision++;
    state.visible = (value as { visible: boolean }).visible;
    refresh();
  };
  const prepareKeyboard = () => {
    const bridge = (host as BannerWindow).median?.keyboard;
    if (!bridge || bridge === subscribed || typeof bridge.listen !== 'function') return;
    try {
      subscribed?.listen?.('');
      subscribed = bridge;
      bridge.listen(value => { if (subscribed === bridge) keyboardUpdate(value); });
      const revision = nativeRevision;
      // Documented Median APIs: https://docs.median.co/docs/keyboard-state-tracking
      const info = bridge.info?.();
      if (info && typeof info.then === 'function') void info.then(value => {
        if (active && bridge === subscribed && revision === nativeRevision) keyboardUpdate(value);
      }).catch(() => {});
    } catch { subscribed = undefined; /* Retain geometry fallback when an older package lacks this API. */ }
  };
  const refresh = () => {
    if (frame !== null) return;
    frame = host.requestAnimationFrame(() => {
      frame = null;
      const height = host.visualViewport?.height ?? host.innerHeight;
      if (state.width !== host.innerWidth) { state.width = host.innerWidth; state.height = height; }
      else state.height = Math.max(state.height, height);
      prepareKeyboard(); controller.refresh();
    });
  };
  const observer = new MutationObserver(refresh);
  observer.observe(page.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['role', 'aria-modal', 'hidden', 'aria-hidden', 'inert', 'class', 'style', 'data-native-banner-layout', 'data-native-banner-unsafe'],
  });
  page.addEventListener('focusin', refresh);
  page.addEventListener('focusout', refresh);
  host.addEventListener('resize', refresh);
  host.visualViewport?.addEventListener('resize', refresh);
  host.visualViewport?.addEventListener('scroll', refresh);
  refresh();
  return () => {
    active = false;
    if (keyboardStates.get(host) === state) keyboardStates.delete(host);
    try { subscribed?.listen?.(''); } catch { /* Native shell may already be unloading. */ }
    observer.disconnect();
    if (frame !== null) host.cancelAnimationFrame(frame);
    page.removeEventListener('focusin', refresh);
    page.removeEventListener('focusout', refresh);
    host.removeEventListener('resize', refresh);
    host.visualViewport?.removeEventListener('resize', refresh);
    host.visualViewport?.removeEventListener('scroll', refresh);
  };
}
