import React, { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT } from '@/lib/ads';

// ---------------------------------------------------------------------------
// AdsenseAd — reusable responsive Google AdSense display unit.
//
// Safe by design:
//   - Does NOT inject the AdSense script itself (the global script lives in
//     index.html). It only pushes a request once mounted.
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
    try {
      // Safely request an ad fill. If adsbygoogle isn't present (blocked /
      // not loaded), initialize it as an array so the push is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      /* AdSense blocked or unavailable — fail silently, never crash the app. */
    }
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
