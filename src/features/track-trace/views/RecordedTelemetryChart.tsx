import {useMemo} from 'react';
import type {LapTelemetrySample} from '../circuit/types';
type Series={key:'speed'|'lateralG'|'longitudinalG';label:string;color:string;factor?:number};
export function RecordedTelemetryChart({samples,series,unit,title}:{samples:LapTelemetrySample[];series:Series[];unit:string;title:string}){
 const plot=useMemo(()=>{
  const points=samples.map(s=>({sample:s,time:Date.parse(s.timestamp)})).filter(p=>Number.isFinite(p.time));
  const start=points[0]?.time??0,end=points.at(-1)?.time??start;
  const values=points.flatMap(p=>series.flatMap(s=>{const v=p.sample[s.key];return typeof v==='number'&&Number.isFinite(v)?[v*(s.factor??1)]:[];}));
  const low=values.reduce((a,b)=>Math.min(a,b),0),high=values.reduce((a,b)=>Math.max(a,b),1),x=(t:number)=>40+(t-start)/Math.max(1,end-start)*500,y=(v:number)=>145-(v-low)/(high-low)*120;
  return {start,end,low,high,values,paths:series.map(s=>{let d='',prior:number|null=null;for(const p of points){const value=p.sample[s.key];if(value===null||!Number.isFinite(value)){prior=null;continue;}const fresh=prior===null||p.time-prior>2000;d+=(fresh?' M':' L')+x(p.time).toFixed(2)+','+y(value*(s.factor??1)).toFixed(2);prior=p.time;}return {series:s,d};})};
 },[samples,series]);
 if(!plot.values.length)return <p className="text-sm text-muted-foreground">No recorded values are available for this chart.</p>;
 return <figure className="space-y-2 rounded-xl border border-border bg-card p-3"><figcaption className="text-sm font-medium">{title}</figcaption><svg role="img" aria-label={title} viewBox="0 0 560 180" className="h-auto w-full"><path d="M40 20V145H540" fill="none" stroke="#94a3b8"/>{plot.paths.map(({series:s,d})=><path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth="2"/>)}<text x="3" y="27" fontSize="11" fill="#475569">{plot.high.toFixed(1)}</text><text x="3" y="147" fontSize="11" fill="#475569">{plot.low.toFixed(1)}</text><text x="40" y="166" fontSize="11" fill="#475569">0 s</text><text x="492" y="166" fontSize="11" fill="#475569">{((plot.end-plot.start)/1000).toFixed(1)} s</text></svg><div className="flex flex-wrap gap-3 text-xs">{series.map(s=><span key={s.key} style={{color:s.color}}>{s.label} ({unit})</span>)}</div><p className="text-xs text-muted-foreground">Recorded sample time and values. Lines break across missing readings or gaps longer than two seconds.</p></figure>;
}
