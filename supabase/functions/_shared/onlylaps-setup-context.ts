export const ONLYLAPS_SETUP_CONTEXT_SCHEMA_VERSION =
  'onlyfast_onlylaps_setup_context_v1';
export const CURRENT_ONLYLAPS_ANALYSIS_VERSION = 'onlylaps_lap_insights_v1';

type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface OnlyFastSessionRow {
  id: string;
  user_id: string;
}

export interface OnlyFastOnlyLapsLinkRow {
  id: string;
  user_id: string;
  onlyfast_session_id: string;
  onlylaps_session_id: string;
  link_method: string;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface OnlyLapsTimingSessionRow {
  id: string;
  user_id: string;
  track_map_id: string | null;
  name: string;
  session_name?: string | null;
  vehicle_name: string | null;
  session_type: string;
  started_at: string | null;
  ended_at: string | null;
  weather: unknown;
  device_info: unknown;
}

export interface OnlyLapsTrackMapRow {
  id: string;
  user_id: string | null;
  created_by: string | null;
  is_active: boolean;
  name: string | null;
  track_name: string | null;
  track_type: string | null;
  track_shape: string | null;
  track_length: string | null;
}

export interface OnlyLapsLapRow {
  id: string;
  user_id: string;
  timing_session_id: string;
  lap_number: number;
  duration_ms: number;
  sector_times_ms: unknown;
  is_valid: boolean;
  excluded_reason: string | null;
  average_speed: number | null;
  max_speed: number | null;
  max_lateral_g: number | null;
  max_longitudinal_g: number | null;
  max_accel_g: number | null;
  max_braking_g: number | null;
}

export interface OnlyLapsSectorRow {
  lap_id: string;
  timing_session_id: string;
  user_id: string;
  sector_index: number;
  duration_ms: number | null;
  is_valid: boolean;
  source_definition_version: number | null;
  source_kind: string | null;
}

export interface OnlyLapsAnalysisRow {
  id: string;
  session_id: string;
  user_id: string;
  summary_text: string | null;
  summary_json: unknown;
  driving_observations: unknown;
  corner_observations: unknown;
  sector_observations: unknown;
  consistency_observations: unknown;
  braking_observations: unknown;
  acceleration_observations: unknown;
  lateral_grip_observations: unknown;
  line_trajectory_observations: unknown;
  setup_relevant_observations: unknown;
  optimum_lap_time_ms: number | null;
  optimum_lap: unknown;
  analysis_version: string;
  model_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreResult<T> {
  data: T;
  error: string | null;
}

export interface OnlyLapsSetupContextStore {
  findOwnedOnlyFastSession(
    sessionId: string,
    userId: string,
  ): Promise<StoreResult<OnlyFastSessionRow | null>>;
  listOwnedLinks(
    onlyfastSessionId: string,
    userId: string,
  ): Promise<StoreResult<OnlyFastOnlyLapsLinkRow[]>>;
  findOwnedOnlyLapsSession(
    sessionId: string,
    userId: string,
  ): Promise<StoreResult<OnlyLapsTimingSessionRow | null>>;
  findTrackMap(
    trackMapId: string,
  ): Promise<StoreResult<OnlyLapsTrackMapRow | null>>;
  listOwnedLaps(
    sessionId: string,
    userId: string,
  ): Promise<StoreResult<OnlyLapsLapRow[]>>;
  listOwnedSectorRows(
    sessionId: string,
    userId: string,
  ): Promise<StoreResult<OnlyLapsSectorRow[]>>;
  findOwnedAnalysis(
    sessionId: string,
    userId: string,
    analysisVersion: string,
  ): Promise<StoreResult<OnlyLapsAnalysisRow | null>>;
}

export type NormalizedSectorContext = {
  sector_index: number;
  best_duration_ms: number;
  source_lap_id: string | null;
  source_lap_number: number | null;
  source_definition_version: number | null;
  source_kind: string | null;
  source: 'onlylaps_lap_sector_times' | 'onlylaps_session_analysis';
};

export type NormalizedCornerContext = {
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
  trajectory: JsonValue;
  possible_scrub: JsonValue;
  confidence: JsonValue;
  observation: string | null;
};

export type OnlyLapsSetupContext =
  | {
      schema_version: typeof ONLYLAPS_SETUP_CONTEXT_SCHEMA_VERSION;
      linked: false;
      onlyfast_session_id: string;
    }
  | {
      schema_version: typeof ONLYLAPS_SETUP_CONTEXT_SCHEMA_VERSION;
      linked: true;
      onlyfast_session_id: string;
      link: {
        id: string;
        method: string;
        match_confidence: number | null;
      };
      session: {
        onlylaps_session_id: string;
        display_name: string;
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
        weather: JsonValue;
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
        convention: 'vehicle_braking_positive_v2';
        max_abs_lateral_g: number | null;
        max_abs_longitudinal_g: number | null;
        max_acceleration_g: number | null;
        max_braking_g: number | null;
      };
      sectors: NormalizedSectorContext[];
      corners: NormalizedCornerContext[];
      ai_analysis: {
        summary: string | null;
        summary_data: JsonObject | null;
        driving_observations: JsonValue[];
        corner_observations: JsonValue[];
        sector_observations: JsonValue[];
        consistency_observations: JsonValue[];
        braking_observations: JsonValue[];
        acceleration_observations: JsonValue[];
        grip_observations: JsonValue[];
        trajectory_observations: JsonValue[];
        setup_relevant_observations: JsonValue[];
        optimum_lap_time_ms: number | null;
        optimum_lap: JsonObject | null;
        analysis_version: string | null;
        model_used: string | null;
        generated_at: string | null;
        updated_at: string | null;
      };
    };

export type OnlyLapsSetupContextErrorCode =
  | 'invalid_session_id'
  | 'onlyfast_session_not_found'
  | 'ownership_mismatch'
  | 'linked_session_not_found'
  | 'integrity_error'
  | 'data_load_failed';

export class OnlyLapsSetupContextError extends Error {
  readonly code: OnlyLapsSetupContextErrorCode;

  constructor(code: OnlyLapsSetupContextErrorCode, message: string) {
    super(message);
    this.name = 'OnlyLapsSetupContextError';
    this.code = code;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? Math.round(number) : null;
}

function nonnegativeInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? Math.round(number) : null;
}

function nonemptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[], rounded = false): number | null {
  if (values.length === 0) return null;
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;
  return rounded ? Math.round(value) : value;
}

function maximum(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  return finite.length > 0 ? Math.max(...finite) : null;
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toJsonValue(item)]),
    );
  }
  return null;
}

function jsonObject(value: unknown): JsonObject | null {
  return isRecord(value) ? (toJsonValue(value) as JsonObject) : null;
}

function observationArray(value: unknown): JsonValue[] {
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (isRecord(value)) return [toJsonValue(value)];
  return [];
}

function millisecondsFromSeconds(value: unknown): number | null {
  const seconds = finiteNumber(value);
  return seconds === null ? null : Math.round(seconds * 1000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function sessionDurationMs(
  startedAt: string | null,
  endedAt: string | null,
): number | null {
  if (!startedAt || !endedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? end - start
    : null;
}

function getCurrentGForceValues(
  session: OnlyLapsTimingSessionRow,
  laps: OnlyLapsLapRow[],
) {
  const deviceInfo = isRecord(session.device_info) ? session.device_info : {};
  const usesCurrentConvention =
    deviceInfo.gForceConvention === 'vehicle_braking_positive_v2';
  const accelerationValues = laps.map((lap) =>
    usesCurrentConvention ? lap.max_accel_g : lap.max_braking_g,
  );
  const brakingValues = laps.map((lap) =>
    usesCurrentConvention ? lap.max_braking_g : lap.max_accel_g,
  );

  return {
    convention: 'vehicle_braking_positive_v2' as const,
    max_abs_lateral_g: maximum(laps.map((lap) => lap.max_lateral_g)),
    max_abs_longitudinal_g: maximum(
      laps.map((lap) => lap.max_longitudinal_g),
    ),
    max_acceleration_g: maximum(accelerationValues),
    max_braking_g: maximum(brakingValues),
  };
}

function normalizeAnalysis(analysis: OnlyLapsAnalysisRow | null) {
  return {
    summary: nonemptyString(analysis?.summary_text),
    summary_data: jsonObject(analysis?.summary_json),
    driving_observations: observationArray(analysis?.driving_observations),
    corner_observations: observationArray(analysis?.corner_observations),
    sector_observations: observationArray(analysis?.sector_observations),
    consistency_observations: observationArray(
      analysis?.consistency_observations,
    ),
    braking_observations: observationArray(analysis?.braking_observations),
    acceleration_observations: observationArray(
      analysis?.acceleration_observations,
    ),
    grip_observations: observationArray(
      analysis?.lateral_grip_observations,
    ),
    trajectory_observations: observationArray(
      analysis?.line_trajectory_observations,
    ),
    setup_relevant_observations: observationArray(
      analysis?.setup_relevant_observations,
    ),
    optimum_lap_time_ms: nonnegativeInteger(
      analysis?.optimum_lap_time_ms,
    ),
    optimum_lap: jsonObject(analysis?.optimum_lap),
    analysis_version: nonemptyString(analysis?.analysis_version),
    model_used: nonemptyString(analysis?.model_used),
    generated_at: analysis ? nonemptyString(analysis.created_at) : null,
    updated_at: analysis ? nonemptyString(analysis.updated_at) : null,
  };
}

function analysisOptimumSectors(
  analysis: OnlyLapsAnalysisRow | null,
): NormalizedSectorContext[] {
  const optimumLap = jsonObject(analysis?.optimum_lap);
  const rawSectors = Array.isArray(optimumLap?.sectors)
    ? optimumLap.sectors
    : observationArray(analysis?.sector_observations);

  return rawSectors
    .flatMap((value): NormalizedSectorContext[] => {
      if (!isRecord(value)) return [];
      const sectorIndex = positiveInteger(
        value.sectorIndex ?? value.sector_index,
      );
      const durationMs = positiveInteger(
        value.durationMs ?? value.duration_ms,
      );
      if (sectorIndex === null || sectorIndex > 5 || durationMs === null) {
        return [];
      }
      return [
        {
          sector_index: sectorIndex,
          best_duration_ms: durationMs,
          source_lap_id: nonemptyString(
            value.sourceLapId ?? value.source_lap_id,
          ),
          source_lap_number: positiveInteger(
            value.sourceLapNumber ?? value.source_lap_number,
          ),
          source_definition_version: null,
          source_kind: null,
          source: 'onlylaps_session_analysis',
        },
      ];
    })
    .sort((first, second) => first.sector_index - second.sector_index);
}

function normalizeSectors(
  laps: OnlyLapsLapRow[],
  sectorRows: OnlyLapsSectorRow[],
  analysis: OnlyLapsAnalysisRow | null,
) {
  const validLapById = new Map(laps.map((lap) => [lap.id, lap]));
  const configuredSectorCount = Math.min(
    5,
    Math.max(
      0,
      ...sectorRows
        .map((row) => positiveInteger(row.sector_index) ?? 0)
        .filter((index) => index <= 5),
    ),
  );
  const bestBySector = new Map<number, NormalizedSectorContext>();

  sectorRows.forEach((row) => {
    const lap = validLapById.get(row.lap_id);
    const sectorIndex = positiveInteger(row.sector_index);
    const durationMs = positiveInteger(row.duration_ms);
    if (
      !lap ||
      row.is_valid !== true ||
      sectorIndex === null ||
      sectorIndex > 5 ||
      durationMs === null
    ) {
      return;
    }

    const candidate: NormalizedSectorContext = {
      sector_index: sectorIndex,
      best_duration_ms: durationMs,
      source_lap_id: lap.id,
      source_lap_number: lap.lap_number,
      source_definition_version: nonnegativeInteger(
        row.source_definition_version,
      ),
      source_kind: nonemptyString(row.source_kind),
      source: 'onlylaps_lap_sector_times',
    };
    const current = bestBySector.get(sectorIndex);
    if (
      !current ||
      candidate.best_duration_ms < current.best_duration_ms ||
      (candidate.best_duration_ms === current.best_duration_ms &&
        (candidate.source_lap_number ?? Number.MAX_SAFE_INTEGER) <
          (current.source_lap_number ?? Number.MAX_SAFE_INTEGER))
    ) {
      bestBySector.set(sectorIndex, candidate);
    }
  });

  if (sectorRows.length === 0) {
    const sectors = analysisOptimumSectors(analysis);
    const optimumLapMs =
      sectors.length > 0 &&
      sectors.every((sector, index) => sector.sector_index === index + 1)
        ? sectors.reduce(
            (total, sector) => total + sector.best_duration_ms,
            0,
          )
        : nonnegativeInteger(analysis?.optimum_lap_time_ms);
    return { sectors, optimumLapMs };
  }

  const sectors = [...bestBySector.values()].sort(
    (first, second) => first.sector_index - second.sector_index,
  );
  const complete =
    configuredSectorCount > 0 &&
    sectors.length === configuredSectorCount &&
    sectors.every((sector, index) => sector.sector_index === index + 1);
  return {
    sectors,
    optimumLapMs: complete
      ? sectors.reduce(
          (total, sector) => total + sector.best_duration_ms,
          0,
        )
      : null,
  };
}

function cornerNumber(value: Record<string, unknown>): number | null {
  return positiveInteger(value.cornerNumber ?? value.corner_number);
}

function normalizeCorners(
  analysis: OnlyLapsAnalysisRow | null,
): NormalizedCornerContext[] {
  const corners = new Map<number, NormalizedCornerContext>();
  const ensureCorner = (number: number) => {
    const existing = corners.get(number);
    if (existing) return existing;
    const created: NormalizedCornerContext = {
      corner_number: number,
      sector_index: null,
      source_lap_id: null,
      source_lap_number: null,
      entry_speed_mps: null,
      minimum_speed_mps: null,
      exit_speed_mps: null,
      corner_time_ms: null,
      time_delta_ms: null,
      comparison: null,
      lateral_g: null,
      trajectory: null,
      possible_scrub: null,
      confidence: null,
      observation: null,
    };
    corners.set(number, created);
    return created;
  };

  const optimumLap = jsonObject(analysis?.optimum_lap);
  const optimumCorners = Array.isArray(optimumLap?.cornerContexts)
    ? optimumLap.cornerContexts
    : [];
  optimumCorners.forEach((value) => {
    if (!isRecord(value)) return;
    const number = cornerNumber(value);
    if (number === null) return;
    const corner = ensureCorner(number);
    corner.sector_index = positiveInteger(
      value.sectorIndex ?? value.sector_index,
    );
    corner.source_lap_id = nonemptyString(
      value.sourceLapId ?? value.source_lap_id,
    );
    corner.source_lap_number = positiveInteger(
      value.sourceLapNumber ?? value.source_lap_number,
    );
    corner.entry_speed_mps = finiteNumber(
      value.entrySpeedMps ?? value.entry_speed_mps,
    );
    corner.minimum_speed_mps = finiteNumber(
      value.minimumSpeedMps ?? value.minimum_speed_mps,
    );
    corner.exit_speed_mps = finiteNumber(
      value.exitSpeedMps ?? value.exit_speed_mps,
    );
    corner.corner_time_ms = millisecondsFromSeconds(
      value.cornerTimeSeconds ?? value.corner_time_seconds,
    );
    corner.time_delta_ms = millisecondsFromSeconds(
      value.timeDeltaVsFastestSeconds ??
        value.time_delta_vs_fastest_seconds,
    );
    corner.trajectory = toJsonValue(
      value.lineClassification ?? value.line_classification ?? null,
    );
  });

  observationArray(analysis?.corner_observations).forEach((value) => {
    if (!isRecord(value)) return;
    const number = cornerNumber(value);
    if (number === null) return;
    const corner = ensureCorner(number);
    const measured = isRecord(value.measuredDeltas)
      ? value.measuredDeltas
      : isRecord(value.measured_deltas)
        ? value.measured_deltas
        : {};
    const heuristics = isRecord(value.derivedHeuristics)
      ? value.derivedHeuristics
      : isRecord(value.derived_heuristics)
        ? value.derived_heuristics
        : {};
    const comparison = {
      entry_speed_delta_mph: finiteNumber(measured.entrySpeedDeltaMph),
      minimum_speed_delta_mph: finiteNumber(
        measured.minimumSpeedDeltaMph,
      ),
      exit_speed_delta_mph: finiteNumber(measured.exitSpeedDeltaMph),
      entry_time_delta_ms: millisecondsFromSeconds(
        measured.entryTimeDeltaSeconds,
      ),
      apex_time_delta_ms: millisecondsFromSeconds(
        measured.apexTimeDeltaSeconds,
      ),
      exit_time_delta_ms: millisecondsFromSeconds(
        measured.exitTimeDeltaSeconds,
      ),
    };
    corner.comparison = Object.values(comparison).some(
      (item) => item !== null,
    )
      ? comparison
      : null;
    corner.time_delta_ms =
      millisecondsFromSeconds(measured.cornerTimeDeltaSeconds) ??
      corner.time_delta_ms;
    const lateralG = {
      maximum_delta: finiteNumber(measured.maximumLateralGDelta),
      average_delta: finiteNumber(measured.averageLateralGDelta),
    };
    corner.lateral_g = Object.values(lateralG).some(
      (item) => item !== null,
    )
      ? lateralG
      : corner.lateral_g;
    if (heuristics.lineDifference !== undefined) {
      corner.trajectory = toJsonValue(heuristics.lineDifference);
    }
    if (heuristics.possibleScrub !== undefined) {
      corner.possible_scrub = toJsonValue(heuristics.possibleScrub);
    }
    if (heuristics.confidence !== undefined) {
      corner.confidence = toJsonValue(heuristics.confidence);
    }
    corner.observation =
      nonemptyString(value.observation) ??
      nonemptyString(value.summary) ??
      nonemptyString(value.interpretation) ??
      corner.observation;
  });

  observationArray(analysis?.lateral_grip_observations).forEach((value) => {
    if (!isRecord(value)) return;
    const number = cornerNumber(value);
    if (number === null) return;
    const corner = ensureCorner(number);
    corner.lateral_g = {
      maximum_delta:
        finiteNumber(value.maximumLateralGDelta) ??
        corner.lateral_g?.maximum_delta ??
        null,
      average_delta:
        finiteNumber(value.averageLateralGDelta) ??
        corner.lateral_g?.average_delta ??
        null,
    };
  });

  observationArray(analysis?.line_trajectory_observations).forEach(
    (value) => {
      if (!isRecord(value)) return;
      const number = cornerNumber(value);
      if (number === null) return;
      const corner = ensureCorner(number);
      if (value.lineDifference !== undefined) {
        corner.trajectory = toJsonValue(value.lineDifference);
      }
    },
  );

  return [...corners.values()].sort(
    (first, second) => first.corner_number - second.corner_number,
  );
}

function minimumOptimumCornerSpeed(
  corners: NormalizedCornerContext[],
): number | null {
  const speeds = corners
    .map((corner) => corner.minimum_speed_mps)
    .filter((value): value is number => value !== null);
  return speeds.length > 0 ? Math.min(...speeds) : null;
}

function assertOwnedRows(
  rows: Array<{ user_id: string; timing_session_id: string }>,
  userId: string,
  sessionId: string,
) {
  if (
    rows.some(
      (row) =>
        row.user_id !== userId || row.timing_session_id !== sessionId,
    )
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyLaps telemetry ownership could not be verified.',
    );
  }
}

function requiredData<T>(result: StoreResult<T>, label: string): T {
  if (result.error) {
    throw new OnlyLapsSetupContextError(
      'data_load_failed',
      `Unable to load ${label}.`,
    );
  }
  return result.data;
}

export async function getOnlyLapsSetupContext({
  onlyfastSessionId,
  store,
  userId,
}: {
  onlyfastSessionId: string;
  store: OnlyLapsSetupContextStore;
  userId: string;
}): Promise<OnlyLapsSetupContext> {
  if (!uuidPattern.test(onlyfastSessionId)) {
    throw new OnlyLapsSetupContextError(
      'invalid_session_id',
      'A valid OnlyFast session ID is required.',
    );
  }

  const onlyfastSession = requiredData(
    await store.findOwnedOnlyFastSession(onlyfastSessionId, userId),
    'the OnlyFast session',
  );
  if (!onlyfastSession) {
    throw new OnlyLapsSetupContextError(
      'onlyfast_session_not_found',
      'OnlyFast session not found.',
    );
  }
  if (
    onlyfastSession.id !== onlyfastSessionId ||
    onlyfastSession.user_id !== userId
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyFast session ownership could not be verified.',
    );
  }

  const links = requiredData(
    await store.listOwnedLinks(onlyfastSessionId, userId),
    'the OnlyFast to OnlyLaps link',
  );
  if (links.length === 0) {
    return {
      schema_version: ONLYLAPS_SETUP_CONTEXT_SCHEMA_VERSION,
      linked: false,
      onlyfast_session_id: onlyfastSessionId,
    };
  }
  if (links.length > 1) {
    throw new OnlyLapsSetupContextError(
      'integrity_error',
      'The OnlyFast session has more than one OnlyLaps link.',
    );
  }
  const link = links[0];
  if (
    link.user_id !== userId ||
    link.onlyfast_session_id !== onlyfastSessionId
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyFast to OnlyLaps link ownership could not be verified.',
    );
  }

  const onlylapsSession = requiredData(
    await store.findOwnedOnlyLapsSession(link.onlylaps_session_id, userId),
    'the linked OnlyLaps session',
  );
  if (!onlylapsSession) {
    throw new OnlyLapsSetupContextError(
      'linked_session_not_found',
      'Linked OnlyLaps session not found.',
    );
  }
  if (
    onlylapsSession.id !== link.onlylaps_session_id ||
    onlylapsSession.user_id !== userId
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyLaps session ownership could not be verified.',
    );
  }

  const [trackResult, lapsResult, sectorsResult, analysisResult] =
    await Promise.all([
      onlylapsSession.track_map_id
        ? store.findTrackMap(onlylapsSession.track_map_id)
        : Promise.resolve({ data: null, error: null }),
      store.listOwnedLaps(onlylapsSession.id, userId),
      store.listOwnedSectorRows(onlylapsSession.id, userId),
      store.findOwnedAnalysis(
        onlylapsSession.id,
        userId,
        CURRENT_ONLYLAPS_ANALYSIS_VERSION,
      ),
    ]);

  const track = requiredData(trackResult, 'the OnlyLaps track map');
  const allLaps = requiredData(lapsResult, 'OnlyLaps lap summaries');
  const sectorRows = requiredData(sectorsResult, 'OnlyLaps sector summaries');
  const analysis = requiredData(analysisResult, 'OnlyLaps session analysis');

  assertOwnedRows(allLaps, userId, onlylapsSession.id);
  assertOwnedRows(sectorRows, userId, onlylapsSession.id);
  if (
    analysis &&
    (analysis.user_id !== userId ||
      analysis.session_id !== onlylapsSession.id ||
      analysis.analysis_version !== CURRENT_ONLYLAPS_ANALYSIS_VERSION)
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyLaps analysis ownership could not be verified.',
    );
  }
  if (
    track &&
    track.is_active !== true &&
    track.user_id !== userId &&
    track.created_by !== userId
  ) {
    throw new OnlyLapsSetupContextError(
      'ownership_mismatch',
      'OnlyLaps track-map access could not be verified.',
    );
  }

  const validLaps = allLaps.filter((lap) => lap.is_valid === true);
  const validLapTimes = validLaps
    .map((lap) => nonnegativeInteger(lap.duration_ms))
    .filter((value): value is number => value !== null);
  const fastestLapMs =
    validLapTimes.length > 0 ? Math.min(...validLapTimes) : null;
  const averageLapMs = average(validLapTimes, true);
  const medianLapMs = median(validLapTimes);
  const spreadMs =
    validLapTimes.length > 0
      ? Math.max(...validLapTimes) - Math.min(...validLapTimes)
      : null;
  const { sectors, optimumLapMs } = normalizeSectors(
    validLaps,
    sectorRows,
    analysis,
  );
  const corners = normalizeCorners(analysis);
  const averageSpeeds = validLaps
    .map((lap) => finiteNumber(lap.average_speed))
    .filter((value): value is number => value !== null);
  const trackName =
    nonemptyString(track?.track_name) ??
    nonemptyString(track?.name) ??
    nonemptyString(onlylapsSession.name);

  return {
    schema_version: ONLYLAPS_SETUP_CONTEXT_SCHEMA_VERSION,
    linked: true,
    onlyfast_session_id: onlyfastSessionId,
    link: {
      id: link.id,
      method: link.link_method,
      match_confidence: finiteNumber(link.match_confidence),
    },
    session: {
      onlylaps_session_id: onlylapsSession.id,
      display_name:
        nonemptyString(onlylapsSession.session_name) ??
        (onlylapsSession.started_at
          ? `Session — ${onlylapsSession.started_at.slice(11, 16)}`
          : 'Timing Session'),
      track_map_id: onlylapsSession.track_map_id,
      track_name: trackName,
      track_type: nonemptyString(track?.track_type),
      track_shape: nonemptyString(track?.track_shape),
      track_length: nonemptyString(track?.track_length),
      vehicle_name: nonemptyString(onlylapsSession.vehicle_name),
      session_type: onlylapsSession.session_type,
      session_date: onlylapsSession.started_at?.slice(0, 10) ?? null,
      started_at: onlylapsSession.started_at,
      ended_at: onlylapsSession.ended_at,
      duration_ms: sessionDurationMs(
        onlylapsSession.started_at,
        onlylapsSession.ended_at,
      ),
      recorded_lap_count: allLaps.length,
      valid_lap_count: validLaps.length,
      excluded_lap_count: allLaps.length - validLaps.length,
      weather: toJsonValue(onlylapsSession.weather),
    },
    lap_performance: {
      fastest_lap_ms: fastestLapMs,
      average_lap_ms: averageLapMs,
      median_lap_ms: medianLapMs,
      optimum_lap_ms: optimumLapMs,
      lap_time_spread_ms: spreadMs,
    },
    speed: {
      maximum_mph: maximum(validLaps.map((lap) => lap.max_speed)),
      average_lap_mph:
        averageSpeeds.length > 0
          ? round(average(averageSpeeds) as number, 2)
          : null,
      minimum_optimum_corner_mps: minimumOptimumCornerSpeed(corners),
    },
    g_force: getCurrentGForceValues(onlylapsSession, validLaps),
    sectors,
    corners,
    ai_analysis: normalizeAnalysis(analysis),
  };
}
