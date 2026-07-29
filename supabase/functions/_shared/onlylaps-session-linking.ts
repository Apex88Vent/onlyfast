export const ONLYLAPS_SESSION_LINK_BETA_FEATURE =
  'test_account_full_access';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LinkStoreResult<T> {
  data: T;
  error: string | null;
}

export interface OnlyFastLinkingSessionRow {
  id: string;
  user_id: string;
  track_name: string | null;
  race_date: string | null;
  session_label: string | null;
  setup_type: string | null;
}

export interface OnlyLapsLinkRow {
  id: string;
  user_id: string;
  onlyfast_session_id: string;
  onlylaps_session_id: string;
  link_method: string;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface OnlyLapsCandidateSessionRow {
  id: string;
  user_id: string;
  track_map_id: string | null;
  name: string;
  session_name: string | null;
  session_type: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface OnlyLapsCandidateLapRow {
  timing_session_id: string;
  lap_count: number;
  valid_lap_count: number;
  fastest_valid_lap_ms: number | null;
}

export interface CandidateSessionPage {
  rows: OnlyLapsCandidateSessionRow[];
  hasMore: boolean;
}

export interface CandidateSessionQuery {
  startedAfter: string | null;
  startedBefore: string | null;
  limit: number;
  offset: number;
}

export interface OnlyLapsSessionLinkStore {
  findOwnedOnlyFastSession(
    sessionId: string,
    userId: string,
  ): Promise<LinkStoreResult<OnlyFastLinkingSessionRow | null>>;
  listOwnedLinksForOnlyFast(
    onlyfastSessionId: string,
    userId: string,
  ): Promise<LinkStoreResult<OnlyLapsLinkRow[]>>;
  findOwnedOnlyLapsSession(
    sessionId: string,
    userId: string,
  ): Promise<LinkStoreResult<OnlyLapsCandidateSessionRow | null>>;
  listOwnedOnlyLapsSessions(
    userId: string,
    query: CandidateSessionQuery,
  ): Promise<LinkStoreResult<CandidateSessionPage>>;
  listOwnedLapSummaries(
    sessionIds: string[],
    userId: string,
  ): Promise<LinkStoreResult<OnlyLapsCandidateLapRow[]>>;
  listOwnedLinksForOnlyLaps(
    sessionIds: string[],
    userId: string,
  ): Promise<LinkStoreResult<OnlyLapsLinkRow[]>>;
  setOwnedLink(
    userId: string,
    onlyfastSessionId: string,
    onlylapsSessionId: string,
    linkMethod: 'manual' | 'suggested_confirmed',
    matchConfidence: number | null,
  ): Promise<LinkStoreResult<OnlyLapsLinkRow | null>>;
  unlinkOwnedSession(
    userId: string,
    onlyfastSessionId: string,
  ): Promise<LinkStoreResult<boolean>>;
}

export interface OnlyLapsSessionCandidate {
  onlylaps_session_id: string;
  custom_name: string | null;
  fallback_name: string;
  display_name: string;
  track_name: string | null;
  session_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  lap_count: number;
  valid_lap_count: number;
  fastest_valid_lap_ms: number | null;
  linked_onlyfast_session_id: string | null;
  linked_to_current_session: boolean;
  linked_elsewhere: boolean;
  rank_score: number;
  match_reasons: string[];
}

export interface OnlyLapsSessionPickerResult {
  onlyfast_session_id: string;
  current_link: OnlyLapsLinkRow | null;
  current_session: OnlyLapsSessionCandidate | null;
  candidates: OnlyLapsSessionCandidate[];
  suggested_candidate_id: string | null;
  ambiguous: boolean;
  scope: 'suggested' | 'all';
  offset: number;
  has_more: boolean;
}

export class OnlyLapsSessionLinkError extends Error {
  readonly code:
    | 'invalid_session_id'
    | 'onlyfast_session_not_found'
    | 'onlylaps_session_not_found'
    | 'ownership_mismatch'
    | 'integrity_error'
    | 'already_linked_elsewhere'
    | 'data_load_failed'
    | 'write_failed';

  constructor(
    code: OnlyLapsSessionLinkError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'OnlyLapsSessionLinkError';
    this.code = code;
  }
}

function requiredData<T>(
  result: LinkStoreResult<T>,
  label: string,
): T {
  if (result.error) {
    throw new OnlyLapsSessionLinkError(
      'data_load_failed',
      `Unable to load ${label}.`,
    );
  }
  return result.data;
}

function assertUuid(value: string): void {
  if (!uuidPattern.test(value)) {
    throw new OnlyLapsSessionLinkError(
      'invalid_session_id',
      'A valid session ID is required.',
    );
  }
}

function nonempty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function finiteNonnegative(value: unknown): number | null {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : null;
}

const genericTrackWords = new Set([
  'the',
  'track',
  'speedway',
  'raceway',
  'motorsports',
  'motorplex',
  'park',
  'oval',
]);

function normalizedTokens(value: string | null | undefined): string[] {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeTrackName(
  value: string | null | undefined,
): string {
  const meaningful = normalizedTokens(value).filter(
    (token) => !genericTrackWords.has(token),
  );
  return meaningful.join(' ');
}

function normalizedSessionWords(
  value: string | null | undefined,
): Set<string> {
  const words = new Set(normalizedTokens(value));
  if (words.has('hot') && words.has('laps')) words.add('practice');
  if (words.has('qualifier') || words.has('qualifying')) {
    words.add('qualifying');
  }
  if (words.has('feature')) words.add('main');
  if (words.has('race') && words.has('heat')) words.add('heat');
  return words;
}

function dayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  const parsed = Date.parse(`${dateOnly}T00:00:00.000Z`);
  return Number.isFinite(parsed)
    ? Math.floor(parsed / 86_400_000)
    : null;
}

function fallbackSessionName(startedAt: string | null): string {
  if (!startedAt) return 'Session';
  const parsed = new Date(startedAt);
  if (!Number.isFinite(parsed.getTime())) return 'Session';
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
  return `Session — ${time} UTC`;
}

export function rankOnlyLapsCandidate(
  onlyfast: OnlyFastLinkingSessionRow,
  candidate: OnlyLapsCandidateSessionRow,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const onlyfastDay = dayNumber(onlyfast.race_date);
  const candidateDay = dayNumber(candidate.started_at);

  if (onlyfastDay !== null && candidateDay !== null) {
    const distance = Math.abs(onlyfastDay - candidateDay);
    if (distance === 0) {
      score += 60;
      reasons.push('same race date');
    } else if (distance === 1) {
      score += 25;
      reasons.push('within one day');
    } else if (distance <= 3) {
      score += 10;
      reasons.push('nearby date');
    }
  }

  const onlyfastTrack = normalizeTrackName(onlyfast.track_name);
  const onlylapsTrack = normalizeTrackName(candidate.name);
  if (onlyfastTrack && onlylapsTrack) {
    if (onlyfastTrack === onlylapsTrack) {
      score += 35;
      reasons.push('same track');
    } else if (
      onlyfastTrack.includes(onlylapsTrack) ||
      onlylapsTrack.includes(onlyfastTrack)
    ) {
      score += 22;
      reasons.push('similar track');
    }
  }

  const expectedSession = normalizedSessionWords(
    `${onlyfast.session_label || ''} ${onlyfast.setup_type || ''}`,
  );
  const actualSession = normalizedSessionWords(
    `${candidate.session_name || ''} ${candidate.session_type || ''}`,
  );
  const sharedSessionWord = [...expectedSession].some((word) =>
    actualSession.has(word),
  );
  if (sharedSessionWord) {
    score += 15;
    reasons.push('matching session type');
  }

  return { score, reasons };
}

function assertOwnedOnlyFast(
  row: OnlyFastLinkingSessionRow | null,
  sessionId: string,
  userId: string,
): OnlyFastLinkingSessionRow {
  if (!row) {
    throw new OnlyLapsSessionLinkError(
      'onlyfast_session_not_found',
      'OnlyFast session not found.',
    );
  }
  if (row.id !== sessionId || row.user_id !== userId) {
    throw new OnlyLapsSessionLinkError(
      'ownership_mismatch',
      'OnlyFast session ownership could not be verified.',
    );
  }
  return row;
}

function assertOwnedOnlyLaps(
  row: OnlyLapsCandidateSessionRow | null,
  sessionId: string,
  userId: string,
): OnlyLapsCandidateSessionRow {
  if (!row) {
    throw new OnlyLapsSessionLinkError(
      'onlylaps_session_not_found',
      'OnlyLaps session not found.',
    );
  }
  if (row.id !== sessionId || row.user_id !== userId) {
    throw new OnlyLapsSessionLinkError(
      'ownership_mismatch',
      'OnlyLaps session ownership could not be verified.',
    );
  }
  return row;
}

function assertLinkIntegrity(
  links: OnlyLapsLinkRow[],
  onlyfastSessionId: string,
  userId: string,
): void {
  if (
    links.some(
      (link) =>
        link.user_id !== userId ||
        link.onlyfast_session_id !== onlyfastSessionId,
    )
  ) {
    throw new OnlyLapsSessionLinkError(
      'ownership_mismatch',
      'Session-link ownership could not be verified.',
    );
  }
  if (links.length > 1) {
    throw new OnlyLapsSessionLinkError(
      'integrity_error',
      'This OnlyFast session has more than one OnlyLaps link.',
    );
  }
}

function dateWindow(
  raceDate: string | null,
): { startedAfter: string | null; startedBefore: string | null } {
  const day = dayNumber(raceDate);
  if (day === null) {
    return { startedAfter: null, startedBefore: null };
  }
  return {
    startedAfter: new Date((day - 3) * 86_400_000).toISOString(),
    startedBefore: new Date((day + 4) * 86_400_000).toISOString(),
  };
}

function dedupeSessions(
  rows: OnlyLapsCandidateSessionRow[],
): OnlyLapsCandidateSessionRow[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function buildCandidates({
  onlyfast,
  sessions,
  laps,
  links,
  currentLink,
  userId,
}: {
  onlyfast: OnlyFastLinkingSessionRow;
  sessions: OnlyLapsCandidateSessionRow[];
  laps: OnlyLapsCandidateLapRow[];
  links: OnlyLapsLinkRow[];
  currentLink: OnlyLapsLinkRow | null;
  userId: string;
}): OnlyLapsSessionCandidate[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  if (
    sessions.some((session) => session.user_id !== userId) ||
    laps.some((lap) => !sessionIds.has(lap.timing_session_id)) ||
    links.some(
      (link) =>
        link.user_id !== userId ||
        !sessionIds.has(link.onlylaps_session_id),
    )
  ) {
    throw new OnlyLapsSessionLinkError(
      'ownership_mismatch',
      'OnlyLaps candidate ownership could not be verified.',
    );
  }

  const lapsBySession = new Map(
    laps.map((lap) => [lap.timing_session_id, lap]),
  );
  const linksBySession = new Map(
    links.map((link) => [link.onlylaps_session_id, link]),
  );

  return sessions.map((session) => {
    const lapSummary = lapsBySession.get(session.id);
    const linked = linksBySession.get(session.id) || null;
    const ranking = rankOnlyLapsCandidate(onlyfast, session);
    const customName = nonempty(session.session_name);
    const fallbackName = fallbackSessionName(session.started_at);
    const linkedToCurrent =
      linked?.onlyfast_session_id === onlyfast.id ||
      currentLink?.onlylaps_session_id === session.id;

    return {
      onlylaps_session_id: session.id,
      custom_name: customName,
      fallback_name: fallbackName,
      display_name: customName || fallbackName,
      track_name: nonempty(session.name),
      session_type: nonempty(session.session_type),
      started_at: session.started_at,
      ended_at: session.ended_at,
      lap_count: Math.round(
        finiteNonnegative(lapSummary?.lap_count) ?? 0,
      ),
      valid_lap_count: Math.round(
        finiteNonnegative(lapSummary?.valid_lap_count) ?? 0,
      ),
      fastest_valid_lap_ms: finiteNonnegative(
        lapSummary?.fastest_valid_lap_ms,
      ),
      linked_onlyfast_session_id:
        linked?.onlyfast_session_id ?? null,
      linked_to_current_session: linkedToCurrent,
      linked_elsewhere:
        Boolean(linked) && !linkedToCurrent,
      rank_score: ranking.score,
      match_reasons: ranking.reasons,
    };
  });
}

function suggestedCandidate(
  candidates: OnlyLapsSessionCandidate[],
  hasCurrentLink: boolean,
): { id: string | null; ambiguous: boolean } {
  if (hasCurrentLink) return { id: null, ambiguous: false };
  const eligible = candidates
    .filter((candidate) => !candidate.linked_elsewhere)
    .sort((a, b) => b.rank_score - a.rank_score);
  const reasonable = eligible.filter(
    (candidate) => candidate.rank_score >= 60,
  );
  const first = eligible[0];
  const second = eligible[1];
  const hasUniqueStrongMatch =
    Boolean(first) &&
    first.rank_score >= 90 &&
    (!second || first.rank_score - second.rank_score >= 15);

  return {
    id: hasUniqueStrongMatch ? first.onlylaps_session_id : null,
    ambiguous: reasonable.length > 1 && !hasUniqueStrongMatch,
  };
}

export async function listOnlyLapsSessionCandidates({
  onlyfastSessionId,
  offset = 0,
  scope = 'suggested',
  store,
  userId,
}: {
  onlyfastSessionId: string;
  offset?: number;
  scope?: 'suggested' | 'all';
  store: OnlyLapsSessionLinkStore;
  userId: string;
}): Promise<OnlyLapsSessionPickerResult> {
  assertUuid(onlyfastSessionId);
  const safeOffset =
    Number.isInteger(offset) && offset > 0 ? Math.min(offset, 500) : 0;
  const onlyfast = assertOwnedOnlyFast(
    requiredData(
      await store.findOwnedOnlyFastSession(onlyfastSessionId, userId),
      'the OnlyFast session',
    ),
    onlyfastSessionId,
    userId,
  );
  const currentLinks = requiredData(
    await store.listOwnedLinksForOnlyFast(onlyfastSessionId, userId),
    'the current OnlyLaps link',
  );
  assertLinkIntegrity(currentLinks, onlyfastSessionId, userId);
  const currentLink = currentLinks[0] || null;
  const window =
    scope === 'suggested'
      ? dateWindow(onlyfast.race_date)
      : { startedAfter: null, startedBefore: null };
  const page = requiredData(
    await store.listOwnedOnlyLapsSessions(userId, {
      ...window,
      limit: 25,
      offset: safeOffset,
    }),
    'OnlyLaps timing sessions',
  );

  let sessions = [...page.rows];
  if (
    currentLink &&
    !sessions.some(
      (session) => session.id === currentLink.onlylaps_session_id,
    )
  ) {
    const linkedSession = assertOwnedOnlyLaps(
      requiredData(
        await store.findOwnedOnlyLapsSession(
          currentLink.onlylaps_session_id,
          userId,
        ),
        'the linked OnlyLaps session',
      ),
      currentLink.onlylaps_session_id,
      userId,
    );
    sessions.push(linkedSession);
  }
  sessions = dedupeSessions(sessions);
  const sessionIds = sessions.map((session) => session.id);
  const [laps, sessionLinks] =
    sessionIds.length === 0
      ? [[], []]
      : await Promise.all([
          store
            .listOwnedLapSummaries(sessionIds, userId)
            .then((result) =>
              requiredData(result, 'OnlyLaps lap summaries'),
            ),
          store
            .listOwnedLinksForOnlyLaps(sessionIds, userId)
            .then((result) =>
              requiredData(result, 'OnlyLaps linked states'),
            ),
        ]);
  const candidates = buildCandidates({
    onlyfast,
    sessions,
    laps,
    links: sessionLinks,
    currentLink,
    userId,
  }).sort((a, b) => {
    if (a.linked_to_current_session !== b.linked_to_current_session) {
      return a.linked_to_current_session ? -1 : 1;
    }
    if (a.rank_score !== b.rank_score) return b.rank_score - a.rank_score;
    return (b.started_at || '').localeCompare(a.started_at || '');
  });
  const suggestion = suggestedCandidate(candidates, Boolean(currentLink));

  return {
    onlyfast_session_id: onlyfast.id,
    current_link: currentLink,
    current_session:
      candidates.find(
        (candidate) =>
          candidate.onlylaps_session_id ===
          currentLink?.onlylaps_session_id,
      ) || null,
    candidates,
    suggested_candidate_id: suggestion.id,
    ambiguous: suggestion.ambiguous,
    scope,
    offset: safeOffset,
    has_more: page.hasMore,
  };
}

export async function linkOnlyLapsSession({
  matchConfidence = null,
  onlyfastSessionId,
  onlylapsSessionId,
  selectionSource = 'picker',
  store,
  userId,
}: {
  matchConfidence?: number | null;
  onlyfastSessionId: string;
  onlylapsSessionId: string;
  selectionSource?: 'picker' | 'suggestion';
  store: OnlyLapsSessionLinkStore;
  userId: string;
}): Promise<{
  action: 'linked' | 'changed' | 'unchanged';
  link: OnlyLapsLinkRow;
}> {
  assertUuid(onlyfastSessionId);
  assertUuid(onlylapsSessionId);
  assertOwnedOnlyFast(
    requiredData(
      await store.findOwnedOnlyFastSession(onlyfastSessionId, userId),
      'the OnlyFast session',
    ),
    onlyfastSessionId,
    userId,
  );
  assertOwnedOnlyLaps(
    requiredData(
      await store.findOwnedOnlyLapsSession(onlylapsSessionId, userId),
      'the OnlyLaps session',
    ),
    onlylapsSessionId,
    userId,
  );
  const [currentLinks, targetLinks] = await Promise.all([
    store
      .listOwnedLinksForOnlyFast(onlyfastSessionId, userId)
      .then((result) =>
        requiredData(result, 'the current OnlyLaps link'),
      ),
    store
      .listOwnedLinksForOnlyLaps([onlylapsSessionId], userId)
      .then((result) =>
        requiredData(result, 'the selected OnlyLaps linked state'),
      ),
  ]);
  assertLinkIntegrity(currentLinks, onlyfastSessionId, userId);
  if (
    targetLinks.some(
      (link) =>
        link.user_id !== userId ||
        link.onlylaps_session_id !== onlylapsSessionId,
    )
  ) {
    throw new OnlyLapsSessionLinkError(
      'ownership_mismatch',
      'Selected-session link ownership could not be verified.',
    );
  }
  const elsewhere = targetLinks.find(
    (link) => link.onlyfast_session_id !== onlyfastSessionId,
  );
  if (elsewhere) {
    throw new OnlyLapsSessionLinkError(
      'already_linked_elsewhere',
      'That OnlyLaps session is already linked to another OnlyFast session.',
    );
  }

  const previous = currentLinks[0] || null;
  const previousSessionId = previous?.onlylaps_session_id ?? null;
  const confidence =
    selectionSource === 'suggestion'
      ? finiteNonnegative(matchConfidence)
      : null;
  const writeResult = await store.setOwnedLink(
    userId,
    onlyfastSessionId,
    onlylapsSessionId,
    selectionSource === 'suggestion'
      ? 'suggested_confirmed'
      : 'manual',
    confidence === null ? null : Math.min(confidence, 1),
  );
  if (writeResult.error?.startsWith('23505:')) {
    throw new OnlyLapsSessionLinkError(
      'already_linked_elsewhere',
      'That OnlyLaps session is already linked to another OnlyFast session.',
    );
  }
  const written = requiredData(
    writeResult,
    'the OnlyLaps session link',
  );
  if (
    !written ||
    written.user_id !== userId ||
    written.onlyfast_session_id !== onlyfastSessionId ||
    written.onlylaps_session_id !== onlylapsSessionId
  ) {
    throw new OnlyLapsSessionLinkError(
      'write_failed',
      'The OnlyLaps session link could not be saved.',
    );
  }

  return {
    action: !previous
      ? 'linked'
      : previousSessionId === onlylapsSessionId
        ? 'unchanged'
        : 'changed',
    link: written,
  };
}

export async function unlinkOnlyLapsSession({
  onlyfastSessionId,
  store,
  userId,
}: {
  onlyfastSessionId: string;
  store: OnlyLapsSessionLinkStore;
  userId: string;
}): Promise<{ unlinked: boolean }> {
  assertUuid(onlyfastSessionId);
  assertOwnedOnlyFast(
    requiredData(
      await store.findOwnedOnlyFastSession(onlyfastSessionId, userId),
      'the OnlyFast session',
    ),
    onlyfastSessionId,
    userId,
  );
  const currentLinks = requiredData(
    await store.listOwnedLinksForOnlyFast(onlyfastSessionId, userId),
    'the current OnlyLaps link',
  );
  assertLinkIntegrity(currentLinks, onlyfastSessionId, userId);
  if (currentLinks.length === 0) return { unlinked: false };

  return {
    unlinked: requiredData(
      await store.unlinkOwnedSession(userId, onlyfastSessionId),
      'the OnlyLaps session link',
    ),
  };
}
