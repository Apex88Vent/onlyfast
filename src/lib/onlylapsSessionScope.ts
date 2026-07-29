const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ONLYLAPS_SESSION_LINK_CHANGED_EVENT =
  'onlyfast:onlylaps-session-link-changed';

export function resolveActiveOnlyFastSessionId(
  activeSessionSlot: string,
  sessionIds: Partial<Record<string, string>>,
): string | null {
  const sessionId = sessionIds[activeSessionSlot];
  return typeof sessionId === 'string' && UUID_PATTERN.test(sessionId)
    ? sessionId
    : null;
}

export function notifyOnlyLapsSessionLinkChanged(
  onlyfastSessionId: string,
): void {
  window.dispatchEvent(
    new CustomEvent(ONLYLAPS_SESSION_LINK_CHANGED_EVENT, {
      detail: { onlyfastSessionId },
    }),
  );
}
