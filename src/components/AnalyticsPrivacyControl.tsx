import { useSyncExternalStore } from 'react';
import { analyticsEnabledInBuild, getAnalyticsConsent, setAnalyticsConsent, subscribeAnalyticsConsent } from '@/lib/analytics';

export default function AnalyticsPrivacyControl() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => 'unknown');
  return <section aria-label="Analytics privacy" className="rounded-xl border border-[#E5E7EB] p-4 space-y-3">
    <h3 className="text-sm font-bold text-[#1A1B23]">Optional analytics</h3>
    <p className="text-sm text-[#6B7280]">Allow Google Firebase Analytics to measure feature usage, screens, racing class and membership tier.
      Your setup values, notes, timing images, GPS data, and AI conversations are not included. Advertising choices are separate.</p>
    <p className="text-sm" role="status">{consent === 'granted' ? 'Analytics permission allowed.' : consent === 'denied' ? 'Analytics permission declined.' : 'Analytics permission has not been given.'}
      {!analyticsEnabledInBuild() && ' Collection is disabled in this build.'}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setAnalyticsConsent('denied')} aria-pressed={consent === 'denied'}
        className="rounded-lg border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[#00A8E8]">Decline analytics</button>
      <button type="button" onClick={() => setAnalyticsConsent('granted')} aria-pressed={consent === 'granted'}
        className="rounded-lg border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[#00A8E8]">Allow analytics</button>
    </div>
  </section>;
}
