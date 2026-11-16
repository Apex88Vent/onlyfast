import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { traceRpc, type TraceTrack, type TraceTrackDuplicate } from './api';

// Submission never publishes a map. Moderation is a server/operator operation.
export default function TrackTracePublication({ track }: { track: TraceTrack }) {
  const cache=useQueryClient();
  const [layout,setLayout]=useState('');
  const [location,setLocation]=useState(track.community_location || track.description || '');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [errors,setErrors]=useState<string[]>([]);
  const [duplicates,setDuplicates]=useState<TraceTrackDuplicate[]>([]);
  const key=layout.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
  async function submit(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');setErrors([]);
    try {
      const result=await traceRpc<{status:string;errors?:string[];duplicates?:TraceTrackDuplicate[]}>('submit_track_trace_scan',{
        p_track_id:track.id,p_layout_key:key,p_layout_name:layout.trim(),p_location:location.trim(),
      });
      if(result.status==='invalid')setErrors(result.errors || ['This scan needs geometry or metadata corrections before review.']);
      else if(result.status==='pending') {
        setDuplicates(result.duplicates || []);
        setMessage('Submitted for review. Your scan stays private until approved. Existing shared tracks have not changed.');
        await cache.invalidateQueries({queryKey:['track_trace','tracks']});
      } else setErrors(['Submission status could not be verified. Refresh before trying again.']);
    } catch {setErrors(['The scan could not be submitted. Check your access and saved scan, then try again.']);}
    finally{setBusy(false);}
  }
  return <details className="mt-4 border-t pt-3">
    <summary className="cursor-pointer py-2 text-sm font-semibold text-[#007DAE]">{track.submission?.status==='pending' ? 'Submission awaiting review' : 'Submit saved scan to community'}</summary>
    <p className="mt-2 text-xs text-[#6B7280]">Submit this saved circuit scan for geometry and duplicate review. Each facility layout stays separate. The scan remains private until a reviewer approves it.</p>
    {track.submission?.status==='rejected' && <p role="status" className="mt-2 text-sm">Changes requested: {track.submission.review_note || 'Review the scan and resubmit.'}</p>}
    <form onSubmit={event=>void submit(event)} className="mt-3 space-y-3" aria-label={'Submit '+(track.track_name||track.name)}>
      <label className="block text-sm font-medium" htmlFor={'layout-'+track.id}>Layout name<input id={'layout-'+track.id} value={layout} onChange={e=>setLayout(e.target.value)} placeholder="e.g. Main oval, short oval, clockwise" minLength={2} maxLength={80} required className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm font-medium" htmlFor={'location-'+track.id}>Location<input id={'location-'+track.id} value={location} onChange={e=>setLocation(e.target.value)} placeholder="City, region / country" minLength={3} maxLength={120} required className="mt-1 block w-full rounded-lg border p-2" /></label>
      <button type="submit" disabled={busy||!key} className="rounded-lg border border-[#007DAE] px-3 py-2 text-sm font-semibold text-[#007DAE] disabled:opacity-50">{busy?'Submitting…':track.submission?.status==='pending'?'Update submission':'Submit for review'}</button>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {errors.length>0 && <ul role="alert" className="mt-3 list-inside list-disc text-sm text-red-700">{errors.map((error,i)=><li key={i}>{error}</li>)}</ul>}
    {duplicates.length>0 && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"><p className="font-semibold">Possible existing tracks — review required</p><ul className="mt-2 space-y-1">{duplicates.map(item=><li key={item.id}>{item.track_name} · {item.community_layout_name||'Layout to review'} · v{item.version} · {item.distance_m} m away{item.same_layout?' · Same layout identity':''}</li>)}</ul><p className="mt-2">No tracks are merged or replaced automatically.</p></div>}
  </details>;
}
