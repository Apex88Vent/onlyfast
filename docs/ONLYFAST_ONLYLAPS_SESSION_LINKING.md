# OnlyFast ↔ OnlyLaps beta session linking

Implementation date: 2026-07-28.

## Scope and feature gate

This is the first user-facing OnlyFast ↔ OnlyLaps feature, but it is available
only to the existing experimental test account. It reuses:

`test_account_full_access`

The client requires both the enabled flag and `tester_kind = experimental`.
The `manage-onlylaps-session-link` Edge Function independently verifies the
JWT, authenticated user, beta account master switch, tester kind, and the same
feature flag. A production user cannot reveal the UI or bypass the gate by
calling the endpoint directly.

No Setup Assist component, prompt, model call, limit, or recommendation path
uses OnlyLaps data in this change.

## Cardinality and migration safety

Migration:

`supabase/migrations/202607280004_onlyfast_onlylaps_session_linking.sql`

The relationship is now one-to-one:

- one `public.race_setups.id` has at most one OnlyLaps timing session;
- one `public.onlylaps_timing_sessions.id` has at most one OnlyFast session;
- the existing unique-pair constraint remains;
- the existing composite same-owner foreign keys and RLS policies remain.

Before creating either unique index, the migration locks the link table and
audits both sides. Any duplicate causes the migration to abort with the
conflicting session and link IDs. It never deletes or rewrites a conflicting
row.

The live shared project was checked immediately before implementation:

- total existing links: `0`;
- duplicate OnlyFast session IDs: none;
- duplicate OnlyLaps session IDs: none.

Authenticated browser roles retain owner-scoped SELECT but lose direct
INSERT/UPDATE/DELETE privileges. Only service-role RPCs, called from the
beta-gated Edge Function, can mutate a link.

## Picker and ranking behavior

The compact card is in the saved individual-session area of
`SetupDashboard`, immediately below the active session header/actions. Unsaved
work has no `race_setups.id`, so the card appears after the individual session
has been saved.

The first query loads at most 25 owned timing sessions within three calendar
days of the OnlyFast race date. A service-role-only database aggregate returns
one compact lap-count/fastest-lap row per timing session. The picker never
queries `onlylaps_telemetry_samples`.

Candidates show:

- current custom `session_name`, queried dynamically;
- a local-time `Session — time` fallback for historical unnamed sessions;
- track;
- session date/time;
- lap count;
- fastest valid lap;
- whether the session is already linked.

The ranking score uses only suggestion hints:

- same race date: 60;
- within one day: 25;
- within three days: 10;
- normalized exact track: 35;
- safe partial normalized track: 22;
- matching session label/type: 15.

A suggestion is displayed only when the best eligible candidate scores at
least 90 and leads the next candidate by at least 15 points. Multiple
reasonable candidates are marked ambiguous and never linked automatically.
The user can open the picker and page through all other owned sessions.

These values do not form the relationship. After confirmation, the immutable
`race_setups.id` and `onlylaps_timing_sessions.id` are authoritative.

## Link, change, and unlink

Edge Function:

`manage-onlylaps-session-link`

Authenticated POST actions:

- `list`: owned candidates, current link, ranking, and already-linked state;
- `link`: atomically inserts a new link or replaces the existing link for the
  OnlyFast session;
- `unlink`: deletes only the association.

Link/change verifies that the authenticated user owns both parent session
rows. Unlink verifies ownership of the OnlyFast parent. The second unique index
prevents an OnlyLaps timing session from being attached to another OnlyFast
session.

Unlink never deletes either session, lap rows, telemetry, analysis, or public
shares.

## Rename safety

OnlyFast `session_label` and OnlyLaps `session_name` are queried for display and
ranking only. Link writes and reads use the two UUID foreign keys. Tests rename
both labels after linking and prove that the original UUID pair remains
unchanged while the current custom name is displayed on the next read.

## Deployment

Deploy in this order:

1. Apply
   `supabase/migrations/202607280004_onlyfast_onlylaps_session_linking.sql`.
2. Deploy the `manage-onlylaps-session-link` Edge Function with JWT
   verification enabled.
3. Redeploy `get-onlylaps-setup-context` with JWT verification enabled because
   its link-integrity behavior changed.
4. Deploy the OnlyFast frontend through its normal GitHub/hosting pipeline.

The shared TypeScript files are bundled automatically when their Edge
Functions are deployed. They are not SQL and must not be pasted into the SQL
Editor.

No OpenAI secret or Setup Assist deployment change is required.
