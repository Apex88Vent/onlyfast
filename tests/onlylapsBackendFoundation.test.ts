import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationUrl = new URL(
  '../supabase/migrations/202607280002_onlyfast_onlylaps_backend_foundation.sql',
  import.meta.url,
);
const sql = readFileSync(migrationUrl, 'utf8');

test('session links enforce same-owner parent relationships and reject duplicate pairs', () => {
  assert.match(
    sql,
    /foreign key \(onlyfast_session_id, user_id\)[\s\S]*references public\.race_setups \(id, user_id\)/i,
  );
  assert.match(
    sql,
    /foreign key \(onlylaps_session_id, user_id\)[\s\S]*references public\.onlylaps_timing_sessions \(id, user_id\)/i,
  );
  assert.match(sql, /unique \(onlyfast_session_id, onlylaps_session_id\)/i);
});

test('both new tables have owner-only RLS for every write and read operation', () => {
  for (const table of [
    'onlyfast_onlylaps_session_links',
    'onlylaps_session_analysis',
  ]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
    );

    for (const operation of ['select', 'insert', 'update', 'delete']) {
      assert.match(
        sql,
        new RegExp(
          `create policy [\\s\\S]*?on public\\.${table}[\\s\\S]*?for ${operation}[\\s\\S]*?auth\\.uid\\(\\) = (?:${table}\\.)?user_id`,
          'i',
        ),
      );
    }
  }

  assert.match(
    sql,
    /create policy onlyfast_onlylaps_links_insert_own[\s\S]*?from public\.race_setups[\s\S]*?from public\.onlylaps_timing_sessions/i,
  );
  assert.match(
    sql,
    /create policy onlylaps_session_analysis_insert_own[\s\S]*?from public\.onlylaps_timing_sessions/i,
  );
});

test('permanent analysis storage covers the required structured observations', () => {
  for (const column of [
    'summary_text',
    'summary_json',
    'driving_observations',
    'corner_observations',
    'sector_observations',
    'consistency_observations',
    'braking_observations',
    'acceleration_observations',
    'lateral_grip_observations',
    'line_trajectory_observations',
    'setup_relevant_observations',
    'optimum_lap_time_ms',
    'optimum_lap',
    'analysis_version',
    'model_used',
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'));
  }
});

test('migration does not alter telemetry source or public share objects', () => {
  assert.doesNotMatch(sql, /alter table public\.onlylaps_(lap_times|telemetry_samples|track_maps)\b/i);
  assert.doesNotMatch(sql, /onlylaps_resolve_telemetry_share\s*\(/i);
  assert.doesNotMatch(sql, /onlylaps_telemetry_shares/i);
});
