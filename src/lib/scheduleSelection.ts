export interface ScheduleRaceEntry {
  id?: string;
  race_date?: string | null;
  race_end_date?: string | null;
  track?: string | null;
  organization?: string | null;
  finishing_position?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PRE_RACE_WEEKEND_WINDOW_DAYS = 2;
const POST_RACE_WEEKEND_WINDOW_DAYS = 2;

export const toLocalDateOnly = (date = new Date()): Date => {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
};

export const parseLocalRaceDate = (date?: string | null): Date | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const daysFromToday = (raceDate?: string | null, today = new Date()): number | null => {
  const parsed = parseLocalRaceDate(raceDate);
  if (!parsed) return null;
  return Math.round((parsed.getTime() - toLocalDateOnly(today).getTime()) / DAY_MS);
};

export const sortScheduleEntriesByDate = <T extends ScheduleRaceEntry>(rows: T[]): T[] =>
  [...rows]
    .filter(row => Boolean(parseLocalRaceDate(row.race_date)))
    .sort((a, b) => {
      const aTime = parseLocalRaceDate(a.race_date)?.getTime() ?? 0;
      const bTime = parseLocalRaceDate(b.race_date)?.getTime() ?? 0;
      return aTime - bTime;
    });

export const getNextScheduledRace = <T extends ScheduleRaceEntry>(rows: T[], today = new Date()): T | null =>
  sortScheduleEntriesByDate(rows).find(row => {
    const days = daysFromToday(row.race_date, today);
    return days !== null && days >= 0 && Boolean((row.track || '').trim());
  }) || null;

export const getRaceWeekendScheduleSelection = <T extends ScheduleRaceEntry>(
  rows: T[],
  today = new Date(),
): { race: T; title: 'Current Race Weekend' | 'Next Race Weekend'; mode: 'current' | 'next' } | null => {
  const sorted = sortScheduleEntriesByDate(rows).filter(row => Boolean((row.track || '').trim()));

  // Treat race weekend as current from two full local calendar days before race day
  // through one full local calendar day after, so prep/travel days still open the current weekend.
  const currentWindowRace = sorted.find(row => {
    const days = daysFromToday(row.race_date, today);
    return days !== null && days <= PRE_RACE_WEEKEND_WINDOW_DAYS && days >= -POST_RACE_WEEKEND_WINDOW_DAYS;
  });
  if (currentWindowRace) {
    return { race: currentWindowRace, title: 'Current Race Weekend', mode: 'current' };
  }

  const nextRace = getNextScheduledRace(sorted, today);
  return nextRace ? { race: nextRace, title: 'Next Race Weekend', mode: 'next' } : null;
};

export interface RaceScheduleNavigation<T extends ScheduleRaceEntry> {
  previous: T | null;
  center: T | null;
  next: T | null;
}

const racesMatch = (first: ScheduleRaceEntry, second: ScheduleRaceEntry): boolean => {
  if (first.id && second.id) return first.id === second.id;
  return first.race_date === second.race_date &&
    String(first.track || '').trim().toLowerCase() === String(second.track || '').trim().toLowerCase();
};

export const getRaceScheduleNavigation = <T extends ScheduleRaceEntry>(
  rows: T[],
  centerRace?: T | null,
): RaceScheduleNavigation<T> => {
  const sorted = sortScheduleEntriesByDate(rows).filter(row => Boolean((row.track || '').trim()));
  if (sorted.length === 0 || !centerRace) return { previous: null, center: null, next: null };
  const requestedIndex = sorted.findIndex(row => racesMatch(row, centerRace));
  if (requestedIndex < 0) return { previous: null, center: null, next: null };
  const centerIndex = requestedIndex;
  return {
    previous: centerIndex > 0 ? sorted[centerIndex - 1] : null,
    center: sorted[centerIndex] || null,
    next: centerIndex < sorted.length - 1 ? sorted[centerIndex + 1] : null,
  };
};

export interface RaceRolloverSelection<T extends ScheduleRaceEntry> extends RaceScheduleNavigation<T> {
  automaticallyAdvanced: boolean;
}

export const getScheduleRaceKey = (race?: ScheduleRaceEntry | null): string => {
  if (!race) return '';
  if (race.id) return `id:${race.id}`;
  return [race.race_date, race.race_end_date, String(race.track || '').trim().toLowerCase()]
    .filter(Boolean)
    .join('|');
};

export const raceIdentityMatchesScheduleRace = (
  raceDate: string | null | undefined,
  trackName: string | null | undefined,
  race: ScheduleRaceEntry,
): boolean => {
  const scheduledTrack = String(race.track || '').trim().toLowerCase();
  return Boolean(
    raceDate &&
    scheduledTrack &&
    raceDate === race.race_date &&
    String(trackName || '').trim().toLowerCase() === scheduledTrack,
  );
};

export const getRaceFinalScheduledDate = (race: ScheduleRaceEntry): Date | null => {
  const start = parseLocalRaceDate(race.race_date);
  const end = parseLocalRaceDate(race.race_end_date);
  if (!start) return end;
  if (!end || end.getTime() < start.getTime()) return start;
  return end;
};

export const getUpcomingScheduleEntries = <T extends ScheduleRaceEntry>(
  rows: T[],
  today = new Date(),
): T[] => {
  const localToday = toLocalDateOnly(today);
  return sortScheduleEntriesByDate(rows).filter(row => {
    const finalDate = getRaceFinalScheduledDate(row);
    return Boolean((row.track || '').trim()) && Boolean(finalDate && finalDate.getTime() >= localToday.getTime());
  });
};

export const getRaceRolloverSelection = <T extends ScheduleRaceEntry>(
  rows: T[],
  today = new Date(),
): RaceRolloverSelection<T> => {
  const sorted = sortScheduleEntriesByDate(rows).filter(row => Boolean((row.track || '').trim()));
  if (sorted.length === 0) {
    return { previous: null, center: null, next: null, automaticallyAdvanced: false };
  }

  const localToday = toLocalDateOnly(today);
  let centerIndex = 0;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const finalDate = getRaceFinalScheduledDate(sorted[index]);
    if (!finalDate) continue;
    const rolloverDate = new Date(finalDate);
    rolloverDate.setDate(rolloverDate.getDate() + POST_RACE_WEEKEND_WINDOW_DAYS);
    rolloverDate.setHours(0, 0, 0, 0);
    if (localToday.getTime() >= rolloverDate.getTime()) centerIndex = index + 1;
  }

  return {
    previous: centerIndex > 0 ? sorted[centerIndex - 1] : null,
    center: sorted[centerIndex] || null,
    next: centerIndex < sorted.length - 1 ? sorted[centerIndex + 1] : null,
    automaticallyAdvanced: centerIndex > 0,
  };
};

export const getRaceCenterLabel = <T extends ScheduleRaceEntry>(
  selection: RaceRolloverSelection<T>,
  activatedRaceKey: string,
): 'Current Race' | 'Upcoming Race' => {
  const centerKey = getScheduleRaceKey(selection.center);
  return selection.automaticallyAdvanced && centerKey && activatedRaceKey !== centerKey
    ? 'Upcoming Race'
    : 'Current Race';
};
