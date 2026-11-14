import { Link } from 'react-router-dom';
import { Activity, Route, LockKeyhole } from 'lucide-react';
import { TRACK_TRACE_NAME, trackTraceEnabled } from './api';
import { useTrackTracePermission } from './useTrackTrace';
import { TrackTraceBetaBadge } from './TrackTraceBeta';
import { homeActionCardClassName, homeActionIconContainerClassName, homeActionIconClassName, homeActionLabelClassName } from '@/components/homeActionStyles';

export default function TrackTraceEntry({ userId, setupId, variant = 'setup' }: { userId: string | null; setupId?: string | null; variant?: 'setup' | 'landing' }) {
  const access = useTrackTracePermission(userId);
  if (!trackTraceEnabled) return null;
  const locked = access.data?.can_read_history === false || access.data?.allowed === false;
  const readOnly = access.data?.read_only === true;
  if (variant === 'landing') {
    const content = <>
      <span className={homeActionIconContainerClassName}><Activity className={homeActionIconClassName} strokeWidth={2.2} aria-hidden="true" /></span>
      <span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><span className={homeActionLabelClassName}>Track Trace Telemetry</span><TrackTraceBetaBadge /></span>
        {access.navigationLocked && <span className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280] sm:text-sm"><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />Upgrade to Pro to Unlock</span>}
        {!access.fullAccess && !access.navigationLocked && <span className="mt-1 block text-sm text-[#6B7280]">{!userId ? 'Sign in to check access' : access.isError ? 'Access unavailable — refresh to retry' : 'Checking access…'}</span>}
      </span>
    </>;
    const className = 'col-span-2 flex min-w-0 gap-2 max-[379px]:gap-1.5 ' + homeActionCardClassName;
    const style = { height: 'var(--home-action-height)' };
    return access.allowed && access.navigationLocked ? <div className="col-span-2 min-w-0">
      <Link to="/upgrade" className={className} style={style}>{content}</Link>
      <Link to="/track-trace?view=review" className="mt-2 inline-block py-2 text-sm font-semibold text-[#007DAE] underline">View saved telemetry</Link>
    </div> : access.fullAccess || access.navigationLocked ? <Link to={access.navigationLocked ? '/upgrade' : '/track-trace'} className={className} style={style}>{content}</Link>
      : <button type="button" className={className} style={style} disabled>{content}</button>;
  }
  return <section className="my-4 min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-5" aria-label={TRACK_TRACE_NAME}>
    <div className="flex items-start gap-3">
      {locked ? <LockKeyhole aria-hidden="true" className="h-6 w-6 shrink-0 text-slate-500" /> : <Route aria-hidden="true" className="h-6 w-6 shrink-0 text-[#00A8E8]" />}
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#1A1B23]">{TRACK_TRACE_NAME}</h2><TrackTraceBetaBadge /></div>
        <p className="mt-1 text-sm text-[#6B7280]">Circuit sessions, lap timing and saved telemetry, connected to your race setup.</p>
        {access.allowed ? <><Link className="mt-3 inline-block font-semibold text-[#007DAE] underline" to={'/track-trace' + (setupId ? '?setup=' + encodeURIComponent(setupId) : '')}>Open {TRACK_TRACE_NAME}</Link>
          {readOnly && <p className="mt-2 text-sm">View your eligible saved telemetry. Recording and changes require Pro or Factory.</p>}</>
          : locked ? <><p className="mt-2 text-sm">Included with Pro and Factory.</p><Link className="mt-2 inline-block font-semibold text-[#007DAE] underline" to="/upgrade">Explore Pro access</Link></>
          : <p role="status" className="mt-2 text-sm">{!userId ? 'Sign in to check access.' : access.isError ? 'Access could not be verified. Refresh to try again.' : 'Checking access…'}</p>}
      </div>
    </div>
  </section>;
}
