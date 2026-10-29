/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default off. Native formats run only after the native ATT/UMP flow and verified Rookie eligibility. */
  readonly VITE_MEDIAN_ADMOB_ENABLED?: string;
  /** Temporary console-only rollout diagnostics, scoped to the resolved Rookie test user ID. */
  readonly VITE_MEDIAN_ADMOB_DIAGNOSTICS?: string;
}
