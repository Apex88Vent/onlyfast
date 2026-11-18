import { useEffect, useRef, useState } from 'react';
import { trackEvent, enterAnalyticsScreen } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analyticsController';

/** Observe existing content without changing advertising eligibility or display. */
export function useAnalyticsVisibility(event: AnalyticsEvent, screen?: string, placement?: string) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const viewed = useRef(false);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let restoreScreen: (() => void) | undefined;
    const observer = new IntersectionObserver(entries => {
      if (viewed.current || document.visibilityState !== 'visible' || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      viewed.current = true;
      if (screen) restoreScreen = enterAnalyticsScreen(screen);
      trackEvent(event, placement ? { placement } : {});
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => { observer.disconnect(); restoreScreen?.(); };
  }, [node, event, screen, placement]);
  return setNode;
}
