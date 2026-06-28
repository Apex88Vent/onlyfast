export interface ScheduleRaceEntry {
  id?: string;
  race_date?: string | null;
  track?: string | null;
  organization?: string | null;
  finishing_position?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PRE_RACE_WEEKEND_WINDOW_DAYS = 2;
const POST_RACE_WEEKEND_WINDOW_DAYS = 1;

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
