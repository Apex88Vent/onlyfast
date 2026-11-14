import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { traceRpc, type TraceTrack } from './api';

export default function TrackTraceLibrary({ userId, revision, onSelect }: {
  userId: string; revision: string; onSelect: (track: TraceTrack) => void;
}) {
  const [offset, setOffset] = useState(0);
  const tracks = useQuery({
    queryKey: ['track_trace', 'tracks', userId, revision, offset],
    queryFn: () => traceRpc<TraceTrack[]>('list_track_trace_tracks', { p_offset: offset }), retry: false, gcTime: 0,
  });
  return <section className="space-y-4" aria-label="Track Library">
    <h2 className="text-lg font-bold">Track Library</h2>
    <p className="text-sm text-[#6B7280]">Saved circuit tracks available to your account. Choosing a track prepares a session; it does not start GPS recording.</p>
    {tracks.isPending ? <p role="status">Loading saved circuits…</p> : tracks.isError ? <div role="alert"><p>Saved circuits could not be loaded.</p><button className="mt-2 underline" onClick={() => void tracks.refetch()}>Try again</button></div>
      : !tracks.data?.length ? <p className="rounded-xl border bg-white p-5">No saved circuit tracks are available. Track scanning is not integrated yet.</p>
      : <ul className="space-y-3">{tracks.data.map(track => {
        const startFinish = Array.isArray(track.start_finish_path) && track.start_finish_path.length >= 2;
        const geometry = Array.isArray(track.outside_path) && track.outside_path.length >= 3;
        const sectors = track.user_sectors.length ? track.user_sectors : track.sector_defaults;
        return <li key={track.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="break-words font-bold">{track.track_name || track.name}</h3>
          <p className="mt-1 text-sm text-[#6B7280]">Version {track.version} · {track.track_shape || 'Circuit'}{track.track_length_meters != null ? ` · ${track.track_length_meters} m` : track.track_length ? ` · ${track.track_length}` : ''}</p>
          <p className="mt-2 text-sm">Start/finish: {startFinish ? 'Saved line' : track.manual_start_finish_data || track.automatic_start_finish_data ? 'Saved configuration; review required' : 'Not configured'}</p>
          {sectors.length ? sectors.map((sector, i) => <p className="mt-1 text-sm" key={i}>{sector.sector_count} sectors · definition version {sector.version}</p>) : <p className="mt-1 text-sm">Sector information is not configured.</p>}
          {(!startFinish || !geometry) && <p className="mt-2 text-sm text-amber-800">This track has incomplete scan or start/finish information. Review its configuration before timing.</p>}
          <button type="button" onClick={() => onSelect(track)} disabled={!track.can_select} className="mt-3 rounded-lg bg-[#007DAE] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Use this track</button>
          {!track.can_select && <p className="mt-2 text-sm text-[#6B7280]">This track is view-only. Choose one of your saved circuits to prepare a session.</p>}
        </li>;
      })}</ul>}
    <div className="flex gap-4">{offset > 0 && <button className="underline" onClick={() => setOffset(x => Math.max(0,x-50))}>Previous tracks</button>}{tracks.data?.length === 50 && <button className="underline" onClick={() => setOffset(x => x+50)}>More tracks</button>}</div>
  </section>;
}
