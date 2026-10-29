import React, { Suspense, useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { shouldShowAds } from '@/lib/ads';
import { isMedianIOSApp } from '@/lib/paymentVisibility';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import { nativeAds } from '@/lib/nativeAds';

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
const subscribeNativeAds = (notify: () => void) => nativeAds.subscribeDiagnostics(notify);

const RookieAdSlot: React.FC<RookieAdSlotProps> = (props) => {
  useMembershipRevision();
  const nativeExperience = useSyncExternalStore(subscribeNativeAds,
    () => nativeAds.usesConfirmedNativeBannerExperience(props.user?.id ?? null), () => false);
  const isDevPreview = props.previewMode && import.meta.env.DEV;

  if (!isDevPreview && (!shouldShowAds(props.user) ||
      (props.placement !== 'after_save_interstitial' && nativeExperience))) {
    return null;
  }

  return (
    <Suspense fallback={props.placement === 'after_save_interstitial' || isMedianIOSApp ? null : (
      <div aria-hidden="true" className={`h-[160px] w-full shrink-0 ${props.className || ''}`} />
    )}>
      <RookieHouseAdContent {...props} />
    </Suspense>
  );
};

export default RookieAdSlot;
