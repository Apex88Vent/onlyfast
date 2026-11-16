// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import {
  calculateDistanceMeters,
  type GpsPoint,
  type SavedTrackMap
} from "./onlylapsTrackScanUtils.ts";
import type {
  LapSmoothingConfidence,
  LapSmoothingSummary,
  LapTelemetrySample,
  LapTracePoint,
  SavedLapRecord,
  SmoothedLapTracePoint
} from "./types.ts";

const impossibleJumpFallbackMps = 95;
const maxRawCorrectionMeters = 18;
const smoothingAlgorithm = "onlylaps_deterministic_telemetry_v1" as const;

type SmoothingInput = {
  samples: LapTelemetrySample[];
  track: SavedTrackMap | null | undefined;
  lapTimeMs: number;
};

type SmoothingResult = {
  rawTrace: LapTracePoint[];
  smoothedTrace: SmoothedLapTracePoint[];
  confidence: LapSmoothingConfidence;
  summary: LapSmoothingSummary;
  warning: string | null;
};

export type SegmentDelta = {
  segmentNumber: number;
  deltaMs: number;
  label: string;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function sampleToLapTracePoint(sample: LapTelemetrySample): LapTracePoint {
  return {
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
  };
}

function isUsableTracePoint(point: LapTracePoint) {
  return (
    isFiniteNumber(point.lat) &&
    isFiniteNumber(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    Number.isFinite(Date.parse(point.timestamp))
  );
}

function removeGpsOutliers(rawTrace: LapTracePoint[]) {
  const kept: LapTracePoint[] = [];
  let removed = 0;

  rawTrace.forEach((point) => {
    if (!isUsableTracePoint(point)) {
      removed += 1;
      return;
    }

    const previous = kept[kept.length - 1];

    if (!previous) {
      kept.push(point);
      return;
    }

    const elapsedSeconds = (Date.parse(point.timestamp) - Date.parse(previous.timestamp)) / 1000;
    const distanceMeters = calculateDistanceMeters(previous, point);
    const reportedSpeed = Math.max(previous.speed ?? 0, point.speed ?? 0);
    const allowedMps = Math.max(
      impossibleJumpFallbackMps,
      isFiniteNumber(reportedSpeed) ? reportedSpeed * 1.8 + 18 : impossibleJumpFallbackMps
    );
    const impliedMps = elapsedSeconds > 0 ? distanceMeters / elapsedSeconds : 0;
    const duplicateTimeJump = elapsedSeconds <= 0.15 && distanceMeters > 20;
    const impossibleJump = elapsedSeconds > 0.15 && impliedMps > allowedMps;

    if (duplicateTimeJump || impossibleJump) {
      removed += 1;
      return;
    }

    kept.push(point);
  });

  return {
    kept,
    removed
  };
}

function applyAdaptiveKalmanSmoothing(trace: LapTracePoint[]) {
  if (trace.length <= 1) {
    return trace.map((point) => ({ ...point }));
  }

  const smoothed: LapTracePoint[] = [];
  let lat = trace[0].lat;
  let lng = trace[0].lng;
  let velocityLat = 0;
  let velocityLng = 0;
  let previousTime = Date.parse(trace[0].timestamp);

  smoothed.push({ ...trace[0] });

  for (let index = 1; index < trace.length; index += 1) {
    const point = trace[index];
    const currentTime = Date.parse(point.timestamp);
    const dt = clamp((currentTime - previousTime) / 1000, 0.1, 3);
    const predictedLat = lat + velocityLat * dt;
    const predictedLng = lng + velocityLng * dt;
    const accuracyPenalty = clamp(((point.accuracy ?? 8) - 4) / 36, 0, 1);
    const speedAssist = point.speed != null && point.speed > 18 ? 0.12 : 0;
    const alpha = clamp(0.68 - accuracyPenalty * 0.3 + speedAssist, 0.34, 0.86);
    const beta = clamp(0.16 - accuracyPenalty * 0.08 + speedAssist * 0.2, 0.06, 0.24);
    const residualLat = point.lat - predictedLat;
    const residualLng = point.lng - predictedLng;

    lat = predictedLat + alpha * residualLat;
    lng = predictedLng + alpha * residualLng;
    velocityLat += (beta * residualLat) / dt;
    velocityLng += (beta * residualLng) / dt;
    previousTime = currentTime;

    smoothed.push({
      ...point,
      lat,
      lng
    });
  }

  return smoothed;
}

function pickByProgress(points: GpsPoint[], index: number, count: number) {
  if (points.length === 0) {
    return null;
  }

  if (points.length === 1 || count <= 1) {
    return points[0];
  }

  const pointIndex = Math.min(
    points.length - 1,
    Math.round((index / (count - 1)) * (points.length - 1))
  );

  return points[pointIndex];
}

function buildTrackReferencePath(track: SavedTrackMap | null | undefined) {
  if (!track) {
    return [];
  }

  if (track.outside_path.length > 1 && track.inside_path.length > 1) {
    const count = Math.max(track.outside_path.length, track.inside_path.length);

    return Array.from({ length: count }, (_, index) => {
      const outside = pickByProgress(track.outside_path, index, count);
      const inside = pickByProgress(track.inside_path, index, count);

      if (!outside || !inside) {
        return outside ?? inside;
      }

      return {
        lat: (outside.lat + inside.lat) / 2,
        lng: (outside.lng + inside.lng) / 2,
        accuracy: null,
        altitude: null,
        speed: null,
        heading: null,
        timestamp: outside.timestamp
      };
    }).filter((point): point is GpsPoint => point !== null);
  }

  if (track.outside_path.length > 1) {
    return track.outside_path;
  }

  return track.inside_path;
}

function findNearestReferencePoint(
  point: LapTracePoint,
  referencePath: GpsPoint[]
): { point: GpsPoint | null; distanceMeters: number } {
  let nearestPoint: GpsPoint | null = null;
  let distanceMeters = Number.POSITIVE_INFINITY;

  for (const referencePoint of referencePath) {
    const distance = calculateDistanceMeters(point, referencePoint);

    if (distance < distanceMeters) {
      nearestPoint = referencePoint;
      distanceMeters = distance;
    }
  }

  return {
    point: nearestPoint,
    distanceMeters
  };
}

function capCorrectionToRaw(
  rawPoint: LapTracePoint,
  correctedPoint: LapTracePoint,
  capMeters: number
) {
  const correctionMeters = calculateDistanceMeters(rawPoint, correctedPoint);

  if (correctionMeters <= capMeters || correctionMeters === 0) {
    return correctedPoint;
  }

  const ratio = capMeters / correctionMeters;

  return {
    ...correctedPoint,
    lat: rawPoint.lat + (correctedPoint.lat - rawPoint.lat) * ratio,
    lng: rawPoint.lng + (correctedPoint.lng - rawPoint.lng) * ratio
  };
}

function mapMatchTrace({
  rawTrace,
  smoothedTrace,
  track
}: {
  rawTrace: LapTracePoint[];
  smoothedTrace: LapTracePoint[];
  track: SavedTrackMap | null | undefined;
}) {
  const referencePath = buildTrackReferencePath(track);
  const maxMatchDistanceMeters =
    track?.track_type === "road_course" ? 70 : track?.track_type ? 48 : 58;
  let mapMatchedPointCount = 0;

  if (referencePath.length < 3) {
    return {
      trace: smoothedTrace.map<SmoothedLapTracePoint>((point, index) => {
        const rawPoint = rawTrace[index] ?? point;
        const correctionMeters = calculateDistanceMeters(rawPoint, point);

        return {
          ...point,
          rawLat: rawPoint.lat,
          rawLng: rawPoint.lng,
          correctionMeters: round(correctionMeters, 2),
          mapMatched: false
        };
      }),
      mapMatchedPointCount
    };
  }

  const trace = smoothedTrace.map<SmoothedLapTracePoint>((point, index) => {
    const rawPoint = rawTrace[index] ?? point;
    const nearest = findNearestReferencePoint(point, referencePath);
    let corrected = point;
    let mapMatched = false;

    if (nearest.point && nearest.distanceMeters <= maxMatchDistanceMeters) {
      const matchStrength = clamp(
        0.12 + (maxMatchDistanceMeters - nearest.distanceMeters) / maxMatchDistanceMeters / 5,
        0.12,
        0.28
      );
      const maxTrackCorrection = Math.min(12, Math.max(6, rawPoint.accuracy ?? 8));

      corrected = {
        ...point,
        lat:
          point.lat +
          (nearest.point.lat - point.lat) *
            Math.min(matchStrength, maxTrackCorrection / Math.max(nearest.distanceMeters, 1)),
        lng:
          point.lng +
          (nearest.point.lng - point.lng) *
            Math.min(matchStrength, maxTrackCorrection / Math.max(nearest.distanceMeters, 1))
      };
      mapMatched = true;
      mapMatchedPointCount += 1;
    }

    corrected = capCorrectionToRaw(
      rawPoint,
      corrected,
      Math.max(8, Math.min(maxRawCorrectionMeters, (rawPoint.accuracy ?? 8) * 1.8))
    );

    return {
      ...corrected,
      rawLat: rawPoint.lat,
      rawLng: rawPoint.lng,
      correctionMeters: round(calculateDistanceMeters(rawPoint, corrected), 2),
      mapMatched
    };
  });

  return {
    trace,
    mapMatchedPointCount
  };
}

function buildSegmentElapsedMs(trace: LapTracePoint[], lapTimeMs: number, segmentCount = 3) {
  if (segmentCount <= 0) {
    return [];
  }

  if (trace.length < segmentCount + 1) {
    const base = Math.round(lapTimeMs / segmentCount);

    return Array.from({ length: segmentCount }, (_, index) =>
      index === segmentCount - 1 ? lapTimeMs - base * (segmentCount - 1) : base
    );
  }

  const firstTime = Date.parse(trace[0].timestamp);
  const lastTime = Date.parse(trace[trace.length - 1].timestamp);
  const traceSpan = Math.max(1, lastTime - firstTime);
  const scale = lapTimeMs > 0 ? lapTimeMs / traceSpan : 1;
  let previousBoundary = firstTime;

  return Array.from({ length: segmentCount }, (_, index) => {
    const pointIndex =
      index === segmentCount - 1
        ? trace.length - 1
        : Math.max(1, Math.round(((index + 1) / segmentCount) * (trace.length - 1)));
    const boundary = Date.parse(trace[pointIndex].timestamp);
    const duration = Math.max(0, Math.round((boundary - previousBoundary) * scale));
    previousBoundary = boundary;

    return duration;
  });
}

function rateSmoothingConfidence({
  rawTrace,
  keptTrace,
  removedOutlierCount,
  averageCorrectionMeters,
  mapMatchedPointCount
}: {
  rawTrace: LapTracePoint[];
  keptTrace: LapTracePoint[];
  removedOutlierCount: number;
  averageCorrectionMeters: number | null;
  mapMatchedPointCount: number;
}): LapSmoothingConfidence {
  if (rawTrace.length < 5 || keptTrace.length < 4) {
    return "low";
  }

  const accuracies = rawTrace
    .map((point) => point.accuracy)
    .filter((value): value is number => isFiniteNumber(value));
  const averageAccuracy = average(accuracies);
  const outlierRatio = removedOutlierCount / rawTrace.length;
  const mapMatchRatio = keptTrace.length > 0 ? mapMatchedPointCount / keptTrace.length : 0;
  let score = 0;

  if (averageAccuracy === null || averageAccuracy <= 15) {
    score += 2;
  } else if (averageAccuracy <= 35) {
    score += 1;
  }

  if (outlierRatio <= 0.04) {
    score += 2;
  } else if (outlierRatio <= 0.12) {
    score += 1;
  }

  if ((averageCorrectionMeters ?? 0) <= 5) {
    score += 2;
  } else if ((averageCorrectionMeters ?? 0) <= 11) {
    score += 1;
  }

  if (mapMatchedPointCount === 0 || mapMatchRatio >= 0.45) {
    score += 1;
  }

  if (score >= 6) {
    return "high";
  }

  if (score >= 4) {
    return "medium";
  }

  return "low";
}

function getSmoothingWarning(confidence: LapSmoothingConfidence) {
  if (confidence !== "low") {
    return null;
  }

  return "GPS quality was poor for this lap, so the corrected line may be inaccurate.";
}

export function smoothLapTelemetry({
  samples,
  track,
  lapTimeMs
}: SmoothingInput): SmoothingResult {
  const rawTrace = samples.map(sampleToLapTracePoint);
  const { kept, removed } = removeGpsOutliers(rawTrace);
  const kalmanTrace = applyAdaptiveKalmanSmoothing(kept);
  const { trace: smoothedTrace, mapMatchedPointCount } = mapMatchTrace({
    rawTrace: kept,
    smoothedTrace: kalmanTrace,
    track
  });
  const corrections = smoothedTrace.map((point) => point.correctionMeters);
  const averageCorrectionMeters = average(corrections);
  const accuracies = rawTrace
    .map((point) => point.accuracy)
    .filter((value): value is number => isFiniteNumber(value));
  const confidence = rateSmoothingConfidence({
    rawTrace,
    keptTrace: kept,
    removedOutlierCount: removed,
    averageCorrectionMeters,
    mapMatchedPointCount
  });
  const warning = getSmoothingWarning(confidence);
  const summary: LapSmoothingSummary = {
    algorithm: smoothingAlgorithm,
    confidence,
    rawSampleCount: rawTrace.length,
    keptSampleCount: kept.length,
    removedOutlierCount: removed,
    averageCorrectionMeters:
      averageCorrectionMeters === null ? null : round(averageCorrectionMeters, 2),
    maxCorrectionMeters: corrections.length > 0 ? round(Math.max(...corrections), 2) : null,
    averageGpsAccuracyMeters: accuracies.length > 0 ? round(average(accuracies) ?? 0, 1) : null,
    mapMatchedPointCount,
    segmentElapsedMs: buildSegmentElapsedMs(smoothedTrace, lapTimeMs),
    warning
  };

  return {
    rawTrace,
    smoothedTrace,
    confidence,
    summary,
    warning
  };
}

export function fallbackSmoothedTraceFromSamples(samples: LapTelemetrySample[]) {
  return samples.map<SmoothedLapTracePoint>((sample) => {
    const point = sampleToLapTracePoint(sample);

    return {
      ...point,
      rawLat: point.lat,
      rawLng: point.lng,
      correctionMeters: 0,
      mapMatched: false
    };
  });
}

function segmentTimesForLap(lap: SavedLapRecord) {
  if (lap.smoothingSummary?.segmentElapsedMs.length) {
    return lap.smoothingSummary.segmentElapsedMs;
  }

  if (lap.sectorTimesMs?.length) {
    return lap.sectorTimesMs.every(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    )
      ? lap.sectorTimesMs
      : [];
  }

  const base = Math.round(lap.lapTimeMs / 3);

  return [base, base, lap.lapTimeMs - base * 2];
}

export function calculateSegmentDeltasVsBest(
  lap: SavedLapRecord,
  bestLap: SavedLapRecord | null | undefined
): SegmentDelta[] {
  const lapSegments = segmentTimesForLap(lap);
  const bestSegments = bestLap ? segmentTimesForLap(bestLap) : [];

  return lapSegments.map((segmentTime, index) => {
    const bestTime = bestSegments[index] ?? segmentTime;
    const deltaMs = segmentTime - bestTime;
    const prefix = deltaMs > 0 ? "+" : "";

    return {
      segmentNumber: index + 1,
      deltaMs,
      label:
        Math.abs(deltaMs) < 1
          ? "Best"
          : `${prefix}${(deltaMs / 1000).toFixed(3)}s`
    };
  });
}

export function buildLapInsightInput({
  lap,
  bestLap,
  samples
}: {
  lap: SavedLapRecord;
  bestLap: SavedLapRecord | null | undefined;
  samples: LapTelemetrySample[];
}) {
  const segmentDeltas = calculateSegmentDeltasVsBest(lap, bestLap);
  const segmentCount = Math.max(segmentDeltas.length, 1);
  const speedBySegment = Array.from({ length: segmentCount }, (_, segmentIndex) => {
    const segmentSamples = samples.filter((_, sampleIndex) => {
      const sampleSegment = Math.min(
        segmentCount - 1,
        Math.floor((sampleIndex / Math.max(samples.length, 1)) * segmentCount)
      );

      return sampleSegment === segmentIndex;
    });
    const speeds = segmentSamples
      .map((sample) => sample.speed)
      .filter((value): value is number => isFiniteNumber(value));

    return speeds.length > 0 ? round(average(speeds) ?? 0, 2) : null;
  });
  const gForceBySegment = Array.from({ length: segmentCount }, (_, segmentIndex) => {
    const segmentSamples = samples.filter((_, sampleIndex) => {
      const sampleSegment = Math.min(
        segmentCount - 1,
        Math.floor((sampleIndex / Math.max(samples.length, 1)) * segmentCount)
      );

      return sampleSegment === segmentIndex;
    });
    const lateralGs = segmentSamples
      .map((sample) => sample.lateralG)
      .filter((value): value is number => isFiniteNumber(value));

    return lateralGs.length > 0
      ? round(Math.max(...lateralGs.map((value) => Math.abs(value))), 3)
      : null;
  });

  return {
    lapNumber: lap.lapNumber,
    lapTimeMs: lap.lapTimeMs,
    smoothingConfidence: lap.smoothingConfidence,
    smoothingSummary: lap.smoothingSummary,
    telemetrySampleCount: samples.length,
    lineQuality: {
      averageCorrectionMeters: lap.smoothingSummary?.averageCorrectionMeters ?? null,
      maximumCorrectionMeters: lap.smoothingSummary?.maxCorrectionMeters ?? null,
      mapMatchedPointCount: lap.smoothingSummary?.mapMatchedPointCount ?? 0
    },
    speedBySegment,
    gForceBySegment,
    segmentDeltas,
    bestLapTimeMs: bestLap?.lapTimeMs ?? null
  };
}

