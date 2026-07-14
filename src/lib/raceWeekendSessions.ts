export const RACE_SESSION_TYPES = ['base', 'heat', 'main', 'extra1', 'extra2', 'extra3'] as const;

export type RaceSessionType = typeof RACE_SESSION_TYPES[number];
export type RaceSessionStatus = 'complete' | 'in-progress' | 'not-started';

export const DEFAULT_RACE_SESSION_TYPES: RaceSessionType[] = ['base', 'heat', 'main'];

export const DEFAULT_RACE_SESSION_LABELS: Record<'base' | 'heat' | 'main', string> = {
  base: 'Hot Laps',
  heat: 'Heat',
  main: 'Main Event',
};

export const DEFAULT_RACE_SESSION_ORDER: Record<RaceSessionType, number> = {
  base: 1,
  heat: 2,
  main: 3,
  extra1: 4,
  extra2: 5,
  extra3: 6,
};

export interface RaceWeekendSessionRow extends Record<string, unknown> {
  id?: unknown;
  setup_type?: unknown;
  session_label?: unknown;
  session_order?: unknown;
  session_started?: unknown;
  session_finished?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface ResolvedRaceWeekendSession {
  id: string | null;
  setupType: RaceSessionType;
  label: string;
  order: number;
  status: RaceSessionStatus;
  row: RaceWeekendSessionRow | null;
}

const normalizeText = (value: unknown): string => String(value ?? '').trim();

export const isRaceSessionType = (value: unknown): value is RaceSessionType =>
  typeof value === 'string' && RACE_SESSION_TYPES.includes(value as RaceSessionType);

export const isDefaultRaceSessionType = (
  value: RaceSessionType,
): value is 'base' | 'heat' | 'main' => DEFAULT_RACE_SESSION_TYPES.includes(value);

export const isGeneratedSessionPlaceholder = (value: unknown): boolean => {
  const label = normalizeText(value).toLowerCase();
  if (!label) return true;
  return /^session\s*\d+$/.test(label) ||
    /^(extra|additional|untitled)\s+session$/.test(label) ||
    label === 'untitled';
};

export const savedSessionLabel = (row: RaceWeekendSessionRow): string | null => {
  if (!isRaceSessionType(row.setup_type)) return null;
  const savedLabel = normalizeText(row.session_label);
  if (savedLabel) {
    if (!isDefaultRaceSessionType(row.setup_type) && isGeneratedSessionPlaceholder(savedLabel)) return null;
    return savedLabel;
  }
  return isDefaultRaceSessionType(row.setup_type)
    ? DEFAULT_RACE_SESSION_LABELS[row.setup_type]
    : null;
};

export const isValidSavedRaceSession = (row: RaceWeekendSessionRow): boolean => {
  if (!isRaceSessionType(row.setup_type)) return false;
  if (!normalizeText(row.id)) return false;
  return savedSessionLabel(row) !== null;
};

const numericOrder = (row: RaceWeekendSessionRow, setupType: RaceSessionType): number => {
  const parsed = Number(row.session_order);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RACE_SESSION_ORDER[setupType];
};

const rowRecency = (row: RaceWeekendSessionRow): number => {
  const value = normalizeText(row.updated_at) || normalizeText(row.created_at);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const truthySessionFlag = (value: unknown): boolean =>
  value === true || value === 1 || normalizeText(value).toLowerCase() === 'true';

export const resolveSavedRaceWeekendSessions = (
  rows: RaceWeekendSessionRow[],
): ResolvedRaceWeekendSession[] => {
  const bestByType = new Map<RaceSessionType, RaceWeekendSessionRow>();

  rows.forEach(row => {
    if (!isValidSavedRaceSession(row) || !isRaceSessionType(row.setup_type)) return;
    const existing = bestByType.get(row.setup_type);
    if (!existing || rowRecency(row) > rowRecency(existing)) {
      bestByType.set(row.setup_type, row);
    }
  });

  return [...bestByType.entries()]
    .map(([setupType, row]) => ({
      id: normalizeText(row.id),
      setupType,
      label: savedSessionLabel(row) as string,
      order: numericOrder(row, setupType),
      status: truthySessionFlag(row.session_finished) ? 'complete' as const : 'in-progress' as const,
      row,
    }))
    .sort((first, second) =>
      first.order - second.order ||
      DEFAULT_RACE_SESSION_ORDER[first.setupType] - DEFAULT_RACE_SESSION_ORDER[second.setupType]
    );
};

export const createNewRaceWeekendSessions = (): ResolvedRaceWeekendSession[] =>
  DEFAULT_RACE_SESSION_TYPES.map(setupType => ({
    id: null,
    setupType,
    label: DEFAULT_RACE_SESSION_LABELS[setupType],
    order: DEFAULT_RACE_SESSION_ORDER[setupType],
    status: 'not-started',
    row: null,
  }));

