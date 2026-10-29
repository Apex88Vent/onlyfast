import React, { Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import { shouldShowAds } from '@/lib/ads';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';

export type RookieAdPlacement =
  | 'home_middle'
  | 'home_bottom'
  | 'setup_track_conditions'
  | 'setup_dashboard_bottom'
  | 'setup_session_bottom'
  | 'parts_reference_bottom'
  | 'schedule_bottom'
  | 'timing_scan_bottom'
  | 'todo_bottom'
  | 'after_save_interstitial';

export interface RookieAdSlotProps {
  placement: RookieAdPlacement;
  user?: User | null;
  className?: string;
  previewMode?: boolean;
  onContinue?: () => void;
  container?: 'li' | 'tr';
  colSpan?: number;
}

const RookieHouseAdContent = React.lazy(() => import('./RookieHouseAdContent'));

const RookieAdSlot: React.FC<RookieAdSlotProps> = (props) => {
  useMembershipRevision();
  const isDevPreview = props.previewMode && import.meta.env.DEV;

  if (!isDevPreview && !shouldShowAds(props.user)) {
    return null;
  }

  const content = (
    <Suspense fallback={props.placement === 'after_save_interstitial' ? null : (
      <div aria-hidden="true" className={`h-[160px] w-full shrink-0 ${props.className || ''}`} />
    )}>
      <RookieHouseAdContent {...props} />
    </Suspense>
  );
  // Keep semantic list/table containers inside eligibility gating, so paid and
  // logged-out users do not receive empty ad rows or their spacing.
  if (props.container === 'li') return <li>{content}</li>;
  if (props.container === 'tr') return <tr><td colSpan={props.colSpan} className="py-4">{content}</td></tr>;
  return content;
};

export default RookieAdSlot;
