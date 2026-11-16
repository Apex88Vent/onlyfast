import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { traceRpc } from './api';
import type { LapTelemetrySample } from './circuit/types';
import TracePathPreview from './TracePathPreview';

export default function TrackTraceTelemetry({userId,revision,sessionId}:{userId:string;revision:string;sessionId:string}) {
  const [after,setAfter]=useState(-1);
  const samples=useQuery({queryKey:['track_trace','samples',userId,revision,sessionId,after],queryFn:()=>traceRpc<LapTelemetrySample[]>('get_track_trace_samples',{p_session_id:sessionId,p_after:after}),retry:false,gcTime:0});
  const rows=samples.data??[];
  const speeds=rows.map(s=>s.speed).filter((s):s is number=>s!==null&&Number.isFinite(s));
  return <div className="mt-4 space-y-3" aria-label="Recorded GPS telemetry">
    {samples.isPending?<p role="status">Loading GPS samples…</p>:samples.isError?<p role="alert">GPS samples could not be loaded. <button className="underline" onClick={()=>void samples.refetch()}>Retry</button></p>:rows.length?<>
      <p className="text-sm">Samples {rows[0].sampleIndex+1}–{rows[rows.length-1].sampleIndex+1} · {new Date(rows[0].timestamp).toLocaleTimeString()}–{new Date(rows[rows.length-1].timestamp).toLocaleTimeString()}</p>
      {!!speeds.length&&<p className="text-sm">GPS speed in this page: max {(Math.max(...speeds)*2.2369362921).toFixed(1)} mph · average {(speeds.reduce((a,b)=>a+b,0)/speeds.length*2.2369362921).toFixed(1)} mph</p>}
      <TracePathPreview paths={[{label:'Raw GPS samples',points:rows.map(s=>({lat:s.latitude,lng:s.longitude})),color:'#007DAE'}]}/>
      <p className="text-xs text-slate-600">Raw GPS positions; gaps and poor fixes may affect this trace. Timing uses the recorded start/finish crossings. Smoothed lap summaries are saved separately.</p>
      <div className="flex gap-4">{after>=0&&<button className="text-sm underline" onClick={()=>setAfter(-1)}>First samples</button>}{rows.length===500&&<button className="text-sm underline" onClick={()=>setAfter(rows[rows.length-1].sampleIndex)}>Next samples</button>}</div>
    </>:<p className="text-sm text-slate-600">No Phase 2D GPS samples are saved in this session.</p>}
  </div>;
}
