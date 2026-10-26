/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default off. Enabling the flag does not bypass the native consent release hold. */
  readonly VITE_MEDIAN_ADMOB_ENABLED?: string;
}
