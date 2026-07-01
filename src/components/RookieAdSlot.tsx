import React, { Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import { shouldShowAds } from '@/lib/ads';

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
}

const RookieHouseAdContent = React.lazy(() => import('./RookieHouseAdContent'));

const RookieAdSlot: React.FC<RookieAdSlotProps> = (props) => {
  const isDevPreview = props.previewMode && import.meta.env.DEV;

  if (!isDevPreview && !shouldShowAds(props.user)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <RookieHouseAdContent {...props} />
    </Suspense>
  );
};

export default RookieAdSlot;
