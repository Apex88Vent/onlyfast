// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { detectStartFinishCrossing } from "./startFinishCrossing.ts";
import type {
  LapSectorResult,
  LapTelemetrySample,
  SavedLapRecord,
  SectorLineDefinition,
  TrackSectorLayout
} from "./types.ts";
import {
  calculateDistanceMeters,
  isOvalTrackType,
  type GpsPoint,
  type SavedTrackMap
} from "./onlylapsTrackScanUtils.ts";
import {
  buildPreviewBoundary,
  getTrackEditorPath,
  orientTrackPath,
  sampleTrackPath
} from "./trackEditorGeometry.ts";

export const maximumTrackSectors = 5;
export const minimumSectorProgressGap = 0.04;
const minimumSectorDurationMs = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toGpsPoint(point: { lat: number; lng: number }, timestamp = new Date(0).toISOString()): GpsPoint {
  return {
    ...point,
    accuracy: 0,
    altitude: null,
    speed: null,
    heading: null,
    timestamp
  };
}

function telemetryToGps(sample: LapTelemetrySample): GpsPoint {
  return {
    lat: sample.latitude,
    lng: sample.longitude,
    accuracy: sample.gpsAccuracy,
    altitude: sample.altitude,
    speed: sample.speed,
    heading: sample.heading,
    timestamp: sample.timestamp
  };
}

function samplePathAtProgress(path: GpsPoint[], progress: number) {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const distances = [0];
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += calculateDistanceMeters(path[index - 1], path[index]);
    distances.push(total);
  }
  if (total <= 0) return path[0];
  const target = clamp(progress, 0, 1) * total;
  for (let index = 1; index < distances.length; index += 1) {
    if (distances[index] < target) continue;
    const segment = distances[index] - distances[index - 1];
    const fraction = segment > 0 ? (target - distances[index - 1]) / segment : 0;
    return {
      ...path[index],
      lat: path[index - 1].lat + (path[index].lat - path[index - 1].lat) * fraction,
      lng: path[index - 1].lng + (path[index].lng - path[index - 1].lng) * fraction
    };
  }
  return path[path.length - 1];
}

export function buildSectorLineAtProgress(
  track: SavedTrackMap,
  progress: number,
  sectorIndex: number
): SectorLineDefinition | null {
  if (track.outside_path.length < 2 || track.inside_path.length < 2) {
    const editorPath = getTrackEditorPath(track);
    const boundary = buildPreviewBoundary(editorPath, progress);
    if (!boundary) return null;
    const before = sampleTrackPath(editorPath, clamp(progress - 0.01, 0, 1));
    const after = sampleTrackPath(editorPath, clamp(progress + 0.01, 0, 1));
    const direction = before && after
      ? detectStartFinishCrossing(
          before,
          after,
          { a: boundary.start, b: boundary.end },
          { debounceMs: 0, minLapTimeMs: 0, maxGpsAccuracyMeters: 1000 }
        ).direction
      : null;
    return {
      id: `sector-line-${sectorIndex}-${Math.round(progress * 10000)}`,
      sectorIndex,
      progress: clamp(progress, minimumSectorProgressGap, 1 - minimumSectorProgressGap),
      start: { lat: boundary.start.lat, lng: boundary.start.lng },
      end: { lat: boundary.end.lat, lng: boundary.end.lng },
      expectedDirection: direction
    };
  }
  const outside = orientTrackPath(track.outside_path, track);
  const inside = orientTrackPath(track.inside_path, track);
  const outsidePoint = samplePathAtProgress(outside, progress);
  const insidePoint = samplePathAtProgress(inside, progress);
  if (!outsidePoint || !insidePoint) return null;

  const beforeOutside = samplePathAtProgress(outside, clamp(progress - 0.01, 0, 1));
  const afterOutside = samplePathAtProgress(outside, clamp(progress + 0.01, 0, 1));
  const beforeInside = samplePathAtProgress(inside, clamp(progress - 0.01, 0, 1));
  const afterInside = samplePathAtProgress(inside, clamp(progress + 0.01, 0, 1));
  const before = beforeOutside && beforeInside ? {
    lat: (beforeOutside.lat + beforeInside.lat) / 2,
    lng: (beforeOutside.lng + beforeInside.lng) / 2
  } : null;
  const after = afterOutside && afterInside ? {
    lat: (afterOutside.lat + afterInside.lat) / 2,
    lng: (afterOutside.lng + afterInside.lng) / 2
  } : null;
  const line = { a: toGpsPoint(outsidePoint), b: toGpsPoint(insidePoint) };
  const direction = before && after
    ? detectStartFinishCrossing(
        toGpsPoint(before, "2026-01-01T00:00:00.000Z"),
        toGpsPoint(after, "2026-01-01T00:00:02.000Z"),
        line,
        { debounceMs: 0, minLapTimeMs: 0, maxGpsAccuracyMeters: 1000 }
      ).direction
    : null;

  return {
    id: `sector-line-${sectorIndex}-${Math.round(progress * 10000)}`,
    sectorIndex,
    progress: clamp(progress, minimumSectorProgressGap, 1 - minimumSectorProgressGap),
    start: { lat: outsidePoint.lat, lng: outsidePoint.lng },
    end: { lat: insidePoint.lat, lng: insidePoint.lng },
    expectedDirection: direction
  };
}

export function createDefaultSectorLayout(track: SavedTrackMap): TrackSectorLayout {
  const isOval = isOvalTrackType(track.track_type);
  const proposedLine = isOval ? buildSectorLineAtProgress(track, 0.5, 1) : null;
  const lines = proposedLine ? [proposedLine] : [];
  const reliableGeometry = track.outside_path.length >= 6 &&
    track.inside_path.length >= 6 && track.start_finish_path.length >= 2;

  return {
    id: null,
    trackId: track.id,
    sectorCount: lines.length + 1,
    version: Math.max(1, track.version ?? 1),
    source: "generated_default",
    ownerId: track.created_by ?? track.user_id,
    lines,
    confidence: isOval && !reliableGeometry ? "needs_confirmation" : "high",
    createdAt: null,
    updatedAt: null
  };
}

export function validateSectorLayout(lines: SectorLineDefinition[]) {
  if (lines.length >= maximumTrackSectors) return "A track can have no more than 5 sectors.";
  const sorted = [...lines].sort((a, b) => a.progress - b.progress);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].progress < minimumSectorProgressGap || sorted[index].progress > 1 - minimumSectorProgressGap) {
      return "Sector lines must be separated from the start/finish line.";
    }
    if (index > 0 && sorted[index].progress - sorted[index - 1].progress < minimumSectorProgressGap) {
      return "Sector lines are too close together for reliable GPS timing.";
    }
  }
  return null;
}

export function calculateLapSectorTimes(
  lap: SavedLapRecord,
  allSamples: LapTelemetrySample[],
  layout: TrackSectorLayout
): LapSectorResult[] {
  const samples = allSamples
    .filter((sample) => sample.lapNumber === lap.lapNumber)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const lines = [...layout.lines].sort((a, b) => a.sectorIndex - b.sectorIndex);

  if (lines.length === 0) {
    return [{
      lapId: lap.id,
      sectorIndex: 1,
      durationMs: lap.isValid ? lap.lapTimeMs : null,
      crossingTimestamp: lap.endedAt,
      isValid: lap.isValid,
      sourceDefinitionVersion: layout.version
    }];
  }

  const results: LapSectorResult[] = [];
  let previousBoundaryAt = lap.startedAt;
  let sampleCursor = 1;
  let orderValid = true;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const definition = lines[lineIndex];
    let crossingTime: string | null = null;
    for (let index = sampleCursor; index < samples.length; index += 1) {
      const detection = detectStartFinishCrossing(
        telemetryToGps(samples[index - 1]),
        telemetryToGps(samples[index]),
        { a: toGpsPoint(definition.start), b: toGpsPoint(definition.end) },
        {
          debounceMs: 0,
          minLapTimeMs: 0,
          expectedDirection: definition.expectedDirection,
          maxGpsAccuracyMeters: 75
        }
      );
      if (!detection.crossed || !detection.crossingTime) continue;
      crossingTime = detection.crossingTime;
      sampleCursor = index + 1;
      break;
    }

    const durationMs = crossingTime ? Date.parse(crossingTime) - Date.parse(previousBoundaryAt) : null;
    const isValid = orderValid && durationMs !== null && durationMs >= minimumSectorDurationMs;
    results.push({
      lapId: lap.id,
      sectorIndex: lineIndex + 1,
      durationMs: isValid ? Math.round(durationMs) : null,
      crossingTimestamp: crossingTime,
      isValid,
      sourceDefinitionVersion: layout.version
    });
    if (!isValid || !crossingTime) orderValid = false;
    else previousBoundaryAt = crossingTime;
  }

  const finalDuration = Date.parse(lap.endedAt) - Date.parse(previousBoundaryAt);
  const finalValid = orderValid && Number.isFinite(finalDuration) && finalDuration >= minimumSectorDurationMs;
  results.push({
    lapId: lap.id,
    sectorIndex: lines.length + 1,
    durationMs: finalValid ? Math.round(finalDuration) : null,
    crossingTimestamp: lap.endedAt,
    isValid: finalValid,
    sourceDefinitionVersion: layout.version
  });

  return results;
}
