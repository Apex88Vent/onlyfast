// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import type { GpsPoint } from "./onlylapsTrackScanUtils.ts";
import type {
  LapTelemetrySample,
  MotionTelemetrySnapshot,
  PhoneMountOrientation,
  TelemetryGForceConvention
} from "./types.ts";

const metersPerSecondToMph = 2.2369362921;
const gravityMetersPerSecond = 9.80665;
const metersPerEarthRadius = 6371000;

type AccelerationVector = {
  x: number | null;
  y: number | null;
  z: number | null;
  source: MotionTelemetrySnapshot["motionSource"];
};

function toNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export const defaultPhoneMountOrientation: PhoneMountOrientation = "top_forward";
export const currentTelemetryGForceConvention: TelemetryGForceConvention =
  "vehicle_braking_positive_v2";
export const legacyTelemetryGForceConvention: TelemetryGForceConvention =
  "vehicle_acceleration_positive_v1";

export function normalizePersistedLongitudinalG(
  value: number | null | undefined,
  convention: TelemetryGForceConvention | null | undefined
) {
  const normalized = toNullableNumber(value);

  if (normalized === null) {
    return null;
  }

  return convention === currentTelemetryGForceConvention ? normalized : round(-normalized);
}

export function splitVehicleLongitudinalG(value: number | null | undefined) {
  const longitudinalG = toNullableNumber(value);

  return {
    accelG: longitudinalG !== null && longitudinalG < 0 ? Math.abs(longitudinalG) : null,
    brakingG: longitudinalG !== null && longitudinalG > 0 ? longitudinalG : null
  };
}

export function getNormalizedGForceDisplayCoordinates({
  lateralG,
  limitG,
  longitudinalG
}: {
  lateralG: number;
  limitG: number;
  longitudinalG: number;
}) {
  const clamp = (value: number) => Math.min(1, Math.max(-1, value));

  return {
    x: clamp(lateralG / limitG),
    y: -clamp(longitudinalG / limitG)
  };
}

export function mapDeviceMotionToVehicleAxes(
  rawMotion: {
    xG: number | null | undefined;
    yG: number | null | undefined;
    zG: number | null | undefined;
  },
  mountOrientation: PhoneMountOrientation = defaultPhoneMountOrientation
) {
  const xG = toNullableNumber(rawMotion.xG);
  const yG = toNullableNumber(rawMotion.yG);
  const zG = toNullableNumber(rawMotion.zG);

  switch (mountOrientation) {
    case "bottom_forward":
      return {
        lateralG: xG == null ? null : round(-xG),
        longitudinalG: yG == null ? null : round(yG),
        verticalG: zG == null ? null : round(zG)
      };
    case "left_forward":
      return {
        lateralG: yG == null ? null : round(yG),
        longitudinalG: xG == null ? null : round(xG),
        verticalG: zG == null ? null : round(zG)
      };
    case "right_forward":
      return {
        lateralG: yG == null ? null : round(-yG),
        longitudinalG: xG == null ? null : round(-xG),
        verticalG: zG == null ? null : round(zG)
      };
    case "top_forward":
    default:
      return {
        lateralG: xG == null ? null : round(xG),
        longitudinalG: yG == null ? null : round(-yG),
        verticalG: zG == null ? null : round(zG)
      };
  }
}

function calculateDistanceMeters(
  pointA: { lat: number; lng: number },
  pointB: { lat: number; lng: number }
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * metersPerEarthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function metersPerSecondToMilesPerHour(speed: number | null | undefined) {
  const value = toNullableNumber(speed);
  return value == null ? null : round(value * metersPerSecondToMph, 2);
}

export function accelerationToG(value: number | null | undefined) {
  const acceleration = toNullableNumber(value);
  return acceleration == null ? null : round(acceleration / gravityMetersPerSecond);
}

function hasAccelerationValue(acceleration: DeviceMotionEventAcceleration | null) {
  return Boolean(
    acceleration &&
      [acceleration.x, acceleration.y, acceleration.z].some(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
  );
}

function getMotionAcceleration(
  event: DeviceMotionEvent,
  previous: MotionTelemetrySnapshot
): AccelerationVector {
  if (hasAccelerationValue(event.acceleration)) {
    return {
      x: toNullableNumber(event.acceleration?.x),
      y: toNullableNumber(event.acceleration?.y),
      z: toNullableNumber(event.acceleration?.z),
      source: "linear_acceleration"
    };
  }

  if (
    hasAccelerationValue(event.accelerationIncludingGravity) &&
    previous.orientationBeta !== null &&
    previous.orientationGamma !== null
  ) {
    const beta = (previous.orientationBeta * Math.PI) / 180;
    const gamma = (previous.orientationGamma * Math.PI) / 180;
    const gravityX = -gravityMetersPerSecond * Math.sin(gamma);
    const gravityY = gravityMetersPerSecond * Math.sin(beta) * Math.cos(gamma);
    const gravityZ = gravityMetersPerSecond * Math.cos(beta) * Math.cos(gamma);

    return {
      x:
        event.accelerationIncludingGravity?.x == null
          ? null
          : round(event.accelerationIncludingGravity.x - gravityX, 4),
      y:
        event.accelerationIncludingGravity?.y == null
          ? null
          : round(event.accelerationIncludingGravity.y - gravityY, 4),
      z:
        event.accelerationIncludingGravity?.z == null
          ? null
          : round(event.accelerationIncludingGravity.z - gravityZ, 4),
      source: "gravity_compensated"
    };
  }

  return {
    x: null,
    y: null,
    z: null,
    source: "unavailable"
  };
}

export function normalizeMotionTelemetry(
  event: DeviceMotionEvent,
  previous: MotionTelemetrySnapshot,
  mountOrientation: PhoneMountOrientation = defaultPhoneMountOrientation
): MotionTelemetrySnapshot {
  const acceleration = getMotionAcceleration(event, previous);
  const rotation = event.rotationRate;
  const vehicleAxes = mapDeviceMotionToVehicleAxes(
    {
      xG: accelerationToG(acceleration.x),
      yG: accelerationToG(acceleration.y),
      zG: accelerationToG(acceleration.z)
    },
    mountOrientation
  );
  const motionAvailable = acceleration.source !== "unavailable";

  return {
    ...previous,
    accelX: acceleration.x,
    accelY: acceleration.y,
    accelZ: acceleration.z,
    gyroX: toNullableNumber(rotation?.alpha),
    gyroY: toNullableNumber(rotation?.beta),
    gyroZ: toNullableNumber(rotation?.gamma),
    lateralG: motionAvailable ? vehicleAxes.lateralG : null,
    longitudinalG: motionAvailable ? vehicleAxes.longitudinalG : null,
    verticalG: motionAvailable ? vehicleAxes.verticalG : null,
    motionAvailable,
    motionSampleCount: previous.motionSampleCount + 1,
    lastMotionSampleAt: new Date().toISOString(),
    motionSource: acceleration.source
  };
}

export function normalizeOrientationTelemetry(
  event: DeviceOrientationEvent,
  previous: MotionTelemetrySnapshot
): MotionTelemetrySnapshot {
  return {
    ...previous,
    orientationAlpha: toNullableNumber(event.alpha),
    orientationBeta: toNullableNumber(event.beta),
    orientationGamma: toNullableNumber(event.gamma),
    motionAvailable: previous.motionAvailable
  };
}

export function createTelemetrySample({
  gpsPoint,
  motion,
  lapNumber,
  sampleIndex,
  trackId
}: {
  gpsPoint: GpsPoint;
  motion: MotionTelemetrySnapshot;
  lapNumber: number | null;
  sampleIndex: number;
  trackId: string | null;
}): LapTelemetrySample {
  return {
    trackId,
    lapNumber,
    timestamp: gpsPoint.timestamp,
    latitude: gpsPoint.lat,
    longitude: gpsPoint.lng,
    gpsAccuracy: gpsPoint.accuracy,
    speed: gpsPoint.speed,
    heading: gpsPoint.heading,
    altitude: gpsPoint.altitude,
    accelX: motion.accelX,
    accelY: motion.accelY,
    accelZ: motion.accelZ,
    gyroX: motion.gyroX,
    gyroY: motion.gyroY,
    gyroZ: motion.gyroZ,
    lateralG: motion.lateralG,
    longitudinalG: motion.longitudinalG,
    verticalG: motion.verticalG,
    sampleIndex
  };
}

export function summarizeLapTelemetry(samples: LapTelemetrySample[], lapTimeMs: number) {
  const speeds = samples
    .map((sample) => sample.speed)
    .filter((speed): speed is number => speed !== null && Number.isFinite(speed));
  const lateralGs = samples
    .map((sample) => sample.lateralG)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const longitudinalGs = samples
    .map((sample) => sample.longitudinalG)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const verticalGs = samples
    .map((sample) => sample.verticalG)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const gpsPoints = samples.map((sample) => ({
    lat: sample.latitude,
    lng: sample.longitude
  }));
  const distanceMeters = gpsPoints.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }

    return total + calculateDistanceMeters(gpsPoints[index - 1], point);
  }, 0);
  const elapsedHours = lapTimeMs / 3600000;

  return {
    averageSpeed:
      elapsedHours > 0 && distanceMeters > 0
        ? round((distanceMeters / 1609.344) / elapsedHours, 2)
        : speeds.length > 0
          ? metersPerSecondToMilesPerHour(
              speeds.reduce((total, speed) => total + speed, 0) / speeds.length
            )
          : null,
    maxSpeed: speeds.length > 0 ? metersPerSecondToMilesPerHour(Math.max(...speeds)) : null,
    maxLateralG: lateralGs.length > 0 ? round(Math.max(...lateralGs.map(Math.abs)), 3) : null,
    maxLongitudinalG:
      longitudinalGs.length > 0 ? round(Math.max(...longitudinalGs.map(Math.abs)), 3) : null,
    maxVerticalG: verticalGs.length > 0 ? round(Math.max(...verticalGs.map(Math.abs)), 3) : null,
    maxAccelG:
      longitudinalGs.length > 0
        ? round(Math.max(0, ...longitudinalGs.filter((value) => value < 0).map(Math.abs)), 3)
        : null,
    maxBrakingG:
      longitudinalGs.length > 0
        ? round(Math.max(0, ...longitudinalGs.filter((value) => value > 0)), 3)
        : null
  };
}

export function emptyMotionTelemetry(): MotionTelemetrySnapshot {
  return {
    accelX: null,
    accelY: null,
    accelZ: null,
    gyroX: null,
    gyroY: null,
    gyroZ: null,
    lateralG: null,
    longitudinalG: null,
    verticalG: null,
    orientationAlpha: null,
    orientationBeta: null,
    orientationGamma: null,
    motionAvailable: false,
    motionSampleCount: 0,
    lastMotionSampleAt: null,
    motionSource: "unavailable"
  };
}

