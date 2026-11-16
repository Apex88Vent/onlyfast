# Track Trace Phase 2B refinements and independent preparation

Follow-up: [Phase 2D live recording and scanning](ONLYFAST_2027_TRACK_TRACE_PHASE2D.md)
supersedes this report's earlier recording/scanning availability statements.

November 14, 2026. Primary checkout, `develop/onlyfast-2027`.
Incremental follow-up to [Phase 2B](ONLYFAST_2027_TRACK_TRACE_PHASE2B.md).

## Interface changes

The existing six Home actions retain their layout, labels and handlers. Their
existing card, label and icon styles now live in `homeActionStyles.ts` and are
also used by the full-width Track Trace entry. The icon uses the same responsive
32/40/64 px sizes, stroke width 2.2 and container alignment. Horizontal and
vertical padding match. The BETA badge and Sportsman lock message fit inside
the card; the existing upgrade and historical-view paths are preserved.

The telemetry card spans both grid columns and their normal gap. A scoped
ResizeObserver mirrors the rendered Setup Library card height into a CSS custom
property, accounting for standard-card text wrapping without resizing the six
original actions. Shared minimum dimensions remain the fallback. At seven tested
widths, the telemetry and reference heights match exactly:

| Viewport width | Reference / telemetry height | Full grid / telemetry width |
| --- | --- | --- |
| 320 px | 78 / 78 px | 288 / 288 px |
| 360 px | 78 / 78 px | 328 / 328 px |
| 390 px | 78 / 78 px | 358 / 358 px |
| 640 px | 219 / 219 px | 608 / 608 px |
| 768 px | 200 / 200 px | 736 / 736 px |
| 1024 px | 200 / 200 px | 992 / 992 px |
| 1280 px | 200 / 200 px | 1024 / 1024 px |

## BETA comparison

**The badges did not match before correction.** Track Trace used the generic
`info` badge: primary theme colors, a 30% border, fully rounded shape, 10 px
semibold text and 8 px horizontal padding. The Pavement Oval / Road Racing
labels in both `OnboardingFlow.tsx` and `ClassChangeModal.tsx` use:

`inline-flex align-middle rounded border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#00A8E8]`.

Track Trace now uses those exact visual classes: 10% cyan background, cyan text,
20% cyan border, 9 px bold typography, the same rounded corners and 6/2 px
horizontal/vertical padding. Only external spacing/flex-shrink behavior differs
by placement. A test compares the class sets directly against both discipline
sources. `TRACK_TRACE_CONFIG.beta` still centrally controls the badge and notice.
The existing discipline components were not edited.

## Preparation paths and track selection

Start Session presents **Link to Existing Setup** and **Record Without Setup**.
The first selects an eligible saved exact setup-session row, using the existing
summary, permission and creation workflow. The second needs no setup and saves
an authenticated owner's independent circuit session.

Both paths offer **Saved circuit track** and **Free Record**. The saved-track
choice embeds the existing paged Track Library, including map name, version,
length where supplied, start/finish, sector and incomplete-data information.
Selecting an owned map keeps the preparation form mounted and retains its typed
session name. Changing back to Free Record clears `track_map_id`. Selection
callbacks return the existing map object for metadata display; authorization is
still determined by the server, never by the displayed metadata or URL.

Free Record uses the established null map convention and fixed `practice`
circuit type. It does not enable open routes or Gumball. The wording explicitly
states that GPS recording is unavailable. The original one-fix GPS availability
check remains available; no location watch or timing engine was added.

## Small testing-only database extension

Applied only to verified testing project `mfzajhnfonrfuiwxgvhe`:
`supabase/testing-2027/20261114152935_track_trace_independent_preparation.sql`.

The existing SECURITY INVOKER `create_track_trace_session(uuid,text,uuid)`
previously required a setup row. Its existing body is patched after name/access
validation: a null setup ID inserts an owned `practice` timing-session row and
returns its ID. Non-null setup IDs follow the original branch unchanged.

The extension preserves the installed authorization guard, search path, grants,
RLS, name validation and linked-session restrictions. It creates no table,
overload, entitlement resolver or fake setup. No laps, samples or start/end
timestamps are supplied. Existing RLS rejects foreign or open-route maps and
unpaid writes. The migration checks the isolated environment marker and expected
source anchor and refuses unexpected source drift.

Independent sessions appear in the existing Review Session library and existing
link picker. Later linking uses the exact `race_setups.id` and original
`onlyfast_onlylaps_session_links`, set/unlink functions and one-to-one rules.
Preparing an unlinked shell creates no association or inferred match.

The extension was tested with the installed Phase 1C schema, after history/archive
policies, and before the separately reviewed atomic archive installation. All
three orders retain authorization and later exact-session linking. Archive
sources/artifacts were not edited or installed by this task.

## Verification

- Final full regression: **769 passed, 0 failed, 0 skipped**. Report:
  `tmp/qa-automation/2026-11-14T17-27-09.645Z-1e8d0b33-7196-4ae1-8dff-30df58193d3f/report.json`.
- New database suite: **15 passed** across three installation orders. Covers
  durable ownership, no manufactured setup/link/laps/samples, saved/free maps,
  private/open-route rejection, invalid names, Pro/Factory, Sportsman/anonymous
  denial, review history, exact later linking and original linked preparation.
- Component browser suite: all **seven widths** above; both paid tiers,
  Sportsman upgrade/readability, exact dimensions/padding/icon strokes, both
  preparation paths, saved/free selection, draft name preservation, independent
  review, existing linking/save isolation, menu navigation, GPS denied state,
  shared pending state and unchanged View Shared Setup. No JS errors or external
  requests. Screenshots inspected at mobile widths.
- App/node TypeScript, focused feature/Home ESLint, isolated testing Preview
  build and `git diff --check` pass. The existing large-bundle warning remains.
- Hosted verifier: **21 grouped checks passed**, including 12 real testing
  browser traversals across three tiers/four viewports, real independent
  mapped/free preparation, original linked preparation/review and exact later
  linking. The final matrix waits for initial membership loading and establishes
  each expected synthetic test tier before its context. Earlier interrupted or
  timing-sensitive runs are not counted as passes.
  Fixtures and five orphan weekend records were cleaned up, original test tiers
  restored. The testing-only operator removed the exact disposable map because
  authenticated DELETE was filtered by existing policy; policies were retained.
  Report: `tmp/track-trace-refinements/hosted/hosted.json`.

The testing backend began exposing the richer history-aware permission contract
during verification. The verifier now tests `can_record` independently from
`allowed`/`can_read_history`, preserving owned Sportsman historical reads while
denying preparation and link mutations. The null-setup branch and the installed
`require_track_trace_write_2027` guard were independently confirmed present.
This task did not activate the archive integration.

Advisor counts immediately before/after this extension were unchanged (8 INFO,
14 function WARN, 1 password WARN). The final testing schema snapshot is 11 INFO,
13 function WARN, 1 password WARN; broader testing schema changes occurred during
the run. No new public SECURITY DEFINER function or policy is introduced here.
Evidence: `tmp/track-trace-refinements/advisors.json`. Existing guidance:
[RLS notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[function notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Preview, remaining dependencies and files

Local built preview: <http://127.0.0.1:4192/track-trace?view=start>.
Home: <http://127.0.0.1:4192/app>. Testing login required.

Live recording, scanning, replay/comparisons and shared telemetry still need the
reviewed OnlyLaps adapters/backend identified in the Phase 2B audit. Preparation
does not start recording. No physical-device GPS validation is claimed. The
existing testing AI provider/deployment dependency is unchanged.

Files changed in this refinement:

- `src/components/HomeLanding.tsx`, new `homeActionStyles.ts`.
- `src/features/track-trace/{TrackTraceEntry,TrackTraceBeta,TrackTracePage,TrackTraceLibrary}.tsx`.
- New testing-only migration listed above.
- New `tests/trackTraceIndependentPreparation.test.ts`.
- `tests/trackTraceNavigation.test.ts`, `tests/trackTracePhase2bUI.test.ts`.
- `tests/rookieAdPages.test.ts` and `tests/onboardingNavigation.mjs`: bind the
  real shared styles into existing isolated fixtures; assertions retained.
- `qa/automation/track-trace-navigation.mjs`, `qa/automation/track-trace-hosted.mjs`.
- This report and links/status notes in the existing Track Trace documents.

Preexisting local changes, archive work and recovery files were preserved.
No commit, push, merge, production deployment/database operation, live billing
change, standalone OnlyLaps edit or new hosted frontend deployment was performed.
