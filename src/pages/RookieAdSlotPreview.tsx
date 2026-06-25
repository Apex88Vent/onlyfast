import React from 'react';
import type { User } from '@supabase/supabase-js';
import RookieAdSlot, { type RookieAdPlacement } from '@/components/RookieAdSlot';

const previewUser = {
  id: 'rookie-ad-preview-user',
  email: 'rookie-preview@onlyfast.local',
  user_metadata: {
    membership_tier: 'rookie',
    has_admin_full_access: false,
  },
} as unknown as User;

const placements: RookieAdPlacement[] = [
  'setup_dashboard_bottom',
  'setup_session_bottom',
  'parts_reference_bottom',
  'schedule_bottom',
  'timing_scan_bottom',
  'after_save_interstitial',
];

const labelFor = (placement: RookieAdPlacement) =>
  placement
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const RookieAdSlotPreview: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#F5F5F7] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-14 w-auto object-contain" />
          <h1 className="mt-4 text-2xl font-bold text-[#1A1B23]">Rookie Ad Slot Preview</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Local development preview for every supported OnlyFast house-ad placement.
          </p>
        </div>

        <div className="space-y-6">
          {placements.map((placement) => (
            <section key={placement} className="space-y-2">
              <h2 className="text-sm font-bold text-[#374151]">{labelFor(placement)}</h2>
              <RookieAdSlot placement={placement} user={previewUser} previewMode />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};

export default RookieAdSlotPreview;
