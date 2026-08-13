import { createClient } from '@supabase/supabase-js';
import { appendMedianPickerTrace } from '@/lib/medianPickerTrace';

/* ──────────────────────────────────────────────────────────────────────────
 * SWITCHING TO A DIFFERENT SUPABASE / DATABASE PROJECT
 * ──────────────────────────────────────────────────────────────────────────
 * You have TWO ways to point this app at a different backend project.
 * Either one works — pick whichever is easier for you.
 *
 *   OPTION A — Recommended: use environment variables (no code changes)
 *   ─────────────────────────────────────────────────────────────────
 *   In Vercel: Project → Settings → Environment Variables, add these for
 *   Production, Preview, AND Development, then redeploy:
 *
 *     VITE_SUPABASE_URL       = https://YOUR-PROJECT-REF.supabase.co
 *     VITE_SUPABASE_ANON_KEY  = your-anon-public-key
 *
 *   Locally: create a `.env.local` file in the project root with the same
 *   two lines, then restart `npm run dev`.
 *
 *   (The legacy names VITE_database_URL / VITE_database_ANON_KEY are also
 *   still accepted for backwards compatibility.)
 *
 *   OPTION B — Edit the FALLBACK_URL / FALLBACK_KEY constants below
 *   ─────────────────────────────────────────────────────────────────
 *   Replace the two strings just below with the URL + anon key from your
 *   new Supabase project (Project Settings → API). Commit & redeploy.
 *   These bundled defaults are used whenever the env vars above are not set.
 * ────────────────────────────────────────────────────────────────────────── */

// ⬇️  EDIT THESE TWO LINES TO POINT AT A DIFFERENT PROJECT (Option B)  ⬇️
// Currently pointed at the user's own Supabase project (thpyjvwtfvfxiufchrxn).
const FALLBACK_URL = 'https://thpyjvwtfvfxiufchrxn.supabase.co';
const FALLBACK_KEY = 'sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv';
// ⬆️  EDIT THESE TWO LINES TO POINT AT A DIFFERENT PROJECT (Option B)  ⬆️

// Accept both the standard Supabase env var names AND the legacy names this
// project shipped with, so existing deployments keep working.
const env = import.meta.env as Record<string, string | undefined>;
const envUrl =
  env.VITE_SUPABASE_URL ||
  env.VITE_database_URL ||
  undefined;
const envKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_database_ANON_KEY ||
  undefined;

const supabaseUrl = envUrl || FALLBACK_URL;
const supabaseKey = envKey || FALLBACK_KEY;

// Runtime diagnostics — surface a single, friendly notice in the console when
// env vars aren't set, but only treat it as an *error* when we have no usable
// credentials at all. Using fallbacks is fine for this project, so we emit an
// informational message instead of a scary red error.
if (typeof window !== 'undefined') {
  const w = window as unknown as { __dbDiagLogged?: boolean };
  if (!w.__dbDiagLogged) {
    w.__dbDiagLogged = true;

    const haveUsableCreds = Boolean(supabaseUrl && supabaseKey);
    const usingFallback = !envUrl || !envKey;

    if (!haveUsableCreds) {
      // Truly broken — no env vars AND no fallbacks. App will not work.
      // eslint-disable-next-line no-console
      console.error(
        '[supabase] No credentials available. Set VITE_SUPABASE_URL and ' +
          'VITE_SUPABASE_ANON_KEY in your Vercel Project Settings → ' +
          'Environment Variables for Production, Preview, and Development, ' +
          'then redeploy.'
      );
    } else if (usingFallback) {
      // eslint-disable-next-line no-console
      console.info(
        `[supabase] Using bundled default credentials. To point at a different ` +
          `Supabase project, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ` +
          `in Vercel (and locally in .env.local), or edit the FALLBACK_URL / ` +
          `FALLBACK_KEY constants in src/lib/supabase.ts.`
      );
    } else {
      // Env vars are present — do light sanity checks.
      if (!/^https?:\/\//i.test(supabaseUrl)) {
        // eslint-disable-next-line no-console
        console.error(
          '[supabase] VITE_SUPABASE_URL does not look like a valid URL:',
          supabaseUrl
        );
      }
      // Supabase has two key formats:
      //   - Legacy JWT anon keys: ~200+ chars, start with "eyJ"
      //   - New publishable keys:  ~40+  chars, start with "sb_publishable_"
      // Both are valid, so we just check for an obvious "you forgot to paste" length.
      if (supabaseKey.length < 20) {
        // eslint-disable-next-line no-console
        console.error(
          '[supabase] VITE_SUPABASE_ANON_KEY looks unusually short — verify it was copied correctly.'
        );
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[supabase] Connected to project at ${supabaseUrl} (from env vars).`
        );
      }
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);
appendMedianPickerTrace('supabase_client_created', {
  source: 'primary_client',
  clientInstances: 1,
});

export { supabase, supabaseUrl, supabaseKey };
