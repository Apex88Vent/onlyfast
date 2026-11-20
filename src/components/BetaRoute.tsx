import React from 'react';
import { Navigate } from 'react-router-dom';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';

interface BetaRouteProps {
  feature: string;
  children: React.ReactNode;
  fallbackPath?: string;
}

const BetaRoute: React.FC<BetaRouteProps> = ({
  feature,
  children,
  fallbackPath = '/',
}) => {
  const { loading, hasBetaFeature } = useBetaFeatures();

  if (loading) {
    return <div className="min-h-screen bg-[#F5F5F7]" aria-busy="true" />;
  }

  if (!hasBetaFeature(feature)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default BetaRoute;
