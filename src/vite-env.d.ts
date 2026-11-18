/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Firebase client configuration. No service-account credentials. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_ANALYTICS_ENABLED?: string;
  readonly VITE_ANALYTICS_DEBUG?: string;
  readonly VITE_ANALYTICS_NATIVE_MANUAL_SCREENS?: string;
  /** Authorized stock billing rollout; each store remains independently gated. */
  readonly VITE_REVENUECAT_ENABLED?: string;
  readonly VITE_REVENUECAT_ANDROID_ENABLED?: string;
  readonly VITE_REVENUECAT_IOS_ENABLED?: string;
  /** Default off. Native formats run only after the native ATT/UMP flow and verified Rookie eligibility. */
  readonly VITE_MEDIAN_ADMOB_ENABLED?: string;
  /** Temporary console-only rollout diagnostics, scoped to the resolved Rookie test user ID. */
  readonly VITE_MEDIAN_ADMOB_DIAGNOSTICS?: string;
}

interface ImportMetaEnv { readonly ONLYFAST_2027_PREVIEW: boolean; }
interface ImportMetaEnv {
  readonly ONLYFAST_2027_APP: boolean;
  readonly ONLYFAST_DEPLOYMENT_BRANCH: string;
  readonly ONLYFAST_DEPLOYMENT_TARGET: string;
}
