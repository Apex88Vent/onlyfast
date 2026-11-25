// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type { GpsPoint } from "./onlylapsTrackScanUtils.ts";

export type ProjectedPoint = {
  x: number;
  y: number;
  timestamp?: string;
};

export type ProjectedTrack = {
  outside: ProjectedPoint[];
  startFinish: ProjectedPoint[];
  inside: ProjectedPoint[];
  lap: ProjectedPoint[];
  rawLap: ProjectedPoint[];
  smoothedLap: ProjectedPoint[];
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateBoundingBox(points: GpsPoint[]) {
  if (points.length === 0) {
    return null;
  }

  return points.reduce(
    (bbox, point) => ({
      minLat: Math.min(bbox.minLat, point.lat),
      minLng: Math.min(bbox.minLng, point.lng),
      maxLat: Math.max(bbox.maxLat, point.lat),
      maxLng: Math.max(bbox.maxLng, point.lng)
    }),
    {
      minLat: points[0].lat,
      minLng: points[0].lng,
      maxLat: points[0].lat,
      maxLng: points[0].lng
    }
  );
}

export function projectTrackForReplay({
  outsidePath,
  startFinishPath,
  insidePath,
  lapPath,
  rawLapPath = [],
  smoothedLapPath = [],
  width = 320,
  height = 220,
  padding = 18
}: {
  outsidePath: GpsPoint[];
  startFinishPath: GpsPoint[];
  insidePath: GpsPoint[];
  lapPath: GpsPoint[];
  rawLapPath?: GpsPoint[];
  smoothedLapPath?: GpsPoint[];
  width?: number;
  height?: number;
  padding?: number;
}): ProjectedTrack {
  const allPoints = [
    ...outsidePath,
    ...startFinishPath,
    ...insidePath,
    ...lapPath,
    ...rawLapPath,
    ...smoothedLapPath
  ];
  const bbox = calculateBoundingBox(allPoints);

  if (!bbox) {
    return {
      outside: [],
      startFinish: [],
      inside: [],
      lap: [],
      rawLap: [],
      smoothedLap: []
    };
  }

  const lngSpan = Math.max(bbox.maxLng - bbox.minLng, 0.000001);
  const latSpan = Math.max(bbox.maxLat - bbox.minLat, 0.000001);
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);

  const project = (point: GpsPoint): ProjectedPoint => ({
    x: round(padding + ((point.lng - bbox.minLng) / lngSpan) * drawableWidth),
    y: round(height - padding - ((point.lat - bbox.minLat) / latSpan) * drawableHeight),
    timestamp: point.timestamp
  });

  return {
    outside: outsidePath.map(project),
    startFinish: startFinishPath.map(project),
    inside: insidePath.map(project),
    lap: lapPath.map(project),
    rawLap: rawLapPath.map(project),
    smoothedLap: smoothedLapPath.map(project)
  };
}

export function normalizeLapComparisonProgress({
  elapsedMs,
  lapTimeMs
}: {
  elapsedMs: number;
  lapTimeMs: number;
}) {
  if (lapTimeMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, elapsedMs / lapTimeMs));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getTimestampMs(value: unknown) {
  if (!isRecord(value) || typeof value.timestamp !== "string") {
    return null;
  }

  const timestamp = Date.parse(value.timestamp);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function interpolateNumber(start: number, end: number, fraction: number) {
  return start + (end - start) * fraction;
}

function interpolateSample<T>(previous: T, current: T, fraction: number): T {
  if (!isRecord(previous) || !isRecord(current)) {
    return fraction < 0.5 ? previous : current;
  }

  const interpolated: Record<string, unknown> = {
    ...previous,
    ...current
  };
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  keys.forEach((key) => {
    const previousValue = previous[key];
    const currentValue = current[key];

    if (
      typeof previousValue === "number" &&
      Number.isFinite(previousValue) &&
      typeof currentValue === "number" &&
      Number.isFinite(currentValue)
    ) {
      interpolated[key] = interpolateNumber(previousValue, currentValue, fraction);
      return;
    }

    if (key === "timestamp" && typeof previousValue === "string" && typeof currentValue === "string") {
      const previousTime = Date.parse(previousValue);
      const currentTime = Date.parse(currentValue);

      if (Number.isFinite(previousTime) && Number.isFinite(currentTime)) {
        interpolated[key] = new Date(interpolateNumber(previousTime, currentTime, fraction)).toISOString();
        return;
      }
    }

    interpolated[key] = fraction < 0.5 ? previousValue : currentValue;
  });

  return interpolated as T;
}

function getPointCoordinates(value: unknown): ProjectedPoint | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  ) {
    return {
      x: value.x,
      y: value.y
    };
  }

  if (
    typeof value.lng === "number" &&
    Number.isFinite(value.lng) &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat)
  ) {
    return {
      x: value.lng,
      y: value.lat
    };
  }

  if (
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude)
  ) {
    return {
      x: value.longitude,
      y: value.latitude
    };
  }

  return null;
}

function sampleAtDistanceProgress<T>(samples: T[], progress: number) {
  const distances = [0];
  let totalDistance = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = getPointCoordinates(samples[index - 1]);
    const current = getPointCoordinates(samples[index]);

    if (!previous || !current) {
      return null;
    }

    totalDistance += Math.hypot(current.x - previous.x, current.y - previous.y);
    distances.push(totalDistance);
  }

  if (totalDistance <= 0) {
    return null;
  }

  const targetDistance = progress * totalDistance;

  for (let index = 1; index < distances.length; index += 1) {
    if (distances[index] < targetDistance) {
      continue;
    }

    const segmentLength = distances[index] - distances[index - 1];
    const fraction = segmentLength > 0 ? (targetDistance - distances[index - 1]) / segmentLength : 0;
    return interpolateSample(samples[index - 1], samples[index], clamp(fraction, 0, 1));
  }

  return samples[samples.length - 1];
}

export function sampleAtProgress<T>(samples: T[], progress: number) {
  if (samples.length === 0) {
    return null;
  }

  if (samples.length === 1) {
    return samples[0];
  }

  const normalizedProgress = clamp(progress, 0, 1);
  const firstTimestamp = getTimestampMs(samples[0]);
  const lastTimestamp = getTimestampMs(samples[samples.length - 1]);
  const timestamps = samples.map(getTimestampMs);
  const hasUsableTimestamps =
    firstTimestamp !== null &&
    lastTimestamp !== null &&
    lastTimestamp > firstTimestamp &&
    timestamps.every(
      (timestamp, index) =>
        timestamp !== null && (index === 0 || timestamp >= (timestamps[index - 1] ?? 0))
    );

  if (hasUsableTimestamps && firstTimestamp !== null && lastTimestamp !== null) {
    const targetTimestamp = firstTimestamp + (lastTimestamp - firstTimestamp) * normalizedProgress;

    for (let index = 1; index < samples.length; index += 1) {
      const previousTimestamp = timestamps[index - 1] ?? firstTimestamp;
      const currentTimestamp = timestamps[index] ?? lastTimestamp;

      if (currentTimestamp < targetTimestamp) {
        continue;
      }

      const segmentDuration = currentTimestamp - previousTimestamp;
      const fraction =
        segmentDuration > 0 ? (targetTimestamp - previousTimestamp) / segmentDuration : 0;

      return interpolateSample(samples[index - 1], samples[index], clamp(fraction, 0, 1));
    }
  }

  const distanceSample = sampleAtDistanceProgress(samples, normalizedProgress);

  if (distanceSample) {
    return distanceSample;
  }

  const scaledIndex = normalizedProgress * (samples.length - 1);
  const index = Math.min(samples.length - 2, Math.floor(scaledIndex));
  return interpolateSample(samples[index], samples[index + 1], scaledIndex - index);
}

export function toSvgPath(points: ProjectedPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}
