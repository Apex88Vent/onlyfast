// =============================================================================
// DEV / DEMO TEST ACCOUNT CONFIG
// -----------------------------------------------------------------------------
// This file isolates the reusable dev/demo test-account behavior so it is easy
// to find and DISABLE/REMOVE before a production launch.
//
// To turn OFF the auto-reset behavior, set ENABLE_TEST_ACCOUNT_RESET to false
// (or delete this block + its call sites in Header.tsx / AppLayout.tsx).
//
// IMPORTANT: This flag is FRONTEND-ONLY and is NOT a security boundary. The
// real protection lives server-side in the `reset-test-account` Edge Function,
// which:
//   1. requires a valid JWT (manually verifies the bearer token via getUser),
//   2. refuses to run unless its own server env flag TEST_ACCOUNT_RESET_ENABLED
//      is set to "true",
//   3. only ever resets the verified user whose email === TEST_ACCOUNT_EMAIL,
//   4. derives user_id from the verified token and NEVER from request body.
// See docs/edge-functions/reset-test-account.ts.
// =============================================================================

import { supabase } from '@/lib/supabase';

/** The single, dedicated dev/demo account. Only this account is ever reset. */
export const TEST_ACCOUNT_EMAIL = 'test@test.com';

/**
 * Master FRONTEND flag for the test-account reset system.
 * Set to `false` before production launch to fully disable the client-side
 * triggers. (The Edge Function has its own independent server-side flag.)
 */
export const ENABLE_TEST_ACCOUNT_RESET = true;

/** Returns true if the given email is the dedicated dev/demo test account. */
export function isTestAccount(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === TEST_ACCOUNT_EMAIL.toLowerCase();
}

// =============================================================================
// DEV/DEMO TEST-ACCOUNT FULL-ACCESS BYPASS
// -----------------------------------------------------------------------------
// PURPOSE: Let the single dedicated demo account (test@test.com) click into
// every feature, page, card, class, and section for testing/demo purposes —
// without creating fake paid subscription records and without changing access
// rules for ANY real user (rookie / pro / team / unpaid / promo).
//
// HOW IT WORKS: We keep a tiny synchronous cache of the currently signed-in
// user's email (kept fresh via Supabase auth events). Synchronous access-gate
// helpers (membership tiers, subscription "isPaid", coming-soon locks) can then
// call `isCurrentUserTestAccount()` to short-circuit to full access — but ONLY
// for test@test.com.
//
// >>> TO DISABLE / REMOVE BEFORE PRODUCTION <<<
//   1. Set ENABLE_TEST_ACCOUNT_BYPASS = false (kills the bypass instantly), OR
//   2. Delete this block and the `isCurrentUserTestAccount()` call sites in
//      membership.ts, subscription.ts, and OnboardingFlow.tsx.
// This is a FRONTEND demo convenience only; it never touches billing/Stripe.
// =============================================================================

/** Master switch for the test-account full-access bypass. Flip to false to disable. */
export const ENABLE_TEST_ACCOUNT_BYPASS = true;

/** Synchronous cache of the current session's email (for sync access gates). */
let _currentUserEmail: string | null = null;

/** Update the cached email. Called internally by the auth listener below. */
function setCurrentUserEmailCache(email?: string | null): void {
  _currentUserEmail = email ? email.trim().toLowerCase() : null;
}

// Initialize the cache from the existing session and keep it in sync with auth
// state changes. Wrapped in try/catch so it can never break app startup.
try {
  supabase.auth.getSession().then(({ data }) => {
    setCurrentUserEmailCache(data?.session?.user?.email ?? null);
  }).catch(() => {/* non-fatal */});

  supabase.auth.onAuthStateChange((_event, session) => {
    setCurrentUserEmailCache(session?.user?.email ?? null);
  });
} catch {
  /* non-fatal — bypass simply stays inactive if this fails */
}

/**
 * Returns true ONLY when the bypass is enabled AND the currently signed-in user
 * is exactly the dedicated test account (test@test.com).
 *
 * Used by access-gate helpers to grant the demo account full access. This is the
 * ONLY thing that distinguishes the test account from real users — real users
 * are never affected.
 */
export function isCurrentUserTestAccount(): boolean {
  if (!ENABLE_TEST_ACCOUNT_BYPASS) return false;
  return isTestAccount(_currentUserEmail);
}


/**
 * Calls the secure `reset-test-account` Edge Function for the currently
 * signed-in session. Safe to call from logout OR from a reset-on-login
 * fallback (covers the case where logout never ran because the browser was
 * closed or the session expired).
 *
 * The frontend never decides what gets reset — it just forwards the session
 * bearer token; the Edge Function performs all verification and deletion.
 *
 * Returns true on success, false on failure (logout should proceed either way).
 */
export async function resetTestAccountData(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      console.warn('[test-account] no active session; skipping reset');
      return false;
    }
    const { error } = await supabase.functions.invoke('reset-test-account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      console.warn('[test-account] reset-test-account failed:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[test-account] reset-test-account threw:', err);
    return false;
  }
}
