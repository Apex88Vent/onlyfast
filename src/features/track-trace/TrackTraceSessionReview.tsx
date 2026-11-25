import { useQuery } from '@tanstack/react-query';
import { traceRpc, type TraceContext } from './api';
import TrackTraceTelemetry from './TrackTraceTelemetry';

const duration = (ms: number) => (ms / 1000).toFixed(3) + ' s';

// Shared by the existing route and the in-place setup dialog. Every read still
// goes through the same owner/circuit-authorized RPC; drafts are never touched.
export default function TrackTraceSessionReview({ userId, revision, sessionId, setupId, canModify=false }: {
  userId: string; revision: string; sessionId?: string | null; setupId?: string | null; canModify?:boolean;
}) {
  const detail = useQuery({
    queryKey: ['track_trace', 'review', userId, revision, sessionId, setupId],
    queryFn: async () => {
      return traceRpc<TraceContext|null>('get_track_trace_review_summary', { p_session_id: setupId?null:sessionId, p_setup_id:setupId??null });
    }, enabled: !!(sessionId || setupId), retry: false, gcTime: 0,
  });
  return <section className="min-w-0 rounded-2xl border bg-white p-3 sm:p-5" aria-label="Session review">
    {detail.isPending ? <p role="status">Loading session…</p> : detail.isError ? <div role="alert"><p>This session is unavailable or access has changed. Your setup has not been changed.</p><button className="mt-2 underline" onClick={() => void detail.refetch()}>Try again</button></div>
      : !detail.data ? <p>No permitted telemetry is linked to this setup session. It may have been removed or become unavailable.</p> : <>
        <TrackTraceTelemetry userId={userId} revision={revision} sessionId={detail.data.session.id} summary={detail.data} canModify={canModify}/>
        <details className="mt-3 text-sm"><summary>Stored session records</summary>
        <p className="mt-2 text-sm">{detail.data.laps.length} laps · {detail.data.sectors.length} sector results</p>
        <ul className="mt-3 space-y-1">{detail.data.laps.map(lap => <li key={lap.id}>Lap {lap.lap_number}: {duration(lap.duration_ms)}{lap.is_valid ? '' : ' (excluded)'}</li>)}</ul>
        {detail.data.sectors.length > 0 && <ul className="mt-3 space-y-1 text-sm" aria-label="Sector results">{detail.data.sectors.map((sector, i) => <li key={sector.lap_id + ':' + sector.sector_index + ':' + i}>Sector {sector.sector_index}: {sector.duration_ms==null?'Unavailable':duration(sector.duration_ms)}</li>)}</ul>}
        </details>
      </>}
  </section>;
}
