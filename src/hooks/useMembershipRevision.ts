import { useSyncExternalStore } from 'react';
import { getMembershipRevision } from '@/lib/trustedMembership';

const subscribe = (listener: () => void) => {
  window.addEventListener('membership-updated', listener);
  return () => window.removeEventListener('membership-updated', listener);
};
// Re-render existing feature gates after trusted access is refreshed.
export function useMembershipRevision() {
  useSyncExternalStore(subscribe, getMembershipRevision, () => 0);
}
