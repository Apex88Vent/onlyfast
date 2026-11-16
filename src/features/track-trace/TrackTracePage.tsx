import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TRACK_TRACE_NAME, traceRpc, getTraceAssistStatus, type TraceSession, type TraceTrack } from './api';
import { useTrackTraceIdentity, useTrackTracePermission } from './useTrackTrace';
import TrackTraceMenu, { type TrackTraceView } from './TrackTraceMenu';
import { TrackTraceBetaBadge } from './TrackTraceBeta';
import TrackTraceSessionReview from './TrackTraceSessionReview';
import TrackTraceLibrary from './TrackTraceLibrary';
import TrackTraceRecorder, { TrackTraceRecovery } from './TrackTraceRecorder';
import TrackTraceScanner from './TrackTraceScanner';

// Keyed by identity/membership revision: switching accounts or tiers unmounts
// all session data and pending writes before any new access decision is shown.
function TraceWorkspace({ userId, revision, setupId, canRecord, trackId, unlinked = false, mode = 'all', onSelectTrack, onRecord, initialSessionId }: { userId: string; revision: string; setupId: string | null; canRecord: boolean; trackId: string | null; unlinked?: boolean; mode?: 'all' | 'start' | 'review'; onSelectTrack: (trackId: string | null) => void; onRecord:(id:string)=>void; initialSessionId?:string|null }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialSessionId ?? null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [choosingTrack, setChoosingTrack] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TraceTrack | null>(null);
  const sessions = useQuery({
    queryKey: ['track_trace', userId, revision, setupId, offset],
    queryFn: () => traceRpc<TraceSession[]>('list_track_trace_sessions', { p_setup_id: setupId, p_offset: offset }),
    enabled: !unlinked, retry: false, gcTime: 0,
  });
  const assistContext = useQuery({
    queryKey: ['track_trace', 'setup_assist', userId, revision, setupId, selected],
    queryFn: () => getTraceAssistStatus(setupId!),
    enabled: !!setupId && canRecord, retry: false, gcTime: 0,
  });
  const setupAccess = useQuery({
    queryKey: ['track_trace', 'setup_access', userId, revision, setupId],
    queryFn: () => traceRpc<{ editable: boolean }>('get_onlyfast_2027_setup_edit_state', { p_setup_id: setupId }),
    enabled: !!setupId && canRecord, retry: false, gcTime: 0, refetchInterval: 30000,
  });
  const canPrepare = canRecord && (unlinked || (!!setupAccess.data && !setupAccess.isError &&
    (setupAccess.data.editable === true || (!('editable' in setupAccess.data) && typeof (setupAccess.data as { created_at?: unknown }).created_at === 'string'))));
  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    if (!canPrepare) { setSaving(false); setError('This setup is read-only.'); return; }
    try {
      const id = await traceRpc<string>('create_track_trace_session', { p_setup_id: setupId, p_name: name.trim(), p_track_map_id: trackId });
      setSelected(id); setName(''); onRecord(id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Session could not be saved.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">{canRecord ? 'Pro and Factory include the same circuit timing and telemetry access, with no session limit.' : 'Your saved telemetry is read-only. Pro or Factory is required to record sessions or change telemetry. Archived setup contents remain restricted.'}</p>
    {setupId && canRecord && <p className="text-sm" role="status">{assistContext.isError ? 'Setup Assist telemetry access could not be verified.' : assistContext.data?.linked ? 'Saved telemetry is linked for Setup Assist. Recommendations will become available with the testing AI integration.' : 'Setup Assist will use telemetry linked to this exact race session.'}</p>}
    {!unlinked && <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Saved circuit sessions</h2>
      {sessions.isPending ? <p role="status">Loading sessions…</p> : sessions.isError ? <p role="alert">Sessions could not be loaded. <button className="underline" onClick={() => void sessions.refetch()}>Try again</button></p> : <>
        {!sessions.data?.length && <p className="mt-2 text-sm text-slate-600">No saved circuit sessions {setupId ? 'linked to this setup' : 'yet'}.</p>}
        <ul className="mt-3 space-y-2">{sessions.data?.map(session => <li key={session.id}>
          <button className="w-full break-words rounded-xl border p-3 text-left hover:border-[#00A8E8]" onClick={() => setSelected(session.id)} aria-pressed={selected === session.id}>
            <span className="font-semibold">{session.session_name || session.name}</span>
            <span className="mt-1 block text-sm text-slate-600">{session.track_map_id ? 'Scanned circuit' : 'Free / unscanned circuit'} · {session.started_at ? new Date(session.started_at).toLocaleString() : 'Session prepared'}</span>
          </button>
        </li>)}</ul>
        <div className="mt-3 flex gap-4">
          {offset > 0 && <button className="underline" onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous sessions</button>}
          {sessions.data?.length === 100 && <button className="underline" onClick={() => setOffset(value => value + 100)}>More sessions</button>}
        </div>
      </>}
    </section>}
    {mode !== 'review' && canRecord && ((setupId || unlinked) && canPrepare ? <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">Prepare a circuit session</h2><TrackTraceBetaBadge /></div>
      <p className="mt-1 text-sm text-slate-600">{unlinked ? 'Prepare an owned recording without a setup. It will be available in Review Session and can be linked to an exact setup session later.' : 'Prepare a recording linked to this exact race setup.'} Arm GPS on the next screen.</p>
      <fieldset className="mt-4 space-y-2"><legend className="text-sm font-semibold">Circuit track</legend>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="trace-track" checked={!trackId&&!choosingTrack} onChange={() => {setChoosingTrack(false);setSelectedTrack(null);onSelectTrack(null);}} className="mt-1" /><span><span className="font-semibold">Free Record</span><span className="block text-[#6B7280]">Capture circuit GPS without a saved map. Automatic lap timing requires a saved start/finish line.</span></span></label>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="trace-track" checked={!!trackId||choosingTrack} onChange={() => setChoosingTrack(true)} className="mt-1" /><span className="font-semibold">Saved circuit track</span></label>
      </fieldset>
      {trackId && <p className="mt-2 text-sm">{selectedTrack ? `${selectedTrack.track_name||selectedTrack.name} · Version ${selectedTrack.version}${selectedTrack.track_length_meters!=null ? ` · ${selectedTrack.track_length_meters} m` : ''}` : 'A saved circuit is selected for this session.'}</p>}
      {(trackId||choosingTrack) && <button type="button" onClick={() => setChoosingTrack(x=>!x)} className="mt-2 text-sm text-[#007DAE] underline">{choosingTrack ? 'Close track selection' : 'Change selected track'}</button>}
      {choosingTrack && <div className="mt-3"><TrackTraceLibrary userId={userId} revision={revision} onSelect={track => {setSelectedTrack(track);onSelectTrack(track.id);setChoosingTrack(false);}} /></div>}
      <form onSubmit={create}><label className="mt-3 block text-sm font-medium" htmlFor="trace-session-name">Session name</label>
      <input id="trace-session-name" className="mt-1 w-full rounded-lg border p-3" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
      <button className="mt-3 w-full rounded-lg bg-[#007DAE] px-4 py-3 font-semibold text-white sm:w-auto disabled:opacity-50" disabled={saving || !name.trim() || (choosingTrack&&!trackId) || (!unlinked&&(sessions.isPending || sessions.isError || !!sessions.data?.length))}>{saving ? 'Saving…' : 'Save circuit session'}</button>
      {!unlinked&&!!sessions.data?.length && <p className="mt-2 text-sm">This setup already has a linked session. Its existing association is preserved.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</form>
    </section> : <p className="rounded-xl bg-white p-5 text-sm">{setupId ? 'This setup is read-only or its editing permission is being checked.' : 'Open an editable saved race setup to prepare a linked session.'}</p>)}
    {selected && canRecord && <button className="rounded-lg border px-4 py-3 font-semibold text-[#007DAE]" onClick={()=>onRecord(selected)}>Open recording controls</button>}
    {selected && <TrackTraceSessionReview userId={userId} revision={revision} sessionId={selected} />}
  </div>;
}

interface TraceSetupChoice {
  id: string; setup_name: string; session_label: string | null; setup_type: string;
  race_weekend_id: string | null; race_class: string; archived_at?: string | null;
  access?: { editable?: boolean };
}

function TraceSetupPicker({ userId, revision, onSelect }: { userId: string; revision: string; onSelect: (id: string) => void }) {
  const setups = useQuery({
    queryKey: ['track_trace', 'setup_choices', userId, revision],
    queryFn: () => traceRpc<TraceSetupChoice[]>('list_user_setup_summaries'), retry: false, gcTime: 0,
  });
  const choices = setups.data?.filter(setup => setup.race_weekend_id && setup.setup_type !== 'base_template' && !setup.archived_at && setup.access?.editable !== false) ?? [];
  return <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
    <h2 className="text-lg font-bold">Choose an existing setup session</h2>
    <p className="mt-2 text-sm text-[#6B7280]">Choose a saved race session to prepare its circuit recording.</p>
    {setups.isPending ? <p role="status" className="mt-3">Loading race sessions…</p> : setups.isError ? <p role="alert" className="mt-3">Race sessions could not be loaded. <button className="underline" onClick={() => void setups.refetch()}>Try again</button></p>
      : choices.length ? <ul className="mt-4 space-y-2">{choices.map(setup => <li key={setup.id}>
        <button className="w-full break-words rounded-xl border border-[#E5E7EB] p-3 text-left hover:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]" onClick={() => onSelect(setup.id)}>
          <span className="block font-semibold">{setup.setup_name}</span><span className="block text-sm text-[#6B7280]">{setup.session_label || setup.setup_type} · {setup.race_class}</span>
        </button>
      </li>)}</ul> : <p className="mt-4 text-sm">Save a race setup in OnlyFast first, then return here to prepare its circuit session.</p>}
  </section>;
}

export default function TrackTracePage() {
  const userId = useTrackTraceIdentity();
  const access = useTrackTracePermission(userId);
  const [params, setParams] = useSearchParams();
  const setupId = params.get('setup');
  const trackId = params.get('track');
  const preparation = params.get('prepare') || (setupId ? 'linked' : '');
  const view = params.get('view') || (setupId ? 'session' : 'menu');
  const recordingId = params.get('record');
  const canRecord = access.fullAccess;
  const permissionKey = [access.revision, access.data?.tier, access.data?.can_record, access.data?.can_read_archived].join(':');
  function selectView(nextView: TrackTraceView, nextSetupId = setupId) {
    const next = new URLSearchParams(params);
    next.set('view', nextView);
    next.delete('record');
    if (nextSetupId) next.set('setup', nextSetupId);
    setParams(next);
  }
  function selectPreparation(kind: 'linked' | 'unlinked') {
    const next=new URLSearchParams(params);next.set('prepare',kind);next.set('view','start');
    if(kind==='unlinked')next.delete('setup');setParams(next);
  }
  function openRecorder(id:string) {const next=new URLSearchParams(params);next.set('view','start');next.set('record',id);setParams(next);}
  function reviewRecording(id:string) {const next=new URLSearchParams(params);next.delete('record');next.delete('setup');next.set('view','review');next.set('session',id);setParams(next);}
  const workspace = (unlinked=false) => <TraceWorkspace key={userId + ':' + permissionKey + ':' + (unlinked ? 'unlinked' : setupId) + ':' + view+':'+params.get('session')} userId={userId!} revision={permissionKey} setupId={unlinked ? null : setupId} canRecord={canRecord} trackId={trackId} unlinked={unlinked} onRecord={openRecorder} initialSessionId={params.get('session')} onSelectTrack={id => {const next=new URLSearchParams(params);if(id)next.set('track',id);else next.delete('track');setParams(next);}} mode={view === 'review' ? 'review' : view === 'start' ? 'start' : 'all'} />;
  return <main className="min-h-screen bg-[#F5F5F7] px-4 py-6 text-[#1A1B23]">
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/app" className="inline-block py-2 text-[#007DAE] underline">Back to OnlyFast</Link>
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{TRACK_TRACE_NAME}</h1><TrackTraceBetaBadge /></div>
      {access.allowed && userId && (canRecord || ['review','session'].includes(view)) ? <>
        {view !== 'menu' && <button onClick={() => selectView('menu')} className="py-2 text-[#007DAE] underline">Back to Track Trace menu</button>}
        {canRecord && !recordingId && <TrackTraceRecovery key={userId+permissionKey+view} userId={userId} onResume={openRecorder}/>}
        {!canRecord && ['start','scan'].includes(view) ? <section className="rounded-2xl border bg-white p-5" role="status">Historical telemetry is read-only. Pro or Factory is required to prepare or record a session. <button className="underline" onClick={() => selectView('review')}>Review saved sessions</button></section>
          : recordingId && view==='start' ? <TrackTraceRecorder key={userId+permissionKey+recordingId} userId={userId} sessionId={recordingId} onSaved={reviewRecording}/>
          : view === 'library' ? <TrackTraceLibrary userId={userId} revision={permissionKey} onSelect={track => { const next=new URLSearchParams(params); next.set('track',track.id);next.set('view','start');setParams(next); }} />
          : view === 'scan' ? <TrackTraceScanner key={userId+permissionKey} userId={userId} revision={permissionKey}/> : view === 'start' ? <>
          <section className="rounded-2xl border bg-white p-5" aria-label="Start Session options"><h2 className="text-lg font-bold">Start Session</h2><p className="mt-2 text-sm text-[#6B7280]">Choose how to prepare your circuit recording.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={() => selectPreparation('linked')} aria-pressed={preparation==='linked'} className="rounded-xl border p-4 text-left font-semibold text-[#007DAE]">Link to Existing Setup</button>
            <button onClick={() => selectPreparation('unlinked')} aria-pressed={preparation==='unlinked'} className="rounded-xl border p-4 text-left font-semibold text-[#007DAE]">Record Without Setup</button>
          </div></section>
          {preparation==='unlinked' ? workspace(true) : preparation==='linked' ? setupId ? workspace() : <TraceSetupPicker key={userId + ':' + permissionKey} userId={userId} revision={permissionKey} onSelect={id => selectView('start', id)} /> : null}
        </>
          : ['review', 'session'].includes(view) ? workspace()
          : <TrackTraceMenu onSelect={selectView} canRecord={canRecord} />}
      </>
        : <section className="rounded-2xl border bg-white p-5" aria-live="polite">
          {!userId ? <p><Link to="/login" className="underline">Sign in</Link> to check your access.</p>
            : access.navigationLocked ? <><h2 className="font-bold">Unlock {TRACK_TRACE_NAME}</h2><p className="mt-2">Recording and changes are included with Pro and Factory.</p><Link to="/upgrade" className="mt-3 inline-block text-[#007DAE] underline">Explore Pro access</Link>
              {access.allowed && <Link to="/track-trace?view=review" className="mt-3 block py-2 text-[#007DAE] underline">View saved telemetry</Link>}</>
            : <p>{access.isError ? 'Access could not be verified. Refresh to try again.' : 'Checking access…'}</p>}
        </section>}
    </div>
  </main>;
}
