import { useEffect, useRef, useState } from 'react';
import { traceRpc, type TraceContext } from './api';
import { CircuitRecorder, samplePoint, type RecordingTrack } from './circuit/recorder';
import { emptyMotionTelemetry } from './circuit/telemetryMath';

import { listDrafts, loadSamples, putDraft, putSample, removeDraft, type RecordingDraft } from './recordingJournal';
import { useCircuitGps } from './useCircuitGps';
import {LiveCircuitReadouts} from './LiveCircuitReadouts';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

import type { PhoneMountOrientation } from './circuit/types';
import { PhoneOrientationCalibration } from './views/PhoneOrientationCalibration';
import GpsReadiness from './GpsReadiness';

const button = 'min-h-12 rounded-lg bg-[#007DAE] px-4 py-3 font-semibold text-white disabled:opacity-50';
export default function TrackTraceRecorder({ userId, sessionId, onSaved }: { userId: string; sessionId: string; onSaved: (id: string) => void }) {
  const draft = useRef<RecordingDraft | null>(null);
  const engine = useRef<CircuitRecorder | null>(null);
  const localWrites = useRef(Promise.resolve());
  const uploading = useRef(false);
  const mounted = useRef(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sync, setSync] = useState('');
  const [version, redraw] = useState(0);
  const [confirmCode, setConfirmCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [completed, setCompleted] = useState(false);
  const [name, setName] = useState('Circuit session');
  const [canStart, setCanStart] = useState(false);
  const [, setNow] = useState(Date.now());
  const [mountOrientation,setMountOrientation]=useState<PhoneMountOrientation|null>(null);
  function interrupt() {
    if (!draft.current || !engine.current) return;
    const index = engine.current.samples.length;
    if (!draft.current.interruptions.includes(index)) draft.current.interruptions.push(index);
    engine.current.interrupt();
    localWrites.current = localWrites.current.then(() => putDraft(draft.current!)).catch(storageError);
  }
  const gps = useCircuitGps((point, motion) => {
    if (!draft.current || draft.current.ended || !engine.current) return;
    const sample = engine.current.add(point, motion);
    if (!sample) return;
    Object.assign(sample,{phoneMountOrientation:mountOrientation??'top_forward'});
    localWrites.current = localWrites.current.then(() => putSample(draft.current!, sample)).then(() => {
      if (mounted.current) redraw(v => v + 1);
    }).catch(storageError);
  }, interrupt,mountOrientation??'top_forward');
  function storageError() {
    gps.stop();
    if (mounted.current) setError('Local storage failed. GPS stopped to protect your recording. Keep this page open; download the retained recording or retry saving.');
  }
  async function upload() {
    if (uploading.current || !draft.current || !engine.current) return;
    uploading.current = true;
    const d = draft.current;
    try {
      await localWrites.current;
      // Snapshot only locally committed samples. Repeated requests use the same
      // recorder/index/content and are accepted once by the server.
      const retained = await loadSamples(d.owner, d.session);
      for (let start = d.acknowledged; start < retained.length; start += 100) {
        const batch = retained.slice(start, start + 100);
        await traceRpc('append_track_trace_samples', { p_session_id: d.session, p_recorder_id: d.recorder, p_samples: batch });
        d.acknowledged = start + batch.length;
      }
      if (mounted.current && d.acknowledged>0) setSync(`${d.acknowledged} samples saved on server.`);
    } catch { if (mounted.current) setSync('Upload pending. Samples are retained on this device; reconnect and retry. Access changes may also prevent uploading.'); }
    finally { uploading.current = false; }
  }
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const detail = await traceRpc<TraceContext>('get_track_trace_session', { p_session_id: sessionId });
        let existing = (await listDrafts(userId)).find(d => d.session === sessionId);
        const server = detail.session.device_info?.track_trace_recording as {recorder:string;started:string;status:string;track:RecordingTrack|null}|undefined;
        if (!existing && server?.status === 'recording') {
          existing = { owner:userId,session:sessionId,recorder:server.recorder,started:server.started,track:server.track,ended:null,acknowledged:0,interruptions:[] };
          // Server recovery also works if the device journal was evicted. It
          // uses the original map/version snapshot, never a new track clone.
          let after=-1;
          while (true) {
            const rows = await traceRpc<import('./circuit/types').LapTelemetrySample[]>('get_track_trace_samples',{p_session_id:sessionId,p_after:after});
            if (!mounted.current) return;
            for (const row of rows) {
              if (row.sampleIndex!==after+1) throw new Error('Incomplete server journal.');
              await putSample(existing,row); after=row.sampleIndex;
            }
            if(rows.length<500)break;
          }
          await putDraft(existing);
        }
        if (existing && !existing.track && server?.track) existing.track=server.track;
        if (!mounted.current) return;
        setName(detail.session.session_name || detail.session.name);
        setCanStart(!detail.session.started_at && !detail.session.ended_at || !!existing);
        if (existing) {
          const retained=await loadSamples(userId, sessionId);
          const recoveredOrientation=existing.mountOrientation??(retained[0] as {phoneMountOrientation?:PhoneMountOrientation}|undefined)?.phoneMountOrientation;
          const orientation=recoveredOrientation&&['top_forward','bottom_forward','left_forward','right_forward'].includes(recoveredOrientation)?recoveredOrientation:null;
          setMountOrientation(orientation);if(orientation)existing.mountOrientation=orientation;
          existing.acknowledged = 0;
          const restored = new CircuitRecorder(existing.track);
          for (const sample of retained) {
            if (existing.interruptions.includes(sample.sampleIndex) || (sample as {interruptionBefore?:boolean}).interruptionBefore) restored.interrupt();
            const rebuilt=restored.add(samplePoint(sample), { ...emptyMotionTelemetry(), ...sample });
            if(rebuilt)Object.assign(rebuilt,sample);
          }
          if (!mounted.current) return;
          draft.current = existing; engine.current = restored;
          if (!existing.ended) {
            existing.interruptions.push(restored.samples.length); restored.interrupt();
            await putDraft(existing);
          }
          redraw(v => v + 1);
        }
        setCompleted(!!detail.session.ended_at && !existing); setReady(true);
      } catch { if (mounted.current) setError('This recording could not be loaded. Retained local data has not been removed.'); }
    })();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const timer = window.setInterval(() => { void upload(); }, 3000);
    const online = () => void upload(); window.addEventListener('online', online);
    return () => { mounted.current = false; window.clearInterval(clock); window.clearInterval(timer); window.removeEventListener('online', online); };
    // This component is keyed by owner/session. Draft and upload refs hold the
    // current journal; permission changes unmount it and stop GPS.
  }, [userId, sessionId]);

  async function arm() {
    setBusy(true); setError('');
    try {
      let d = draft.current;
      if (!d) {
        d = { owner: userId, session: sessionId, recorder: crypto.randomUUID(), started: new Date().toISOString(), track: null, ended: null, acknowledged: 0, interruptions: [],mountOrientation:mountOrientation??'top_forward' };
        await putDraft(d); draft.current = d;
      }
      const response = await traceRpc<{ track: RecordingTrack | null; status: string }>('begin_track_trace_recording', { p_session_id: sessionId, p_recorder_id: d.recorder, p_started_at: d.started });
      const previousTrack = d.track;
      d.track = response.track;
      await putDraft(d);
      if (!mounted.current) return;
      if (response.status === 'completed') { setCompleted(true); return; }
      if (!engine.current || previousTrack?.map.id !== d.track?.map.id) {
        const samples = engine.current?.samples ?? [];
        engine.current = new CircuitRecorder(d.track);
        for (const sample of samples) {
          if (d.interruptions.includes(sample.sampleIndex) || (sample as {interruptionBefore?:boolean}).interruptionBefore) engine.current.interrupt();
          const rebuilt=engine.current.add(samplePoint(sample), { ...emptyMotionTelemetry(), ...sample });
          if(rebuilt)Object.assign(rebuilt,sample);
        }
      }
      else interrupt();
      gps.start(); redraw(v => v + 1);
    } catch { if (mounted.current) setError('Recording could not start. Check access and connectivity, then retry. The prepared session and any retained recording remain available.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function save() {
    const d = draft.current, e = engine.current;
    if (!d || !e || (confirmCode && answer !== confirmCode)) return;
    if(!e.samples.length){
      gps.stop();setConfirmCode('');setAnswer('');
      setError('No GPS recording was captured. No samples were received, so this session has not been completed. Resume GPS after checking location access, or download diagnostics.');
      return;
    }
    setBusy(true); setError(''); gps.stop(); setConfirmCode(''); setAnswer('');
    try {
      d.ended ??= new Date().toISOString();
      await localWrites.current;
      // Retry all buffered fixes too, including a prior local-storage failure.
      await putDraft(d); for (const sample of e.samples) await putSample(d, sample);
      await upload();
      if (d.acknowledged !== e.samples.length) throw new Error('Upload is incomplete.');
      const result = await traceRpc<{ saved: boolean }>('complete_track_trace_recording', { p_session_id: d.session, p_recorder_id: d.recorder, p_ended_at: d.ended,
        p_sample_count: e.samples.length, p_laps: e.finish(d.session, d.owner), p_interruptions: d.interruptions });
      if (!result.saved) throw new Error('Completion was not confirmed.');
      await removeDraft(d.owner, d.session);
      if (mounted.current) { setCompleted(true); onSaved(d.session); }
    } catch { if (mounted.current) setError('Save not confirmed. Your recording remains on this device. Keep it here and retry after reconnecting; no samples have been discarded.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  function download() {
    const url=URL.createObjectURL(new Blob([JSON.stringify({draft:draft.current,samples:engine.current?.samples,laps:engine.current?.laps,diagnostics:{gpsState:gps.state,errorCode:gps.errorCode,error:gps.error,secureContext:window.isSecureContext,visibility:document.visibilityState,wake:gps.wake,userAgent:navigator.userAgent}})],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download=`track-trace-${sessionId}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const e=engine.current, d=draft.current;
  const controls=<Card className="space-y-3 rounded-2xl p-4">
    <p role="status" className="text-sm">{gps.running?gps.state==='active'?'GPS recording active':'Waiting for GPS · no current fix':d?.ended?'Recording stopped · save pending':d?'Retained recording · GPS paused':'Ready to arm GPS'}</p>
    {!d&&<><PhoneOrientationCalibration selectedOrientation={mountOrientation} onChange={setMountOrientation} warning={null}/><GpsReadiness/></>}
    <div className="flex flex-wrap gap-3">
      {!gps.running&&!d?.ended&&<Button className={button} disabled={!ready||busy||!canStart} onClick={()=>void arm()}>{busy?'Starting…':d?'Resume GPS':'Arm and start GPS'}</Button>}
      {gps.running&&<Button variant="outline" className="min-h-12" onClick={()=>void gps.enableMotion()}>Enable motion sensors</Button>}
      {d&&!d.ended&&<Button variant="outline" className="min-h-12" disabled={busy} onClick={()=>{setAnswer('');setConfirmCode(String(1000+crypto.getRandomValues(new Uint32Array(1))[0]%9000));}}>End and save session</Button>}
      {d?.ended&&<Button className={button} disabled={busy} onClick={()=>void save()}>Retry save</Button>}
      {d&&<Button variant="outline" className="min-h-11" onClick={download}>Download retained recording</Button>}
    </div><p className="text-xs leading-5 text-muted-foreground">{gps.wake} Background GPS may pause; interrupted laps restart at a valid crossing.</p><p className="text-xs text-muted-foreground">{gps.motionStatus}</p>
  </Card>;
  return <section className="min-w-0 space-y-3" aria-label="Live circuit recorder" data-recording-revision={version}>
    {!ready&&!error&&<p role="status">Loading recording…</p>}
    <LiveCircuitReadouts engine={e} started={d?.started??null} name={name} running={gps.running} fix={gps.state==='active'?gps.fix:null} error={gps.error} userId={userId} sessionId={sessionId} controls={completed?<Button onClick={()=>onSaved(sessionId)}>Review saved recording</Button>:controls}/>
    <p className="text-xs text-muted-foreground">G-force visual guide: 0.75 G yellow · 1.50 G red. Actual measured numbers are preserved.</p>
    <Dialog open={!!confirmCode} onOpenChange={open=>{if(!open)setConfirmCode('');}}><DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>End recording</DialogTitle><DialogDescription>GPS continues until you confirm. Recorded samples are retained.</DialogDescription></DialogHeader><form className="space-y-3" aria-label="Confirm end session" onSubmit={event=>{event.preventDefault();void save();}}><p>To end this session, enter <strong className="font-mono">{confirmCode}</strong>.</p><label htmlFor="trace-end-code" className="block">Four-digit confirmation</label><input id="trace-end-code" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="off" className="min-h-12 w-full rounded-lg border p-3" value={answer} onChange={e=>setAnswer(e.target.value)}/><div className="flex flex-wrap gap-3"><Button className={button} disabled={answer!==confirmCode||busy||!e?.samples.length}>Confirm end and save</Button><Button variant="outline" type="button" onClick={()=>setConfirmCode('')}>Keep recording</Button></div>{!e?.samples.length&&<p className="text-sm text-amber-900">No GPS samples have arrived. Resume GPS and wait for a fix before saving.</p>}</form></DialogContent></Dialog>
    {sync&&!!e?.samples.length&&<p role="status" className="text-sm">{sync} <Button variant="link" onClick={()=>void upload()}>Retry sync</Button></p>}
    {(error||gps.error)&&<p role="alert" className="text-sm text-red-700">{error||gps.error}</p>}
  </section>;
}
export function TrackTraceRecovery({userId,onResume}:{userId:string;onResume:(id:string)=>void}) {
  const [drafts,setDrafts]=useState<RecordingDraft[]>([]);
  useEffect(()=>{let active=true;void listDrafts(userId).then(rows=>{if(active)setDrafts(rows);}).catch(()=>undefined);return()=>{active=false;};},[userId]);
  return drafts.length ? <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Retained recordings"><h2 className="font-semibold">Retained recordings on this device</h2><p className="text-sm">Resume or retry saving after an interruption.</p>{drafts.map(d=><button key={d.session} className="block py-2 text-[#007DAE] underline" onClick={()=>onResume(d.session)}>{new Date(d.started).toLocaleString()} · {d.ended?'Save pending':'GPS interrupted'}</button>)}</section> : null;
}
