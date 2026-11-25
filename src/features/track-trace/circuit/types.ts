// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type { GpsPoint, SavedTrackMap } from "./onlylapsTrackScanUtils.ts";

export type SessionMode = "normal";

export type GumballDetectionStatus =
  | "not_applicable"
  | "recording_route"
  | "searching"
  | "possible_start_finish"
  | "confirming"
  | "timing_active"
  | "low_confidence";

export type StartFinishSource = "scanned" | "automatic" | "manual";

export type StoredStartFinishData = {
  center: { lat: number; lng: number };
  line: StartFinishLine;
  averageHeading: number;
  expectedDirection: 1 | -1 | null;
  confidence: number;
  supportingCrossings: number;
  detectionRadiusMeters: number;
  gpsAccuracyMeters: number | null;
  lockedAt: string;
  source: StartFinishSource;
};

export type GumballDetectionDiagnostics = {
  reasons: string[];
  candidateZoneCount: number;
  bestCandidateScore: number | null;
  ambiguousCandidateCount: number;
};

export type OpenRouteSummary = {
  totalDistanceMeters: number;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  rawTrace: LapTracePoint[];
  smoothedTrace: SmoothedLapTracePoint[];
  smoothingConfidence: LapSmoothingConfidence;
};

export type PhoneMountOrientation =
  | "top_forward"
  | "bottom_forward"
  | "left_forward"
  | "right_forward";

export type TelemetryGForceConvention =
  | "vehicle_acceleration_positive_v1"
  | "vehicle_braking_positive_v2";

export type MotionTelemetrySnapshot = {
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  lateralG: number | null;
  longitudinalG: number | null;
  verticalG: number | null;
  orientationAlpha: number | null;
  orientationBeta: number | null;
  orientationGamma: number | null;
  motionAvailable: boolean;
  motionSampleCount: number;
  lastMotionSampleAt: string | null;
  motionSource: "linear_acceleration" | "gravity_compensated" | "unavailable";
};

export type LapTelemetrySample = {
  id?: string | number;
  sessionId?: string;
  lapId?: string | null;
  userId?: string;
  trackId: string | null;
  lapNumber: number | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  lateralG: number | null;
  longitudinalG: number | null;
  verticalG: number | null;
  sampleIndex: number;
};

export type LapSmoothingConfidence = "high" | "medium" | "low";

export type LapTracePoint = {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  altitude: number | null;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  lateralG: number | null;
  longitudinalG: number | null;
  verticalG: number | null;
};

export type SmoothedLapTracePoint = LapTracePoint & {
  rawLat: number;
  rawLng: number;
  correctionMeters: number;
  mapMatched: boolean;
};

export type LapSmoothingSummary = {
  algorithm: "onlylaps_deterministic_telemetry_v1";
  confidence: LapSmoothingConfidence;
  rawSampleCount: number;
  keptSampleCount: number;
  removedOutlierCount: number;
  averageCorrectionMeters: number | null;
  maxCorrectionMeters: number | null;
  averageGpsAccuracyMeters: number | null;
  mapMatchedPointCount: number;
  segmentElapsedMs: number[];
  warning: string | null;
};

export type CompletedLapDraft = {
  lapNumber: number;
  startedAt: string;
  endedAt: string;
  lapTimeMs: number;
  sectorTimesMs?: Array<number | null> | null;
  averageSpeed: number | null;
  maxSpeed: number | null;
  maxLateralG: number | null;
  maxLongitudinalG: number | null;
  maxVerticalG: number | null;
  maxAccelG: number | null;
  maxBrakingG: number | null;
  isValid: boolean;
  excludedReason: string | null;
  timingSource?: "official" | "estimated" | "manual";
};

export type SavedLapRecord = CompletedLapDraft & {
  id: string;
  sessionId: string;
  userId: string;
  trackId: string | null;
  createdAt: string;
  rawTrace?: LapTracePoint[];
  smoothedTrace?: SmoothedLapTracePoint[];
  smoothingConfidence?: LapSmoothingConfidence | null;
  smoothingSummary?: LapSmoothingSummary | null;
  smoothingWarning?: string | null;
};

export type SectorLineDefinition = {
  id: string;
  sectorIndex: number;
  progress: number;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  expectedDirection: 1 | -1 | null;
};

export type TrackSectorLayout = {
  id: string | null;
  trackId: string;
  sectorCount: number;
  version: number;
  source: "track_default" | "user_override" | "generated_default";
  ownerId: string | null;
  lines: SectorLineDefinition[];
  confidence: "high" | "needs_confirmation";
  createdAt: string | null;
  updatedAt: string | null;
};

export type LapSectorResult = {
  lapId: string;
  sectorIndex: number;
  durationMs: number | null;
  crossingTimestamp: string | null;
  isValid: boolean;
  sourceDefinitionVersion: number;
  sourceKind?: "track_default" | "user_override" | "generated_default" | null;
};

export type SavedOptimumSectorSource = {
  sectorIndex: number;
  durationMs: number;
  sourceLapId: string;
  sourceLapNumber: number;
  segmentStartTimestamp: string | null;
  segmentEndTimestamp: string | null;
};

export type CornerAnalysisConfidence = "low" | "medium" | "high";

export type CornerDefinition = {
  cornerNumber: number;
  startProgress: number;
  apexProgress: number;
  endProgress: number;
  primaryDirection: "left" | "right";
  physicalLengthMeters: number;
  confidence: number;
  detectionMethod: "oval_split" | "curvature_cluster" | "manual_range";
  detectionVersion: string;
  apex: { lat: number; lng: number };
};

export type StoredCornerDefinitions = {
  version: string;
  generatedAt: string;
  trackType: SavedTrackMap["track_type"];
  travelDirection: SavedTrackMap["direction"];
  source: "track_representative" | "session_representative" | "manual_track_editor";
  corners: CornerDefinition[];
};

export type CornerDataQuality = {
  rating: CornerAnalysisConfidence;
  averageAccuracyMeters: number | null;
  averageSampleIntervalMs: number | null;
  maximumSampleGapMs: number | null;
  gForceCoverage: number;
  warnings: string[];
};

export type CornerLapMetrics = {
  lapId: string;
  lapNumber: number;
  cornerNumber: number;
  entrySpeedMps: number | null;
  minimumSpeedMps: number | null;
  exitSpeedMps: number | null;
  averageSpeedMps: number | null;
  maximumLateralG: number | null;
  averageLateralG: number | null;
  lateralGVariation: number | null;
  preEntryBrakingG: number | null;
  turnInProgress: number | null;
  apexProgress: number;
  accelerationPickupProgress: number | null;
  entryElapsedSeconds: number;
  apexElapsedSeconds: number;
  exitElapsedSeconds: number;
  cornerTimeSeconds: number;
  distanceMeters: number;
  averageSignedLateralOffsetMeters: number | null;
  averageInsideOffsetMeters: number | null;
  lineOffsetsMeters: number[];
  gpsAccuracyMeters: number | null;
  maximumSampleGapMs: number | null;
  sampleCount: number;
  lateralGSampleCoverage: number;
  confidence: CornerAnalysisConfidence;
};

export type SessionCornerAnalysis = {
  version: string;
  detectionVersion: string;
  generatedAt: string;
  definitions: StoredCornerDefinitions;
  dataQuality: CornerDataQuality;
  laps: Array<{
    lapId: string;
    lapNumber: number;
    isValid: boolean;
    corners: CornerLapMetrics[];
  }>;
};

export type CornerLineDifference = {
  classification:
    | "meaningfully_higher"
    | "meaningfully_lower"
    | "meaningfully_wider"
    | "meaningfully_tighter"
    | "not_meaningful";
  confidence: CornerAnalysisConfidence;
  medianDifferenceMeters: number | null;
  persistence: number;
  estimatedDistanceDeltaMeters: number | null;
  explanation: string;
};

export type CornerScrubObservation = {
  detected: boolean;
  confidence: CornerAnalysisConfidence;
  reasons: string[];
  explanation: string;
};

export type CornerComparisonResult = {
  cornerNumber: number;
  definition: CornerDefinition;
  comparisonLap: CornerLapMetrics;
  referenceLap: CornerLapMetrics;
  cornerTimeDeltaSeconds: number;
  entryTimeDeltaSeconds: number;
  apexTimeDeltaSeconds: number;
  exitTimeDeltaSeconds: number;
  entrySpeedDeltaMps: number | null;
  minimumSpeedDeltaMps: number | null;
  exitSpeedDeltaMps: number | null;
  averageSpeedDeltaMps: number | null;
  maximumLateralGDelta: number | null;
  averageLateralGDelta: number | null;
  lineDifference: CornerLineDifference;
  possibleScrub: CornerScrubObservation;
  confidence: CornerAnalysisConfidence;
  summary: string;
  interpretation: string;
  important: boolean;
};

export type LapCornerComparison = {
  algorithmVersion: string;
  detectionVersion: string;
  trackType: SavedTrackMap["track_type"];
  travelDirection: SavedTrackMap["direction"];
  comparisonLapId: string;
  comparisonLapNumber: number;
  referenceLapId: string;
  referenceLapNumber: number;
  gpsQuality: CornerDataQuality;
  corners: CornerComparisonResult[];
};

export type TelemetryShare = {
  code: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "revoked" | "expired";
};

export type SharedTelemetryLoadStatus =
  | "active"
  | "invalid"
  | "not_found"
  | "expired"
  | "revoked"
  | "error";

export type SharedTelemetryLoadResult = {
  status: SharedTelemetryLoadStatus;
  share: TelemetryShare | null;
  session: SavedLapSession | null;
  error: string | null;
};

export type LapDetectionDiagnosticEvent = {
  timestamp: string;
  createdLap: boolean;
  lapNumber: number | null;
  reason: string | null;
  speed: number | null;
  heading: number | null;
  gpsAccuracy: number | null;
  distanceFromLineMeters: number | null;
  linePlaneIntersection?: boolean;
  gateCrossing?: boolean;
  validDirectionalCrossing?: boolean;
  rejectionCategory?:
    | "none"
    | "too_far_beyond_endpoint"
    | "wrong_direction"
    | "cooldown_or_min_lap"
    | "gps_accuracy"
    | "timer_state";
  endpointToleranceMeters?: number | null;
  distanceBeyondEndpointMeters?: number | null;
  segmentPosition?: number | null;
};

export type StartFinishLineDiagnostics = {
  endpointA: {
    lat: number;
    lng: number;
  };
  endpointB: {
    lat: number;
    lng: number;
  };
  segmentLengthMeters: number | null;
  expectedDirection: 1 | -1 | null;
  gateMidpoint: {
    lat: number;
    lng: number;
  } | null;
  perpendicularHeadingDegrees: number | null;
  baseEndpointExtensionMeters: number;
};

export type LapSessionRecordingDiagnostics = {
  totalGpsPoints: number;
  totalDistanceMeters: number;
  startFinishCrossingsDetected: number;
  linePlaneIntersectionsDetected?: number;
  startFinishGateCrossingsDetected?: number;
  validDirectionalCrossingsDetected?: number;
  completedLaps?: number;
  rejectedTooFarBeyondEndpointCount?: number;
  rejectedWrongDirectionCount?: number;
  rejectedCooldownOrMinLapCount?: number;
  rejectedGpsAccuracyCount?: number;
  lapDetectionGateStatus: string;
  ignoredCrossingsCount: number;
  ignoredCrossingReasons: string[];
  gpsGapsOverTwoSeconds: number;
  longestGpsGapMs: number | null;
  averageGpsSampleIntervalMs: number | null;
  minGpsAccuracyMeters: number | null;
  averageGpsAccuracyMeters: number | null;
  maxGpsAccuracyMeters: number | null;
  startFinishLine?: StartFinishLineDiagnostics | null;
  crossingEvents: LapDetectionDiagnosticEvent[];
};

export type SavedLapSession = {
  id: string;
  rawId?: string;
  userId: string;
  trackId: string | null;
  trackName: string;
  sessionName?: string | null;
  originalCourseName?: string | null;
  sessionMode?: SessionMode;
  courseType?: "closed" | "open" | null;
  detectionStatus?: GumballDetectionStatus;
  detectionConfidence?: number | null;
  officialTimingStartedAt?: string | null;
  generatedTrackId?: string | null;
  automaticStartFinishData?: StoredStartFinishData | null;
  manualStartFinishData?: StoredStartFinishData | null;
  detectionDiagnostics?: GumballDetectionDiagnostics | null;
  routeSummary?: OpenRouteSummary | null;
  startedAt: string;
  endedAt: string;
  status: "completed" | "failed" | "active";
  reviewStatus?: "complete" | "no_gps_data" | "recording_error" | "recording";
  gpsSampleCount?: number;
  gpsErrorMessage?: string | null;
  recordingDiagnostics?: LapSessionRecordingDiagnostics | null;
  totalLapsRecorded: number;
  totalLapsSaved: number;
  fastestLapTimeMs: number | null;
  averageLapTimeMs: number | null;
  rawAverageLapTimeMs: number | null;
  notes: string | null;
  phoneMountOrientation?: PhoneMountOrientation | null;
  telemetryGForceConvention?: TelemetryGForceConvention;
  createdAt: string;
  isDemo?: boolean;
  storageSource?: "onlylaps_timing_sessions";
  trackMap?: SavedTrackMap | null;
  laps?: SavedLapRecord[];
  telemetrySamples?: LapTelemetrySample[];
  sectorCount?: number;
  sectorDefinitionVersion?: number | null;
  sectorSourceKind?: LapSectorResult["sourceKind"];
  sectorResults?: LapSectorResult[];
  optimumSectorSources?: SavedOptimumSectorSource[];
  cornerDefinitions?: StoredCornerDefinitions | null;
  cornerAnalysis?: SessionCornerAnalysis | null;
};

export type CompletedLapSessionDraft = {
  id?: string;
  track: SavedTrackMap | null;
  sessionMode?: SessionMode;
  courseType?: "closed" | "open" | null;
  courseName?: string | null;
  originalCourseName?: string | null;
  detectionStatus?: GumballDetectionStatus;
  detectionConfidence?: number | null;
  officialTimingStartedAt?: string | null;
  generatedTrackId?: string | null;
  automaticStartFinishData?: StoredStartFinishData | null;
  manualStartFinishData?: StoredStartFinishData | null;
  detectionDiagnostics?: GumballDetectionDiagnostics | null;
  routeSummary?: OpenRouteSummary | null;
  startedAt: string;
  endedAt: string;
  laps: CompletedLapDraft[];
  telemetrySamples: LapTelemetrySample[];
  notes?: string | null;
  motionUnavailable?: boolean;
  phoneMountOrientation?: PhoneMountOrientation;
  persistedTelemetrySampleIndexes?: number[];
  gpsErrorMessage?: string | null;
  recordingDiagnostics?: LapSessionRecordingDiagnostics | null;
};

export type NearbyTrackOption = {
  track: SavedTrackMap;
  distanceMeters: number;
};

export type RecorderStatus =
  | "setup"
  | "requesting"
  | "no_track"
  | "select_track"
  | "ready"
  | "armed"
  | "active"
  | "saving"
  | "saved"
  | "error";

export type StartFinishLine = {
  a: GpsPoint;
  b: GpsPoint;
};
