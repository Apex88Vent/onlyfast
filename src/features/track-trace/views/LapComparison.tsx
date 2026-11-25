import { Button } from "@/components/ui/button";
// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_BETA_REVIEW.md.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { CornerComparisonCards } from "./CornerComparisonCards";
import {
  getLapReplayPath,
  lapHasSmoothedTrace,
  TraceModeSelector,
  type TraceMode
} from "./LapTraceView";
import {
  ReplayMap,
  type ReplayFollowTarget,
  type ReplayViewMode
} from "./ReplayMap";
import { ReplayTelemetryPanel } from "./ReplayTelemetryPanel";
import { SelectedLapDetails } from "./SelectedLapDetails";
type LapInsightPersistenceContext = Record<string, unknown>;
import { compareSessionLapsByCorner } from "../circuit/cornerAnalysis.ts";
import { formatLapTime } from "../circuit/lapFiltering.ts";
import {
  buildOptimumCornerAnalysisReference,
  type OptimumLapResult
} from "../circuit/optimumLap.ts";
import {
  getCornerReferenceLap,
  getLapTelemetrySamples,
  getLapTopSpeedMph,
  getReplayLapColor
} from "../circuit/sessionReview.ts";
import type {
  LapTelemetrySample,
  SavedLapRecord,
  SavedLapSession
} from "../circuit/types.ts";

type LapComparisonProps = {
  session: SavedLapSession;
  validLaps: SavedLapRecord[];
  selectedLap: SavedLapRecord | null;
  optimum: OptimumLapResult | null;
  selectedSamplesOverride?: LapTelemetrySample[];
  selectedLabel?: string;
  showCornerAnalysis?: boolean;
  showTelemetry?: boolean;
};

const primaryColor = getReplayLapColor("primary");
const comparisonColor = getReplayLapColor("comparison");

function getPositionLabel(session: SavedLapSession, progress: number) {
  const corner = session.cornerDefinitions?.corners.find(
    (candidate) => progress >= candidate.startProgress && progress <= candidate.endProgress
  );
  return corner ? `Turn ${corner.cornerNumber}` : `${Math.round(progress * 100)}% lap`;
}

export function LapComparison({
  session,
  validLaps,
  selectedLap,
  optimum,
  selectedSamplesOverride,
  selectedLabel,
  showCornerAnalysis=true,
  showTelemetry=true
}: LapComparisonProps) {
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparisonTargetId, setComparisonTargetId] = useState("");
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [traceMode, setTraceMode] = useState<TraceMode>("raw");
  const [viewMode, setViewMode] = useState<ReplayViewMode>("full");
  const [followTarget, setFollowTarget] = useState<ReplayFollowTarget>("selected-lap");
  const [selectedCornerNumber, setSelectedCornerNumber] = useState<number | null>(null);
  const isActualLap = Boolean(
    selectedLap && validLaps.some((lap) => lap.id === selectedLap.id)
  );
  const comparisonOptions = useMemo(
    () => validLaps.filter((lap) => lap.id !== selectedLap?.id),
    [selectedLap?.id, validLaps]
  );
  const fallbackReferenceLap = useMemo(
    () => getCornerReferenceLap(isActualLap ? selectedLap : null, validLaps),
    [isActualLap, selectedLap, validLaps]
  );
  const comparisonUsesOptimum = Boolean(
    optimum && (!compareEnabled || comparisonTargetId === "optimum")
  );
  const comparisonLap = useMemo(
    () =>
      comparisonUsesOptimum
        ? optimum?.lap ?? null
        : getCornerReferenceLap(
            isActualLap ? selectedLap : null,
            validLaps,
            compareEnabled ? comparisonTargetId : undefined
          ),
    [
      compareEnabled,
      comparisonTargetId,
      comparisonUsesOptimum,
      isActualLap,
      optimum,
      selectedLap,
      validLaps
    ]
  );
  const selectedSamples = useMemo(
    () => selectedSamplesOverride ?? getLapTelemetrySamples(session, selectedLap),
    [selectedLap, selectedSamplesOverride, session]
  );
  const comparisonSamples = useMemo(
    () =>
      comparisonUsesOptimum
        ? optimum?.samples ?? []
        : getLapTelemetrySamples(session, comparisonLap),
    [comparisonLap, comparisonUsesOptimum, optimum, session]
  );
  const smoothedAvailable =
    lapHasSmoothedTrace(selectedLap) &&
    (!compareEnabled || lapHasSmoothedTrace(comparisonLap));
  const effectiveTraceMode =
    traceMode === "smoothed" && smoothedAvailable ? "smoothed" : "raw";
  const selectedPath = useMemo(
    () =>
      getLapReplayPath({
        lap: selectedLap,
        samples: selectedSamples,
        traceMode: effectiveTraceMode
      }),
    [effectiveTraceMode, selectedLap, selectedSamples]
  );
  const comparisonPath = useMemo(
    () =>
      getLapReplayPath({
        lap: comparisonLap,
        samples: comparisonSamples,
        traceMode: effectiveTraceMode
      }),
    [comparisonLap, comparisonSamples, effectiveTraceMode]
  );
  const optimumCornerReference = useMemo(
    () =>
      optimum
        ? buildOptimumCornerAnalysisReference(session, optimum)
        : null,
    [optimum, session]
  );
  const activeCornerAnalysis = useMemo(
    () =>
      comparisonUsesOptimum &&
      session.cornerAnalysis &&
      optimumCornerReference
        ? {
            ...session.cornerAnalysis,
            laps: [
              ...session.cornerAnalysis.laps.filter(
                (lap) => lap.lapId !== optimumCornerReference.lapAnalysis.lapId
              ),
              optimumCornerReference.lapAnalysis
            ]
          }
        : session.cornerAnalysis,
    [comparisonUsesOptimum, optimumCornerReference, session.cornerAnalysis]
  );
  const cornerComparison = useMemo(
    () =>
      activeCornerAnalysis && isActualLap && selectedLap && comparisonLap
        ? compareSessionLapsByCorner({
            analysis: activeCornerAnalysis,
            comparisonLap: selectedLap,
            referenceLap: comparisonLap
          })
        : null,
    [activeCornerAnalysis, comparisonLap, isActualLap, selectedLap]
  );
  const analysisPersistence = useMemo<LapInsightPersistenceContext | undefined>(
    () =>
      session.rawId
        ? {
            sessionId: session.rawId,
            optimumLap: optimum
              ? {
                  lapTimeMs: optimum.lap.lapTimeMs,
                  deltaToFastestLapMs: optimum.deltaToFastestLapMs,
                  sectors: optimum.sectors.map((sector) => ({
                    sectorIndex: sector.sectorIndex,
                    durationMs: sector.durationMs,
                    sourceLapId: sector.sourceLapId,
                    sourceLapNumber: sector.sourceLapNumber
                  })),
                  cornerContexts: optimum.cornerContexts.map((corner) => ({
                    sectorIndex: corner.sectorIndex,
                    cornerNumber: corner.cornerNumber,
                    sourceLapId: corner.sourceLapId,
                    sourceLapNumber: corner.sourceLapNumber,
                    entrySpeedMps: corner.entrySpeedMps,
                    minimumSpeedMps: corner.minimumSpeedMps,
                    exitSpeedMps: corner.exitSpeedMps,
                    cornerTimeSeconds: corner.cornerTimeSeconds,
                    timeDeltaVsFastestSeconds:
                      corner.timeDeltaVsFastestSeconds,
                    lineClassification: corner.lineClassification
                  }))
                }
              : null
          }
        : undefined,
    [optimum, session.rawId]
  );
  const cornerMarkers = useMemo(
    () =>
      (session.cornerDefinitions?.corners ?? []).map((corner) => ({
        id: `corner-${corner.cornerNumber}`,
        label: `Turn ${corner.cornerNumber}`,
        point: {
          lat: corner.apex.lat,
          lng: corner.apex.lng,
          accuracy: null,
          altitude: null,
          speed: null,
          heading: null,
          timestamp: session.startedAt
        }
      })),
    [session.cornerDefinitions, session.startedAt]
  );

  const updateProgress = useCallback((nextProgress: number) => {
    progressRef.current = nextProgress;
    setProgress(nextProgress);
  }, []);

  useEffect(() => {
    const nextReference = getCornerReferenceLap(
      isActualLap ? selectedLap : null,
      validLaps
    );
    setComparisonTargetId((current) => {
      if (optimum && (
        !current ||
        current === "optimum" ||
        current === selectedLap?.id ||
        !validLaps.some((lap) => lap.id === current)
      )) {
        return "optimum";
      }
      if (current && current !== selectedLap?.id) return current;
      return nextReference?.id ?? "";
    });
    setPlaying(false);
    updateProgress(0);
  }, [isActualLap, optimum, selectedLap, updateProgress, validLaps]);

  useEffect(() => {
    if (traceMode === "smoothed" && !smoothedAvailable) setTraceMode("raw");
  }, [smoothedAvailable, traceMode]);

  useEffect(() => {
    if (!playing || !selectedLap || selectedLap.lapTimeMs <= 0) return;
    const durationMs = selectedLap.lapTimeMs;
    const startedAt =
      performance.now() - (progressRef.current * durationMs) / playbackSpeed;
    let frame = 0;

    function tick(now: number) {
      const nextProgress = Math.min(
        1,
        ((now - startedAt) * playbackSpeed) / durationMs
      );
      updateProgress(nextProgress);
      if (nextProgress < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playbackSpeed, playing, selectedLap, updateProgress]);

  useEffect(() => {
    setSelectedCornerNumber(cornerComparison?.corners[0]?.cornerNumber ?? null);
  }, [cornerComparison]);

  if (!selectedLap) return null;

  const reset = () => {
    setPlaying(false);
    updateProgress(0);
  };
  const selectCorner = (cornerNumber: number, scroll = false) => {
    setSelectedCornerNumber(cornerNumber);
    if (scroll) {
      requestAnimationFrame(() => {
        document
          .getElementById(`corner-comparison-${cornerNumber}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };
  const selectedLapName = selectedLabel ?? `Lap ${selectedLap.lapNumber}`;
  const primaryPanelLabel = `Primary — ${selectedLapName}`;
  const comparisonPanelLabel = comparisonUsesOptimum
    ? "Optimum Lap"
    : comparisonLap
      ? `Compare — Lap ${comparisonLap.lapNumber}`
      : "Compare lap";
  const topSpeedMph = isActualLap
    ? getLapTopSpeedMph(selectedLap, session.telemetrySamples ?? [])
    : selectedLap.maxSpeed;
  const referenceDescription = comparisonUsesOptimum
    ? "Using the calculated composite optimum lap as the reference."
    : comparisonLap
      ? optimum
        ? `Using selected comparison Lap ${comparisonLap.lapNumber}.`
        : `Optimum lap unavailable; using fastest valid actual Lap ${comparisonLap.lapNumber}.`
      : "Another valid lap is required as a reference.";
  const cornerReferenceLabel = comparisonUsesOptimum
    ? "Optimum Lap"
    : comparisonLap
      ? `Lap ${comparisonLap.lapNumber}`
      : "Reference lap";
  const positionLabel = getPositionLabel(session, progress);

  return (
    <section className="space-y-3" aria-label="Selected lap replay and analysis">
      <section className="rounded-2xl bg-white p-4 text-[#071018] shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5D6675]">
              Replay Analysis
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Selected Lap Replay</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
              <span style={{ color: primaryColor }}>{primaryPanelLabel}</span>
              <span>{formatLapTime(selectedLap.lapTimeMs)}</span>
              <span>
                Top speed {topSpeedMph == null ? "—" : `${topSpeedMph.toFixed(1)} mph`}
              </span>
            </div>
          </div>
          <Button variant="outline"
            type="button"
            role="switch"
            aria-checked={compareEnabled}
            disabled={
              !isActualLap ||
              (!optimum && comparisonOptions.length === 0)
            }
            onClick={() => {
              if (!compareEnabled) {
                setComparisonTargetId(
                  optimum ? "optimum" : fallbackReferenceLap?.id ?? ""
                );
              }
              setCompareEnabled((current) => !current);
              reset();
            }}
            className={`min-h-11 rounded-lg px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              compareEnabled
                ? "bg-[#7E22CE] text-white hover:bg-purple-900 hover:text-white"
                : "border border-[#7E22CE]/35 text-[#7E22CE]"
            }`}
          >
            {compareEnabled ? "Compare Laps On" : "Compare Laps"}
          </Button>
        </div>

        {compareEnabled ? (
          <label className="mt-3 block text-xs font-semibold text-[#5D6675]">
            Compare to
            <select
              value={comparisonTargetId}
              onChange={(event) => {
                setComparisonTargetId(event.target.value);
                reset();
              }}
              className="mt-1 min-h-11 w-full rounded-[14px] border border-[#C8D1DD] bg-white px-3 text-sm font-semibold text-[#071018]"
              aria-label="Comparison lap"
            >
              {optimum ? <option value="optimum">Optimum Lap</option> : null}
              {comparisonOptions.map((lap) => (
                <option key={lap.id} value={lap.id}>
                  Lap {lap.lapNumber} · {formatLapTime(lap.lapTimeMs)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D7DEE8] pt-3">
          <label className="text-xs font-semibold text-[#5D6675]">
            Playback speed
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              className="ml-2 min-h-11 rounded-lg border border-[#C8D1DD] bg-white px-3 text-sm font-semibold text-[#071018]"
            >
              {[0.5, 1, 1.5, 2].map((speed) => (
                <option key={speed} value={speed}>{speed}x</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button variant="outline"
              type="button"
              onClick={reset}
              className="flex size-10 items-center justify-center rounded-lg border border-[#C8D1DD] text-[#007DAE]"
              aria-label="Restart replay"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="outline"
              type="button"
              onClick={() => setPlaying((current) => !current)}
              className="flex size-11 items-center justify-center rounded-lg bg-[#007DAE] text-white hover:bg-[#006B95] hover:text-white"
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? (
                <Pause className="size-5" aria-hidden="true" />
              ) : (
                <Play className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(progress * 1000)}
          onChange={(event) => {
            setPlaying(false);
            updateProgress(Number(event.target.value) / 1000);
          }}
          className="mt-2 w-full accent-[#007DAE]"
          aria-label="Normalized track-position timeline"
        />

        <div className="mt-3 bg-card p-2 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <TraceModeSelector
              mode={effectiveTraceMode}
              onChange={setTraceMode}
              smoothedAvailable={smoothedAvailable}
            />
            <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5" style={{ color: primaryColor }}>
                <span
                  className="size-2.5 rounded-lg"
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                />
                {primaryPanelLabel}
              </span>
              {compareEnabled && comparisonLap ? (
                <span className="flex items-center gap-1.5" style={{ color: comparisonColor }}>
                  <span
                    className="size-2.5 rounded-lg"
                    style={{ backgroundColor: comparisonColor }}
                    aria-hidden="true"
                  />
                  {comparisonPanelLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mx-auto w-full sm:w-3/4">
            <ReplayMap
              track={session.trackMap}
              title="Selected lap track replay"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              followTarget={followTarget}
              onFollowTargetChange={setFollowTarget}
              className="h-[225px] sm:h-[285px]"
              markers={cornerMarkers}
              selectedMarkerId={
                selectedCornerNumber === null ? null : `corner-${selectedCornerNumber}`
              }
              onMarkerSelect={(markerId) => {
                const cornerNumber = Number(markerId.replace("corner-", ""));
                if (Number.isFinite(cornerNumber)) selectCorner(cornerNumber, true);
              }}
              traces={[
                {
                  id: "selected-lap",
                  label: primaryPanelLabel,
                  path: selectedPath,
                  progress,
                  color: primaryColor
                },
                ...(compareEnabled && comparisonLap
                  ? [{
                      id: "comparison-lap",
                      label: comparisonPanelLabel,
                      path: comparisonPath,
                      progress,
                      color: comparisonColor
                    }]
                  : [])
              ]}
            />
          </div>
        </div>

        {showTelemetry&&<div
          className={`mt-2 grid gap-2 ${
            compareEnabled ? "grid-cols-2" : "max-w-sm grid-cols-1"
          }`}
          aria-label="Replay telemetry"
        >
          <ReplayTelemetryPanel
            title={primaryPanelLabel}
            samples={selectedSamples}
            progress={progress}
            lap={selectedLap}
            accentColor={primaryColor}
            positionLabel={positionLabel}
            compact
          />
          {compareEnabled && comparisonLap ? (
            <ReplayTelemetryPanel
              title={comparisonPanelLabel}
              samples={comparisonSamples}
              progress={progress}
              lap={comparisonLap}
              accentColor={comparisonColor}
              positionLabel={positionLabel}
              compact
            />
          ) : null}
        </div>}

        <SelectedLapDetails
          lap={selectedLap}
          session={session}
          isOptimum={!isActualLap}
        />
      </section>

      {showCornerAnalysis&&(cornerComparison ? (
        <CornerComparisonCards
          comparison={cornerComparison}
          selectedCornerNumber={selectedCornerNumber}
          onSelectCorner={selectCorner}
          referenceDescription={referenceDescription}
          primaryLabel={isActualLap ? `Lap ${selectedLap.lapNumber}` : selectedLapName}
          referenceLabel={cornerReferenceLabel}
          referenceSourceLapNumbers={
            comparisonUsesOptimum
              ? optimumCornerReference?.sourceLapNumbersByCorner
              : undefined
          }
          analysisPersistence={analysisPersistence}
        />
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
          Corner analysis will appear when this selected lap and a reference lap have
          saved corner telemetry.
        </p>
      ))}
    </section>
  );
}
