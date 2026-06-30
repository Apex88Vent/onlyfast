import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Gauge, Sparkles } from 'lucide-react';
import { shouldShowAds } from '@/lib/ads';
import { setPendingPlan } from '@/lib/membership';
import { hideExternalPayments, nativeUpgradeMessage } from '@/lib/paymentVisibility';

export type RookieAdPlacement =
  | 'home_middle'
  | 'home_bottom'
  | 'setup_dashboard_bottom'
  | 'setup_session_bottom'
  | 'parts_reference_bottom'
  | 'schedule_bottom'
  | 'timing_scan_bottom'
  | 'after_save_interstitial';

interface RookieAdSlotProps {
  placement: RookieAdPlacement;
  user?: User | null;
  className?: string;
  previewMode?: boolean;
  onContinue?: () => void;
}

const LOGO_SRC = '/onlyfast-logo.png';

const placementCopy: Record<RookieAdPlacement, { eyebrow: string; title: string; body: string; benefits: string[]; note?: string }> = {
  home_middle: {
    eyebrow: 'Rookie ad slot',
    title: 'Rookie is free and ad-supported.',
    body: 'Upgrade to Pro for $5/mo to remove ads from your Home dashboard.',
    benefits: ['Ad-free Home.', 'Cleaner race day view.', 'More setup tools.'],
  },
  home_bottom: {
    eyebrow: 'Rookie ad slot',
    title: 'Remove ads from OnlyFast.',
    body: 'Pro keeps the app cleaner while you plan, tune, and save race weekends.',
    benefits: ['Ad-free screens.', 'Export setups.', 'Faster workflow.'],
  },
  setup_dashboard_bottom: {
    eyebrow: 'Placeholder ad slot',
    title: 'Rookie plan is ad-supported.',
    body: 'Upgrade to Pro for $5/mo to remove ads and keep your setup notebook cleaner.',
    benefits: ['Ad-free screens.', 'Export setups.', 'More setup tools.'],
  },
  setup_session_bottom: {
    eyebrow: 'Placeholder ad slot',
    title: 'Keep tuning. Lose the ads.',
    body: 'Upgrade to Pro for $5/mo for an ad-free setup notebook.',
    benefits: ['Cleaner setup screens.', 'More saved workflow.', 'Export-ready setups.'],
  },
  parts_reference_bottom: {
    eyebrow: 'Placeholder ad slot',
    title: 'Build your edge with Pro.',
    body: 'Upgrade to Pro for $5/mo to remove ads and unlock a cleaner parts workflow.',
    benefits: ['Ad-free parts reference.', 'More tools.', 'Faster workflow.'],
  },
  schedule_bottom: {
    eyebrow: 'Placeholder ad slot',
    title: 'Plan race days with fewer distractions.',
    body: 'Upgrade to Pro for $5/mo and remove Rookie ads.',
    benefits: ['Cleaner screens.', 'Less clutter.', 'Faster workflow.'],
  },
  timing_scan_bottom: {
    eyebrow: 'Placeholder ad slot',
    title: 'Scan results. Skip the ads.',
    body: 'Upgrade to Pro for $5/mo for a cleaner timing workflow.',
    benefits: ['Ad-free timing.', 'More tools.', 'Cleaner workflow.'],
  },
  after_save_interstitial: {
    eyebrow: 'Setup Saved',
    title: 'Rookie plan is ad-supported.',
    body: 'Upgrade to Pro for $5/mo to remove ads and keep working faster.',
    benefits: ['Ad-free experience.', 'Export setups.', 'More setup tools.'],
    note: 'Temporary house ad until Media.net, AdMob, or another ad provider is approved.',
  },
};

const RookieAdSlot: React.FC<RookieAdSlotProps> = ({
  placement,
  user,
  className = '',
  previewMode = false,
  onContinue,
}) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const isDevPreview = previewMode && import.meta.env.DEV;

  if (dismissed || (!isDevPreview && !shouldShowAds(user))) {
    return null;
  }

  const copy = placementCopy[placement];
  const isInterstitial = placement === 'after_save_interstitial';

  const handleUpgrade = () => {
    if (hideExternalPayments) {
      navigate('/upgrade', { state: { plan: 'pro' } });
      return;
    }

    setPendingPlan('pro');
    navigate('/upgrade', { state: { plan: 'pro' } });
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
      return;
    }
    setDismissed(true);
  };

  const content = (
    <section
      data-placement={placement}
      aria-label="OnlyFast Pro upgrade"
      className={[
        'relative overflow-hidden rounded-2xl border border-[#D7EEF8] bg-white shadow-lg shadow-[#00A8E8]/10',
        isInterstitial ? 'w-full max-w-lg p-6 text-center' : 'w-full p-4 sm:p-5',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[#00A8E8]" aria-hidden="true" />

      {/* Future ad network integration point: this house-ad content can be replaced with Media.net web ads, AdMob/native ads, or another approved revenue-generating ad slot. Keep membership gating so paid users never load ad scripts. */}
      <div className={isInterstitial ? 'flex flex-col items-center gap-4' : 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'}>
        <div className={isInterstitial ? 'flex flex-col items-center gap-3' : 'flex min-w-0 items-start gap-4'}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EAF8FE] text-[#00A8E8]">
            {isInterstitial ? <Sparkles size={27} aria-hidden="true" /> : <Gauge size={27} aria-hidden="true" />}
          </div>

          <div className={isInterstitial ? 'max-w-md' : 'min-w-0'}>
            <img
              src={LOGO_SRC}
              alt="OnlyFast"
              className={isInterstitial ? 'mx-auto mb-2 h-10 w-auto object-contain' : 'mb-2 h-8 w-auto object-contain'}
            />
            <p className="text-xs font-bold uppercase tracking-wide text-[#00A8E8]">{copy.eyebrow}</p>
            <h3 className={isInterstitial ? 'mt-1 text-2xl font-bold text-[#1A1B23]' : 'mt-1 text-lg font-bold text-[#1A1B23]'}>
              {copy.title}
            </h3>
            <p className={isInterstitial ? 'mt-2 text-sm text-[#4B5563]' : 'mt-1 text-sm text-[#4B5563]'}>
              {copy.body}
            </p>
            <ul className={isInterstitial ? 'mt-3 flex flex-wrap justify-center gap-2' : 'mt-3 flex flex-wrap gap-2'}>
              {copy.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-full border border-[#D7EEF8] bg-[#F3FBFE] px-3 py-1 text-xs font-semibold text-[#1A1B23]"
                >
                  {benefit}
                </li>
              ))}
            </ul>
            {copy.note && (
              <p className="mt-3 text-xs text-[#6B7280]">{copy.note}</p>
            )}
            {hideExternalPayments && (
              <p className="mt-3 rounded-lg border border-[#D7EEF8] bg-[#F3FBFE] px-3 py-2 text-xs font-semibold text-[#1A1B23]">
                {nativeUpgradeMessage}
              </p>
            )}
          </div>
        </div>

        <div className={isInterstitial ? 'flex w-full flex-col gap-2 sm:flex-row sm:justify-center' : 'flex shrink-0 flex-col gap-2 sm:min-w-48'}>
          <button
            type="button"
            onClick={handleUpgrade}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            {hideExternalPayments ? 'View Pro details' : 'Upgrade to Pro'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Continue with Rookie
          </button>
        </div>
      </div>
    </section>
  );

  if (!isInterstitial) {
    return content;
  }

  return (
    <div className="rounded-3xl bg-[#1A1B23] p-4 shadow-2xl">
      {content}
    </div>
  );
};

export default RookieAdSlot;
