// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { AlertTriangle, RotateCcw, Save, X } from "lucide-react";
import type {
  GpsPoint,
  GpsSummary,
  TrackScanMetadata
} from "../circuit/onlylapsTrackScanUtils.ts";
import {
  getTrackShapeLabel,
  getTrackTypeLabel,
  isOvalTrackType
} from "../circuit/onlylapsTrackScanUtils.ts";
import { TrackScanPreview } from "./TrackScanPreview";

type TrackScanReviewProps = {
  fallbackTrackName: string;
  gpsSummary: GpsSummary;
  insidePath: GpsPoint[];
  notes: string;
  onCancel: () => void;
  onNotesChange: (notes: string) => void;
  onRetake: () => void;
  onSave: () => void;
  onTrackNameChange: (trackName: string) => void;
  outsidePath: GpsPoint[];
  saveError: string | null;
  saving: boolean;
  startFinishPath: GpsPoint[];
  trackDetails: TrackScanMetadata;
  trackName: string;
};

function formatNumber(value: number | null, decimals = 1) {
  return value == null ? "--" : value.toFixed(decimals);
}

function formatCenter(summary: GpsSummary) {
  if (!summary.center) {
    return "--";
  }

  return `${summary.center.lat.toFixed(5)}, ${summary.center.lng.toFixed(5)}`;
}

function formatBoundingBox(summary: GpsSummary) {
  if (!summary.bbox) {
    return "--";
  }

  return `${summary.bbox.minLat.toFixed(5)}, ${summary.bbox.minLng.toFixed(5)} to ${summary.bbox.maxLat.toFixed(5)}, ${summary.bbox.maxLng.toFixed(5)}`;
}

export function TrackScanReview({
  fallbackTrackName,
  gpsSummary,
  insidePath,
  notes,
  onCancel,
  onNotesChange,
  onRetake,
  onSave,
  onTrackNameChange,
  outsidePath,
  saveError,
  saving,
  startFinishPath,
  trackDetails,
  trackName
}: TrackScanReviewProps) {
  const hasLowPointCount =
    gpsSummary.outsidePoints < 10 ||
    gpsSummary.startFinishPoints < 2 ||
    gpsSummary.insidePoints < 10;
  const isOvalTrack = isOvalTrackType(trackDetails.trackType);
  const isTrackNameBlank = trackName.trim().length === 0;

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-4 shadow-[0_22px_55px_rgba(0,0,0,0.36)]">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
          Review
        </p>
        <h1 className="mt-2 text-[30px] font-black leading-none text-white">
          Save track map
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#D7DEE8]">
          Check the outside trace, start/finish line, and inside edge before saving this
          private OnlyFast Track Trace map.
        </p>
      </div>

      <TrackScanPreview
        outsidePath={outsidePath}
        startFinishLinePath={startFinishPath}
        insidePath={insidePath}
        label="Track Base Layer Preview"
        scanStage="review"
        trackType={trackDetails.trackType}
        trackShape={trackDetails.trackShape}
        trackLength={trackDetails.trackLength}
      />

      <section className="rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B8C0CC]">
          Track Details
        </p>
        <dl className="mt-3 grid gap-3 text-sm">
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Type</dt>
            <dd className="mt-1 text-base font-black text-white">
              {getTrackTypeLabel(trackDetails.trackType)}
            </dd>
          </div>
          {isOvalTrack ? (
            <>
              <div className="rounded-[16px] bg-white/[0.07] p-3">
                <dt className="font-black text-[#B8C0CC]">Shape</dt>
                <dd className="mt-1 text-base font-black text-white">
                  {getTrackShapeLabel(trackDetails.trackShape)}
                </dd>
              </div>
              <div className="rounded-[16px] bg-white/[0.07] p-3">
                <dt className="font-black text-[#B8C0CC]">Length</dt>
                <dd className="mt-1 text-base font-black text-white">
                  {trackDetails.trackLength ?? "Unknown"}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      {hasLowPointCount ? (
        <p className="flex gap-2 rounded-[16px] border border-amber-300/24 bg-amber-300/12 p-3 text-sm font-bold leading-6 text-amber-50">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          This scan has a low number of GPS points. You can save it, but a slower
          retrace may improve accuracy.
        </p>
      ) : null}

      <div className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        <label className="block">
          <span className="text-sm font-black text-[#5D6675]">Track name</span>
          <input
            value={trackName}
            onChange={(event) => onTrackNameChange(event.target.value)}
            placeholder="Example: Eldora Speedway"
            aria-invalid={isTrackNameBlank}
            aria-describedby={isTrackNameBlank ? "track-name-validation" : undefined}
            className="mt-2 min-h-[52px] w-full rounded-[16px] border border-[#C8D1DD] bg-white px-4 text-base font-black text-[#071018] outline-none transition focus:border-[#007DAE] focus:ring-4 focus:ring-[#007DAE]/14"
          />
        </label>
        {isTrackNameBlank ? (
          <p
            id="track-name-validation"
            className="mt-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-700"
          >
            Enter a track name before saving. Suggested name: {fallbackTrackName}.
          </p>
        ) : null}
        <label className="mt-4 block">
          <span className="text-sm font-black text-[#5D6675]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Optional surface, weather, or scan notes"
            rows={3}
            className="mt-2 w-full resize-none rounded-[16px] border border-[#C8D1DD] bg-white px-4 py-3 text-sm font-bold leading-6 text-[#071018] outline-none transition focus:border-[#007DAE] focus:ring-4 focus:ring-[#007DAE]/14"
          />
        </label>
      </div>

      <section className="rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B8C0CC]">
          GPS quality summary
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Outside points</dt>
            <dd className="mt-1 text-xl font-black text-white">{gpsSummary.outsidePoints}</dd>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">S/F points</dt>
            <dd className="mt-1 text-xl font-black text-white">{gpsSummary.startFinishPoints}</dd>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Inside points</dt>
            <dd className="mt-1 text-xl font-black text-white">{gpsSummary.insidePoints}</dd>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Avg accuracy</dt>
            <dd className="mt-1 text-xl font-black text-white">
              {formatNumber(gpsSummary.averageAccuracy)} m
            </dd>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Worst accuracy</dt>
            <dd className="mt-1 text-xl font-black text-white">
              {formatNumber(gpsSummary.worstAccuracy)} m
            </dd>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Area key</dt>
            <dd className="mt-1 truncate text-base font-black text-white">
              {gpsSummary.areaKey ?? "--"}
            </dd>
          </div>
          <div className="col-span-2 rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Estimated center</dt>
            <dd className="mt-1 text-sm font-black text-white">{formatCenter(gpsSummary)}</dd>
          </div>
          <div className="col-span-2 rounded-[16px] bg-white/[0.07] p-3">
            <dt className="font-black text-[#B8C0CC]">Estimated bounding box</dt>
            <dd className="mt-1 text-xs font-black leading-5 text-white">
              {formatBoundingBox(gpsSummary)}
            </dd>
          </div>
        </dl>
      </section>

      {saveError ? (
        <p className="rounded-[16px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold leading-6 text-red-50">
          {saveError}
        </p>
      ) : null}

      <div className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-[#007DAE] px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(30,136,255,0.28)] transition hover:bg-[#00A8E8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-5" aria-hidden="true" />
          {saving ? "Saving Track..." : "Save Track"}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-[#007DAE] px-3 text-sm font-black text-[#007DAE] transition hover:bg-[#EFF6FF]"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Retake Scan
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-[#D7DEE8] px-3 text-sm font-black text-[#5D6675] transition hover:border-[#007DAE] hover:text-[#007DAE]"
          >
            <X className="size-4" aria-hidden="true" />
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
