import { createContext } from 'react';
import {
  CLOSED_BETA_ACCESS,
  type BetaAccessSnapshot,
} from '@/lib/betaFeatures';

export interface BetaFeaturesContextValue extends BetaAccessSnapshot {
  loading: boolean;
  hasBetaFeature: (featureName: string) => boolean;
  refreshBetaFeatures: () => Promise<void>;
  betaIndicatorLabel: 'Beta Test Account' | 'Beta Features' | null;
}

export const BetaFeaturesContext = createContext<BetaFeaturesContextValue>({
  ...CLOSED_BETA_ACCESS,
  loading: true,
  hasBetaFeature: () => false,
  refreshBetaFeatures: async () => {},
  betaIndicatorLabel: null,
});
