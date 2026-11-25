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
  getCornerDefinitionsForTrack,
  saveTrackCornerDefinitions
} from "../editService";
import type { StoredCornerDefinitions } from "../circuit/types";
import { buildManualCornerDefinitions } from "../circuit/trackEditorGeometry";
import { getEditableCornerTrack as getTrackMapById } from "../editService";
import type { SavedTrackMap } from "../circuit/onlylapsTrackScanUtils";

type CornerEditorPageProps = { authBypassEnabled?: boolean; trackId: string };
type DraftCorner = { start: number; end?: number };

const minimumCornerProgressGap = 0.003;
const cornerColors = Array.from({ length: 20 }, (_, index) =>
  `hsl(${Math.round((index * 137.508 + 202) % 360)} 82% ${index % 3 === 0 ? 62 : 68}%)`
);

function formatDistance(track: SavedTrackMap, progress: number) {
  const length = track.track_length_meters ?? track.estimated_length_meters;
  if (!length) return null;
  const distance = progress * length;
  return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
}

function normalizeSavedCorners(definitions: StoredCornerDefinitions | null) {
  return [...(definitions?.corners ?? [])]
    .sort((a, b) => a.cornerNumber - b.cornerNumber)
    .slice(0, 20)
    .map((corner) => ({
      start: corner.startProgress,
      end: corner.endProgress
    }));
}

function suggestedProgress(
  cornerCount: number,
  cornerIndex: number,
  stage: "start" | "end",
  minimum: number
) {
  const actionIndex = cornerIndex * 2 + (stage === "end" ? 1 : 0);
  return Math.min(
    1 - minimumCornerProgressGap,
    Math.max(minimum, (actionIndex + 1) / (cornerCount * 2 + 1))
  );
}

export function CornerEditorPage({
  authBypassEnabled = false,
  trackId
}: CornerEditorPageProps) {
  const router = useRouter();
  const [track, setTrack] = useState<SavedTrackMap | null>(null);
  const [savedDefinitions, setSavedDefinitions] = useState<StoredCornerDefinitions | null>(null);
  const [cornerCount, setCornerCount] = useState(1);
  const [draftCorners, setDraftCorners] = useState<DraftCorner[]>([]);
  const [sliderProgress, setSliderProgress] = useState(0.25);
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
      const definitionsResult = await getCornerDefinitionsForTrack(trackResult.data);
      if (!active) return;
      const saved = definitionsResult.data;
      const corners = normalizeSavedCorners(saved);
      const count = Math.max(1, corners.length || 1);
      setTrack(trackResult.data);
      setSavedDefinitions(saved);
      setCornerCount(count);
      setDraftCorners(corners);
      setSliderProgress(corners.length === count ? 1 : suggestedProgress(count, 0, "start", minimumCornerProgressGap));
      setError(definitionsResult.error);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [trackId]);

  const completedCount = draftCorners.filter(
    (corner): corner is Required<DraftCorner> => typeof corner.end === "number"
  ).length;
  const activeCorner = draftCorners[completedCount];
  const definingEnd = Boolean(activeCorner && activeCorner.end === undefined);
  const isComplete = completedCount === cornerCount;
  const currentCorner = Math.min(cornerCount, completedCount + 1);
  const previousEnd =
    completedCount > 0 ? (draftCorners[completedCount - 1].end ?? 0) : 0;
  const sliderMinimum = definingEnd
    ? (activeCorner?.start ?? 0) + minimumCornerProgressGap
    : previousEnd + minimumCornerProgressGap;
  const futureCorners = cornerCount - currentCorner;
  const requiredPointsAfterCurrent = definingEnd
    ? futureCorners * 2
    : futureCorners * 2 + 1;
  const sliderMaximum =
    1 - minimumCornerProgressGap * (requiredPointsAfterCurrent + 1);
  const distance = track ? formatDistance(track, sliderProgress) : null;
  const savedCorners = normalizeSavedCorners(savedDefinitions);
  const hasUnsavedWork =
    draftCorners.length !== savedCorners.length ||
    draftCorners.some((corner, index) => {
      const saved = savedCorners[index];
      return (
        !saved ||
        Math.abs(corner.start - saved.start) > 0.0001 ||
        Math.abs((corner.end ?? -1) - (saved.end ?? -1)) > 0.0001
      );
    });

  const mapRanges = useMemo(() => {
    const ranges: TrackMapRange[] = draftCorners.flatMap((corner, index) =>
      typeof corner.end === "number"
        ? [{
            start: corner.start,
            end: corner.end,
            color: cornerColors[index],
            label: `C${index + 1}`
          }]
        : []
    );
    if (definingEnd && activeCorner) {
      ranges.push({
        start: activeCorner.start,
        end: sliderProgress,
        color: cornerColors[currentCorner - 1],
        label: `C${currentCorner}`,
        preview: true
      });
    }
    return ranges;
  }, [activeCorner, currentCorner, definingEnd, draftCorners, sliderProgress]);

  const setNumberOfCorners = (nextCount: number) => {
    if (nextCount === cornerCount) return;
    if (
      draftCorners.length > 0 &&
      !window.confirm("Changing the number of corners will reset the points you have defined. Continue?")
    ) {
      return;
    }
    setCornerCount(nextCount);
    setDraftCorners([]);
    setSliderProgress(suggestedProgress(nextCount, 0, "start", minimumCornerProgressGap));
    setShowSave(false);
    setError(null);
  };

  const definePoint = () => {
    if (isComplete) {
      setShowSave(true);
      return;
    }
    if (sliderProgress < sliderMinimum || sliderProgress > sliderMaximum) {
      setError(
        definingEnd
          ? `Corner ${currentCorner} end must come after its start.`
          : "The next corner must begin after the previous corner ends."
      );
      return;
    }
    if (!definingEnd) {
      const next = [...draftCorners, { start: sliderProgress }];
      setDraftCorners(next);
      setSliderProgress(
        suggestedProgress(
          cornerCount,
          currentCorner - 1,
          "end",
          sliderProgress + minimumCornerProgressGap
        )
      );
      setError(null);
      return;
    }
    const next = draftCorners.map((corner, index) =>
      index === completedCount ? { ...corner, end: sliderProgress } : corner
    );
    setDraftCorners(next);
    setError(null);
    if (completedCount + 1 === cornerCount) {
      setSliderProgress(1);
      return;
    }
    setSliderProgress(
      suggestedProgress(
        cornerCount,
        currentCorner,
        "start",
        sliderProgress + minimumCornerProgressGap
      )
    );
  };

  const undoLastPoint = () => {
    if (draftCorners.length === 0) return;
    const last = draftCorners[draftCorners.length - 1];
    if (typeof last.end === "number") {
      setDraftCorners([
        ...draftCorners.slice(0, -1),
        { start: last.start }
      ]);
      setSliderProgress(last.end);
    } else {
      setDraftCorners(draftCorners.slice(0, -1));
      setSliderProgress(last.start);
    }
    setShowSave(false);
    setError(null);
  };

  const resetCorners = () => {
    if (
      draftCorners.length > 0 &&
      !window.confirm("Reset all unsaved corner points and start again?")
    ) {
      return;
    }
    setDraftCorners([]);
    setSliderProgress(suggestedProgress(cornerCount, 0, "start", minimumCornerProgressGap));
    setShowSave(false);
    setError(null);
  };

  const cancel = () => {
    if (hasUnsavedWork && !window.confirm("Leave without saving these corner changes?")) return;
    router.push(`/my-tracks/${encodeURIComponent(trackId)}/edit`);
  };

  const save = async () => {
    if (!track || !isComplete) return;
    const completedRanges = draftCorners.map((corner) => ({
      start: corner.start,
      end: corner.end!
    }));
    const definitions = buildManualCornerDefinitions(track, completedRanges);
    setSaving(true);
    setError(null);
    const result = await saveTrackCornerDefinitions(track, definitions);
    if (!result.data) {
      setError(result.error ?? "Corner definitions could not be saved.");
      setSaving(false);
      setShowSave(false);
      return;
    }
    router.push(
      `/my-tracks/${encodeURIComponent(track.id)}/edit?saved=corners&count=${cornerCount}`
    );
  };

  const actionLabel = isComplete
    ? "Finalize Corners"
    : definingEnd
      ? `Define Corner ${currentCorner} End`
      : `Define Corner ${currentCorner} Start`;

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
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#A855F7]">
            Define corners
          </p>
          <h1 className="mt-2 text-[30px] font-black text-white">
            {track?.track_name ?? "Corner Editor"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#D7DEE8]">
            Define each start and end in the order encountered after crossing start/finish.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
            <Loader2 className="size-5 animate-spin text-[#00A8E8]" />
            Loading corner definitions
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
              <label htmlFor="corner-count" className="text-sm font-black">
                Number of Corners
              </label>
              <select
                id="corner-count"
                value={cornerCount}
                onChange={(event) => setNumberOfCorners(Number(event.target.value))}
                className="mt-3 min-h-12 w-full rounded-[14px] border border-[#CBD5E1] bg-[#EFF6FF] px-4 text-base font-black text-[#071018] outline-none focus:border-[#007DAE]"
              >
                {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </section>

            <section className="rounded-[20px] border border-white/[0.12] bg-[#050B11]/88 p-3">
              <TrackDefinitionMap
                track={track}
                ranges={mapRanges}
                ariaLabel={`${track.track_name} guided corner map`}
                cursor={
                  isComplete
                    ? undefined
                    : {
                        progress: sliderProgress,
                        color: cornerColors[currentCorner - 1]
                      }
                }
              />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    Defining Corner {currentCorner} of {cornerCount}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#B8C0CC]">
                    {isComplete
                      ? "All corner ranges are complete"
                      : definingEnd
                        ? `Select the end of Corner ${currentCorner}`
                        : `Select the start of Corner ${currentCorner}`}
                  </p>
                </div>
                <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-black text-[#9CE2FF]">
                  {completedCount} / {cornerCount}
                </span>
              </div>
            </section>

            <section className="rounded-[22px] bg-white p-4 text-[#071018]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Track position</p>
                  <p className="mt-1 text-xs font-bold text-[#5D6675]">
                    Forward in saved lap direction
                  </p>
                </div>
                <p className="text-right text-lg font-black text-[#007DAE]">
                  {Math.round(sliderProgress * 100)}%
                  {distance ? <span className="block text-xs text-[#5D6675]">{distance}</span> : null}
                </p>
              </div>
              <input
                type="range"
                min={isComplete ? 0 : Math.round(sliderMinimum * 1000)}
                max={isComplete ? 1000 : Math.round(sliderMaximum * 1000)}
                value={Math.round(sliderProgress * 1000)}
                onChange={(event) => {
                  setSliderProgress(Number(event.target.value) / 1000);
                  setError(null);
                }}
                disabled={isComplete}
                className="mt-4 w-full accent-[#A855F7] disabled:opacity-45"
                aria-label={`Corner point at ${Math.round(sliderProgress * 100)} percent`}
              />
              <div className="mt-1 flex justify-between text-[10px] font-black uppercase tracking-[0.1em] text-[#64748B]">
                <span>Start / Finish · 0%</span>
                <span>Start / Finish · 100%</span>
              </div>
            </section>

            <section className="rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
                Corner legend
              </p>
              <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                {Array.from({ length: cornerCount }, (_, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-black text-white"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: cornerColors[index] }}
                    />
                    Corner {index + 1}
                  </span>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={definePoint}
              className="min-h-[54px] w-full rounded-full bg-[#A855F7] px-4 text-base font-black text-white shadow-[0_12px_28px_rgba(168,85,247,0.25)]"
            >
              {actionLabel}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undoLastPoint}
                disabled={draftCorners.length === 0}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/[0.18] px-3 text-xs font-black text-white disabled:opacity-40"
              >
                <Undo2 className="size-4" />
                Undo Last Point
              </button>
              <button
                type="button"
                onClick={resetCorners}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#A855F7] px-3 text-xs font-black text-[#D8B4FE]"
              >
                <RotateCcw className="size-4" />
                Reset Corners
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
          title="Save corners?"
          summary={`${cornerCount} ${cornerCount === 1 ? "corner" : "corners"} numbered in saved lap order`}
          explanation="Saving updates your private track for future recordings. Historical session definitions and analysis remain unchanged."
          saving={saving}
          onCancel={() => setShowSave(false)}
          onSave={save}
          preview={
            <TrackDefinitionMap
              track={track}
              ranges={mapRanges}
              ariaLabel={`Completed ${cornerCount}-corner track preview`}
              compact
            />
          }
        />
      ) : null}
    </LapSessionShell>
  );
}
