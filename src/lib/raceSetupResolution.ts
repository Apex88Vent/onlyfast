import {
  isValidSavedRaceSession,
  resolveSavedRaceWeekendSessions,
  type RaceWeekendSessionRow,
} from './raceWeekendSessions.ts';
import type { ScheduleRaceEntry } from './scheduleSelection.ts';

export type RaceSetupResolutionSource = 'linked' | 'exact-date-track' | 'date-window' | 'track-recent' | 'none';

export interface RaceSetupChoice {
  key: string;
  title: string;
  trackName: string;
  raceDate: string;
  scheduleId: string;
  updatedAt: string;
  rows: RaceWeekendSessionRow[];
}

export interface RaceSetupResolution {
  choice: RaceSetupChoice | null;
  choices: RaceSetupChoice[];
  source: RaceSetupResolutionSource;
  canLinkToSchedule: boolean;
  dateDifferenceDays?: number;
}

const normalizedText = (value: unknown): string => String(value ?? '').trim();

const GENERIC_VENUE_SUFFIXES = new Set(['race', 'raceway', 'racetrack', 'speedway', 'track']);

export const normalizeRaceTrack = (value: unknown): string => {
  const beforeAddress = normalizedText(value)
    .toLowerCase()
    .replace(/\b([a-z0-9]+)[’']s\b/g, '$1')
    .replace(/&/g, ' and ')
    .split(',')[0]
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const tokens = beforeAddress.split(' ').filter(Boolean);
  let suffixStart = tokens.length;
  while (suffixStart > 0 && GENERIC_VENUE_SUFFIXES.has(tokens[suffixStart - 1])) {
    suffixStart -= 1;
  }
  const venueTokens = suffixStart > 0 ? tokens.slice(0, suffixStart) : tokens;
  return venueTokens.join(' ');
};

export const raceTrackSearchToken = (value: unknown): string =>
  normalizeRaceTrack(value)
    .split(' ')
    .filter(token => token.length >= 3)
    .sort((first, second) => second.length - first.length)[0] || '';

export const normalizeRaceDate = (value: unknown): string => {
  const text = normalizedText(value);
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate?.[1] || text;
};

const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const dateOnlyOrdinal = (value: unknown): number | null => {
  const match = normalizeRaceDate(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]) return null;

  // Gregorian civil-date ordinal. This deliberately avoids Date/UTC so a
  // browser timezone can never shift either race to a neighboring day.
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
};

export const raceDateDifferenceDays = (first: unknown, second: unknown): number | null => {
  const firstDay = dateOnlyOrdinal(first);
  const secondDay = dateOnlyOrdinal(second);
  return firstDay === null || secondDay === null ? null : Math.abs(firstDay - secondDay);
};

const isBaseTemplateRow = (row: RaceWeekendSessionRow): boolean =>
  normalizedText(row.setup_type) === 'base_template' ||
  normalizedText(row.setup_name).toUpperCase().startsWith('[BASE TEMPLATE]');

const rowUpdatedAt = (row: RaceWeekendSessionRow): string =>
  normalizedText(row.updated_at) || normalizedText(row.created_at);

const recencyTime = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareUpdatedDescending = (first: RaceSetupChoice, second: RaceSetupChoice): number =>
  recencyTime(second.updatedAt) - recencyTime(first.updatedAt) || second.updatedAt.localeCompare(first.updatedAt);

export const buildRaceSetupChoices = (rows: RaceWeekendSessionRow[]): RaceSetupChoice[] => {
  const groups = new Map<string, RaceWeekendSessionRow[]>();

  rows.forEach(row => {
    if (isBaseTemplateRow(row) || !isValidSavedRaceSession(row)) return;
    const scheduleId = normalizedText(row.race_schedule_id);
    const raceDate = normalizeRaceDate(row.race_date);
    const trackName = normalizeRaceTrack(row.track_name);
    const setupName = normalizedText(row.setup_name).toLowerCase() || '__unnamed__';

    // A schedule UUID is the parent identity. Legacy per-session setup names
    // must never split rows that already belong to the same scheduled race.
    const key = scheduleId
      ? `schedule:${scheduleId}`
      : `legacy:${raceDate}|${trackName}|${setupName}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const rowsBySavedOrder = resolveSavedRaceWeekendSessions(groupRows)
        .map(session => session.row)
        .filter((row): row is RaceWeekendSessionRow => Boolean(row));
      const newestRow = [...groupRows]
        .sort((first, second) => recencyTime(rowUpdatedAt(second)) - recencyTime(rowUpdatedAt(first)))[0];
      const source = newestRow || rowsBySavedOrder[0] || groupRows[0];
      const updatedAt = groupRows.reduce((latest, row) => {
        const candidate = rowUpdatedAt(row);
        return recencyTime(candidate) > recencyTime(latest) ? candidate : latest;
      }, '');

      return {
        key,
        title: normalizedText(source?.setup_name) || normalizedText(source?.track_name) || 'Untitled Setup',
        trackName: normalizedText(source?.track_name),
        raceDate: normalizeRaceDate(source?.race_date),
        scheduleId: normalizedText(source?.race_schedule_id),
        updatedAt,
        rows: rowsBySavedOrder,
      };
    })
    .filter(choice => choice.rows.length > 0)
    .sort(compareUpdatedDescending);
};

export const resolveRaceSetupForEvent = (
  race: ScheduleRaceEntry,
  rows: RaceWeekendSessionRow[],
): RaceSetupResolution => {
  const choices = buildRaceSetupChoices(rows);
  const scheduleId = normalizedText(race.id);
  const raceDate = normalizeRaceDate(race.race_date);
  const trackName = normalizeRaceTrack(race.track);

  if (scheduleId) {
    const linked = choices.find(choice => choice.scheduleId === scheduleId);
    if (linked) return { choice: linked, choices, source: 'linked', canLinkToSchedule: false };
  }

  const unlinkedChoices = choices.filter(choice => !choice.scheduleId);
  const exactDateTrack = unlinkedChoices
    .filter(choice =>
      Boolean(raceDate) &&
      normalizeRaceDate(choice.raceDate) === raceDate &&
      normalizeRaceTrack(choice.trackName) === trackName
    )
    .sort(compareUpdatedDescending);
  if (exactDateTrack[0]) {
    return {
      choice: exactDateTrack[0],
      choices,
      source: 'exact-date-track',
      canLinkToSchedule: exactDateTrack.length === 1 && !exactDateTrack[0].scheduleId,
    };
  }

  const windowMatches = unlinkedChoices
    .map(choice => ({ choice, difference: raceDateDifferenceDays(choice.raceDate, raceDate) }))
    .filter((candidate): candidate is { choice: RaceSetupChoice; difference: number } =>
      candidate.difference !== null &&
      candidate.difference <= 3 &&
      Boolean(trackName) &&
      normalizeRaceTrack(candidate.choice.trackName) === trackName
    )
    .sort((first, second) =>
      first.difference - second.difference ||
      normalizeRaceDate(second.choice.raceDate).localeCompare(normalizeRaceDate(first.choice.raceDate)) ||
      compareUpdatedDescending(first.choice, second.choice)
    );
  if (windowMatches[0]) {
    return {
      choice: windowMatches[0].choice,
      choices,
      source: 'date-window',
      canLinkToSchedule: windowMatches.length === 1,
      dateDifferenceDays: windowMatches[0].difference,
    };
  }

  const matchingTrack = choices
    .filter(choice => Boolean(trackName) && normalizeRaceTrack(choice.trackName) === trackName)
    .sort((first, second) =>
      normalizeRaceDate(second.raceDate).localeCompare(normalizeRaceDate(first.raceDate)) ||
      compareUpdatedDescending(first, second)
    );
  if (matchingTrack[0]) {
    return { choice: matchingTrack[0], choices, source: 'track-recent', canLinkToSchedule: false };
  }

  return { choice: null, choices, source: 'none', canLinkToSchedule: false };
};
