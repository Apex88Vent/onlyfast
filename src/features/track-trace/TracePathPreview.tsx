import type { GpsPoint } from './circuit/onlylapsTrackScanUtils';
export default function TracePathPreview({paths}:{paths:{label:string;points:Pick<GpsPoint,'lat'|'lng'>[];color:string}[]}) {
  const points=paths.flatMap(p=>p.points).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  if(points.length<2)return null;
  const minLat=Math.min(...points.map(p=>p.lat)),maxLat=Math.max(...points.map(p=>p.lat));
  const minLng=Math.min(...points.map(p=>p.lng)),maxLng=Math.max(...points.map(p=>p.lng));
  const cos=Math.cos((minLat+maxLat)/2*Math.PI/180);
  const width=(maxLng-minLng)*cos,height=maxLat-minLat,scale=260/Math.max(width,height,0.000001);
  return <figure className="rounded-xl border bg-slate-50 p-3"><svg viewBox="0 0 300 300" className="mx-auto max-h-72 w-full" role="img" aria-label="Recorded GPS geometry preview">
    {paths.map(path=><polyline key={path.label} points={path.points.map(p=>`${20+(p.lng-minLng)*cos*scale},${280-(p.lat-minLat)*scale}`).join(' ')} fill="none" stroke={path.color} strokeWidth="2"><title>{path.label}</title></polyline>)}
  </svg><figcaption className="flex flex-wrap gap-3 text-xs">{paths.map(p=><span key={p.label} style={{color:p.color}}>{p.label}: {p.points.length} points</span>)}</figcaption></figure>;
}
