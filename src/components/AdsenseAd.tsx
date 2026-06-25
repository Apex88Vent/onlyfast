import React, { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT } from '@/lib/ads';

const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

const loadAdSenseScript = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-onlyfast-adsense="true"], script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
  );
  if (existing) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = ADSENSE_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.onlyfastAdsense = 'true';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
};

// ---------------------------------------------------------------------------
// AdsenseAd — reusable responsive Google AdSense display unit.
//
// Safe by design:
//   - Loads AdSense only when an ad slot mounts, keeping app startup free of
//     third-party ad script execution.
//   - Wrapped in try/catch so a blocked / unavailable / not-yet-loaded AdSense
//     can never crash the app.
//   - Reserves a small min-height so there is no jarring layout shift.
//
// Callers are responsible for ONLY rendering this for rookie users
// (use shouldShowAds(user) from "@/lib/ads").
// ---------------------------------------------------------------------------

interface AdsenseAdProps {
  /** The AdSense ad slot id (data-ad-slot). Use values from AD_SLOTS. */
  slot: string;
  /** Optional label shown above the ad for transparency. */
  label?: string;
  /** Extra classes for the outer container. */
  className?: string;
  /** Optional fixed format (defaults to responsive auto). */
  format?: string;
}

const AdsenseAd: React.FC<AdsenseAdProps> = ({
  slot,
  label = 'Advertisement',
  className = '',
  format = 'auto',
}) => {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    let cancelled = false;
    loadAdSenseScript().then(() => {
      if (cancelled) return;
      try {
      // Safely request an ad fill. If adsbygoogle isn't present (blocked /
      // not loaded), initialize it as an array so the push is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch {
      /* AdSense blocked or unavailable — fail silently, never crash the app. */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`w-full rounded-2xl border border-[#E5E7EB] bg-white p-3 ${className}`}
      aria-label="Sponsored advertisement"
    >
      <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] mb-1.5 text-center">
        {label}
      </div>
      <div className="min-h-[90px] flex items-center justify-center overflow-hidden rounded-lg bg-[#FAFAFA]">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

export default AdsenseAd;
