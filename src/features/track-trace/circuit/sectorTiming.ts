// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import { detectStartFinishCrossing } from "./startFinishCrossing.ts";
import type { LapSectorResult,LapTelemetrySample,SavedLapRecord,TrackSectorLayout } from "./types.ts";
import type { GpsPoint } from "./onlylapsTrackScanUtils.ts";
const minimumSectorDurationMs = 1000;
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
