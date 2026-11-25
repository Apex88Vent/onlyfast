// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useEffect, useMemo, useState } from "react";
import {
  GForceIndicator,
  GForceTelemetryReadouts
} from "./GForceIndicator";
import { ReplayMap, type ReplayViewMode } from "./ReplayMap";
import type { GpsPoint } from "../circuit/onlylapsTrackScanUtils.ts";
import type { SavedTrackMap } from "../circuit/onlylapsTrackScanUtils.ts";
import type {
  LapSmoothingConfidence,
  LapTelemetrySample,
  LapTracePoint,
  SavedLapRecord,
  StoredCornerDefinitions
} from "../circuit/types.ts";
import { sampleAtProgress } from "../circuit/trackProjection.ts";
import {
  metersPerSecondToMilesPerHour,
  splitVehicleLongitudinalG
} from "../circuit/telemetryMath.ts";

type LapTraceViewProps = {
  track: SavedTrackMap | null | undefined;
  samples: LapTelemetrySample[];
  progress: number;
  title: string;
  lap?: SavedLapRecord | null;
  onTraceModeChange?: (mode: TraceMode) => void;
  showTraceModeSelector?: boolean;
  traceColor?: string;
  traceMode?: TraceMode;
};

export type TraceMode = "raw" | "smoothed";

function telemetryToGps(samples: LapTelemetrySample[]): GpsPoint[] {
  return samples.map((sample) => ({
    lat: sample.latitude,
    lng: sample.longitude,
    accuracy: sample.gpsAccuracy,
    altitude: sample.altitude,
    speed: sample.speed,
    heading: sample.heading,
    timestamp: sample.timestamp
  }));
}

function traceToGps(trace: LapTracePoint[]): GpsPoint[] {
  return trace.map((point) => ({
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    altitude: point.altitude,
    speed: point.speed,
    heading: point.heading,
    timestamp: point.timestamp
  }));
}

export function lapHasSmoothedTrace(lap: SavedLapRecord | null | undefined) {
  return (lap?.smoothedTrace?.length ?? 0) > 1;
}

export function getLapReplayPath({
  lap,
  samples,
  traceMode
}: {
  lap: SavedLapRecord | null | undefined;
  samples: LapTelemetrySample[];
  traceMode: TraceMode;
}) {
  if (traceMode === "smoothed" && lapHasSmoothedTrace(lap)) {
    return traceToGps(lap?.smoothedTrace ?? []);
  }
  return lap?.rawTrace?.length ? traceToGps(lap.rawTrace) : telemetryToGps(samples);
}

export function TraceModeSelector({
  mode,
  onChange,
  smoothedAvailable,
  unavailableMessage = "Smoothed trace is unavailable for this session."
}: {
  mode: TraceMode;
  onChange: (mode: TraceMode) => void;
  smoothedAvailable: boolean;
  unavailableMessage?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Replay trace mode">
        <button
          type="button"
          aria-pressed={mode === "raw"}
          onClick={() => onChange("raw")}
          className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
            mode === "raw"
              ? "bg-white text-[#071018]"
              : "border border-white/[0.18] text-[#B8C0CC]"
          }`}
        >
          Raw Trace
        </button>
        <button
          type="button"
          aria-pressed={mode === "smoothed"}
          disabled={!smoothedAvailable}
          onClick={() => onChange("smoothed")}
          className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
            mode === "smoothed"
              ? "bg-[#007DAE] text-white"
              : "border border-white/[0.18] text-[#B8C0CC] disabled:cursor-not-allowed disabled:opacity-45"
          }`}
        >
          Smoothed Trace
        </button>
      </div>
      {!smoothedAvailable ? (
        <p className="mt-2 text-xs font-bold text-amber-100">
          {unavailableMessage}
        </p>
      ) : null}
    </div>
  );
}

function getConfidenceLabel(confidence: LapSmoothingConfidence | null | undefined) {
  if (!confidence) {
    return null;
  }

  return `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence`;
}

function hasMotionValue(...values: Array<number | null | undefined>) {
  return values.some((value) => typeof value === "number" && Number.isFinite(value));
}

export function LapTraceView({
  track,
  samples,
  progress,
  title,
  lap,
  onTraceModeChange,
  showTraceModeSelector = true,
  traceColor = "#00A8E8",
  traceMode
}: LapTraceViewProps) {
  const [viewMode, setViewMode] = useState<ReplayViewMode>("full");
  const hasSmoothedTrace = lapHasSmoothedTrace(lap);
  const [internalTraceMode, setInternalTraceMode] = useState<TraceMode>(() =>
    hasSmoothedTrace ? "smoothed" : "raw"
  );
  const activeTraceMode = traceMode ?? internalTraceMode;
  const selectedLapPath = getLapReplayPath({ lap, samples, traceMode: activeTraceMode });
  const currentSample = sampleAtProgress(samples, progress);
  const traceForCurrent = activeTraceMode === "smoothed"
    ? lap?.smoothedTrace ?? []
    : lap?.rawTrace ?? [];
  const currentTrace = sampleAtProgress(traceForCurrent, progress);
  const currentSpeedMph = metersPerSecondToMilesPerHour(
    currentSample?.speed ?? currentTrace?.speed
  );
  const currentLateralG = currentSample?.lateralG ?? currentTrace?.lateralG ?? null;
  const currentLongitudinalG = currentSample?.longitudinalG ?? currentTrace?.longitudinalG ?? null;
  const { accelG: currentAccelG, brakingG: currentBrakingG } =
    splitVehicleLongitudinalG(currentLongitudinalG);
  const hasGForceData = hasMotionValue(
    currentSample?.lateralG,
    currentSample?.longitudinalG,
    currentSample?.verticalG,
    currentSample?.accelX,
    currentSample?.accelY,
    currentSample?.accelZ,
    currentTrace?.lateralG,
    currentTrace?.longitudinalG,
    currentTrace?.verticalG,
    currentTrace?.accelX,
    currentTrace?.accelY,
    currentTrace?.accelZ
  );
  const confidence =
    lap?.smoothingConfidence ?? lap?.smoothingSummary?.confidence ?? null;
  const warning = lap?.smoothingWarning ?? lap?.smoothingSummary?.warning ?? null;
  const confidenceLabel = getConfidenceLabel(confidence);
  const cornerMarkers = useMemo(() => {
    const definitions =
      track?.corner_definitions as unknown as StoredCornerDefinitions | null | undefined;
    return (definitions?.corners ?? []).map((corner) => ({
      id: `replay-corner-${corner.cornerNumber}`,
      label: `Turn ${corner.cornerNumber}`,
      point: {
        lat: corner.apex.lat,
        lng: corner.apex.lng,
        accuracy: null,
        altitude: null,
        speed: null,
        heading: null,
        timestamp: lap?.startedAt ?? new Date(0).toISOString()
      }
    }));
  }, [lap?.startedAt, track?.corner_definitions]);

  function changeTraceMode(mode: TraceMode) {
    if (mode === "smoothed" && !hasSmoothedTrace) return;
    setInternalTraceMode(mode);
    onTraceModeChange?.(mode);
  }

  useEffect(() => {
    if (activeTraceMode !== "smoothed" || hasSmoothedTrace) return;
    setInternalTraceMode("raw");
    onTraceModeChange?.("raw");
  }, [activeTraceMode, hasSmoothedTrace, onTraceModeChange]);

  return (
    <section className="rounded-[20px] border border-white/[0.12] bg-[#050B11]/88 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-[#B8C0CC]">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {confidenceLabel ? (
            <span className="rounded-full bg-[#007DAE]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#00A8E8]">
              {confidenceLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-[#007DAE]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#00A8E8]">
            Replay
          </span>
        </div>
      </div>
      {showTraceModeSelector ? <div className="mb-3">
        <TraceModeSelector
          mode={activeTraceMode}
          onChange={changeTraceMode}
          smoothedAvailable={hasSmoothedTrace}
        />
      </div> : null}
      <div className="grid gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_138px] sm:grid-cols-[minmax(0,1fr)_177px]">
        <ReplayMap
          track={track}
          title={title}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          markers={cornerMarkers}
          traces={[
            ...(selectedLapPath.length > 1 ? [{
              id: activeTraceMode === "smoothed" ? "smoothed-lap" : "raw-lap",
              label: `${title} ${activeTraceMode}`,
              path: selectedLapPath,
              progress,
              color: traceColor,
              dotColor: traceColor
            }] : [])
          ]}
        />
        <GForceIndicator
          speedMph={currentSpeedMph}
          lateralG={currentLateralG}
          accelG={currentAccelG}
          brakingG={currentBrakingG}
          active={hasGForceData}
          size="large"
          maxLateralG={lap?.maxLateralG}
          maxAccelG={lap?.maxAccelG}
          maxBrakingG={lap?.maxBrakingG}
        />
      </div>
      <GForceTelemetryReadouts
        speedMph={currentSpeedMph}
        lateralG={currentLateralG}
        accelG={currentAccelG}
        brakingG={currentBrakingG}
        active={hasGForceData}
        maxLateralG={lap?.maxLateralG}
        maxAccelG={lap?.maxAccelG}
        maxBrakingG={lap?.maxBrakingG}
      />
      {warning ? (
        <p className="mt-3 rounded-[14px] border border-amber-300/24 bg-amber-300/12 p-3 text-xs font-bold leading-5 text-amber-50">
          {warning}
        </p>
      ) : null}
    </section>
  );
}
