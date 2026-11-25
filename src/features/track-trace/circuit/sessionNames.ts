// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type { SavedLapSession } from "./types.ts";

export const SESSION_NAME_MAX_LENGTH = 80;

export type SessionNameValidation =
  | { value: string | null; error: null }
  | { value: null; error: string };

export function normalizeSessionName(value: string): SessionNameValidation {
  const normalized = value.trim();

  if (!normalized) {
    return { value: null, error: null };
  }
  if (normalized.length > SESSION_NAME_MAX_LENGTH) {
    return {
      value: null,
      error: `Session names must be ${SESSION_NAME_MAX_LENGTH} characters or fewer.`
    };
  }
  // eslint-disable-next-line no-control-regex -- Source validation intentionally rejects control characters.
  if (/[\u0000-\u001f\u007f<>]/.test(normalized)) {
    return {
      value: null,
      error: "Session names cannot contain markup or control characters."
    };
  }
  return { value: normalized, error: null };
}

export function getSessionDisplayName(
  session: Pick<SavedLapSession, "sessionName" | "trackName">
) {
  return session.sessionName?.trim() || session.trackName;
}

export function updateOwnedSessionName({
  authenticatedUserId,
  name,
  session
}: {
  authenticatedUserId: string;
  name: string;
  session: SavedLapSession;
}): { data: SavedLapSession | null; error: string | null } {
  const normalized = normalizeSessionName(name);

  if (normalized.error) {
    return { data: null, error: normalized.error };
  }
  if (session.userId !== authenticatedUserId) {
    return { data: null, error: "Session not found." };
  }
  return {
    data: {
      ...session,
      sessionName: normalized.value
    },
    error: null
  };
}
