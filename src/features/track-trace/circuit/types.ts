// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import type { GpsPoint, SavedTrackMap } from "./onlylapsTrackScanUtils.ts";
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

export type StartFinishLine = {
  a: GpsPoint;
  b: GpsPoint;
};
