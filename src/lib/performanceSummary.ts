export interface PerformanceStat {
  label: 'Events' | 'Avg Finish' | 'Top 5s' | 'Wins' | 'Positions Gained';
  value: string | number;
}

export interface PerformanceScheduleRow {
  finishing_position?: unknown;
}

export interface PerformanceSessionRow {
  timing_data?: unknown;
}

export const parsePerformancePosition = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const text = String(value).trim();
  if (!text || /^tbd$/i.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseTimingNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
};

export const positionDeltaFromTiming = (timingData: unknown): number | null => {
  if (!timingData || typeof timingData !== 'object') return null;
  const timing = timingData as Record<string, unknown>;
  const savedDelta = parseTimingNumber(timing.positions_gained_lost);
  if (savedDelta !== null) return savedDelta;

  const start = parseTimingNumber(timing.starting_position);
  const finish = parseTimingNumber(timing.finish_position ?? timing.finishing_position);
  if (start === null || finish === null) return null;
  return start - finish;
};

export const buildPerformanceSummary = (
  scheduleRows: PerformanceScheduleRow[],
  sessionRows: PerformanceSessionRow[],
): PerformanceStat[] => {
  const finishPositions = scheduleRows
    .map(row => parsePerformancePosition(row.finishing_position))
    .filter((position): position is number => position !== null);
  const positionDeltas = sessionRows
    .map(row => positionDeltaFromTiming(row.timing_data))
    .filter((delta): delta is number => delta !== null);

  // Keep the landing page's original empty state when the user has no schedule
  // and no saved timing result at all. Once any performance source exists, every
  // original tile remains visible so one missing statistic cannot hide another.
  if (scheduleRows.length === 0 && positionDeltas.length === 0) return [];

  const wins = finishPositions.filter(position => position === 1).length;
  const topFives = finishPositions.filter(position => position <= 5).length;
  const averageFinish = finishPositions.length > 0
    ? Math.round((finishPositions.reduce((sum, position) => sum + position, 0) / finishPositions.length) * 10) / 10
    : 0;
  const totalPositionsGained = positionDeltas.reduce((sum, delta) => sum + delta, 0);
  const positionsGainedValue = totalPositionsGained > 0
    ? `+${totalPositionsGained}`
    : String(totalPositionsGained);

  return [
    { label: 'Events', value: finishPositions.length },
    { label: 'Avg Finish', value: averageFinish },
    { label: 'Top 5s', value: topFives },
    { label: 'Wins', value: wins },
    { label: 'Positions Gained', value: positionsGainedValue },
  ];
};
