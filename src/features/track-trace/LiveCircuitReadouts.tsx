import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock3, MapPin, Radio } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GForceIndicator, GForceTelemetryReadouts } from './views/GForceIndicator';
import { ReplayMap, type ReplayViewMode } from './views/ReplayMap';
import { formatLapTime } from './circuit/lapFiltering';
import { metersPerSecondToMilesPerHour, splitVehicleLongitudinalG } from './circuit/telemetryMath';
import { samplePoint, type CircuitRecorder } from './circuit/recorder';
import type { GpsPoint } from './circuit/onlylapsTrackScanUtils';

// Display only: the recorder, samples, timing gates and storage remain owned by
// the existing recorder controller. No sample is created by this component.
export function LiveCircuitReadouts({engine,started,name,running,fix,error,userId,sessionId,controls}:{engine:CircuitRecorder|null;started:string|null;name:string;running:boolean;fix:GpsPoint|null;error:string;userId:string;sessionId:string;controls?:ReactNode}) {
  const [now,setNow]=useState(Date.now);
  const [mapView,setMapView]=useState<ReplayViewMode>('full');
  useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[running]);
  const count=engine?.laps.length??0;
  const laps=useMemo(()=>count?engine!.finish(sessionId,userId):[],[count,engine,sessionId,userId]);
  const valid= laps.filter(l=>l.isValid);
  const latest=engine?.samples.at(-1);
  const motion=[latest?.lateralG,latest?.longitudinalG,latest?.verticalG].some(x=>typeof x==='number'&&Number.isFinite(x));
  const {accelG,brakingG}=splitVehicleLongitudinalG(latest?.longitudinalG);
  const active=running&&!!fix&&!error&&now-Date.parse(fix.timestamp)<=10000;
  const poorAccuracy=fix?.accuracy!=null&&fix.accuracy>75;
  const status=error?'GPS needs attention':active?'Recording':running?'Waiting for GPS':started?'Recording paused':'Ready to record';
  const elapsed=started?Math.max(0,now-Date.parse(started)):0;
  const stats=[['Elapsed time',`${Math.floor(elapsed/60000).toString().padStart(2,'0')}:${Math.floor(elapsed%60000/1000).toString().padStart(2,'0')}`],['Completed laps',String(count)],['Current lap',active&&engine?.lapStarted?formatLapTime(Math.max(0,now-Date.parse(engine.lapStarted))):'--'],['Last lap',formatLapTime(engine?.laps.at(-1)?.lapTimeMs)],['Best lap',formatLapTime(valid.length?Math.min(...valid.map(l=>l.lapTimeMs)):null)]];
  return <div className="min-w-0 space-y-4">
    <Card className="rounded-2xl bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{name}</h2><p className="mt-1 text-sm text-muted-foreground">{engine?.track?.map.track_name||'Free Record · circuit GPS'}</p></div><Badge variant="secondary" className={error?'bg-amber-100 text-amber-900':active?'bg-blue-50 text-[#007DAE]':'bg-muted text-muted-foreground'}><Radio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true"/>{status}</Badge></div><div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#007DAE]" aria-hidden="true"/>GPS accuracy: {fix?.accuracy==null?'Waiting for a fix':`±${Math.round(fix.accuracy)} m`}</span><span className="text-muted-foreground">{engine?.samples.length??0} GPS samples · {count} completed laps</span></div></Card>
    {error&&<Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertDescription>{error}</AlertDescription></Alert>}
    {poorAccuracy&&<Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertDescription>GPS accuracy is poor. Timing crossings require accuracy of 75 m or better. Move to an open area and wait for a precise fix.</AlertDescription></Alert>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{stats.map(([label,value])=><Card key={label} className={'min-w-0 rounded-2xl bg-card p-4 '+(label==='Elapsed time'?'col-span-2 sm:col-span-1':'')}><p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{label==='Elapsed time'&&<Clock3 className="h-4 w-4" aria-hidden="true"/>}{label}</p><p className="mt-2 whitespace-nowrap text-[clamp(1.4rem,5vw,2.25rem)] font-bold leading-tight tabular-nums text-foreground">{value}</p></Card>)}</div>
    {controls}
    <Card className="rounded-2xl bg-card p-4 sm:p-5"><h3 className="font-semibold">Speed & G-force</h3><div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)]"><GForceIndicator speedMph={metersPerSecondToMilesPerHour(latest?.speed)} lateralG={latest?.lateralG} accelG={accelG} brakingG={brakingG} active={motion} size="large"/><GForceTelemetryReadouts speedMph={metersPerSecondToMilesPerHour(latest?.speed)} lateralG={latest?.lateralG} accelG={accelG} brakingG={brakingG} active={motion}/></div>{!motion&&<p className="mt-3 text-sm text-muted-foreground">Motion data is unavailable until motion sensors provide a reading. Secure the phone with its top facing forward.</p>}</Card>
    <Card className="rounded-2xl bg-card p-4 sm:p-5"><h3 className="font-semibold">Sector information</h3>{laps.at(-1)?.sectors.length?<dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{laps.at(-1)!.sectors.map(s=><div key={s.sectorIndex} className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Last lap · Sector {s.sectorIndex}</dt><dd className="mt-1 font-semibold tabular-nums">{formatLapTime(s.durationMs)}</dd></div>)}</dl>:<p className="mt-2 text-sm text-muted-foreground">{engine?.track?'Sector times appear after a completed lap.':'A saved circuit with timing lines is required for automatic lap and sector timing.'}</p>}</Card>
    {!!engine?.samples.length&&<Card className="rounded-2xl bg-card p-4 sm:p-5"><h3 className="mb-3 font-semibold">Live track trace</h3><ReplayMap track={engine.track?.map} traces={[{id:'live',label:'Live GPS',path:engine.samples.map(samplePoint),progress:1,color:'#007DAE'}]} title="Live track trace" viewMode={mapView} onViewModeChange={setMapView}/></Card>}
  </div>;
}
