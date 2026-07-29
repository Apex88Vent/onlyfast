# OnlyLaps Setup Context reader

Status: still intentionally disconnected from Setup Assist. The beta
session-linking UI uses the separate `manage-onlylaps-session-link` endpoint;
it does not call this full telemetry reader.

## Server interface

Supabase Edge Function:

`get-onlylaps-setup-context`

Authenticated request:

```json
{
  "onlyfast_session_id": "public.race_setups UUID"
}
```

An owned OnlyFast session without a link returns HTTP 200:

```json
{
  "schema_version": "onlyfast_onlylaps_setup_context_v1",
  "linked": false,
  "onlyfast_session_id": "..."
}
```

Malformed IDs return HTTP 400. Missing, unowned, mismatched, or broken linked
sessions all return the same generic HTTP 404 response so record existence is
not disclosed. More than one link is treated as an HTTP 409 integrity error;
the reader never chooses a link by timestamp.

## Exact linked response shape

Nullable fields remain `null`; missing structured categories remain empty
arrays. No raw telemetry sample or trace array is present.

```ts
{
  schema_version: "onlyfast_onlylaps_setup_context_v1";
  linked: true;
  onlyfast_session_id: string;
  link: {
    id: string;
    method: string;
    match_confidence: number | null;
  };
  session: {
    onlylaps_session_id: string;
    track_map_id: string | null;
    track_name: string | null;
    track_type: string | null;
    track_shape: string | null;
    track_length: string | null;
    vehicle_name: string | null;
    session_type: string;
    session_date: string | null;
    started_at: string | null;
    ended_at: string | null;
    duration_ms: number | null;
    recorded_lap_count: number;
    valid_lap_count: number;
    excluded_lap_count: number;
    weather: JSONValue;
  };
  lap_performance: {
    fastest_lap_ms: number | null;
    average_lap_ms: number | null;
    median_lap_ms: number | null;
    optimum_lap_ms: number | null;
    lap_time_spread_ms: number | null;
  };
  speed: {
    maximum_mph: number | null;
    average_lap_mph: number | null;
    minimum_optimum_corner_mps: number | null;
  };
  g_force: {
    convention: "vehicle_braking_positive_v2";
    max_abs_lateral_g: number | null;
    max_abs_longitudinal_g: number | null;
    max_acceleration_g: number | null;
    max_braking_g: number | null;
  };
  sectors: Array<{
    sector_index: number;
    best_duration_ms: number;
    source_lap_id: string | null;
    source_lap_number: number | null;
    source_definition_version: number | null;
    source_kind: string | null;
    source:
      | "onlylaps_lap_sector_times"
      | "onlylaps_session_analysis";
  }>;
  corners: Array<{
    corner_number: number;
    sector_index: number | null;
    source_lap_id: string | null;
    source_lap_number: number | null;
    entry_speed_mps: number | null;
    minimum_speed_mps: number | null;
    exit_speed_mps: number | null;
    corner_time_ms: number | null;
    time_delta_ms: number | null;
    comparison: {
      entry_speed_delta_mph: number | null;
      minimum_speed_delta_mph: number | null;
      exit_speed_delta_mph: number | null;
      entry_time_delta_ms: number | null;
      apex_time_delta_ms: number | null;
      exit_time_delta_ms: number | null;
    } | null;
    lateral_g: {
      maximum_delta: number | null;
      average_delta: number | null;
    } | null;
    trajectory: JSONValue;
    possible_scrub: JSONValue;
    confidence: JSONValue;
    observation: string | null;
  }>;
  ai_analysis: {
    summary: string | null;
    summary_data: JSONObject | null;
    driving_observations: JSONValue[];
    corner_observations: JSONValue[];
    sector_observations: JSONValue[];
    consistency_observations: JSONValue[];
    braking_observations: JSONValue[];
    acceleration_observations: JSONValue[];
    grip_observations: JSONValue[];
    trajectory_observations: JSONValue[];
    setup_relevant_observations: JSONValue[];
    optimum_lap_time_ms: number | null;
    optimum_lap: JSONObject | null;
    analysis_version: string | null;
    model_used: string | null;
    generated_at: string | null;
    updated_at: string | null;
  };
}
```

`average_speed` and `max_speed` in the deployed OnlyLaps lap table are stored
in mph, so the response names those units explicitly. Persisted optimum-corner
speeds are in m/s and are also named explicitly.

## Metric sources

Calculated from authoritative OnlyLaps rows:

- valid, recorded, and excluded lap counts;
- fastest, rounded average, median, and spread of valid `duration_ms` values;
- session duration from `started_at` and `ended_at`;
- maximum speed and mean of available per-lap average speeds;
- maximum absolute lateral/longitudinal G and the split acceleration/braking
  maxima already derived by OnlyLaps;
- best valid sector per index and optimum-lap sum from
  `onlylaps_lap_sector_times`.

The reader follows OnlyLaps' stored G-force convention. Older sessions are
normalized with the same acceleration/braking swap OnlyLaps applies when
`device_info.gForceConvention` is not `vehicle_braking_positive_v2`.

Read from the current `onlylaps_session_analysis` row:

- summary text and compact `summary_json`;
- every structured observation category without filling empty categories;
- model and version metadata;
- persisted optimum-lap details;
- optimum sector fallback when no sector-result rows exist;
- absolute optimum-corner values, corner comparison deltas, lateral-G
  differences, trajectory heuristics, scrub heuristic, and confidence.

Currently unavailable values remain null/empty. In particular, the reader does
not derive session-wide consistency, braking interpretation, acceleration
interpretation, setup recommendations, or absolute corner measurements that
OnlyLaps has not persisted.

## Validity rules

Only rows with `onlylaps_lap_times.is_valid = true` participate in metrics.
Sector rows must also have `is_valid = true` and belong to one of those valid
laps. This excludes caution/outlier laps already rejected by OnlyLaps.
Physically deleted lap rows are naturally absent and cannot reappear.

When sector-result rows exist, they are authoritative. The optimum lap is
returned only when every configured sector index has a valid best result. The
analysis optimum is used only as the fallback for older/partial sessions with
no sector-result rows.

## Security and query plan

The Edge Function has JWT verification enabled and also calls
`auth.getUser(token)`. It derives `user_id` only from that verified user.

Service-role reads are explicitly filtered by that user for:

- `race_setups`;
- `onlyfast_onlylaps_session_links`;
- `onlylaps_timing_sessions`;
- `onlylaps_lap_times`;
- `onlylaps_lap_sector_times`;
- `onlylaps_session_analysis`.

The pure service rechecks all returned IDs and owners before normalization, so
a faulty or malicious adapter also fails closed. A referenced track map is
returned only when it is globally active or owned/created by the authenticated
user.

After the owned OnlyFast row, link, and OnlyLaps session are verified, the
track, compact lap rows, sector rows, and current analysis are loaded in
parallel. The reader performs no N+1 queries and never queries
`onlylaps_telemetry_samples`.

The analysis lookup is pinned to:

`analysis_version = onlylaps_lap_insights_v1`

## Deployment

The one-to-one relationship is enforced by:

`supabase/migrations/202607280004_onlyfast_onlylaps_session_linking.sql`

After applying that migration, redeploy `get-onlylaps-setup-context` so its
zero/one/many integrity behavior is active. Keep JWT verification enabled.

OnlyLaps now merges the structured categories for its persisted analysis row,
so the earlier whole-row-overwrite caveat is resolved. Setup Assist remains
deliberately disconnected.
