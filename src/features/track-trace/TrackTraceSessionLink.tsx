import { useEffect, useRef, useState } from 'react';
import { deferredFeatureExport } from '@/components/DeferredFeature';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { notifyOnlyLapsSessionLinkChanged } from '@/lib/onlylapsSessionScope';
import { traceRpc, type TraceLinkCandidate, type TraceLinkPicker } from './api';
import { useTrackTracePermission } from './useTrackTrace';
import { TrackTraceBetaBadge } from './TrackTraceBeta';
import TrackTraceSessionReview from './TrackTraceSessionReview';
import { LockKeyhole } from 'lucide-react';

function Summary({ session }: { session: TraceLinkCandidate }) {
  const date = session.started_at || session.created_at;
  return <div className="min-w-0"><p className="break-words font-semibold">{session.name}</p>
    <p className="mt-1 text-xs text-[#6B7280]">{session.track_name || 'Free / unscanned circuit'}{Number.isFinite(Date.parse(date)) ? ' · ' + new Date(date).toLocaleString() : ''}</p>
    <p className="mt-1 text-xs text-[#6B7280]">{session.lap_count} laps{session.fastest_lap_ms != null ? ` · Fastest ${(session.fastest_lap_ms / 1000).toFixed(3)} s` : ''}</p>
  </div>;
}

function TrackTraceSessionLink({ userId, setupId }: { userId: string | null; setupId: string | null }) {
  const access = useTrackTracePermission(userId);
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scope = [userId, setupId, access.revision, access.fullAccess].join(':');
  const active = useRef<string | null>(scope);
  useEffect(() => { active.current=scope; return () => { if (active.current===scope) active.current=null; }; }, [scope]);
  const picker = useQuery({
    queryKey: ['track_trace','link',userId,setupId,access.revision,offset],
    queryFn: async () => {
      const response = await traceRpc<TraceLinkPicker>('list_track_trace_link_candidates',{p_setup_id:setupId,p_offset:offset});
      if (response.setup_id !== setupId) throw new Error('Unexpected setup-session response.');
      return response;
    }, enabled: !!setupId && !!userId && access.fullAccess, retry:false,gcTime:0,
  });
  async function change(sessionId: string | null) {
    if (!setupId || busy || !picker.data?.editable || !access.fullAccess) return;
    if (sessionId===null && !window.confirm('Unlink Track Trace telemetry from this setup session? No setup, recording, lap, or analysis will be deleted.')) return;
    const requestedScope=scope;
    setBusy(true);setError('');
    try {
      await traceRpc('set_track_trace_session_link',{p_setup_id:setupId,p_session_id:sessionId,p_expected_session_id:picker.data.current_session_id});
      if (active.current!==requestedScope) return;
      notifyOnlyLapsSessionLinkChanged(setupId);
      setPickerOpen(false);
      await queryClient.invalidateQueries({queryKey:['track_trace']});
    } catch {
      if (active.current===requestedScope) setError('The telemetry link could not be changed. It may have changed elsewhere or access is unavailable. Refresh and try again; your setup edits are untouched.');
    } finally { if (active.current===requestedScope) setBusy(false); }
  }
  return <section className="my-4 rounded-2xl border border-[#00A8E8]/20 bg-white p-4" aria-label="Setup-session Track Trace telemetry">
    <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">OnlyFast Track Trace</h2><TrackTraceBetaBadge /></div>
    {!userId ? <p className="mt-2 text-sm">Sign in and save this race session to link telemetry.</p>
      : access.navigationLocked ? <div className="mt-2"><Link to="/upgrade" className="inline-flex items-center gap-2 font-semibold text-[#007DAE] underline"><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />Link Track Trace Telemetry — Upgrade to Pro to Unlock</Link>
        {access.allowed && setupId && <button type="button" onClick={() => setReviewOpen(true)} className="mt-2 block py-2 text-sm text-[#007DAE] underline">View saved telemetry</button>}</div>
      : !access.fullAccess ? <p role="status" className="mt-2 text-sm">{access.isError ? 'Telemetry access could not be verified. Setup editing and saving remain available.' : 'Checking telemetry access…'}</p>
      : !setupId ? <p className="mt-2 text-sm">Save this individual race session before linking Track Trace telemetry.</p>
      : <div className="mt-3 space-y-3">
        {picker.isPending ? <p role="status">Loading linked telemetry…</p> : picker.isError ? <p role="alert">Telemetry is unavailable. Your setup edits and saves are unaffected.</p>
          : picker.data?.missing_session ? <p role="status">The linked telemetry recording is missing or no longer available. Your setup is intact.</p>
          : picker.data?.current_session ? <Summary session={picker.data.current_session} /> : <p className="text-sm text-[#6B7280]">No telemetry linked to this individual setup session.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => {setError('');setPickerOpen(true);}} disabled={busy||picker.isPending||picker.isError||!picker.data?.editable} className="rounded-lg bg-[#007DAE] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{picker.data?.current_session_id ? 'Change linked session' : 'Link Track Trace Telemetry'}</button>
          {picker.data?.current_session && <button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold text-[#007DAE]">View telemetry</button>}
          {picker.data?.current_session_id && <button type="button" onClick={() => void change(null)} disabled={busy||!picker.data.editable} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Unlink telemetry</button>}
          {(picker.isError||error) && <button type="button" onClick={() => {setError('');void picker.refetch();}} className="px-2 py-2 text-sm underline">Refresh telemetry</button>}
        </div>
        {picker.data && !picker.data.editable && <p className="text-sm text-[#6B7280]">This setup session is read-only. Its telemetry link cannot be changed.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
    <Dialog open={pickerOpen&&access.fullAccess} onOpenChange={setPickerOpen}><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl">
      <DialogHeader><DialogTitle>Link Track Trace Telemetry</DialogTitle><DialogDescription>Choose your saved circuit recording for this exact setup session. Other setup sessions will not change.</DialogDescription></DialogHeader>
      {picker.isError ? <p role="alert">Recordings could not be loaded. Close and refresh telemetry to retry.</p> : picker.isPending ? <p role="status">Loading recordings…</p> : <ul className="space-y-2">{picker.data?.candidates.map(session => <li key={session.id}><button type="button" onClick={() => void change(session.id)} disabled={busy||session.linked_elsewhere||session.id===picker.data.current_session_id||!picker.data.editable} className="w-full rounded-xl border p-3 text-left hover:border-[#00A8E8] disabled:opacity-50"><Summary session={session} />{session.linked_elsewhere && <span className="text-xs">Linked to another setup session</span>}{session.id===picker.data.current_session_id && <span className="text-xs">Currently linked</span>}</button></li>)}</ul>}
      {!picker.isPending&&!picker.isError&&!picker.data?.candidates.length && <p>No eligible saved circuit recordings are available.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-4">{offset>0&&<button className="underline" onClick={() => setOffset(x=>Math.max(0,x-25))}>Previous recordings</button>}{picker.data?.candidates.length===25&&<button className="underline" onClick={() => setOffset(x=>x+25)}>More recordings</button>}</div>
    </DialogContent></Dialog>
    <Dialog open={reviewOpen&&access.allowed} onOpenChange={setReviewOpen}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl">
      <DialogHeader><DialogTitle>OnlyFast Track Trace review</DialogTitle><DialogDescription>Saved telemetry for this individual setup session. Closing this view returns to your setup edits.</DialogDescription></DialogHeader>
      {userId&&setupId&&<TrackTraceSessionReview userId={userId} revision={String(access.revision)} setupId={setupId} />}
    </DialogContent></Dialog>
  </section>;
}

export default deferredFeatureExport(TrackTraceSessionLink, 'OnlyFast Track Trace telemetry linking');
