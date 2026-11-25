// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type {
  CornerAnalysisConfidence,
  CornerDataQuality,
  CornerDefinition,
  CornerLapMetrics,
  LapCornerComparison,
  LapTelemetrySample,
  SavedLapRecord,
  SavedLapSession,
  SessionCornerAnalysis,
  StoredCornerDefinitions
} from "./types.ts";
import type {
  GpsPoint,
  SavedTrackMap,
  TrackTypeValue
} from "./onlylapsTrackScanUtils.ts";

export const CORNER_DETECTION_VERSION = "onlylaps_corner_detection_v1";
export const CORNER_ANALYSIS_VERSION = "onlylaps_corner_analysis_v2";

export const CORNER_ANALYSIS_THRESHOLDS = {
  referencePointCount: 240,
  curvatureWindowPoints: 3,
  minimumRoadCornerLengthMeters: 12,
  minimumRoadCornerHeadingChangeDegrees: 12,
  minimumNeutralGapMeters: 18,
  minimumCurvatureRadiansPerMeter: 0.004,
  lineProfilePointCount: 24,
  minimumMeaningfulLineDifferenceMeters: 1.5,
  minimumLinePersistence: 0.5,
  minimumMeaningfulTimeDeltaSeconds: 0.04,
  minimumMeaningfulSpeedDeltaMps: 0.67,
  scrubLateralGFloor: 0.08,
  scrubSpeedDeltaMpsFloor: 0.67,
  maximumGoodGpsAccuracyMeters: 4,
  maximumUsableGpsAccuracyMeters: 10,
  maximumGoodSampleIntervalMs: 600,
  maximumUsableSampleIntervalMs: 1200
} as const;

type PathPoint = {
  lat: number;
  lng: number;
  timestamp?: string;
  speed: number | null;
  accuracy: number | null;
  lateralG: number | null;
  longitudinalG: number | null;
};

type NormalizedPoint = PathPoint & {
  x: number;
  y: number;
  progress: number;
  cumulativeMeters: number;
  elapsedSeconds: number;
};

type ReferencePoint = NormalizedPoint & {
  curvature: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finite(values: Array<number | null | undefined>) {
  return values.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value)
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  if (mean === null || values.length < 2) return 0;
  return Math.sqrt(
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  );
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const latMeters = (b.lat - a.lat) * 111_320;
  const lngMeters =
    (b.lng - a.lng) * 111_320 * Math.cos(toRadians((a.lat + b.lat) / 2));
  return Math.hypot(latMeters, lngMeters);
}

function localDelta(
  origin: { lat: number; lng: number },
  point: { lat: number; lng: number }
) {
  return {
    x:
      (point.lng - origin.lng) *
      111_320 *
      Math.cos(toRadians((origin.lat + point.lat) / 2)),
    y: (point.lat - origin.lat) * 111_320
  };
}

function pathLength(points: Array<{ lat: number; lng: number }>) {
  return points.reduce(
    (total, point, index) =>
      index === 0 ? total : total + metersBetween(points[index - 1], point),
    0
  );
}

function interpolateNullable(a: number | null, b: number | null, fraction: number) {
  return a !== null && b !== null ? a + (b - a) * fraction : a ?? b;
}

function interpolatePathPoint(a: PathPoint, b: PathPoint, fraction: number): PathPoint {
  const aTime = a.timestamp ? Date.parse(a.timestamp) : Number.NaN;
  const bTime = b.timestamp ? Date.parse(b.timestamp) : Number.NaN;
  return {
    lat: a.lat + (b.lat - a.lat) * fraction,
    lng: a.lng + (b.lng - a.lng) * fraction,
    timestamp:
      Number.isFinite(aTime) && Number.isFinite(bTime)
        ? new Date(aTime + (bTime - aTime) * fraction).toISOString()
        : a.timestamp ?? b.timestamp,
    speed: interpolateNullable(a.speed, b.speed, fraction),
    accuracy: interpolateNullable(a.accuracy, b.accuracy, fraction),
    lateralG: interpolateNullable(a.lateralG, b.lateralG, fraction),
    longitudinalG: interpolateNullable(a.longitudinalG, b.longitudinalG, fraction)
  };
}

function removeClosingDuplicate(points: PathPoint[]) {
  if (points.length < 3) return points;
  return metersBetween(points[0], points[points.length - 1]) < 2
    ? points.slice(0, -1)
    : points;
}

function closestPointIndex(
  points: PathPoint[],
  target: { lat: number; lng: number } | null
) {
  if (!target || !points.length) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = metersBetween(point, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function rotatePath(points: PathPoint[], index: number) {
  return [...points.slice(index), ...points.slice(0, index)];
}

function signedArea(points: PathPoint[]) {
  if (points.length < 3) return 0;
  const origin = points[0];
  const local = points.map((point) => localDelta(origin, point));
  return local.reduce((total, point, index) => {
    const next = local[(index + 1) % local.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);
}

function getStartFinishCenter(track: SavedTrackMap | null | undefined) {
  const line = track?.start_finish_path ?? [];
  if (!line.length) return null;
  return {
    lat: line.reduce((total, point) => total + point.lat, 0) / line.length,
    lng: line.reduce((total, point) => total + point.lng, 0) / line.length
  };
}

function orientPath(
  original: PathPoint[],
  track: SavedTrackMap | null | undefined
) {
  const withoutDuplicate = removeClosingDuplicate(original);
  const startFinish = getStartFinishCenter(track);
  let points = rotatePath(withoutDuplicate, closestPointIndex(withoutDuplicate, startFinish));
  const area = signedArea(points);
  const direction = track?.direction;
  const shouldReverse =
    (direction === "clockwise" && area > 0) ||
    (direction === "counterclockwise" && area < 0);
  if (shouldReverse) {
    points = [...points].reverse();
    points = rotatePath(points, closestPointIndex(points, startFinish));
  }
  return points;
}

function normalizePath(points: PathPoint[]) {
  if (points.length < 2) return [] as NormalizedPoint[];
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + metersBetween(points[index - 1], points[index]));
  }
  const closingDistance = metersBetween(points[points.length - 1], points[0]);
  const total = cumulative[cumulative.length - 1] + closingDistance;
  const firstTimestamp = points[0].timestamp ? Date.parse(points[0].timestamp) : Number.NaN;
  const origin = points[0];
  return points.map((point, index) => {
    const local = localDelta(origin, point);
    const timestamp = point.timestamp ? Date.parse(point.timestamp) : Number.NaN;
    return {
      ...point,
      x: local.x,
      y: local.y,
      progress: total > 0 ? cumulative[index] / total : index / Math.max(1, points.length - 1),
      cumulativeMeters: cumulative[index],
      elapsedSeconds:
        Number.isFinite(firstTimestamp) && Number.isFinite(timestamp)
          ? Math.max(0, (timestamp - firstTimestamp) / 1000)
          : 0
    };
  });
}

function pointAtProgress(points: NormalizedPoint[], requestedProgress: number) {
  if (!points.length) return null;
  const progress = clamp(requestedProgress, 0, 1);
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].progress < progress) continue;
    const previous = points[index - 1];
    const current = points[index];
    const span = current.progress - previous.progress;
    const fraction = span > 0 ? (progress - previous.progress) / span : 0;
    const interpolated = interpolatePathPoint(previous, current, fraction);
    return {
      ...interpolated,
      x: previous.x + (current.x - previous.x) * fraction,
      y: previous.y + (current.y - previous.y) * fraction,
      progress,
      cumulativeMeters:
        previous.cumulativeMeters +
        (current.cumulativeMeters - previous.cumulativeMeters) * fraction,
      elapsedSeconds:
        previous.elapsedSeconds +
        (current.elapsedSeconds - previous.elapsedSeconds) * fraction
    } satisfies NormalizedPoint;
  }
  return { ...points[points.length - 1], progress };
}

function resampleClosedPath(points: PathPoint[], count: number) {
  const normalized = normalizePath(points);
  if (normalized.length < 2) return [] as NormalizedPoint[];
  return Array.from({ length: count }, (_, index) => {
    const progress = index / count;
    return pointAtProgress(normalized, progress) ?? normalized[normalized.length - 1];
  });
}

function signedTurnAngle(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint) {
  const incoming = { x: b.x - a.x, y: b.y - a.y };
  const outgoing = { x: c.x - b.x, y: c.y - b.y };
  return Math.atan2(
    incoming.x * outgoing.y - incoming.y * outgoing.x,
    incoming.x * outgoing.x + incoming.y * outgoing.y
  );
}

function buildReference(points: NormalizedPoint[]) {
  const window = CORNER_ANALYSIS_THRESHOLDS.curvatureWindowPoints;
  const rawCurvature = points.map((point, index) => {
    const previous = points[(index - window + points.length) % points.length];
    const next = points[(index + window) % points.length];
    const angle = signedTurnAngle(previous, point, next);
    const distance =
      metersBetween(previous, point) + metersBetween(point, next);
    return distance > 0 ? angle / distance : 0;
  });
  return points.map((point, index) => {
    const neighborhood = [-2, -1, 0, 1, 2].map(
      (offset) => rawCurvature[(index + offset + points.length) % points.length]
    );
    return {
      ...point,
      curvature: average(neighborhood) ?? 0
    };
  });
}

function confidenceFromNumber(value: number): CornerAnalysisConfidence {
  return value >= 0.78 ? "high" : value >= 0.5 ? "medium" : "low";
}

function detectOvalCorners(reference: ReferencePoint[]) {
  const count = reference.length;
  const magnitudes = reference.map((point) => Math.abs(point.curvature));
  const baseThreshold = Math.max(
    CORNER_ANALYSIS_THRESHOLDS.minimumCurvatureRadiansPerMeter,
    percentile(magnitudes, 0.6) * 0.55
  );
  const findPeak = (startRatio: number, endRatio: number) => {
    const start = Math.floor(count * startRatio);
    const end = Math.min(count - 1, Math.ceil(count * endRatio));
    let bestIndex = start;
    for (let index = start + 1; index <= end; index += 1) {
      if (magnitudes[index] > magnitudes[bestIndex]) bestIndex = index;
    }
    return bestIndex;
  };
  const findRegion = (
    peakIndex: number,
    minimumIndex: number,
    maximumIndex: number
  ) => {
    const threshold = Math.max(baseThreshold, magnitudes[peakIndex] * 0.24);
    let start = peakIndex;
    let end = peakIndex;
    while (start > minimumIndex && magnitudes[start - 1] >= threshold) start -= 1;
    while (end < maximumIndex && magnitudes[end + 1] >= threshold) end += 1;
    const minimumWidth = Math.max(10, Math.floor(count * 0.12));
    if (end - start < minimumWidth) {
      const missing = minimumWidth - (end - start);
      start = Math.max(minimumIndex, start - Math.ceil(missing / 2));
      end = Math.min(maximumIndex, end + Math.floor(missing / 2));
    }
    return { start, end, peak: peakIndex };
  };
  const first = findRegion(findPeak(0.08, 0.48), Math.floor(count * 0.04), Math.floor(count * 0.49));
  const second = findRegion(findPeak(0.52, 0.92), Math.floor(count * 0.51), Math.floor(count * 0.96));
  const totalLength = pathLength(reference);

  return [first, second].flatMap((region, endIndex) => {
    const midpoint = Math.round((region.start + region.end) / 2);
    const sign =
      average(reference.slice(region.start, region.end + 1).map((point) => point.curvature)) ?? 0;
    const peakStrength = magnitudes[region.peak];
    const confidence = clamp(0.58 + Math.min(0.34, peakStrength / Math.max(baseThreshold, 0.0001) * 0.1), 0, 0.94);
    return [
      { start: region.start, end: midpoint, number: endIndex * 2 + 1, sign, confidence },
      { start: midpoint, end: region.end, number: endIndex * 2 + 2, sign, confidence }
    ].map(({ start, end, number, sign: directionSign, confidence: score }) => {
      const apexIndex = Math.round((start + end) / 2);
      return {
        cornerNumber: number,
        startProgress: round(start / count, 6),
        apexProgress: round(apexIndex / count, 6),
        endProgress: round(end / count, 6),
        primaryDirection: (directionSign >= 0 ? "left" : "right") as "left" | "right",
        physicalLengthMeters: round(((end - start) / count) * totalLength, 1),
        confidence: round(score, 3),
        detectionMethod: "oval_split" as const,
        detectionVersion: CORNER_DETECTION_VERSION,
        apex: {
          lat: reference[apexIndex].lat,
          lng: reference[apexIndex].lng
        }
      };
    });
  });
}

function detectRoadCorners(reference: ReferencePoint[]) {
  const count = reference.length;
  const totalLength = pathLength(reference);
  const stepMeters = totalLength / Math.max(1, count);
  const magnitudes = reference.map((point) => Math.abs(point.curvature));
  const threshold = Math.max(
    CORNER_ANALYSIS_THRESHOLDS.minimumCurvatureRadiansPerMeter,
    percentile(magnitudes, 0.62) * 0.6
  );
  const active = reference.map((point, index) => {
    if (index < 3 || index > count - 4) return false;
    const localHeadingChange = Math.abs(
      reference
        .slice(Math.max(0, index - 3), Math.min(count, index + 4))
        .reduce((sum, item) => sum + item.curvature * stepMeters, 0)
    );
    return Math.abs(point.curvature) >= threshold && localHeadingChange >= toRadians(5);
  });
  const runs: Array<{ start: number; end: number; sign: number }> = [];
  for (let index = 0; index < count; index += 1) {
    if (!active[index]) continue;
    const start = index;
    while (index + 1 < count && active[index + 1]) index += 1;
    const end = index;
    const sign =
      average(reference.slice(start, end + 1).map((point) => point.curvature)) ?? 0;
    runs.push({ start, end, sign });
  }
  const maximumGapPoints = Math.max(
    1,
    Math.round(CORNER_ANALYSIS_THRESHOLDS.minimumNeutralGapMeters / Math.max(stepMeters, 1))
  );
  const merged: typeof runs = [];
  runs.forEach((run) => {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      Math.sign(previous.sign) === Math.sign(run.sign) &&
      run.start - previous.end - 1 <= maximumGapPoints
    ) {
      previous.end = run.end;
      previous.sign =
        average(reference.slice(previous.start, previous.end + 1).map((point) => point.curvature)) ??
        previous.sign;
    } else {
      merged.push({ ...run });
    }
  });
  const candidates = merged
    .map((run) => {
      const physicalLength = (run.end - run.start + 1) * stepMeters;
      const headingChange = reference
        .slice(run.start, run.end + 1)
        .reduce((sum, point) => sum + Math.abs(point.curvature) * stepMeters, 0);
      return { ...run, physicalLength, headingChange };
    })
    .filter(
      (run) =>
        run.physicalLength >= CORNER_ANALYSIS_THRESHOLDS.minimumRoadCornerLengthMeters &&
        run.headingChange >=
          toRadians(CORNER_ANALYSIS_THRESHOLDS.minimumRoadCornerHeadingChangeDegrees)
    )
    .slice(0, 24);

  return candidates.map((run, index): CornerDefinition => {
    let apexIndex = run.start;
    for (let pointIndex = run.start + 1; pointIndex <= run.end; pointIndex += 1) {
      if (magnitudes[pointIndex] > magnitudes[apexIndex]) apexIndex = pointIndex;
    }
    const strength = magnitudes[apexIndex] / Math.max(threshold, 0.0001);
    const confidence = clamp(
      0.46 + Math.min(0.26, (run.headingChange / Math.PI) * 0.5) + Math.min(0.22, strength * 0.08),
      0,
      0.96
    );
    return {
      cornerNumber: index + 1,
      startProgress: round(run.start / count, 6),
      apexProgress: round(apexIndex / count, 6),
      endProgress: round(run.end / count, 6),
      primaryDirection: run.sign >= 0 ? "left" : "right",
      physicalLengthMeters: round(run.physicalLength, 1),
      confidence: round(confidence, 3),
      detectionMethod: "curvature_cluster",
      detectionVersion: CORNER_DETECTION_VERSION,
      apex: {
        lat: reference[apexIndex].lat,
        lng: reference[apexIndex].lng
      }
    };
  });
}

function tracePointToPathPoint(point: {
  lat: number;
  lng: number;
  timestamp?: string;
  speed?: number | null;
  accuracy?: number | null;
  lateralG?: number | null;
  longitudinalG?: number | null;
}): PathPoint {
  return {
    lat: point.lat,
    lng: point.lng,
    timestamp: point.timestamp,
    speed: point.speed ?? null,
    accuracy: point.accuracy ?? null,
    lateralG: point.lateralG ?? null,
    longitudinalG: point.longitudinalG ?? null
  };
}

function telemetryPoint(sample: LapTelemetrySample): PathPoint {
  return {
    lat: sample.latitude,
    lng: sample.longitude,
    timestamp: sample.timestamp,
    speed: sample.speed,
    accuracy: sample.gpsAccuracy,
    lateralG: sample.lateralG,
    longitudinalG: sample.longitudinalG
  };
}

function getLapPath(session: SavedLapSession, lap: SavedLapRecord) {
  if ((lap.smoothedTrace?.length ?? 0) >= 8) {
    return lap.smoothedTrace!.map(tracePointToPathPoint);
  }
  if ((lap.rawTrace?.length ?? 0) >= 8) {
    return lap.rawTrace!.map(tracePointToPathPoint);
  }
  return (session.telemetrySamples ?? [])
    .filter((sample) => sample.lapNumber === lap.lapNumber)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map(telemetryPoint);
}

function representativePath(session: SavedLapSession) {
  const trackRepresentative = session.trackMap?.representative_path_smoothed ?? [];
  if (trackRepresentative.length >= 20) {
    return {
      source: "track_representative" as const,
      points: trackRepresentative.map((point) => ({
        ...tracePointToPathPoint(point),
        speed: null,
        lateralG: null,
        longitudinalG: null
      }))
    };
  }
  const fastest =
    [...(session.laps ?? [])]
      .filter((lap) => lap.isValid)
      .sort((a, b) => a.lapTimeMs - b.lapTimeMs)[0] ??
    session.laps?.[0] ??
    null;
  return {
    source: "session_representative" as const,
    points: fastest ? getLapPath(session, fastest) : []
  };
}

function inferTravelDirection(
  reference: ReferencePoint[],
  saved: SavedTrackMap["direction"]
) {
  if (saved === "clockwise" || saved === "counterclockwise") return saved;
  return signedArea(reference) >= 0 ? "counterclockwise" : "clockwise";
}

export function detectTrackCorners({
  path,
  startFinishPath = [],
  trackType,
  travelDirection = "unknown",
  source = "session_representative"
}: {
  path: Array<Partial<GpsPoint> & Pick<GpsPoint, "lat" | "lng">>;
  startFinishPath?: GpsPoint[];
  trackType: TrackTypeValue | null;
  travelDirection?: SavedTrackMap["direction"];
  source?: StoredCornerDefinitions["source"];
}) {
  const syntheticTrack = {
    start_finish_path: startFinishPath,
    direction: travelDirection
  } as SavedTrackMap;
  const oriented = orientPath(
    path.map((point) =>
      tracePointToPathPoint({
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp,
        speed: point.speed,
        accuracy: point.accuracy
      })
    ),
    syntheticTrack
  );
  const reference = buildReference(
    resampleClosedPath(oriented, CORNER_ANALYSIS_THRESHOLDS.referencePointCount)
  );
  if (reference.length < 20) return null;
  const oval = trackType === "dirt_oval" || trackType === "pavement_oval";
  const corners = oval ? detectOvalCorners(reference) : detectRoadCorners(reference);
  if (!corners.length) return null;
  const definitions: StoredCornerDefinitions = {
    version: CORNER_DETECTION_VERSION,
    generatedAt: new Date().toISOString(),
    trackType,
    travelDirection: inferTravelDirection(reference, travelDirection),
    source,
    corners
  };
  return { definitions, reference };
}

function qualityFromPoints(points: NormalizedPoint[], hasOrientation: boolean): CornerDataQuality {
  const accuracies = finite(points.map((point) => point.accuracy));
  const averageAccuracy = average(accuracies);
  const intervals = points.slice(1).map((point, index) =>
    Math.max(0, (point.elapsedSeconds - points[index].elapsedSeconds) * 1000)
  ).filter((value) => value > 0);
  const averageInterval = average(intervals);
  const maximumGap = intervals.length ? Math.max(...intervals) : null;
  const gCoverage =
    points.length > 0
      ? points.filter((point) => point.lateralG !== null).length / points.length
      : 0;
  const warnings: string[] = [];
  if (
    averageAccuracy !== null &&
    averageAccuracy > CORNER_ANALYSIS_THRESHOLDS.maximumGoodGpsAccuracyMeters
  ) {
    warnings.push(
      `Line comparison confidence is limited because average GPS accuracy was ${averageAccuracy.toFixed(1)} meters.`
    );
  }
  if (
    averageInterval !== null &&
    averageInterval > CORNER_ANALYSIS_THRESHOLDS.maximumGoodSampleIntervalMs
  ) {
    warnings.push("Telemetry sampling was too slow for precise turn-in and apex timing.");
  }
  if (gCoverage < 0.5) {
    warnings.push("G-force coverage is limited; speed and line comparisons remain available.");
  }
  if (!hasOrientation) {
    warnings.push("Phone orientation calibration was not saved for this session.");
  }
  const rating: CornerAnalysisConfidence =
    (averageAccuracy === null ||
      averageAccuracy <= CORNER_ANALYSIS_THRESHOLDS.maximumGoodGpsAccuracyMeters) &&
    (averageInterval === null ||
      averageInterval <= CORNER_ANALYSIS_THRESHOLDS.maximumGoodSampleIntervalMs)
      ? "high"
      : (averageAccuracy === null ||
          averageAccuracy <= CORNER_ANALYSIS_THRESHOLDS.maximumUsableGpsAccuracyMeters) &&
          (averageInterval === null ||
            averageInterval <= CORNER_ANALYSIS_THRESHOLDS.maximumUsableSampleIntervalMs)
        ? "medium"
        : "low";
  return {
    rating,
    averageAccuracyMeters: averageAccuracy === null ? null : round(averageAccuracy, 2),
    averageSampleIntervalMs: averageInterval === null ? null : round(averageInterval, 1),
    maximumSampleGapMs: maximumGap === null ? null : round(maximumGap, 1),
    gForceCoverage: round(gCoverage, 3),
    warnings
  };
}

function minimumConfidence(
  ...values: CornerAnalysisConfidence[]
): CornerAnalysisConfidence {
  const score = { low: 0, medium: 1, high: 2 };
  return [...values].sort((a, b) => score[a] - score[b])[0] ?? "low";
}

function referenceAtProgress(reference: ReferencePoint[], progress: number) {
  const scaled = clamp(progress, 0, 0.999999) * reference.length;
  const index = Math.floor(scaled);
  const nextIndex = (index + 1) % reference.length;
  const fraction = scaled - index;
  const current = reference[index];
  const next = reference[nextIndex];
  return {
    point: {
      lat: current.lat + (next.lat - current.lat) * fraction,
      lng: current.lng + (next.lng - current.lng) * fraction
    },
    tangent: {
      x: next.x - current.x,
      y: next.y - current.y
    }
  };
}

function signedLateralOffset(
  reference: ReferencePoint[],
  progress: number,
  sample: { lat: number; lng: number }
) {
  const matched = referenceAtProgress(reference, progress);
  const delta = localDelta(matched.point, sample);
  const length = Math.hypot(matched.tangent.x, matched.tangent.y);
  if (length <= 0) return 0;
  const tangent = {
    x: matched.tangent.x / length,
    y: matched.tangent.y / length
  };
  return delta.x * -tangent.y + delta.y * tangent.x;
}

function analyzeLapCorner(
  lap: SavedLapRecord,
  points: NormalizedPoint[],
  definition: CornerDefinition,
  reference: ReferencePoint[],
  sessionQuality: CornerDataQuality
): CornerLapMetrics | null {
  const start = pointAtProgress(points, definition.startProgress);
  const apex = pointAtProgress(points, definition.apexProgress);
  const end = pointAtProgress(points, definition.endProgress);
  if (!start || !apex || !end) return null;
  const cornerPoints = [
    start,
    ...points.filter(
      (point) =>
        point.progress > definition.startProgress &&
        point.progress < definition.endProgress
    ),
    end
  ];
  if (cornerPoints.length < 3) return null;
  const speeds = finite(cornerPoints.map((point) => point.speed));
  const lateralGs = finite(cornerPoints.map((point) =>
    point.lateralG === null ? null : Math.abs(point.lateralG)
  ));
  const preEntryStart = Math.max(0, definition.startProgress - 0.04);
  const preEntryBraking = finite(
    points
      .filter(
        (point) =>
          point.progress >= preEntryStart && point.progress <= definition.startProgress
      )
      .map((point) =>
        point.longitudinalG !== null && point.longitudinalG > 0
          ? point.longitudinalG
          : null
      )
  );
  const lateralThreshold = Math.max(0.12, (Math.max(0, ...lateralGs) || 0) * 0.35);
  const turnIn =
    cornerPoints.find(
      (point) => point.lateralG !== null && Math.abs(point.lateralG) >= lateralThreshold
    )?.progress ?? null;
  let accelerationPickup: number | null = null;
  for (let index = 1; index < cornerPoints.length; index += 1) {
    const point = cornerPoints[index];
    if (point.progress < definition.apexProgress) continue;
    const speedRecovery =
      point.speed !== null &&
      cornerPoints[index - 1].speed !== null &&
      point.speed > cornerPoints[index - 1].speed!;
    if ((point.longitudinalG !== null && point.longitudinalG < -0.05) || speedRecovery) {
      accelerationPickup = point.progress;
      break;
    }
  }
  const lineOffsets = Array.from(
    { length: CORNER_ANALYSIS_THRESHOLDS.lineProfilePointCount },
    (_, index) => {
      const fraction = index / (CORNER_ANALYSIS_THRESHOLDS.lineProfilePointCount - 1);
      const progress =
        definition.startProgress +
        (definition.endProgress - definition.startProgress) * fraction;
      const sample = pointAtProgress(points, progress);
      return sample ? signedLateralOffset(reference, progress, sample) : 0;
    }
  );
  const averageOffset = average(lineOffsets);
  const insideSign = definition.primaryDirection === "left" ? 1 : -1;
  const intervals = cornerPoints.slice(1).map((point, index) =>
    Math.max(0, (point.elapsedSeconds - cornerPoints[index].elapsedSeconds) * 1000)
  );
  const accuracy = average(finite(cornerPoints.map((point) => point.accuracy)));
  const gCoverage =
    cornerPoints.filter((point) => point.lateralG !== null).length / cornerPoints.length;
  const localConfidence: CornerAnalysisConfidence =
    cornerPoints.length >= 10 &&
    (accuracy === null ||
      accuracy <= CORNER_ANALYSIS_THRESHOLDS.maximumGoodGpsAccuracyMeters)
      ? "high"
      : cornerPoints.length >= 5 &&
          (accuracy === null ||
            accuracy <= CORNER_ANALYSIS_THRESHOLDS.maximumUsableGpsAccuracyMeters)
        ? "medium"
        : "low";
  return {
    lapId: lap.id,
    lapNumber: lap.lapNumber,
    cornerNumber: definition.cornerNumber,
    entrySpeedMps: start.speed,
    minimumSpeedMps: speeds.length ? Math.min(...speeds) : null,
    exitSpeedMps: end.speed,
    averageSpeedMps: average(speeds),
    maximumLateralG: lateralGs.length ? Math.max(...lateralGs) : null,
    averageLateralG: average(lateralGs),
    lateralGVariation: lateralGs.length ? standardDeviation(lateralGs) : null,
    preEntryBrakingG: preEntryBraking.length ? Math.max(...preEntryBraking) : null,
    turnInProgress: turnIn,
    apexProgress: definition.apexProgress,
    accelerationPickupProgress: accelerationPickup,
    entryElapsedSeconds: round(start.elapsedSeconds, 4),
    apexElapsedSeconds: round(apex.elapsedSeconds, 4),
    exitElapsedSeconds: round(end.elapsedSeconds, 4),
    cornerTimeSeconds: round(end.elapsedSeconds - start.elapsedSeconds, 4),
    distanceMeters: round(
      cornerPoints.reduce(
        (total, point, index) =>
          index === 0 ? total : total + metersBetween(cornerPoints[index - 1], point),
        0
      ),
      2
    ),
    averageSignedLateralOffsetMeters:
      averageOffset === null ? null : round(averageOffset, 3),
    averageInsideOffsetMeters:
      averageOffset === null ? null : round(averageOffset * insideSign, 3),
    lineOffsetsMeters: lineOffsets.map((value) => round(value, 3)),
    gpsAccuracyMeters: accuracy === null ? null : round(accuracy, 2),
    maximumSampleGapMs: intervals.length ? round(Math.max(...intervals), 1) : null,
    sampleCount: cornerPoints.length,
    lateralGSampleCoverage: round(gCoverage, 3),
    confidence: minimumConfidence(
      localConfidence,
      sessionQuality.rating,
      confidenceFromNumber(definition.confidence)
    )
  };
}

export function buildSessionCornerAnalysis(
  session: SavedLapSession,
  options: { forceDetection?: boolean } = {}
): SessionCornerAnalysis | null {

  const representative = representativePath(session);
  if (representative.points.length < 20) return null;
  const savedDefinitions =
    session.cornerDefinitions ??
    (session.trackMap?.corner_definitions as unknown as StoredCornerDefinitions | null | undefined);
  const savedReference = buildReference(
    resampleClosedPath(
      orientPath(representative.points, session.trackMap),
      CORNER_ANALYSIS_THRESHOLDS.referencePointCount
    )
  );
  const detected =
    !options.forceDetection &&
    savedDefinitions?.version === CORNER_DETECTION_VERSION &&
    savedDefinitions.corners.length > 0 &&
    savedReference.length >= 20
      ? { definitions: savedDefinitions, reference: savedReference }
      : detectTrackCorners({
          path: representative.points,
          startFinishPath: session.trackMap?.start_finish_path ?? [],
          trackType: session.trackMap?.track_type ?? null,
          travelDirection: session.trackMap?.direction ?? "unknown",
          source: representative.source
        });
  if (!detected) return null;
  const laps = (session.laps ?? []).filter((lap) => getLapPath(session, lap).length >= 8);
  const normalizedLaps = laps.map((lap) => ({
    lap,
    // Completed lap traces are already ordered from the official start/finish crossing.
    // Rotating them again could wrap timestamps and corrupt matched-position time deltas.
    points: normalizePath(removeClosingDuplicate(getLapPath(session, lap)))
  }));
  const allPoints = normalizedLaps.flatMap((entry) => entry.points);
  const dataQuality = qualityFromPoints(allPoints, Boolean(session.phoneMountOrientation));
  return {
    version: CORNER_ANALYSIS_VERSION,
    detectionVersion: CORNER_DETECTION_VERSION,
    generatedAt: new Date().toISOString(),
    definitions: detected.definitions,
    dataQuality,
    laps: normalizedLaps.map(({ lap, points }) => ({
      lapId: lap.id,
      lapNumber: lap.lapNumber,
      isValid: lap.isValid,
      corners: detected.definitions.corners
        .map((definition) =>
          analyzeLapCorner(lap, points, definition, detected.reference, dataQuality)
        )
        .filter((metrics): metrics is CornerLapMetrics => metrics !== null)
    }))
  };
}

function difference(a: number | null, b: number | null) {
  return a === null || b === null ? null : a - b;
}

function metricVariation(
  analysis: SessionCornerAnalysis,
  cornerNumber: number,
  select: (metrics: CornerLapMetrics) => number | null
) {
  return standardDeviation(
    finite(
      analysis.laps
        .filter((lap) => lap.isValid)
        .flatMap((lap) => lap.corners)
        .filter((corner) => corner.cornerNumber === cornerNumber)
        .map(select)
    )
  );
}

function compareLine(
  analysis: SessionCornerAnalysis,
  comparison: CornerLapMetrics,
  reference: CornerLapMetrics,
  definition: CornerDefinition
) {
  const insideSign = definition.primaryDirection === "left" ? 1 : -1;
  const differences = comparison.lineOffsetsMeters
    .slice(0, Math.min(comparison.lineOffsetsMeters.length, reference.lineOffsetsMeters.length))
    .map((value, index) => (value - reference.lineOffsetsMeters[index]) * insideSign);
  const medianDifference = median(differences);
  const gpsUncertainty =
    ((comparison.gpsAccuracyMeters ?? 8) + (reference.gpsAccuracyMeters ?? 8)) * 0.65;
  const sessionSpread = metricVariation(
    analysis,
    definition.cornerNumber,
    (metrics) => metrics.averageInsideOffsetMeters
  );
  const threshold = Math.max(
    CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulLineDifferenceMeters,
    gpsUncertainty,
    sessionSpread * 1.1
  );
  const sign = Math.sign(medianDifference ?? 0);
  const persistence =
    differences.length && sign
      ? differences.filter(
          (value) => Math.sign(value) === sign && Math.abs(value) >= threshold * 0.5
        ).length / differences.length
      : 0;
  const timeEffect =
    Math.abs(comparison.cornerTimeSeconds - reference.cornerTimeSeconds) >=
    CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulTimeDeltaSeconds;
  const speedEffect =
    Math.abs((comparison.exitSpeedMps ?? 0) - (reference.exitSpeedMps ?? 0)) >=
      CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulSpeedDeltaMps ||
    Math.abs((comparison.minimumSpeedMps ?? 0) - (reference.minimumSpeedMps ?? 0)) >=
      CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulSpeedDeltaMps;
  const distanceEffect = Math.abs(comparison.distanceMeters - reference.distanceMeters) >= 2;
  const meaningful =
    medianDifference !== null &&
    Math.abs(medianDifference) >= threshold &&
    persistence >= CORNER_ANALYSIS_THRESHOLDS.minimumLinePersistence &&
    (timeEffect || speedEffect || distanceEffect);
  const oval =
    analysis.definitions.trackType === "dirt_oval" ||
    analysis.definitions.trackType === "pavement_oval";
  const classification = !meaningful
    ? "not_meaningful"
    : oval
      ? medianDifference! > 0
        ? "meaningfully_lower"
        : "meaningfully_higher"
      : medianDifference! > 0
        ? "meaningfully_tighter"
        : "meaningfully_wider";
  const confidence: CornerAnalysisConfidence =
    !meaningful
      ? minimumConfidence(comparison.confidence, reference.confidence)
      : persistence >= 0.72 &&
          gpsUncertainty <= CORNER_ANALYSIS_THRESHOLDS.maximumGoodGpsAccuracyMeters
        ? "high"
        : persistence >= 0.55
          ? "medium"
          : "low";
  const readable = classification.replace("meaningfully_", "").replace("_", " ");
  return {
    classification,
    confidence,
    medianDifferenceMeters:
      medianDifference === null || !meaningful ? null : round(medianDifference, 2),
    persistence: round(persistence, 3),
    estimatedDistanceDeltaMeters: round(
      comparison.distanceMeters - reference.distanceMeters,
      2
    ),
    explanation:
      classification === "not_meaningful"
        ? "No meaningful line difference remains after accounting for GPS uncertainty and normal lap-to-lap spread."
        : `This lap stayed ${readable} through ${Math.round(persistence * 100)}% of the corner, beyond the GPS-confidence threshold.`
  } as const;
}

function detectPossibleScrub(
  analysis: SessionCornerAnalysis,
  comparison: CornerLapMetrics,
  reference: CornerLapMetrics,
  cornerTimeDeltaSeconds: number
) {
  if (
    comparison.lateralGSampleCoverage < 0.45 ||
    reference.lateralGSampleCoverage < 0.45
  ) {
    return {
      detected: false,
      confidence: "low" as const,
      reasons: [],
      explanation:
        "G-force coverage is insufficient to assess possible speed scrub; speed and line results are still shown."
    };
  }
  const gThreshold = Math.max(
    CORNER_ANALYSIS_THRESHOLDS.scrubLateralGFloor,
    metricVariation(
      analysis,
      comparison.cornerNumber,
      (metrics) => metrics.averageLateralG
    ) * 0.75
  );
  const speedThreshold = Math.max(
    CORNER_ANALYSIS_THRESHOLDS.scrubSpeedDeltaMpsFloor,
    metricVariation(
      analysis,
      comparison.cornerNumber,
      (metrics) => metrics.exitSpeedMps
    ) * 0.75
  );
  const reasons: string[] = [];
  if (
    difference(comparison.averageLateralG, reference.averageLateralG) !== null &&
    difference(comparison.averageLateralG, reference.averageLateralG)! > gThreshold
  ) {
    reasons.push("higher sustained lateral G");
  }
  if (
    difference(comparison.minimumSpeedMps, reference.minimumSpeedMps) !== null &&
    difference(comparison.minimumSpeedMps, reference.minimumSpeedMps)! < -speedThreshold
  ) {
    reasons.push("lower minimum speed");
  }
  if (
    difference(comparison.exitSpeedMps, reference.exitSpeedMps) !== null &&
    difference(comparison.exitSpeedMps, reference.exitSpeedMps)! < -speedThreshold
  ) {
    reasons.push("lower exit speed");
  }
  if (
    comparison.lateralGVariation !== null &&
    reference.lateralGVariation !== null &&
    comparison.lateralGVariation - reference.lateralGVariation >
      Math.max(0.05, metricVariation(
        analysis,
        comparison.cornerNumber,
        (metrics) => metrics.lateralGVariation
      ))
  ) {
    reasons.push("more variable lateral G");
  }
  if (
    comparison.distanceMeters - reference.distanceMeters >
    Math.max(
      2,
      metricVariation(analysis, comparison.cornerNumber, (metrics) => metrics.distanceMeters)
    )
  ) {
    reasons.push("a longer path without a matching time advantage");
  }
  const detected =
    reasons.length >= 2 &&
    reasons.some((reason) => reason.includes("lateral G")) &&
    cornerTimeDeltaSeconds > -CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulTimeDeltaSeconds;
  const confidence: CornerAnalysisConfidence = detected
    ? reasons.length >= 3 &&
      minimumConfidence(comparison.confidence, reference.confidence) === "high"
      ? "high"
      : "medium"
    : minimumConfidence(comparison.confidence, reference.confidence);
  return {
    detected,
    confidence,
    reasons: detected ? reasons : [],
    explanation: detected
      ? `Higher load without a corresponding speed or time advantage suggests possible speed scrub (${reasons.join(", ")}). Phone telemetry cannot confirm whether this came from driver input, tire slip, or vehicle balance.`
      : "The differences are not large or consistent enough to flag possible speed scrub."
  };
}

function formatDeltaSeconds(value: number) {
  if (Math.abs(value) < 0.005) return "<0.01s difference";
  return `${Math.abs(value).toFixed(2)}s ${value <= 0 ? "faster" : "slower"}`;
}

function buildSummary(
  comparison: CornerLapMetrics,
  reference: CornerLapMetrics,
  lineClassification: string,
  timeDelta: number
) {
  const exitDelta = difference(comparison.exitSpeedMps, reference.exitSpeedMps);
  const lineText =
    lineClassification === "not_meaningful"
      ? ""
      : ` It used a ${lineClassification.replace("meaningfully_", "")} line.`;
  const speedText =
    exitDelta !== null &&
    Math.abs(exitDelta) >= CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulSpeedDeltaMps
      ? ` Exit speed was ${Math.abs(exitDelta * 2.2369362921).toFixed(1)} mph ${exitDelta > 0 ? "higher" : "lower"}.`
      : "";
  return `Turn ${comparison.cornerNumber}: ${formatDeltaSeconds(timeDelta)}.${lineText}${speedText}`;
}

export function compareSessionLapsByCorner({
  analysis,
  comparisonLap,
  referenceLap
}: {
  analysis: SessionCornerAnalysis;
  comparisonLap: SavedLapRecord;
  referenceLap: SavedLapRecord;
}): LapCornerComparison | null {
  const comparison = analysis.laps.find((lap) => lap.lapId === comparisonLap.id);
  const reference = analysis.laps.find((lap) => lap.lapId === referenceLap.id);
  if (!comparison || !reference) return null;
  const corners = analysis.definitions.corners.flatMap((definition) => {
    const comparisonMetrics = comparison.corners.find(
      (corner) => corner.cornerNumber === definition.cornerNumber
    );
    const referenceMetrics = reference.corners.find(
      (corner) => corner.cornerNumber === definition.cornerNumber
    );
    if (!comparisonMetrics || !referenceMetrics) return [];
    const cornerTimeDelta =
      comparisonMetrics.cornerTimeSeconds - referenceMetrics.cornerTimeSeconds;
    const lineDifference = compareLine(
      analysis,
      comparisonMetrics,
      referenceMetrics,
      definition
    );
    const possibleScrub = detectPossibleScrub(
      analysis,
      comparisonMetrics,
      referenceMetrics,
      cornerTimeDelta
    );
    const confidence = minimumConfidence(
      comparisonMetrics.confidence,
      referenceMetrics.confidence,
      lineDifference.confidence
    );
    const entrySpeedDelta = difference(
      comparisonMetrics.entrySpeedMps,
      referenceMetrics.entrySpeedMps
    );
    const minimumSpeedDelta = difference(
      comparisonMetrics.minimumSpeedMps,
      referenceMetrics.minimumSpeedMps
    );
    const exitSpeedDelta = difference(
      comparisonMetrics.exitSpeedMps,
      referenceMetrics.exitSpeedMps
    );
    const important =
      Math.abs(cornerTimeDelta) >=
        CORNER_ANALYSIS_THRESHOLDS.minimumMeaningfulTimeDeltaSeconds ||
      lineDifference.classification !== "not_meaningful" ||
      possibleScrub.detected;
    return [{
      cornerNumber: definition.cornerNumber,
      definition,
      comparisonLap: comparisonMetrics,
      referenceLap: referenceMetrics,
      cornerTimeDeltaSeconds: round(cornerTimeDelta, 4),
      entryTimeDeltaSeconds: round(
        comparisonMetrics.entryElapsedSeconds - referenceMetrics.entryElapsedSeconds,
        4
      ),
      apexTimeDeltaSeconds: round(
        comparisonMetrics.apexElapsedSeconds - referenceMetrics.apexElapsedSeconds,
        4
      ),
      exitTimeDeltaSeconds: round(
        comparisonMetrics.exitElapsedSeconds - referenceMetrics.exitElapsedSeconds,
        4
      ),
      entrySpeedDeltaMps: entrySpeedDelta === null ? null : round(entrySpeedDelta, 3),
      minimumSpeedDeltaMps:
        minimumSpeedDelta === null ? null : round(minimumSpeedDelta, 3),
      exitSpeedDeltaMps: exitSpeedDelta === null ? null : round(exitSpeedDelta, 3),
      averageSpeedDeltaMps: (() => {
        const value = difference(
          comparisonMetrics.averageSpeedMps,
          referenceMetrics.averageSpeedMps
        );
        return value === null ? null : round(value, 3);
      })(),
      maximumLateralGDelta: (() => {
        const value = difference(
          comparisonMetrics.maximumLateralG,
          referenceMetrics.maximumLateralG
        );
        return value === null ? null : round(value, 3);
      })(),
      averageLateralGDelta: (() => {
        const value = difference(
          comparisonMetrics.averageLateralG,
          referenceMetrics.averageLateralG
        );
        return value === null ? null : round(value, 3);
      })(),
      lineDifference,
      possibleScrub,
      confidence,
      summary: buildSummary(
        comparisonMetrics,
        referenceMetrics,
        lineDifference.classification,
        cornerTimeDelta
      ),
      interpretation: possibleScrub.detected
        ? possibleScrub.explanation
        : lineDifference.explanation,
      important
    }];
  });
  return {
    algorithmVersion: CORNER_ANALYSIS_VERSION,
    detectionVersion: CORNER_DETECTION_VERSION,
    trackType: analysis.definitions.trackType,
    travelDirection: analysis.definitions.travelDirection,
    comparisonLapId: comparisonLap.id,
    comparisonLapNumber: comparisonLap.lapNumber,
    referenceLapId: referenceLap.id,
    referenceLapNumber: referenceLap.lapNumber,
    gpsQuality: analysis.dataQuality,
    corners
  };
}

export function buildCornerComparisonAiInput(comparison: LapCornerComparison) {
  return {
    algorithmVersion: comparison.algorithmVersion,
    trackType: comparison.trackType,
    travelDirection: comparison.travelDirection,
    comparisonLapId: comparison.comparisonLapId,
    comparisonLapNumber: comparison.comparisonLapNumber,
    referenceLapId: comparison.referenceLapId,
    referenceLapNumber: comparison.referenceLapNumber,
    speedUnit: "mph",
    gpsQuality: comparison.gpsQuality,
    corners: comparison.corners.map((corner) => ({
      cornerNumber: corner.cornerNumber,
      entrySpeedDeltaMph:
        corner.entrySpeedDeltaMps === null
          ? null
          : round(corner.entrySpeedDeltaMps * 2.2369362921, 2),
      minimumSpeedDeltaMph:
        corner.minimumSpeedDeltaMps === null
          ? null
          : round(corner.minimumSpeedDeltaMps * 2.2369362921, 2),
      exitSpeedDeltaMph:
        corner.exitSpeedDeltaMps === null
          ? null
          : round(corner.exitSpeedDeltaMps * 2.2369362921, 2),
      maximumLateralGDelta: corner.maximumLateralGDelta,
      averageLateralGDelta: corner.averageLateralGDelta,
      cornerTimeDeltaSeconds: corner.cornerTimeDeltaSeconds,
      entryTimeDeltaSeconds: corner.entryTimeDeltaSeconds,
      apexTimeDeltaSeconds: corner.apexTimeDeltaSeconds,
      exitTimeDeltaSeconds: corner.exitTimeDeltaSeconds,
      lineDifference: corner.lineDifference,
      possibleScrub: corner.possibleScrub,
      confidence: corner.confidence
    }))
  };
}
