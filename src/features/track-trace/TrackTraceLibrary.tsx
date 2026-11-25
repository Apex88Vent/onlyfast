import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { traceRpc, type TraceTrack } from './api';
import TrackTracePublication from './TrackTracePublication';
import {Link} from 'react-router-dom';

export default function TrackTraceLibrary({ userId, revision, onSelect }: {
  userId: string; revision: string; onSelect: (track: TraceTrack) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [input,setInput]=useState('');
  const [search,setSearch]=useState('');
  const [scope,setScope]=useState('available');
  const tracks = useQuery({
    queryKey: ['track_trace', 'tracks', userId, revision, offset,search,scope],
    queryFn: () => traceRpc<TraceTrack[]>('search_track_trace_tracks', { p_search:search,p_offset: offset,p_scope:scope }), retry: false, gcTime: 0,
  });
  return <section className="space-y-4" aria-label="Track Library">
    <h2 className="text-lg font-bold">Track Library</h2>
    <p className="text-sm text-[#6B7280]">Reuse approved community circuits or your own saved scans. Shared tracks are used directly; no import or new scan is required. Choosing a track prepares a session; it does not start GPS recording.</p>
    <div className="flex flex-wrap gap-3">
      <label className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-auto">Search by track name or location<input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setOffset(0);setSearch(input.trim());}}} maxLength={100} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <button type="button" onClick={()=>{setOffset(0);setSearch(input.trim());}} className="self-end rounded-lg border px-3 py-2 text-sm font-semibold text-[#007DAE]">Search tracks</button>
      <label className="text-sm font-medium">Browse<select aria-label="Browse" value={scope} onChange={e=>{setOffset(0);setScope(e.target.value);}} className="mt-1 block rounded-lg border bg-white p-2"><option value="available">All available tracks</option><option value="community">Shared community tracks</option><option value="mine">My saved scans</option></select></label>
    </div>
    {tracks.isPending ? <p role="status">Loading saved circuits…</p> : tracks.isError ? <div role="alert"><p>Saved circuits could not be loaded.</p><button className="mt-2 underline" onClick={() => void tracks.refetch()}>Try again</button></div>
      : !tracks.data?.length ? <p className="rounded-xl border bg-white p-5">No matching circuit tracks are available. Try another name or location, or browse your saved scans. <Link className="underline" to="/track-trace?view=scan">Scan a new circuit</Link>.</p>
      : <ul className="space-y-3">{tracks.data.map(track => {
        const startFinish = Array.isArray(track.start_finish_path) && track.start_finish_path.length >= 2;
        const geometry = Array.isArray(track.outside_path) && track.outside_path.length >= 3;
        const sectors = track.user_sectors.length ? track.user_sectors : track.sector_defaults;
        return <li key={track.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="break-words font-bold">{track.track_name || track.name}</h3>
          <p className="mt-1 text-xs font-semibold text-[#007DAE]">{track.publication_status==='published'?'Shared community track':track.is_owner?'Your private scan':'Saved circuit'}</p>
          {track.community_layout_name && <p className="mt-1 text-sm">Layout: {track.community_layout_name}</p>}
          {(track.community_location||track.facility_name||track.area_key) && <p className="mt-1 break-words text-sm text-[#6B7280]">{track.community_location||track.facility_name||track.area_key}</p>}
          <p className="mt-1 text-sm text-[#6B7280]">Version {track.version} · {track.track_shape || 'Circuit'}{track.track_length_meters != null ? ` · ${track.track_length_meters} m` : track.track_length ? ` · ${track.track_length}` : ''}</p>
          <p className="mt-2 text-sm">Start/finish: {startFinish ? 'Saved line' : track.manual_start_finish_data || track.automatic_start_finish_data ? 'Saved configuration; review required' : 'Not configured'}</p>
          {sectors.length ? sectors.map((sector, i) => <p className="mt-1 text-sm" key={i}>{sector.sector_count} sectors · definition version {sector.version}</p>) : <p className="mt-1 text-sm">Sector information is not configured.</p>}
          {(!startFinish || !geometry) && <p className="mt-2 text-sm text-amber-800">This track has incomplete scan or start/finish information. Review its configuration before timing.</p>}
          <button type="button" onClick={() => onSelect(track)} disabled={!track.can_select} className="mt-3 rounded-lg bg-[#007DAE] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Use this track</button>
          {track.can_select&&<Link to={'/track-trace?view=track-edit&track='+encodeURIComponent(track.id)} className="ml-3 inline-block py-3 text-sm font-semibold text-[#007DAE] underline">Track setup and map</Link>}
          {!track.can_select && <p className="mt-2 text-sm text-[#6B7280]">This track is not available for a new session. Choose an active approved community circuit or one of your saved circuits.</p>}
          {track.is_owner&&track.publication_status==='private'&&<TrackTracePublication track={track} />}
        </li>;
      })}</ul>}
    <div className="flex gap-4">{offset > 0 && <button type="button" className="underline" onClick={() => setOffset(x => Math.max(0,x-50))}>Previous tracks</button>}{tracks.data?.length === 50 && <button type="button" className="underline" onClick={() => setOffset(x => x+50)}>More tracks</button>}</div>
  </section>;
}
