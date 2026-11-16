import { useEffect, useRef, useState } from 'react';
import { traceRpc } from './api';
import { useCircuitGps } from './useCircuitGps';
import { loadScanDraft, saveScanDraft } from './recordingJournal';
import { calculateBoundingBox, calculateCenterPoint, calculateDistanceMeters, generateAreaKey, generateFacilityKey, shouldAddGpsPoint, summarizeGpsAccuracy, type GpsPoint } from './circuit/onlylapsTrackScanUtils';
import type { CornerDefinition, SectorLineDefinition } from './circuit/types';
import TracePathPreview from './TracePathPreview';
import TrackTracePublication from './TrackTracePublication';
import type { TraceTrack } from './api';

type PathKind='outside'|'inside'|'finish';
interface ScanDraft { id:string; name:string; location:string; type:string; direction:string; outside:GpsPoint[]; inside:GpsPoint[]; finish:GpsPoint[]; corners:CornerDefinition[]; lines:SectorLineDefinition[]; broken:PathKind[]; savedId?:string; recordingPath?:PathKind|null; }
const fresh=():ScanDraft=>({id:crypto.randomUUID(),name:'',location:'',type:'dirt_oval',direction:'counterclockwise',outside:[],inside:[],finish:[],corners:[],lines:[],broken:[]});
const button='rounded-lg border border-[#007DAE] px-3 py-3 text-sm font-semibold text-[#007DAE] disabled:opacity-50';
function pathLength(points:GpsPoint[]) {return points.slice(1).reduce((sum,p,i)=>sum+calculateDistanceMeters(points[i],p),0);}
function atProgress(path:GpsPoint[],progress:number) {
  const target=pathLength(path)*progress;let distance=0;
  for(let i=1;i<path.length;i++){distance+=calculateDistanceMeters(path[i-1],path[i]);if(distance>=target)return path[i];}
  return path[path.length-1];
}
export default function TrackTraceScanner({userId,revision}:{userId:string;revision:string}) {
  const [draft,setDraft]=useState<ScanDraft|null>(null);
  const current=useRef<ScanDraft|null>(null);
  const path=useRef<PathKind|null>(null);
  const writes=useRef(Promise.resolve());
  const mounted=useRef(true);
  const [capturing,setCapturing]=useState<PathKind|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [cornerRange,setCornerRange]=useState({start:'',apex:'',end:''});
  const [sectorA,setSectorA]=useState<GpsPoint|null>(null);
  const [sectorProgress,setSectorProgress]=useState('');
  const [savedTrack,setSavedTrack]=useState<TraceTrack|null>(null);
  const [gpsGap,setGpsGap]=useState(false);
  function update(next:ScanDraft) {
    current.current=next;setDraft(next);
    writes.current=writes.current.then(()=>saveScanDraft(userId,next)).catch(()=>{
      path.current=null;gps.stop();if(mounted.current){setCapturing(null);setError('Local scan storage failed. Keep this page open, download the retained scan, and retry saving.');}
    });
  }
  const gps=useCircuitGps(point=>{
    const d=current.current,k=path.current;
    if(!d||!k)return;
    const previous=d[k][d[k].length-1];
    if(previous&&Date.parse(point.timestamp)<=Date.parse(previous.timestamp))return;
    if(previous&&Date.parse(point.timestamp)-Date.parse(previous.timestamp)>10000){update({...d,broken:[...new Set([...d.broken,k])]});path.current=null;setCapturing(null);setGpsGap(true);setError('GPS gap detected. Capture stopped so the boundary is not joined across missing data. Clear and restart this boundary after GPS recovers.');return;}
    if(point.accuracy===null||point.accuracy>25)return;
    if(d[k].length>=10000){path.current=null;setCapturing(null);setError('Boundary reached the 10,000 point limit.');return;}
    if(shouldAddGpsPoint(previous,point))update({...d,[k]:[...d[k],point]});
  },()=>{const d=current.current,k=path.current;if(d&&k)update({...d,broken:[...new Set([...d.broken,k])]});path.current=null;setCapturing(null);setGpsGap(true);});
  useEffect(()=>{
    mounted.current=true;void loadScanDraft<ScanDraft>(userId).then(value=>{if(mounted.current){current.current=value?{...value,broken:[...new Set([...(value.broken??[]),...(value.recordingPath?[value.recordingPath]:[])])],recordingPath:null}:fresh();setDraft(current.current);}}).catch(()=>{if(mounted.current)setError('Local storage is unavailable; scanning cannot start safely.');});
    return()=>{mounted.current=false;};
  },[userId]);
  async function save() {
    const d=current.current;if(!d)return;path.current=null;setCapturing(null);gps.stop();setBusy(true);setError('');
    try {
      await writes.current;
      const all=[...d.outside,...d.inside,...d.finish],center=calculateCenterPoint(all),bbox=calculateBoundingBox(all);
      if(!center||!bbox)throw new Error('Capture the outside, inside and start/finish paths before saving.');
      if(d.broken.length)throw new Error('Clear and recapture interrupted boundaries before saving this scan.');
      if(!d.name.trim()||!d.location.trim())throw new Error('Track name and location are required.');
      const result=await traceRpc<{saved:boolean;id?:string;errors?:string[]}>('save_track_trace_scan',{p_scan_id:d.id,p_scan:{
        track_name:d.name.trim(),community_location:d.location.trim(),track_type:d.type,track_shape:'custom_unknown',direction:d.direction,
        source:'track_scan',map_source:'track_scan',scan_status:'scanned',is_open_route:false,center_lat:center.lat,center_lng:center.lng,bbox,
        area_key:generateAreaKey(center.lat,center.lng),facility_key:generateFacilityKey(center.lat,center.lng),outside_path:d.outside,inside_path:d.inside,start_finish_path:d.finish,
        gps_summary:summarizeGpsAccuracy(d.outside,d.finish,d.inside),track_length_meters:(pathLength(d.outside)+pathLength(d.inside))/2,
        corner_definitions:{version:'manual_track_editor_v1',generatedAt:new Date().toISOString(),trackType:d.type,travelDirection:d.direction,source:'manual_track_editor',corners:d.corners},
      },p_sectors:{sector_count:d.lines.length+1,lines:d.lines}});
      if(!result.saved||!result.id)throw new Error(result.errors?.join('. ')||'Scan was not saved.');
      const next={...d,savedId:result.id};update(next);
      const tracks=await traceRpc<TraceTrack[]>('search_track_trace_tracks',{p_search:d.name.trim(),p_scope:'mine'});
      if(mounted.current)setSavedTrack(tracks.find(t=>t.id===result.id)??null);
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'Scan save failed. Retained geometry remains available.');}
    finally{if(mounted.current)setBusy(false);}
  }
  function addCorner() {
    const d=current.current;if(!d||!d.outside.length)return;
    const start=Number(cornerRange.start)/100,apex=Number(cornerRange.apex)/100,end=Number(cornerRange.end)/100;
    if(!cornerRange.start||!cornerRange.apex||!cornerRange.end||!(start>=0&&start<apex&&apex<end&&end<=1)){setError('Enter ordered start, apex and end percentages along the recorded outside boundary.');return;}
    update({...d,corners:[...d.corners,{cornerNumber:d.corners.length+1,startProgress:start,apexProgress:apex,endProgress:end,primaryDirection:d.direction==='clockwise'?'right':'left',physicalLengthMeters:pathLength(d.outside)*(end-start),confidence:1,detectionMethod:'manual_range',detectionVersion:'manual_track_editor_v1',apex:atProgress(d.outside,apex)}]});
    setCornerRange({start:'',apex:'',end:''});setError('');
  }
  function addSector() {
    const d=current.current,point=gps.fix,progress=Number(sectorProgress)/100;
    if(!d||!sectorA||!point||point.accuracy===null||point.accuracy>25||Date.now()-Date.parse(point.timestamp)>10000||!sectorProgress||!(progress>0&&progress<1)||calculateDistanceMeters(sectorA,point)<1){setError('Capture two distinct precise GPS endpoints and a sector progress between 0 and 100%.');return;}
    if(d.lines.some(l=>Math.abs(l.progress-progress)<0.04)){setError('Sector gates must be at least 4% apart.');return;}
    const lines=[...d.lines,{id:crypto.randomUUID(),sectorIndex:0,progress,start:sectorA,end:point,expectedDirection:null} as SectorLineDefinition].sort((a,b)=>a.progress-b.progress).map((l,i)=>({...l,sectorIndex:i+1}));
    update({...d,lines});setSectorA(null);setSectorProgress('');setError('');
  }
  function download() {const url=URL.createObjectURL(new Blob([JSON.stringify(current.current)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='track-trace-scan.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(!draft)return <section className="rounded-2xl border bg-white p-5"><p role={error?'alert':'status'}>{error||'Loading retained scan…'}</p></section>;
  return <section className="space-y-4 rounded-2xl border bg-white p-5" aria-label="Circuit scanner">
    <h2 className="text-lg font-bold">Scan circuit track</h2>
    <p className="text-sm">Walk the outside and inside boundaries and across the start/finish line. Each boundary must return within 50 m of its start. Only fixes with accuracy of 25 m or better enter the scan. Scans save privately for review before community submission.</p>
    {draft.savedId ? <><p role="status">Private scan saved. Open Track Library to select it or submit it for approval.</p>{savedTrack&&<TrackTracePublication key={savedTrack.id+revision} track={savedTrack}/>}<button className={button} onClick={()=>{current.current=fresh();update(current.current);setSavedTrack(null);}}>Start another scan</button></> : <>
      <div className="grid gap-3 sm:grid-cols-2"><label>Track name<input className="mt-1 w-full rounded-lg border p-3" value={draft.name} maxLength={80} onChange={e=>update({...draft,name:e.target.value})}/></label><label>Location<input className="mt-1 w-full rounded-lg border p-3" value={draft.location} maxLength={160} onChange={e=>update({...draft,location:e.target.value})}/></label>
      <label>Circuit type<select className="mt-1 w-full rounded-lg border p-3" value={draft.type} onChange={e=>update({...draft,type:e.target.value})}><option value="dirt_oval">Dirt oval</option><option value="pavement_oval">Pavement oval</option><option value="road_course">Closed road course</option></select></label>
      <label>Travel direction<select className="mt-1 w-full rounded-lg border p-3" value={draft.direction} onChange={e=>update({...draft,direction:e.target.value})}><option value="counterclockwise">Counterclockwise</option><option value="clockwise">Clockwise</option></select></label></div>
      {!gps.running&&<button className={button} onClick={()=>gps.start()}>Enable scan GPS</button>}
      <p role="status" className="text-sm">GPS accuracy: {gps.fix?.accuracy!=null?`±${Math.round(gps.fix.accuracy)} m`:'Waiting for a fix'} · {capturing?`Capturing ${capturing} path`:'Boundary capture paused'}</p>
      <p className="text-sm text-slate-600">{gps.wake}</p>
      <div className="flex flex-wrap gap-3">{(['outside','inside','finish'] as PathKind[]).map(k=><button key={k} className={button} disabled={!gps.running||!!capturing||draft.broken.includes(k)} onClick={()=>{update({...draft,recordingPath:k});path.current=k;setCapturing(k);setGpsGap(false);}}>{draft[k].length?'Continue':'Capture'} {k==='finish'?'start/finish':k} ({draft[k].length})</button>)}
        {capturing&&<button className={button} onClick={()=>{path.current=null;setCapturing(null);update({...draft,recordingPath:null});}}>Pause boundary capture</button>}
      </div>
      {(gpsGap||!capturing)&&<details className="text-sm"><summary className="cursor-pointer py-2">Restart an incomplete boundary</summary><div className="flex flex-wrap gap-3">{(['outside','inside','finish'] as PathKind[]).map(k=><button key={k} className={button} onClick={()=>update({...draft,[k]:[],broken:draft.broken.filter(x=>x!==k),recordingPath:null,...(k==='outside'?{corners:[],lines:[]}: {})})}>Clear {k} capture</button>)}</div></details>}
      <fieldset className="space-y-2 rounded-xl border p-3"><legend className="font-semibold">Corner definitions</legend><p className="text-sm">Mark each corner's range as percentages of distance along the outside capture, starting from its first point. Apex positions use your recorded geometry.</p><div className="grid grid-cols-3 gap-2">{(['start','apex','end'] as const).map(k=><label key={k} className="text-sm">{k} %<input type="number" min="0" max="100" step="0.1" className="mt-1 w-full rounded-lg border p-2" value={cornerRange[k]} onChange={e=>setCornerRange({...cornerRange,[k]:e.target.value})}/></label>)}</div><button className={button} disabled={!draft.outside.length||draft.corners.length>=40} onClick={addCorner}>Add corner</button><ul className="text-sm">{draft.corners.map((c,i)=><li key={i}>Corner {c.cornerNumber}: {(c.startProgress*100).toFixed(1)}–{(c.endProgress*100).toFixed(1)}% <button className="underline" onClick={()=>update({...draft,corners:draft.corners.filter((_,n)=>n!==i).map((x,n)=>({...x,cornerNumber:n+1}))})}>Remove</button></li>)}</ul></fieldset>
      <fieldset className="space-y-2 rounded-xl border p-3"><legend className="font-semibold">Sector gates (optional, up to 5 sectors)</legend><p className="text-sm">For each gate, capture one endpoint, walk across the timing line, then capture the other. With no gates, the full lap is one sector.</p><label className="block text-sm">Progress along circuit %<input type="number" min="1" max="99" className="ml-2 w-24 rounded-lg border p-2" value={sectorProgress} onChange={e=>setSectorProgress(e.target.value)}/></label><div className="flex flex-wrap gap-3"><button className={button} disabled={!gps.running||draft.lines.length>=4} onClick={()=>{if(gps.fix?.accuracy!=null&&gps.fix.accuracy<=25&&Date.now()-Date.parse(gps.fix.timestamp)<=10000)setSectorA(gps.fix);else setError('Wait for a precise current GPS fix.');}}>Capture first gate endpoint{sectorA?' again':''}</button><button className={button} disabled={!sectorA||draft.lines.length>=4||!gps.running} onClick={addSector}>Capture second endpoint and add gate</button></div><p className="text-sm">{draft.lines.length+1} sectors configured</p>{draft.lines.map((l,i)=><button key={l.id} className="mr-3 text-sm underline" onClick={()=>update({...draft,lines:draft.lines.filter((_,n)=>n!==i).map((x,n)=>({...x,sectorIndex:n+1}))})}>Remove gate {i+1}</button>)}</fieldset>
      <button className="rounded-lg bg-[#007DAE] px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy||!!capturing} onClick={()=>void save()}>{busy?'Saving private scan…':'Save private circuit scan'}</button>
    </>}
    <TracePathPreview paths={[{label:'Outside',points:draft.outside,color:'#007DAE'},{label:'Inside',points:draft.inside,color:'#64748b'},{label:'Start/finish',points:draft.finish,color:'#b45309'}]}/>
    <button className="text-sm underline" onClick={download}>Download retained scan</button>
    {(error||gps.error)&&<p role="alert" className="text-sm text-red-700">{error||gps.error}</p>}
  </section>;
}
