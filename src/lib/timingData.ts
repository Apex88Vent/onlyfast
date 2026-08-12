export type TimingRecord = Record<string, unknown>;

export interface TimingLap extends TimingRecord {
  lap?: number | string | null;
  lap_number?: number | string | null;
  time?: string | number | null;
  lap_time?: string | number | null;
  seconds?: number | null;
  session_id?: string | null;
  position?: number | string | null;
  driver_name?: string | null;
  car_number?: string | null;
}

export interface TimingData {
  session_id?: string | null;
  source?: string;
  scanned_at?: string;
  fastest_lap_time?: string | number | null;
  fastest_lap_on_lap?: number | null;
  finishing_position?: number | string | null;
  starting_position?: number | string | null;
  slowest_lap_time?: string | number | null;
  average_lap_time?: string | number | null;
  positions_gained_lost?: number | null;
  lap_times?: TimingLap[];
  raw_text?: string | null;
  scan_model?: string | null;
  scan_confidence?: number | null;
  function_version?: string | null;
  [key: string]: unknown;
}

export const attachTimingDataToSession = (
  timingData: unknown,
  sessionId: string,
): TimingData | null => {
  if (!timingData || typeof timingData !== 'object') return null;
  const timing = timingData as TimingData;
  return {
    ...timing,
    session_id: sessionId,
    lap_times: Array.isArray(timing.lap_times)
      ? timing.lap_times.map(lap => (
          lap && typeof lap === 'object'
            ? { ...(lap as TimingRecord), session_id: sessionId }
            : { time: lap == null ? '' : String(lap), session_id: sessionId }
        ))
      : [],
  };
};

const normalizedText = (value: unknown): string => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, '-')
  .replace(/\s+/g, '')
  .replace(/,(?=\d)/g, '.');

const numericLap = (row: TimingRecord): number | null => {
  const value = row.lap ?? row.lap_number;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const rowTime = (row: TimingRecord): string => String(row.time ?? row.lap_time ?? '').trim();

const rowSeconds = (row: TimingRecord): number | null => {
  if (typeof row.seconds === 'number' && Number.isFinite(row.seconds)) return row.seconds;
  const value = normalizedText(rowTime(row));
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(part => !Number.isFinite(part))) return null;
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(seconds) ? seconds : null;
};

const rowsRepresentSameTiming = (first: TimingRecord, second: TimingRecord): boolean => {
  const firstLap = numericLap(first);
  const secondLap = numericLap(second);
  const firstCar = normalizedText(first.car_number ?? first.car ?? first.number);
  const secondCar = normalizedText(second.car_number ?? second.car ?? second.number);
  const firstDriver = normalizedText(first.driver_name ?? first.driver);
  const secondDriver = normalizedText(second.driver_name ?? second.driver);

  if (firstLap !== null || secondLap !== null) {
    if (firstLap === null || secondLap === null || firstLap !== secondLap) return false;
    if (firstCar && secondCar && firstCar !== secondCar) return false;
    if (firstDriver && secondDriver && firstDriver !== secondDriver) return false;
    return true;
  }

  const firstTime = normalizedText(rowTime(first));
  const secondTime = normalizedText(rowTime(second));
  if (!firstTime || firstTime !== secondTime) return false;
  const firstPosition = normalizedText(first.position ?? first.pos ?? first.running_position);
  const secondPosition = normalizedText(second.position ?? second.pos ?? second.running_position);
  const hasStableCompanion = firstPosition || secondPosition || firstCar || secondCar || firstDriver || secondDriver;
  if (!hasStableCompanion) return false;
  if (firstPosition && secondPosition && firstPosition !== secondPosition) return false;
  if (firstCar && secondCar && firstCar !== secondCar) return false;
  if (firstDriver && secondDriver && firstDriver !== secondDriver) return false;
  return true;
};

const completenessScore = (row: TimingRecord): number =>
  Object.values(row).reduce<number>((score, value) => {
    if (value === null || value === undefined || String(value).trim() === '') return score;
    return score + 1;
  }, 0) + (rowSeconds(row) !== null ? 2 : 0);

const mergeRepeatedRow = (
  first: TimingRecord,
  second: TimingRecord,
  sessionId: string,
): TimingRecord => {
  const preferred = completenessScore(second) > completenessScore(first) ? second : first;
  const fallback = preferred === first ? second : first;
  const merged = { ...fallback };
  Object.entries(preferred).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      merged[key] = value;
    }
  });
  return { ...merged, session_id: sessionId };
};

export const mergeTimingRows = (
  rows: TimingRecord[],
  sessionId: string,
): TimingRecord[] => {
  const merged: TimingRecord[] = [];
  rows.forEach((row, index) => {
    const normalizedRow = {
      ...row,
      lap: numericLap(row) ?? row.lap ?? row.lap_number,
      time: rowTime(row),
      seconds: rowSeconds(row),
      session_id: sessionId,
      __sourceOrder: index,
    };
    const existingIndex = merged.findIndex(existing => rowsRepresentSameTiming(existing, normalizedRow));
    if (existingIndex >= 0) {
      merged[existingIndex] = mergeRepeatedRow(merged[existingIndex], normalizedRow, sessionId);
    } else {
      merged.push(normalizedRow);
    }
  });

  return merged
    .sort((a, b) => {
      const lapA = numericLap(a);
      const lapB = numericLap(b);
      if (lapA !== null && lapB !== null && lapA !== lapB) return lapA - lapB;
      if (lapA !== null && lapB === null) return -1;
      if (lapA === null && lapB !== null) return 1;
      const positionA = Number.parseInt(String(a.position ?? a.pos ?? ''), 10);
      const positionB = Number.parseInt(String(b.position ?? b.pos ?? ''), 10);
      if (Number.isFinite(positionA) && Number.isFinite(positionB) && positionA !== positionB) return positionA - positionB;
      return Number(a.__sourceOrder) - Number(b.__sourceOrder);
    })
    .map(({ __sourceOrder: _sourceOrder, ...row }) => row);
};

const firstPresent = (rows: TimingRecord[], key: string): unknown => {
  for (const row of rows) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return null;
};

const formatSeconds = (seconds: number): string => seconds.toFixed(3);

export const mergeTimingScanResults = (
  scans: TimingRecord[],
  sessionId: string,
): TimingRecord | null => {
  if (scans.length === 0) return null;
  const ranked = [...scans].sort((a, b) => completenessScore(b) - completenessScore(a));
  const laps = mergeTimingRows(
    scans.flatMap(scan => Array.isArray(scan.lap_times) ? scan.lap_times : []),
    sessionId,
  );
  const timedLaps = laps
    .map(row => ({ row, seconds: rowSeconds(row) }))
    .filter((entry): entry is { row: TimingRecord; seconds: number } => entry.seconds !== null);
  const fastest = timedLaps.length
    ? timedLaps.reduce((best, entry) => entry.seconds < best.seconds ? entry : best)
    : null;
  const slowest = timedLaps.length
    ? timedLaps.reduce((worst, entry) => entry.seconds > worst.seconds ? entry : worst)
    : null;
  const average = timedLaps.length
    ? timedLaps.reduce((sum, entry) => sum + entry.seconds, 0) / timedLaps.length
    : null;
  const confidenceValues = scans
    .map(scan => Number(scan.confidence))
    .filter(value => Number.isFinite(value));

  return {
    ...ranked[0],
    session_id: sessionId,
    track_name: firstPresent(ranked, 'track_name'),
    event_name: firstPresent(ranked, 'event_name'),
    race_date: firstPresent(ranked, 'race_date'),
    race_class: firstPresent(ranked, 'race_class'),
    session_type: firstPresent(ranked, 'session_type'),
    driver_name: firstPresent(ranked, 'driver_name'),
    car_number: firstPresent(ranked, 'car_number'),
    finishing_position: firstPresent(ranked, 'finishing_position'),
    starting_position: firstPresent(ranked, 'starting_position'),
    positions_gained_lost: firstPresent(ranked, 'positions_gained_lost'),
    total_laps: laps.length,
    best_lap_time: fastest ? (rowTime(fastest.row) || formatSeconds(fastest.seconds)) : firstPresent(ranked, 'best_lap_time'),
    best_lap_seconds: fastest?.seconds ?? firstPresent(ranked, 'best_lap_seconds'),
    slowest_lap_time: slowest ? (rowTime(slowest.row) || formatSeconds(slowest.seconds)) : firstPresent(ranked, 'slowest_lap_time'),
    slowest_lap_seconds: slowest?.seconds ?? firstPresent(ranked, 'slowest_lap_seconds'),
    average_lap_time: average === null ? firstPresent(ranked, 'average_lap_time') : formatSeconds(average),
    average_lap_seconds: average ?? firstPresent(ranked, 'average_lap_seconds'),
    fastest_lap_on_lap: fastest ? numericLap(fastest.row) : firstPresent(ranked, 'fastest_lap_on_lap'),
    lap_times: laps,
    confidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null,
    fields_missing: [],
    raw_text: scans.map(scan => String(scan.raw_text || '').trim()).filter(Boolean).join('\n\n'),
  };
};
