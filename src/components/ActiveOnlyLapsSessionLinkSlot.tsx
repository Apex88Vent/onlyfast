import React from 'react';
import OnlyLapsSessionLinkCard from './OnlyLapsSessionLinkCard';
import { resolveActiveOnlyFastSessionId } from '@/lib/onlylapsSessionScope';

interface ActiveOnlyLapsSessionLinkSlotProps {
  enabled: boolean;
  activeSessionSlot: string;
  sessionIds: Partial<Record<string, string>>;
}

const ActiveOnlyLapsSessionLinkSlot: React.FC<
  ActiveOnlyLapsSessionLinkSlotProps
> = ({ enabled, activeSessionSlot, sessionIds }) => {
  if (!enabled) return null;

  const onlyfastSessionId = resolveActiveOnlyFastSessionId(
    activeSessionSlot,
    sessionIds,
  );
  if (!onlyfastSessionId) return null;

  return (
    <OnlyLapsSessionLinkCard
      key={`onlylaps-session-${onlyfastSessionId}`}
      onlyfastSessionId={onlyfastSessionId}
    />
  );
};

export default ActiveOnlyLapsSessionLinkSlot;
