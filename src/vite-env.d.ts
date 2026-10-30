/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Authorized stock billing rollout; each store remains independently gated. */
  readonly VITE_REVENUECAT_ENABLED?: string;
  readonly VITE_REVENUECAT_ANDROID_ENABLED?: string;
  readonly VITE_REVENUECAT_IOS_ENABLED?: string;
  /** Default off. Native formats run only after the native ATT/UMP flow and verified Rookie eligibility. */
  readonly VITE_MEDIAN_ADMOB_ENABLED?: string;
  /** Temporary console-only rollout diagnostics, scoped to the resolved Rookie test user ID. */
  readonly VITE_MEDIAN_ADMOB_DIAGNOSTICS?: string;
}
