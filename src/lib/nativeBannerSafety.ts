import { isMedianUserAgent } from './nativeEnvironment.ts';

/** Median places the native banner BELOW the WebView, not over HTML content. */
export function nativeBannerIsSafe(host: Window, page: Document): boolean {
  if (!page.querySelector('[data-native-banner-layout]')) return false;
  if (page.querySelector('[role="dialog"]:not([hidden]), .fixed.inset-0, [data-native-banner-unsafe="true"]')) return false;
  const active = page.activeElement as HTMLElement | null;
  if (active?.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select') || active?.isContentEditable) return false;
  const viewport = host.visualViewport;
  if ((viewport?.height ?? host.innerHeight) < 320) return false;
  // An overlay keyboard can shrink the visual viewport without resizing layout.
  if (viewport && host.innerHeight - viewport.height - viewport.offsetTop > 150) return false;
  return true;
}

/** Banner-only refreshes; never suspend, re-ticket, or dispatch interstitials. */
export function watchNativeBannerSafety(controller: { refresh(): void }, host: Window, page: Document): () => void {
  if (!isMedianUserAgent(host.navigator.userAgent)) return () => {};
  let frame: number | null = null;
  const refresh = () => {
    if (frame !== null) return;
    frame = host.requestAnimationFrame(() => { frame = null; controller.refresh(); });
  };
  const observer = new MutationObserver(refresh);
  observer.observe(page.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['role', 'aria-modal', 'hidden', 'data-native-banner-layout', 'data-native-banner-unsafe'],
  });
  page.addEventListener('focusin', refresh);
  page.addEventListener('focusout', refresh);
  host.addEventListener('resize', refresh);
  host.visualViewport?.addEventListener('resize', refresh);
  host.visualViewport?.addEventListener('scroll', refresh);
  refresh();
  return () => {
    observer.disconnect();
    if (frame !== null) host.cancelAnimationFrame(frame);
    page.removeEventListener('focusin', refresh);
    page.removeEventListener('focusout', refresh);
    host.removeEventListener('resize', refresh);
    host.visualViewport?.removeEventListener('resize', refresh);
    host.visualViewport?.removeEventListener('scroll', refresh);
  };
}
