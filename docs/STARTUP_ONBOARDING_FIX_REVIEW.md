# Startup onboarding correction

October 17, 2026. Local-only branch `codex/fix-startup-onboarding`, based on
production commit `cb20b3135d239fcad99331f3fb1c028f191d5b97`. Nothing pushed or
deployed. The original checkout and its later native/staging commit are preserved.

## Cause and correction

AppLayout's signed-out early return rendered a separate welcome card before the
original HowOnlyFastWorks tutorial. The tutorial completion handler also returned
immediately for guests. This put authentication ahead of the requested tutorial.

The standalone card and its combined Create Account / Sign In button are removed
from the JSX. Signed-out visitors now see the original 12-slide tutorial after
the normal splash. Both Skip and Finish open the existing AuthModal Sign In form
directly. Its Create Account option opens the existing registration form; reset,
validation, nickname, waiver, agreements and Supabase auth implementation remain.
No new introductory page, auth implementation, animation or layout was added.

Guest actions record navigation only and make no onboarding RPC call. A session
marker and expiring 24-hour browser marker retain the introduction transition
through registration/confirmation, including a confirmation link in another tab.
Cancel and explicit logout clear these markers. They grant no authenticated,
profile-completion or paid access.

After authentication, the existing server racing state is loaded first. Only a
`tutorial` state may advance to `discipline` using the existing account-bound RPC.
Complete/discipline/vehicle/plan states retain precedence. Discipline, class and
Rookie selection still must persist before landing. Failed progress persistence
does not complete onboarding. The initial session request also ignores late
results after a newer auth event or unmount.

Required flow: tutorial → Sign In → Create Account if needed → authenticated
discipline → associated class → membership (free Rookie; Pro/Teams Coming Soon)
→ landing. Completed signed-in sessions go straight to landing after splash.

## Verification

Actual main application at http://127.0.0.1:8081/, using only the existing isolated
Docker Supabase at http://127.0.0.1:54321/. The staging project ID and absence of
a remote link were validated before local Auth/data requests. No reset, migration,
production customer access, purchase, restore or payment API was used.

| Requested scenario | Evidence/result |
| --- | --- |
| A: new visitor, full tutorial/signup | All 12 slides walked on desktop; original Sign In/Create Account used; one real synthetic local signup submitted after explicit waiver confirmation; discipline → Dwarf Cars → free Rookie → landing passed |
| B: Skip | Real mobile Skip opened Sign In directly, with no extra welcome card; mounted component test covers Skip → signup → required class/plan → landing without guest RPCs |
| C: completed user signs in | Existing synthetic Rookie and Stripe Pro entered their own landing pages without choosing discipline/class/plan again |
| D: authenticated completed session | Actual reload of the new completed account returned directly to landing; mounted coverage also verifies initial completed sessions |
| E: incomplete account | Real mobile sign-in resumed saved Road Racing class selection; selected GT3, reloaded at plan step, then completed Rookie; mounted tests cover each saved unfinished step |
| F: logout/account switching | Real logout returned to original tutorial; switch from GT3/Stripe Pro to Dwarf Cars/Rookie restored the correct account/class; tests cover stale initial session and late class responses |
| G: Rookie | New desktop account and resumed mobile account completed for free; independent authenticated local membership RPC reads returned Rookie |
| H: Pro/Teams | Actual plans rendered $5/$8 and disabled Coming Soon; no purchase/restore performed; public readiness hold unchanged |
| I: existing paid account | Header and Settings showed Pro; independent local RPC returned Pro and all synthetic Stripe customer/subscription/source/plan/status fields were unchanged |
| J: web/Median | Actual desktop and 390×844 mobile web flows had no extra page or redirect loop; Median auth/picker regression tests passed; no Android/iOS binary was rebuilt or run for this fix |

The local signup authenticated immediately. Delayed email confirmation and
new-tab navigation are covered by mounted tests, not a real email delivery test.
No console errors were observed in the actual local browser flow.

- Unit regression suite: **360 passed**, zero failures/skips in the final run.
- Mounted React/disposable PostgreSQL suite: **63 passed**, zero failures/skips,
  including **45 onboarding/navigation checks**.
- TypeScript app check: **passed**.
- Vite production build: **passed**, existing large-chunk warning remains.
- Changed-source lint: AppLayout and HowOnlyFastWorks pass; AuthModal retains its
  two pre-existing explicit-any errors at unchanged lines 127/165. The baseline
  source produces those same errors. No unrelated lint cleanup was made.
- Diff whitespace/scope check: **passed**.

An initial unit run caught the existing source-regex test's old dependency list;
its assertion was updated for guest navigation state while retaining the user-ID
guard. A subsequent run concurrent with the build hit the unchanged lifecycle
test's 12ms timer assumption. The full unit suite passed without the competing
build. Production lifecycle code was not changed to accommodate that test.

## Files in the fix

1. `src/components/AppLayout.tsx` — remove extra card, guest tutorial/auth handoff,
   authoritative account resume, late initial-session guard.
2. `src/components/AuthModal.tsx` — explicit Create Account button label only.
3. `src/components/HowOnlyFastWorks.tsx` — optional guest Skip label; original
   screens, styling, animations and navigation preserved.
4. `tests/onboardingNavigation.mjs` — guest/auth/signup/resume/logout/race coverage.
5. `tests/medianPickerLifecycle.test.ts` — update bootstrap dependency assertion.
6. `docs/STARTUP_ONBOARDING_FIX_REVIEW.md` — this report.

## Release readiness and limits

Ready for a small web-only review/release with the existing lint warning noted.
No new migration, secret or Edge Function is required. Stripe/RevenueCat/backend
files, memberships, racing catalogs/setup sheets, native readiness hold and
Median binaries are unchanged. No unfinished native/staging source is included.

The earlier production Supabase Git integration history mismatch is outside
this fix and has not been repaired. A future web release should account for that
known external check; it does not authorize migrations or history changes.

Stop here for review. Do not push or deploy until separately authorized. A web
rollback needs only the prior frontend deployment/commit, never subscription
record or schema changes.
