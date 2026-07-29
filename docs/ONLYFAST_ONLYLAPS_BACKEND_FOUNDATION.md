# OnlyFast ↔ OnlyLaps backend foundation

Schema inspection date: 2026-07-28.

This change is database plumbing only. It does not connect any OnlyFast screen,
Setup Assist request, OnlyLaps screen, or public telemetry-share flow to the new
tables.

## Existing deployed model

The shared Supabase project's deployed REST schema and both codebases were
inspected before writing the migration.

### OnlyFast

- `public.race_schedule` stores a user's scheduled race dates/weekends.
- `public.race_setups` is the durable individual-session table as well as the
  saved-setup table. Each Hot Laps, Heat, Main Event, or extra session is a
  separate row with its own UUID and `user_id`.
- A race weekend is currently a logical grouping rather than a parent table.
  Current code groups session rows primarily by `track_name + race_date`, with
  `setup_name` as the fallback for legacy/incomplete rows.
- Session identity/order is represented by `setup_type`, `session_label`, and
  `session_order`. Timing-screen data owned by OnlyFast remains in the
  `timing_data` JSONB column on that same row.

The integration therefore uses `public.race_setups.id` as
`onlyfast_session_id`; it does not create a second OnlyFast session model.

### OnlyLaps

The deployed shared project currently exposes:

- `public.onlylaps_timing_sessions`: timing-session parent rows, owned by
  `user_id`.
- `public.onlylaps_lap_times`: lap rows linked through `timing_session_id`.
- `public.onlylaps_telemetry_samples`: authoritative raw/derived sample rows
  linked through `timing_session_id`.
- `public.onlylaps_track_maps`: track/map rows linked from timing sessions by
  `track_map_id`.

OnlyLaps remains the telemetry source of truth. None of these telemetry tables
are copied or changed by this foundation migration.

## Existing analysis storage

The deployed schema had no `onlylaps_session_analysis` table and no AI-analysis
columns on `onlylaps_timing_sessions`.

The OnlyLaps `POST /api/lap-insights` route calls OpenAI and returns only a
`summary` string. `LapAiSummary` holds that string in React component state.
There was no Supabase insert/update for that AI output, so it was not
permanently retrievable.

The OnlyLaps codebase also contains a newer, not-yet-reflected-in-the-deployed-
schema migration that adds `corner_definitions`, `corner_analysis`,
`corner_detection_version`, and `corner_analysis_version` to
`onlylaps_timing_sessions`. That is versioned deterministic corner computation,
not storage of the OpenAI narrative. This foundation preserves it and keeps AI
analysis in a separate table.

## Added database objects

Migration:
`supabase/migrations/202607280002_onlyfast_onlylaps_backend_foundation.sql`

### `public.onlyfast_onlylaps_session_links`

Stores private links between a specific `race_setups` row and a specific
`onlylaps_timing_sessions` row. The unique session pair prevents duplicate
links while allowing a race weekend to have any number of linked OnlyLaps
sessions across its individual OnlyFast session rows.

Ownership is enforced twice:

1. Composite foreign keys require the link's `user_id` to match the
   `race_setups` owner and the `onlylaps_timing_sessions` owner. This also
   protects writes performed by a privileged backend that bypasses RLS.
2. SELECT, INSERT, UPDATE, and DELETE RLS policies require
   `auth.uid() = user_id`.

Anonymous access is revoked.

### `public.onlylaps_session_analysis`

Stores one permanent analysis row per OnlyLaps session and
`analysis_version`. It supports:

- text and structured overall summaries;
- driving, corner, sector, consistency, braking, acceleration, lateral-grip,
  line/trajectory, and setup-relevant observations;
- optimum lap time in milliseconds and structured optimum-lap details;
- the analysis version and model used.

Its composite foreign key guarantees that the analysis owner is the timing
session owner, including for privileged writes. Owner-only CRUD RLS is enabled
and anonymous access is revoked.

The migration creates the durable storage target only. It intentionally does
not change the existing OnlyLaps runtime AI route or write current UI-generated
summaries into this table.

## Deployment

Apply the migration to the shared Supabase project through the normal migration
pipeline. If applying manually, run the complete migration in the Supabase SQL
Editor.

No frontend deployment or feature flag is needed for this step. Until a later
server-side writer/reader is deliberately connected, both new tables remain
dormant and current OnlyFast/OnlyLaps behavior is unchanged.

After deployment, refresh the Supabase schema cache if the new tables do not
appear immediately in generated API tooling.

## Existing-schema caveat

The deployed schema snapshot did not yet contain several newer OnlyLaps
migration fields, including the local corner-analysis columns. The foundation
migration depends only on the already-deployed core table and ownership columns,
so it does not require those pending OnlyLaps migrations and does not conflict
with applying them later.
