import { useContext } from 'react';
import { BetaFeaturesContext } from '@/contexts/betaFeaturesContextValue';

export const useBetaFeatures = () => useContext(BetaFeaturesContext);
