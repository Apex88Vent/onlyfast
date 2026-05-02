import { createClient } from '@supabase/supabase-js';

// Read database credentials from environment variables when available,
// falling back to the project's hardcoded values so the app keeps working
// even if env vars haven't been configured in the host (e.g. Vercel).
const FALLBACK_URL = 'https://ihqknjmrgdazcfyxegbc.databasepad.com';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjE3NWRmNjIzLTE0YzAtNDU4MC05ZDkzLWY0N2Q4YjIyNjE3OSJ9.eyJwcm9qZWN0SWQiOiJpaHFrbmptcmdkYXpjZnl4ZWdiYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1NDA0MDUwLCJleHAiOjIwOTA3NjQwNTAsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.QHvVa7kgVkzeWsnvbsZEuGRDFiOsi_LJgWlHJS0H9S4';

const envUrl = import.meta.env.VITE_database_URL as string | undefined;
const envKey = import.meta.env.VITE_database_ANON_KEY as string | undefined;

const supabaseUrl = envUrl || FALLBACK_URL;
const supabaseKey = envKey || FALLBACK_KEY;

// Runtime diagnostics — surface a single, friendly notice in the console when
// env vars aren't set, but only treat it as an *error* when we have no usable
// credentials at all. Using fallbacks is fine for this project, so we just
// emit an informational warning instead of a scary red error.
if (typeof window !== 'undefined') {
  const w = window as unknown as { __dbDiagLogged?: boolean };
  if (!w.__dbDiagLogged) {
    w.__dbDiagLogged = true;

    const missing: string[] = [];
    if (!envUrl) missing.push('VITE_database_URL');
    if (!envKey) missing.push('VITE_database_ANON_KEY');

    const haveUsableCreds = Boolean(supabaseUrl && supabaseKey);

    if (!haveUsableCreds) {
      // Truly broken — no env vars AND no fallbacks. App will not work.
      // eslint-disable-next-line no-console
      console.error(
        '[database] No database credentials available. Set VITE_database_URL ' +
          'and VITE_database_ANON_KEY in your Vercel Project Settings → ' +
          'Environment Variables for Production, Preview, and Development, ' +
          'then redeploy.'
      );
    } else if (missing.length > 0) {
      // Env vars missing, but bundled fallbacks are in use — app works fine.
      // Emit an info-level message so it's visible but not alarming.
      // eslint-disable-next-line no-console
      console.info(
        `[database] Using bundled default credentials (env var${
          missing.length > 1 ? 's' : ''
        } ${missing.join(
          ', '
        )} not set). To use your own project, configure these in Vercel → ` +
          'Settings → Environment Variables and redeploy.'
      );
    } else {
      // Env vars are present — do light sanity checks.
      if (!/^https?:\/\//i.test(supabaseUrl)) {
        // eslint-disable-next-line no-console
        console.error(
          '[database] VITE_database_URL does not look like a valid URL:',
          supabaseUrl
        );
      }
      if (supabaseKey.length < 40) {
        // eslint-disable-next-line no-console
        console.error(
          '[database] VITE_database_ANON_KEY looks unusually short — verify it was copied correctly.'
        );
      }
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
