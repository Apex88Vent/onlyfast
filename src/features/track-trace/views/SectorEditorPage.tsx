// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { useEffect, useMemo, useState } from "react";
import Link from "./TraceLink";
import { useTraceRouter as useRouter } from "./useTraceRouter";
import { ChevronLeft, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { LapSessionShell } from "./LapSessionShell";
import {
  TrackDefinitionMap,
  type TrackMapRange
} from "./TrackDefinitionMap";
import { TrackSaveModal } from "./TrackSaveModal";
import {
  getSectorLayoutForTrack,
  saveSectorLayout
} from "../editService";
import {
  buildSectorLineAtProgress,
  maximumTrackSectors,
  minimumSectorProgressGap
} from "../circuit/sectorTiming";
import type { SectorLineDefinition, TrackSectorLayout } from "../circuit/types";
import { getTrackMapById } from "../editService";
import type { SavedTrackMap } from "../circuit/onlylapsTrackScanUtils";

type SectorEditorPageProps = { authBypassEnabled?: boolean; trackId: string };

const sectorColors = ["#00A8E8", "#A855F7", "#22D3A6", "#F59E0B", "#F43F8D"];

function sortedLines(lines: SectorLineDefinition[]) {
  return [...lines].sort((a, b) => a.progress - b.progress);
}

function initialSliderProgress(sectorCount: number, confirmedCount: number, previous = 0) {
  if (sectorCount === 1) return 1;
  return Math.min(
    1 - minimumSectorProgressGap,
    Math.max(previous + minimumSectorProgressGap, (confirmedCount + 1) / sectorCount)
  );
}

function formatDistance(track: SavedTrackMap, progress: number) {
  const length = track.track_length_meters ?? track.estimated_length_meters;
  if (!length) return null;
  const distance = progress * length;
  return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
}

export function SectorEditorPage({
  authBypassEnabled = false,
  trackId
}: SectorEditorPageProps) {
  const router = useRouter();
  const [track, setTrack] = useState<SavedTrackMap | null>(null);
  const [savedLayout, setSavedLayout] = useState<TrackSectorLayout | null>(null);
  const [sectorCount, setSectorCount] = useState(1);
  const [confirmedLines, setConfirmedLines] = useState<SectorLineDefinition[]>([]);
  const [sliderProgress, setSliderProgress] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
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
      const layoutResult = await getSectorLayoutForTrack(trackResult.data);
      if (!active) return;
      const layout = layoutResult.data;
      const count = layout?.sectorCount ?? 1;
      const lines = sortedLines(layout?.lines ?? []);
      setTrack(trackResult.data);
      setSavedLayout(layout);
      setSectorCount(count);
      setConfirmedLines(lines);
      setSliderProgress(
        lines.length === Math.max(0, count - 1)
          ? 1
          : initialSliderProgress(count, lines.length, lines.at(-1)?.progress ?? 0)
      );
      setError(layoutResult.data ? null : layoutResult.error);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [trackId]);

  const requiredBoundaries = Math.max(0, sectorCount - 1);
  const isComplete = confirmedLines.length === requiredBoundaries;
  const hasUnsavedWork =
    sectorCount !== savedLayout?.sectorCount ||
    confirmedLines.length !== savedLayout?.lines.length ||
    confirmedLines.some(
      (line, index) =>
        Math.abs(line.progress - sortedLines(savedLayout?.lines ?? [])[index]?.progress) > 0.0001
    );
  const sliderMinimum = confirmedLines.length
    ? confirmedLines[confirmedLines.length - 1].progress + minimumSectorProgressGap
    : minimumSectorProgressGap;
  const remainingAfterCurrent = Math.max(0, requiredBoundaries - confirmedLines.length - 1);
  const sliderMaximum = 1 - minimumSectorProgressGap * (remainingAfterCurrent + 1);
  const currentSector = Math.min(sectorCount, confirmedLines.length + 1);
  const distance = track ? formatDistance(track, sliderProgress) : null;

  const mapRanges = useMemo(() => {
    const ranges: TrackMapRange[] = [];
    let start = 0;
    confirmedLines.forEach((line, index) => {
      ranges.push({
        start,
        end: line.progress,
        color: sectorColors[index],
        label: `S${index + 1}`
      });
      start = line.progress;
    });
    if (isComplete) {
      ranges.push({
        start,
        end: 1,
        color: sectorColors[sectorCount - 1],
        label: `S${sectorCount}`
      });
    } else {
      ranges.push({
        start,
        end: sliderProgress,
        color: sectorColors[currentSector - 1],
        label: `S${currentSector}`,
        preview: true
      });
    }
    return ranges;
  }, [confirmedLines, currentSector, isComplete, sectorCount, sliderProgress]);

  const setNumberOfSectors = (nextCount: number) => {
    if (nextCount === sectorCount) return;
    if (
      (hasUnsavedWork || confirmedLines.length > 0) &&
      !window.confirm("Changing the number of sectors will reset the boundaries you have defined. Continue?")
    ) {
      return;
    }
    setSectorCount(nextCount);
    setConfirmedLines([]);
    setSliderProgress(initialSliderProgress(nextCount, 0));
    setShowSave(false);
    setError(null);
  };

  const defineBoundary = () => {
    if (!track) return;
    if (sectorCount === 1 || isComplete) {
      setShowSave(true);
      return;
    }
    if (sliderProgress < sliderMinimum || sliderProgress > sliderMaximum) {
      setError("Move the boundary forward and leave enough room for the remaining sectors.");
      return;
    }
    const line = buildSectorLineAtProgress(track, sliderProgress, confirmedLines.length + 1);
    if (!line) {
      setError("OnlyFast Track Trace needs usable track geometry to place this boundary.");
      return;
    }
    const nextLines = [...confirmedLines, line];
    setConfirmedLines(nextLines);
    setError(null);
    if (nextLines.length === requiredBoundaries) {
      setSliderProgress(1);
      setShowSave(true);
      return;
    }
    setSliderProgress(
      initialSliderProgress(sectorCount, nextLines.length, line.progress)
    );
  };

  const undoLastBoundary = () => {
    const removed = confirmedLines[confirmedLines.length - 1];
    if (!removed) return;
    setConfirmedLines(confirmedLines.slice(0, -1));
    setSliderProgress(removed.progress);
    setShowSave(false);
    setError(null);
  };

  const resetSectors = () => {
    if (
      confirmedLines.length > 0 &&
      !window.confirm("Reset all unsaved sector boundaries and start again?")
    ) {
      return;
    }
    setConfirmedLines([]);
    setSliderProgress(initialSliderProgress(sectorCount, 0));
    setShowSave(false);
    setError(null);
  };

  const cancel = () => {
    if (hasUnsavedWork && !window.confirm("Leave without saving these sector changes?")) return;
    router.push(`/my-tracks/${encodeURIComponent(trackId)}/edit`);
  };

  const save = async () => {
    if (!track) return;
    const base = savedLayout ?? {
      id: null,
      trackId: track.id,
      sectorCount,
      version: Math.max(1, track.version ?? 1),
      source: "generated_default" as const,
      ownerId: track.created_by ?? track.user_id,
      lines: [],
      confidence: "high" as const,
      createdAt: null,
      updatedAt: null
    };
    const layout: TrackSectorLayout = {
      ...base,
      sectorCount,
      lines: confirmedLines,
      confidence: "high"
    };
    setSaving(true);
    setError(null);
    const result = await saveSectorLayout(track, layout);
    if (!result.data) {
      setError(result.error ?? "Sector layout could not be saved.");
      setSaving(false);
      setShowSave(false);
      return;
    }
    router.push(
      `/my-tracks/${encodeURIComponent(track.id)}/edit?saved=sectors&count=${sectorCount}`
    );
  };

  const actionLabel =
    sectorCount === 1 || isComplete
      ? "Finalize Sectors"
      : confirmedLines.length === requiredBoundaries - 1
        ? "Finalize Sectors"
        : `Define Sector ${confirmedLines.length + 1} End`;

  return (
    <LapSessionShell authBypassEnabled={authBypassEnabled}>
      <section className="space-y-4">
        <Link
          href={`/my-tracks/${encodeURIComponent(trackId)}/edit`}
          className="inline-flex items-center gap-2 text-sm font-black text-[#9CE2FF]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Edit Track
        </Link>
        <header className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
            Define sectors
          </p>
          <h1 className="mt-2 text-[30px] font-black text-white">
            {track?.track_name ?? "Sector Editor"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#D7DEE8]">
            Start at the saved start/finish line and work forward in the recorded lap direction.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
            <Loader2 className="size-5 animate-spin text-[#00A8E8]" />
            Loading sector layout
          </div>
        ) : null}
        {error ? (
          <p className="rounded-[16px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold text-red-50">
            {error}
          </p>
        ) : null}

        {track ? (
          <>
            <section className="rounded-[22px] bg-white p-4 text-[#071018]">
              <p className="text-sm font-black">Number of Sectors</p>
              <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Number of sectors">
                {Array.from({ length: maximumTrackSectors }, (_, index) => index + 1).map(
                  (count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setNumberOfSectors(count)}
                      aria-pressed={sectorCount === count}
                      className={`min-h-11 rounded-[14px] text-base font-black transition ${
                        sectorCount === count
                          ? "bg-[#007DAE] text-white shadow-[0_8px_18px_rgba(30,136,255,0.28)]"
                          : "bg-[#EFF6FF] text-[#334155]"
                      }`}
                    >
                      {count}
                    </button>
                  )
                )}
              </div>
            </section>

            <section className="rounded-[20px] border border-white/[0.12] bg-[#050B11]/88 p-3">
              <TrackDefinitionMap
                track={track}
                ranges={mapRanges}
                ariaLabel={`${track.track_name} guided sector map`}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    Defining Sector {currentSector} of {sectorCount}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#B8C0CC]">
                    {isComplete
                      ? "All sector ranges are complete"
                      : `Select the end of Sector ${currentSector}`}
                  </p>
                </div>
                <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-black text-[#9CE2FF]">
                  {track.direction === "clockwise"
                    ? "Clockwise"
                    : track.direction === "counterclockwise"
                      ? "Counterclockwise"
                      : "Saved lap order"}
                </span>
              </div>
            </section>

            <section className="rounded-[22px] bg-white p-4 text-[#071018]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Track position</p>
                  <p className="mt-1 text-xs font-bold text-[#5D6675]">
                    Start/finish → completed lap
                  </p>
                </div>
                <p className="text-right text-lg font-black text-[#007DAE]">
                  {Math.round(sliderProgress * 100)}%
                  {distance ? <span className="block text-xs text-[#5D6675]">{distance}</span> : null}
                </p>
              </div>
              <input
                type="range"
                min={isComplete || sectorCount === 1 ? 0 : Math.round(sliderMinimum * 1000)}
                max={isComplete || sectorCount === 1 ? 1000 : Math.round(sliderMaximum * 1000)}
                value={Math.round(sliderProgress * 1000)}
                onChange={(event) => {
                  setSliderProgress(Number(event.target.value) / 1000);
                  setError(null);
                }}
                disabled={isComplete || sectorCount === 1}
                className="mt-4 w-full accent-[#007DAE] disabled:opacity-45"
                aria-label={`Sector boundary at ${Math.round(sliderProgress * 100)} percent`}
              />
              <div className="mt-1 flex justify-between text-[10px] font-black uppercase tracking-[0.1em] text-[#64748B]">
                <span>Start / Finish · 0%</span>
                <span>Start / Finish · 100%</span>
              </div>
            </section>

            <section className="rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
                Sector legend
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: sectorCount }, (_, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-black text-white"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: sectorColors[index] }}
                    />
                    Sector {index + 1}
                  </span>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={defineBoundary}
              className="min-h-[54px] w-full rounded-full bg-[#007DAE] px-4 text-base font-black text-white shadow-[0_12px_28px_rgba(30,136,255,0.28)]"
            >
              {actionLabel}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undoLastBoundary}
                disabled={confirmedLines.length === 0}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/[0.18] px-3 text-xs font-black text-white disabled:opacity-40"
              >
                <Undo2 className="size-4" />
                Undo Last Boundary
              </button>
              <button
                type="button"
                onClick={resetSectors}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#A855F7] px-3 text-xs font-black text-[#D8B4FE]"
              >
                <RotateCcw className="size-4" />
                Reset Sectors
              </button>
              <button
                type="button"
                onClick={cancel}
                className="col-span-2 min-h-12 rounded-full border border-white/[0.18] text-sm font-black text-white"
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </section>

      {showSave && track ? (
        <TrackSaveModal
          title="Save sectors?"
          summary={`${sectorCount} ${sectorCount === 1 ? "sector" : "sectors"} around the saved lap direction`}
          explanation="Saving applies to future recordings. Shared tracks use your personal sector override; published geometry and historical results remain unchanged."
          saving={saving}
          onCancel={() => setShowSave(false)}
          onSave={save}
          preview={
            <TrackDefinitionMap
              track={track}
              ranges={mapRanges}
              ariaLabel={`Completed ${sectorCount}-sector track preview`}
              compact
            />
          }
        />
      ) : null}
    </LapSessionShell>
  );
}
