// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { metersPerSecondToMilesPerHour } from "./telemetryMath.ts";
import type {
  LapTelemetrySample,
  SavedLapRecord,
  SavedLapSession
} from "./types.ts";

export const replayLapColors = {
  primary: "#00A8E8",
  comparison: "#A855F7"
} as const;

export type ReplayLapRole = keyof typeof replayLapColors;

export function getReplayLapColor(role: ReplayLapRole) {
  return replayLapColors[role];
}

export function getLapTelemetrySamples(
  session: SavedLapSession,
  lap: SavedLapRecord | null | undefined
) {
  if (!lap) return [];

  return (session.telemetrySamples ?? [])
    .filter((sample) => sample.lapNumber === lap.lapNumber)
    .sort((sampleA, sampleB) => Date.parse(sampleA.timestamp) - Date.parse(sampleB.timestamp));
}

export function getLapTopSpeedMph(
  lap: SavedLapRecord,
  telemetrySamples: LapTelemetrySample[]
) {
  const validSpeeds = telemetrySamples
    .filter((sample) => sample.lapNumber === lap.lapNumber)
    .map((sample) => sample.speed)
    .filter((speed): speed is number =>
      typeof speed === "number" && Number.isFinite(speed) && speed >= 0
    );

  if (validSpeeds.length > 0) {
    return metersPerSecondToMilesPerHour(Math.max(...validSpeeds));
  }

  return typeof lap.maxSpeed === "number" && Number.isFinite(lap.maxSpeed)
    ? lap.maxSpeed
    : null;
}

export function getDefaultSelectedLap(validLaps: SavedLapRecord[]) {
  return [...validLaps].sort(
    (lapA, lapB) => lapA.lapNumber - lapB.lapNumber || lapA.lapTimeMs - lapB.lapTimeMs
  )[0] ?? null;
}

export function getCornerReferenceLap(
  selectedLap: SavedLapRecord | null,
  validLaps: SavedLapRecord[],
  preferredReferenceId?: string
) {
  const candidates = validLaps
    .filter((lap) => lap.id !== selectedLap?.id)
    .sort((lapA, lapB) => lapA.lapTimeMs - lapB.lapTimeMs);

  if (preferredReferenceId) {
    const preferred = candidates.find((lap) => lap.id === preferredReferenceId);
    if (preferred) return preferred;
  }

  return candidates[0] ?? null;
}
