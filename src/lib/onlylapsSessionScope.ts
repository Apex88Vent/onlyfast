const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveActiveOnlyFastSessionId(
  activeSessionSlot: string,
  sessionIds: Partial<Record<string, string>>,
): string | null {
  const sessionId = sessionIds[activeSessionSlot];
  return typeof sessionId === 'string' && UUID_PATTERN.test(sessionId)
    ? sessionId
    : null;
}
