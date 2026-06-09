import React from 'react';
import AdsenseAd from './AdsenseAd';
import { AD_SLOTS } from '@/lib/ads';

// ---------------------------------------------------------------------------
// RookiePostSaveAdScreen — full-page, interstitial-style ad screen shown AFTER
// a rookie user successfully saves something (setup, timing result, schedule).
//
// NOTE ON ADSENSE POLICY: true forced/timed interstitials are restricted by
// AdSense policy in an app structure like this. This is therefore built as a
// safe INTERNAL full-page container that uses an approved AdSense *display*
// placement, plus an always-available "Continue" button so the user is never
// blocked. The caller only mounts this when:
//     - a save SUCCEEDED, and
//     - shouldShowAds(user) === true (rookie only)
//
// It never blocks the save, never shows on failure, never shows pre-login,
// and never shows for pro/team/admin/ambassador/comp accounts.
// ---------------------------------------------------------------------------

interface RookiePostSaveAdScreenProps {
  /** Called when the user dismisses the screen (Continue / close). */
  onContinue: () => void;
  /** Optional headline describing what was just saved. */
  title?: string;
  /** Optional supporting copy. */
  subtitle?: string;
}

const RookiePostSaveAdScreen: React.FC<RookiePostSaveAdScreenProps> = ({
  onContinue,
  title = 'Saved!',
  subtitle = 'Your changes are saved. Here\u2019s a quick word from our sponsors.',
}) => {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored message"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#1A1B23]">{title}</h3>
        <p className="text-sm text-[#6B7280] mt-1 mb-4">{subtitle}</p>

        {/* REPLACE_ME: post_save_full_page_ad slot — see AD_SLOTS in src/lib/ads.ts */}
        <AdsenseAd slot={AD_SLOTS.post_save_full_page_ad} className="mb-5" />

        <button
          onClick={onContinue}
          className="w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default RookiePostSaveAdScreen;
