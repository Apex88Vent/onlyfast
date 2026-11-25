// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { summarizeLapTelemetry } from "./telemetryMath.ts";
import { compareSessionLapsByCorner } from "./cornerAnalysis.ts";
import type {
  LapTelemetrySample,
  SavedLapRecord,
  SavedLapSession,
  SessionCornerAnalysis,
  SmoothedLapTracePoint
} from "./types.ts";

export type OptimumSectorSource = {
  sectorIndex: number;
  durationMs: number;
  sourceLapId: string;
  sourceLapNumber: number;
  sourceStartedAt: string;
  sourceEndedAt: string;
  startsAtMs: number;
  endsAtMs: number;
};

export type OptimumLapResult = {
  lap: SavedLapRecord;
  samples: LapTelemetrySample[];
  sectors: OptimumSectorSource[];
  deltaToFastestLapMs: number;
  replayAvailable: boolean;
  cornerContexts: OptimumCornerContext[];
};

export type OptimumCornerContext = {
  sectorIndex: number;
  cornerNumber: number;
  sourceLapId: string;
  sourceLapNumber: number;
  entrySpeedMps: number | null;
  minimumSpeedMps: number | null;
  exitSpeedMps: number | null;
  cornerTimeSeconds: number;
  timeDeltaVsFastestSeconds: number | null;
  lineClassification:
    | "meaningfully_higher"
    | "meaningfully_lower"
    | "meaningfully_wider"
    | "meaningfully_tighter"
    | "not_meaningful";
  lineConfidence: "low" | "medium" | "high";
  possibleScrub: boolean;
  scrubConfidence: "low" | "medium" | "high";
};

export type OptimumCornerAnalysisReference = {
  lapAnalysis: SessionCornerAnalysis["laps"][number];
  sourceLapNumbersByCorner: Record<number, number>;
};

function interpolateNumber(a: number | null, b: number | null, fraction: number) {
  return a !== null && b !== null ? a + (b - a) * fraction : a ?? b;
}

function interpolateSample(a: LapTelemetrySample, b: LapTelemetrySample, atMs: number) {
  const aMs = Date.parse(a.timestamp);
  const bMs = Date.parse(b.timestamp);
  const fraction = bMs > aMs ? Math.min(1, Math.max(0, (atMs - aMs) / (bMs - aMs))) : 0;
  return {
    ...a,
    timestamp: new Date(atMs).toISOString(),
    latitude: interpolateNumber(a.latitude, b.latitude, fraction) ?? a.latitude,
    longitude: interpolateNumber(a.longitude, b.longitude, fraction) ?? a.longitude,
    gpsAccuracy: interpolateNumber(a.gpsAccuracy, b.gpsAccuracy, fraction),
    speed: interpolateNumber(a.speed, b.speed, fraction),
    heading: interpolateNumber(a.heading, b.heading, fraction),
    altitude: interpolateNumber(a.altitude, b.altitude, fraction),
    accelX: interpolateNumber(a.accelX, b.accelX, fraction),
    accelY: interpolateNumber(a.accelY, b.accelY, fraction),
    accelZ: interpolateNumber(a.accelZ, b.accelZ, fraction),
    gyroX: interpolateNumber(a.gyroX, b.gyroX, fraction),
    gyroY: interpolateNumber(a.gyroY, b.gyroY, fraction),
    gyroZ: interpolateNumber(a.gyroZ, b.gyroZ, fraction),
    lateralG: interpolateNumber(a.lateralG, b.lateralG, fraction),
    longitudinalG: interpolateNumber(a.longitudinalG, b.longitudinalG, fraction),
    verticalG: interpolateNumber(a.verticalG, b.verticalG, fraction)
  };
}

function sampleAtTimestamp(samples: LapTelemetrySample[], atMs: number) {
  if (samples.length === 0) return null;
  for (let index = 1; index < samples.length; index += 1) {
    if (Date.parse(samples[index].timestamp) >= atMs) {
      return interpolateSample(samples[index - 1], samples[index], atMs);
    }
  }
  return { ...samples[samples.length - 1], timestamp: new Date(atMs).toISOString() };
}

function trimSectorSamples(samples: LapTelemetrySample[], startMs: number, endMs: number) {
  const start = sampleAtTimestamp(samples, startMs);
  const end = sampleAtTimestamp(samples, endMs);
  if (!start || !end) return [];
  return [
    start,
    ...samples.filter((sample) => {
      const timestamp = Date.parse(sample.timestamp);
      return timestamp > startMs && timestamp < endMs;
    }),
    end
  ];
}

function interpolateTraceNumber(a: number | null, b: number | null, fraction: number) {
  return a !== null && b !== null ? a + (b - a) * fraction : a ?? b;
}

function interpolateSmoothedTracePoint(
  a: SmoothedLapTracePoint,
  b: SmoothedLapTracePoint,
  atMs: number
) {
  const aMs = Date.parse(a.timestamp);
  const bMs = Date.parse(b.timestamp);
  const fraction = bMs > aMs ? Math.min(1, Math.max(0, (atMs - aMs) / (bMs - aMs))) : 0;
  return {
    ...a,
    timestamp: new Date(atMs).toISOString(),
    lat: interpolateTraceNumber(a.lat, b.lat, fraction) ?? a.lat,
    lng: interpolateTraceNumber(a.lng, b.lng, fraction) ?? a.lng,
    speed: interpolateTraceNumber(a.speed, b.speed, fraction),
    heading: interpolateTraceNumber(a.heading, b.heading, fraction),
    accuracy: interpolateTraceNumber(a.accuracy, b.accuracy, fraction),
    altitude: interpolateTraceNumber(a.altitude, b.altitude, fraction),
    accelX: interpolateTraceNumber(a.accelX, b.accelX, fraction),
    accelY: interpolateTraceNumber(a.accelY, b.accelY, fraction),
    accelZ: interpolateTraceNumber(a.accelZ, b.accelZ, fraction),
    gyroX: interpolateTraceNumber(a.gyroX, b.gyroX, fraction),
    gyroY: interpolateTraceNumber(a.gyroY, b.gyroY, fraction),
    gyroZ: interpolateTraceNumber(a.gyroZ, b.gyroZ, fraction),
    lateralG: interpolateTraceNumber(a.lateralG, b.lateralG, fraction),
    longitudinalG: interpolateTraceNumber(a.longitudinalG, b.longitudinalG, fraction),
    verticalG: interpolateTraceNumber(a.verticalG, b.verticalG, fraction),
    rawLat: interpolateTraceNumber(a.rawLat, b.rawLat, fraction) ?? a.rawLat,
    rawLng: interpolateTraceNumber(a.rawLng, b.rawLng, fraction) ?? a.rawLng,
    correctionMeters:
      interpolateTraceNumber(a.correctionMeters, b.correctionMeters, fraction) ?? a.correctionMeters,
    mapMatched: fraction < 0.5 ? a.mapMatched : b.mapMatched
  };
}

function smoothedPointAtTimestamp(trace: SmoothedLapTracePoint[], atMs: number) {
  if (trace.length === 0) return null;
  for (let index = 1; index < trace.length; index += 1) {
    if (Date.parse(trace[index].timestamp) >= atMs) {
      return interpolateSmoothedTracePoint(trace[index - 1], trace[index], atMs);
    }
  }
  return { ...trace[trace.length - 1], timestamp: new Date(atMs).toISOString() };
}

function trimSmoothedSector(
  trace: SmoothedLapTracePoint[],
  startMs: number,
  endMs: number
) {
  if (trace.length < 2) return [];
  const start = smoothedPointAtTimestamp(trace, startMs);
  const end = smoothedPointAtTimestamp(trace, endMs);
  if (!start || !end) return [];
  return [
    start,
    ...trace.filter((point) => {
      const timestamp = Date.parse(point.timestamp);
      return timestamp > startMs && timestamp < endMs;
    }),
    end
  ];
}

export function buildOptimumLap(session: SavedLapSession): OptimumLapResult | null {
  const validLaps = (session.laps ?? []).filter((lap) => lap.isValid && lap.sectorTimesMs?.length);
  const configuredSectorCount = session.sectorCount ?? 0;
  const sectorCount = Math.min(5, configuredSectorCount > 0
    ? configuredSectorCount
    : Math.max(0, ...validLaps.map((lap) => lap.sectorTimesMs?.length ?? 0)));
  if (sectorCount === 0) return null;

  const fastest = Array.from({ length: sectorCount }, (_, sectorIndex) => {
    const savedSource = (session.optimumSectorSources ?? []).find(
      (source) => source.sectorIndex === sectorIndex + 1
    );
    const savedSourceLap = savedSource
      ? validLaps.find(
          (lap) => lap.id === savedSource.sourceLapId || lap.lapNumber === savedSource.sourceLapNumber
        )
      : null;
    if (savedSource && savedSourceLap && savedSource.durationMs > 0) {
      return { lap: savedSourceLap, durationMs: savedSource.durationMs };
    }
    return validLaps
      .map((lap) => ({ lap, durationMs: lap.sectorTimesMs?.[sectorIndex] ?? null }))
      .filter((entry): entry is { lap: SavedLapRecord; durationMs: number } =>
        typeof entry.durationMs === "number" && Number.isFinite(entry.durationMs) && entry.durationMs > 0
      )
      .sort((a, b) => a.durationMs - b.durationMs || a.lap.lapNumber - b.lap.lapNumber)[0] ?? null;
  });
  if (fastest.some((entry) => entry === null)) return null;

  const compositeStartedAt = Date.parse(session.startedAt);
  let compositeElapsed = 0;
  const samples: LapTelemetrySample[] = [];
  const smoothedTrace: SmoothedLapTracePoint[] = [];
  const sectors: OptimumSectorSource[] = [];
  let replayAvailable = true;
  let smoothedReplayAvailable = true;

  fastest.forEach((entry, sectorIndex) => {
    if (!entry) return;
    const sourceSamples = (session.telemetrySamples ?? [])
      .filter((sample) => sample.lapNumber === entry.lap.lapNumber)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const sourceSmoothedTrace = [...(entry.lap.smoothedTrace ?? [])]
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const sourceOffset = (entry.lap.sectorTimesMs ?? [])
      .slice(0, sectorIndex)
      .reduce<number>((total, value) => total + (value ?? 0), 0);
    const sourceSectorResult = (session.sectorResults ?? []).find(
      (result) => result.lapId === entry.lap.id && result.sectorIndex === sectorIndex + 1
    );
    const previousSectorResult = sectorIndex > 0
      ? (session.sectorResults ?? []).find(
          (result) => result.lapId === entry.lap.id && result.sectorIndex === sectorIndex
        )
      : null;
    const fallbackStart = Date.parse(entry.lap.startedAt) + sourceOffset;
    const savedSource = (session.optimumSectorSources ?? []).find(
      (source) => source.sectorIndex === sectorIndex + 1 && source.sourceLapId === entry.lap.id
    );
    const savedStart = savedSource?.segmentStartTimestamp
      ? Date.parse(savedSource.segmentStartTimestamp)
      : Number.NaN;
    const savedEnd = savedSource?.segmentEndTimestamp
      ? Date.parse(savedSource.segmentEndTimestamp)
      : Number.NaN;
    const resultStart = previousSectorResult?.crossingTimestamp
      ? Date.parse(previousSectorResult.crossingTimestamp)
      : Number.NaN;
    const resultEnd = sourceSectorResult?.crossingTimestamp
      ? Date.parse(sourceSectorResult.crossingTimestamp)
      : Number.NaN;
    const sourceStart = Number.isFinite(savedStart)
      ? savedStart
      : Number.isFinite(resultStart)
        ? resultStart
        : fallbackStart;
    const sourceEnd = Number.isFinite(savedEnd)
      ? savedEnd
      : Number.isFinite(resultEnd)
        ? resultEnd
        : sourceStart + entry.durationMs;
    const segment = trimSectorSamples(sourceSamples, sourceStart, sourceEnd);
    const sectorStartsAt = compositeElapsed;

    if (segment.length < 2) {
      replayAvailable = false;
    }

    const smoothedSegment = trimSmoothedSector(sourceSmoothedTrace, sourceStart, sourceEnd);
    if (smoothedSegment.length < 2) {
      smoothedReplayAvailable = false;
    }

    segment.forEach((sample, sampleIndex) => {
      if (samples.length > 0 && sampleIndex === 0) return;
      const sourceElapsed = Date.parse(sample.timestamp) - sourceStart;
      samples.push({
        ...sample,
        id: `optimum-${sectorIndex + 1}-${sampleIndex}`,
        lapId: "optimum-virtual-composite",
        lapNumber: 0,
        timestamp: new Date(compositeStartedAt + compositeElapsed + sourceElapsed).toISOString(),
        sampleIndex: samples.length
      });
    });
    smoothedSegment.forEach((point, pointIndex) => {
      if (smoothedTrace.length > 0 && pointIndex === 0) return;
      const sourceElapsed = Date.parse(point.timestamp) - sourceStart;
      smoothedTrace.push({
        ...point,
        timestamp: new Date(compositeStartedAt + compositeElapsed + sourceElapsed).toISOString()
      });
    });
    compositeElapsed += entry.durationMs;
    sectors.push({
      sectorIndex: sectorIndex + 1,
      durationMs: entry.durationMs,
      sourceLapId: entry.lap.id,
      sourceLapNumber: entry.lap.lapNumber,
      sourceStartedAt: new Date(sourceStart).toISOString(),
      sourceEndedAt: new Date(sourceEnd).toISOString(),
      startsAtMs: sectorStartsAt,
      endsAtMs: compositeElapsed
    });
  });

  replayAvailable = replayAvailable && samples.length >= 2;
  const summary = summarizeLapTelemetry(samples, compositeElapsed);
  const endedAt = new Date(compositeStartedAt + compositeElapsed).toISOString();
  const lap: SavedLapRecord = {
    id: "optimum-virtual-composite",
    sessionId: session.id,
    userId: session.userId,
    trackId: session.trackId,
    lapNumber: 0,
    startedAt: new Date(compositeStartedAt).toISOString(),
    endedAt,
    lapTimeMs: compositeElapsed,
    sectorTimesMs: sectors.map((sector) => sector.durationMs),
    averageSpeed: summary.averageSpeed,
    maxSpeed: summary.maxSpeed,
    maxLateralG: summary.maxLateralG,
    maxLongitudinalG: summary.maxLongitudinalG,
    maxVerticalG: summary.maxVerticalG,
    maxAccelG: summary.maxAccelG,
    maxBrakingG: summary.maxBrakingG,
    isValid: true,
    excludedReason: null,
    createdAt: endedAt,
    rawTrace: samples.map((sample) => ({
      lat: sample.latitude,
      lng: sample.longitude,
      timestamp: sample.timestamp,
      speed: sample.speed,
      heading: sample.heading,
      accuracy: sample.gpsAccuracy,
      altitude: sample.altitude,
      accelX: sample.accelX,
      accelY: sample.accelY,
      accelZ: sample.accelZ,
      gyroX: sample.gyroX,
      gyroY: sample.gyroY,
      gyroZ: sample.gyroZ,
      lateralG: sample.lateralG,
      longitudinalG: sample.longitudinalG,
      verticalG: sample.verticalG
    })),
    smoothedTrace: smoothedReplayAvailable ? smoothedTrace : []
  };
  const fastestCompleteLap =
    [...validLaps].sort((a, b) => a.lapTimeMs - b.lapTimeMs)[0] ?? null;
  const cornerContexts: OptimumCornerContext[] = [];
  if (session.cornerAnalysis && fastestCompleteLap) {
    sectors.forEach((sector) => {
      const sourceLap = validLaps.find((candidate) => candidate.id === sector.sourceLapId);
      const sourceAnalysis = session.cornerAnalysis?.laps.find(
        (candidate) => candidate.lapId === sector.sourceLapId
      );
      if (!sourceLap || !sourceAnalysis) return;
      const sourceLapStart = Date.parse(sourceLap.startedAt);
      const sectorStart = Date.parse(sector.sourceStartedAt);
      const sectorEnd = Date.parse(sector.sourceEndedAt);
      const comparison = compareSessionLapsByCorner({
        analysis: session.cornerAnalysis!,
        comparisonLap: sourceLap,
        referenceLap: fastestCompleteLap
      });
      sourceAnalysis.corners.forEach((corner) => {
        const apexTimestamp = sourceLapStart + corner.apexElapsedSeconds * 1000;
        if (apexTimestamp < sectorStart || apexTimestamp > sectorEnd) return;
        const comparedCorner = comparison?.corners.find(
          (candidate) => candidate.cornerNumber === corner.cornerNumber
        );
        cornerContexts.push({
          sectorIndex: sector.sectorIndex,
          cornerNumber: corner.cornerNumber,
          sourceLapId: sourceLap.id,
          sourceLapNumber: sourceLap.lapNumber,
          entrySpeedMps: corner.entrySpeedMps,
          minimumSpeedMps: corner.minimumSpeedMps,
          exitSpeedMps: corner.exitSpeedMps,
          cornerTimeSeconds: corner.cornerTimeSeconds,
          timeDeltaVsFastestSeconds: comparedCorner?.cornerTimeDeltaSeconds ?? null,
          lineClassification:
            comparedCorner?.lineDifference.classification ?? "not_meaningful",
          lineConfidence: comparedCorner?.lineDifference.confidence ?? corner.confidence,
          possibleScrub: comparedCorner?.possibleScrub.detected ?? false,
          scrubConfidence: comparedCorner?.possibleScrub.confidence ?? corner.confidence
        });
      });
    });
  }

  return {
    lap,
    samples,
    sectors,
    deltaToFastestLapMs: Math.max(0, (session.fastestLapTimeMs ?? compositeElapsed) - compositeElapsed),
    replayAvailable,
    cornerContexts
  };
}

export function buildOptimumCornerAnalysisReference(
  session: SavedLapSession,
  optimum: OptimumLapResult
): OptimumCornerAnalysisReference | null {
  const analysis = session.cornerAnalysis;
  if (!analysis) return null;

  const sourceLapNumbersByCorner: Record<number, number> = {};
  const corners = analysis.definitions.corners.flatMap((definition) => {
    const source = optimum.sectors
      .map((sector) => {
        const sourceLap = (session.laps ?? []).find(
          (lap) => lap.id === sector.sourceLapId
        );
        const sourceAnalysis = analysis.laps.find(
          (lap) => lap.lapId === sector.sourceLapId
        );
        const metrics = sourceAnalysis?.corners.find(
          (corner) => corner.cornerNumber === definition.cornerNumber
        );
        if (!sourceLap || !metrics) return null;

        const sourceLapStartMs = Date.parse(sourceLap.startedAt);
        const sourceSectorStartMs = Date.parse(sector.sourceStartedAt);
        const sourceSectorEndMs = Date.parse(sector.sourceEndedAt);
        const apexTimestampMs =
          sourceLapStartMs + metrics.apexElapsedSeconds * 1000;
        if (
          apexTimestampMs < sourceSectorStartMs ||
          apexTimestampMs > sourceSectorEndMs
        ) {
          return null;
        }

        return { metrics, sector, sourceLap };
      })
      .find((candidate) => candidate !== null);

    if (!source) return [];

    const sourceSectorOffsetSeconds =
      (Date.parse(source.sector.sourceStartedAt) -
        Date.parse(source.sourceLap.startedAt)) /
      1000;
    const compositeOffsetSeconds =
      source.sector.startsAtMs / 1000 - sourceSectorOffsetSeconds;
    sourceLapNumbersByCorner[definition.cornerNumber] =
      source.sourceLap.lapNumber;

    return [{
      ...source.metrics,
      lapId: optimum.lap.id,
      lapNumber: optimum.lap.lapNumber,
      entryElapsedSeconds:
        source.metrics.entryElapsedSeconds + compositeOffsetSeconds,
      apexElapsedSeconds:
        source.metrics.apexElapsedSeconds + compositeOffsetSeconds,
      exitElapsedSeconds:
        source.metrics.exitElapsedSeconds + compositeOffsetSeconds
    }];
  });

  if (!corners.length) return null;

  return {
    lapAnalysis: {
      lapId: optimum.lap.id,
      lapNumber: optimum.lap.lapNumber,
      isValid: true,
      corners
    },
    sourceLapNumbersByCorner
  };
}
