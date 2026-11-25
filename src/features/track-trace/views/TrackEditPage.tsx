// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { useEffect, useState } from "react";
import Link from "./TraceLink";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Loader2,
  Route
} from "lucide-react";
import { LapSessionShell } from "./LapSessionShell";
import { TrackScanCleanupPanel } from "./TrackScanCleanupPanel";
import { getCornerDefinitionsForTrack } from "../editService";
import { getSectorLayoutForTrack } from "../editService";
import { getTrackMapById } from "../editService";
import type { SavedTrackMap } from "../circuit/onlylapsTrackScanUtils";

type TrackEditPageProps = {
  authBypassEnabled?: boolean;
  trackId: string;
  saved?: "sectors" | "corners" | null;
  savedCount?: number | null;
  updatedCount?: number | null;
};

export function TrackEditPage({
  authBypassEnabled = false,
  trackId,
  saved = null,
  savedCount = null,
  updatedCount = null
}: TrackEditPageProps) {
  const [track, setTrack] = useState<SavedTrackMap | null>(null);
  const [sectorCount, setSectorCount] = useState<number | null>(null);
  const [cornerCount, setCornerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const trackResult = await getTrackMapById(trackId);
      if (!active) return;
      if (!trackResult.data) {
        setError(trackResult.error ?? "Track not found.");
        setLoading(false);
        return;
      }
      const [sectorResult, cornerResult] = await Promise.all([
        getSectorLayoutForTrack(trackResult.data),
        getCornerDefinitionsForTrack(trackResult.data)
      ]);
      if (!active) return;
      setTrack(trackResult.data);
      setSectorCount(sectorResult.data?.sectorCount ?? null);
      setCornerCount(cornerResult.data?.corners.length ?? null);
      setError(sectorResult.error ?? cornerResult.error);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [trackId]);

  return (
    <LapSessionShell authBypassEnabled={authBypassEnabled}>
      <section className="space-y-4">
        <Link
          href="/my-tracks"
          className="inline-flex items-center gap-2 text-sm font-black text-[#9CE2FF]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          My Tracks
        </Link>
        <header className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
            Edit Track
          </p>
          <h1 className="mt-2 text-[32px] font-black text-white">
            {track?.track_name ?? "Track setup"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#D7DEE8]">
            Clean up the scan or define timing markers. Both marker editors begin at the saved start/finish line and follow the recorded lap direction.
          </p>
        </header>

        {saved ? (
          <div className="flex items-start gap-3 rounded-[18px] border border-emerald-300/25 bg-emerald-400/12 p-4 text-emerald-50">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-black">
                {savedCount ?? ""} {saved === "sectors" ? "sectors" : "corners"} saved
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-emerald-100/80">
                {updatedCount
                  ? `${updatedCount} stored ${updatedCount === 1 ? "lap was" : "laps were"} recalculated from existing telemetry.`
                  : "The track metadata is up to date. Raw telemetry was not changed."}
              </p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
            <Loader2 className="size-5 animate-spin text-[#00A8E8]" />
            Loading track setup
          </div>
        ) : null}
        {error ? (
          <p className="rounded-[16px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold text-red-50">
            {error}
          </p>
        ) : null}

        {track ? (
          <div className="space-y-3">
            {track.publication_status!=="published"?<TrackScanCleanupPanel key={track.id} track={track} />:<p className="rounded-xl border p-3 text-sm">Shared track geometry and corners are read-only. Sector edits save your own personal settings.</p>}
            <Link
              href={`/my-tracks/${encodeURIComponent(track.id)}/sectors`}
              className="group flex min-h-[128px] items-center gap-4 rounded-[24px] border border-[#00A8E8]/35 bg-[linear-gradient(135deg,rgba(30,136,255,0.2),rgba(5,11,17,0.94))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.3)] transition hover:border-[#9CE2FF]"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[#007DAE] text-white">
                <GitBranch className="size-7" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-black text-white">Define Sectors</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-[#B8C0CC]">
                  {sectorCount
                    ? `${sectorCount} ${sectorCount === 1 ? "sector" : "sectors"} currently saved`
                    : "Split the lap into up to 5 timed sections"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[#9CE2FF] transition group-hover:translate-x-0.5" />
            </Link>

            <Link
              href={`/my-tracks/${encodeURIComponent(track.id)}/corners`} aria-disabled={track.publication_status==="published"} onClick={event=>{if(track.publication_status==="published")event.preventDefault();}}
              className="group flex min-h-[128px] items-center gap-4 rounded-[24px] border border-[#A855F7]/35 bg-[linear-gradient(135deg,rgba(168,85,247,0.2),rgba(5,11,17,0.94))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.3)] transition hover:border-[#D8B4FE]"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[#A855F7] text-white">
                <Route className="size-7" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-black text-white">Define Corners</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-[#B8C0CC]">
                  {cornerCount
                    ? `${cornerCount} ${cornerCount === 1 ? "corner" : "corners"} currently saved`
                    : "Mark the start and end of up to 20 corners"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[#D8B4FE] transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        ) : null}

        <p className="rounded-[18px] border border-white/[0.1] bg-white/[0.05] p-4 text-xs font-semibold leading-5 text-[#B8C0CC]">
          Definitions apply to future recordings. Historical session snapshots and stored lap/sector analysis remain unchanged.
        </p>
      </section>
    </LapSessionShell>
  );
}
