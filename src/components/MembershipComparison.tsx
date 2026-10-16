import React from 'react';
import { Check, Lock } from 'lucide-react';
import { PLANS, tierLimits, type TierLimits } from '@/lib/membership';

// Display is derived from the same configuration used by the feature gates.
const comparisonFeatures: { label: string; key: keyof TierLimits; kind?: 'ads' | 'lock' | 'weekend' | 'vehicles' }[] = [
  { label: 'Advertisements', key: 'adsEnabled', kind: 'ads' },
  { label: 'Cars / classes', key: 'maxCars' },
  { label: 'Base setups', key: 'maxBaseSetups' },
  { label: 'Race weekend saves', key: 'maxRaceWeekendSetups' },
  { label: '48-hour edit lock', key: 'raceWeekendSetupLockHours', kind: 'lock' },
  { label: 'Timing uploads / month', key: 'timingUploadsPerMonth' },
  { label: 'Setup Assist', key: 'setupAssistsPerRaceWeekend', kind: 'weekend' },
  { label: 'Setup export', key: 'setupExport' },
  { label: 'Leaderboard uploads', key: 'leaderboardUpload' },
  { label: 'Leaderboard badges', key: 'leaderboardBadges' },
  { label: 'Advanced profile', key: 'advancedProfile' },
  { label: 'Multiple disciplines at once', key: 'maxCars', kind: 'vehicles' },
];

export default function MembershipComparison() {
  return <section aria-labelledby="comparison-heading" className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-6">
    <h2 id="comparison-heading" className="text-xl font-bold text-[#1A1B23]">Compare your plans</h2>
    <p className="mt-1 mb-4 text-sm text-[#6B7280]">Saved setups remain viewable, including after Rookie’s editing window ends.</p>
    <div role="table" aria-label="OnlyFast membership features">
      <div role="row" className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr] gap-2 py-3 font-bold text-[#1A1B23]">
        <span role="columnheader">Feature</span>
        {PLANS.map(plan => <span role="columnheader" key={plan.tier}>{plan.displayName}</span>)}
      </div>
      {comparisonFeatures.map(feature => <div role="row" key={feature.label} className="grid grid-cols-3 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-x-2 gap-y-2 border-t border-[#E5E7EB] py-3 text-sm">
        <span role="rowheader" className="col-span-3 sm:col-span-1 font-semibold text-[#1A1B23]">{feature.label}</span>
        {PLANS.map(plan => {
          const value = tierLimits[plan.tier][feature.key];
          const available = feature.kind === 'vehicles' ? value === 'unlimited' : value;
          const text = feature.kind === 'ads' ? (value ? 'Yes' : 'No') : feature.kind === 'lock' ? (value === null ? 'No' : `${value} hours`) :
            feature.kind === 'vehicles' ? (available ? 'Unlimited' : 'Locked') : typeof value === 'boolean' ? (value ? 'Included' : 'Locked') :
            value === 'unlimited' ? 'Unlimited' : `${value}${feature.kind === 'weekend' ? ' / weekend' : ''}`;
          return <div role="cell" key={plan.tier} className="min-w-0 text-[#4B5563]">
            <span className="block text-xs font-semibold text-[#6B7280] sm:hidden">{plan.displayName}</span>
            <span className="inline-flex items-center gap-1 mt-1 sm:mt-0">
              {text === 'Locked' ? <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" /> :
                text === 'Included' ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#00A8E8]" /> : null}
              {text}
            </span>
          </div>;
        })}
      </div>)}
    </div>
    <p className="mt-4 text-xs text-[#6B7280]">Rookie and Pro use one active car/class at a time. The existing vehicle change rules still apply. Teams covers all supported disciplines; upcoming disciplines remain unavailable.</p>
  </section>;
}
