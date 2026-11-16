// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import type { CompletedLapDraft } from "./types.ts";

export const slowLapExcludedReason =
  "More than 20% slower than clean session average / likely caution lap";

function round(value: number) {
  return Math.round(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

export function calculateCleanLapBaseline(lapTimesMs: number[], slowThresholdRatio = 1.2) {
  if (lapTimesMs.length === 0) {
    return null;
  }

  const medianBaseline = median(lapTimesMs);

  if (medianBaseline === null) {
    return null;
  }

  let baseline = medianBaseline;
  let candidateTimes = [...lapTimesMs];

  for (let index = 0; index < 3; index += 1) {
    const trimmed = candidateTimes.filter((lapTime) => lapTime <= baseline * slowThresholdRatio);

    if (trimmed.length === candidateTimes.length) {
      break;
    }

    candidateTimes = trimmed.length > 0 ? trimmed : candidateTimes;
    baseline = average(candidateTimes) ?? baseline;
  }

  return round(baseline);
}

export function filterSlowLaps(
  laps: CompletedLapDraft[],
  slowThresholdRatio = 1.2
): CompletedLapDraft[] {
  const lapTimes = laps.map((lap) => lap.lapTimeMs).filter((lapTime) => lapTime > 0);
  const baseline = calculateCleanLapBaseline(lapTimes, slowThresholdRatio);

  if (baseline === null) {
    return laps;
  }

  return laps.map((lap) => {
    if (lap.lapTimeMs > baseline * slowThresholdRatio) {
      return {
        ...lap,
        isValid: false,
        excludedReason: slowLapExcludedReason
      };
    }

    return {
      ...lap,
      isValid: true,
      excludedReason: null
    };
  });
}

export function summarizeFilteredLaps(laps: CompletedLapDraft[]) {
  const validLaps = laps.filter((lap) => lap.isValid);
  const validLapTimes = validLaps.map((lap) => lap.lapTimeMs);
  const allLapTimes = laps.map((lap) => lap.lapTimeMs);

  return {
    totalLapsRecorded: laps.length,
    totalLapsSaved: validLaps.length,
    fastestLapTimeMs: validLapTimes.length > 0 ? Math.min(...validLapTimes) : null,
    averageLapTimeMs: validLapTimes.length > 0 ? round(average(validLapTimes) ?? 0) : null,
    rawAverageLapTimeMs: allLapTimes.length > 0 ? round(average(allLapTimes) ?? 0) : null
  };
}

export function formatLapTime(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) {
    return "--";
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

export function calculateDeltaFromFastest(lapTimeMs: number, fastestLapTimeMs: number | null) {
  if (!fastestLapTimeMs) {
    return "--";
  }

  const delta = lapTimeMs - fastestLapTimeMs;

  if (delta === 0) {
    return "Best";
  }

  return `+${(delta / 1000).toFixed(3)}`;
}

