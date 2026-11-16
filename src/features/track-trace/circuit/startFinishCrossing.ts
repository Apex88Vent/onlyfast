// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
import type { GpsPoint } from "./onlylapsTrackScanUtils.ts";
import type { StartFinishLine, StartFinishLineDiagnostics } from "./types.ts";

export type CrossingDirection = 1 | -1;

export type CrossingDetectionOptions = {
  debounceMs?: number;
  minLapTimeMs?: number;
  endpointBaseExtensionMeters?: number;
  maxGpsAccuracyMeters?: number;
  expectedDirection?: CrossingDirection | null;
  lastCrossingAt?: string | null;
  lastLapStartedAt?: string | null;
};

export type CrossingDetectionResult = {
  crossed: boolean;
  crossingTime: string | null;
  direction: CrossingDirection | null;
  distanceFromLineMeters: number | null;
  distanceBeyondEndpointMeters: number | null;
  endpointToleranceMeters: number | null;
  gateCrossing: boolean;
  linePlaneIntersection: boolean;
  lineCrossingCandidate: boolean;
  rejectionCategory:
    | "none"
    | "too_far_beyond_endpoint"
    | "wrong_direction"
    | "cooldown_or_min_lap"
    | "gps_accuracy"
    | "timer_state";
  reason: string | null;
  segmentPosition: number | null;
  validDirectionalCrossing: boolean;
};

type Point2d = {
  x: number;
  y: number;
};

const defaultDebounceMs = 3000;
const defaultMinLapTimeMs = 5000;
export const defaultStartFinishEndpointExtensionMeters = 15;
const defaultMaxGpsAccuracyMeters = 75;
const metersPerDegreeLatitude = 111320;

function toPoint2d(point: GpsPoint): Point2d {
  return {
    x: point.lng,
    y: point.lat
  };
}

function cross(a: Point2d, b: Point2d) {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: Point2d, b: Point2d) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

function sideOfLine(point: GpsPoint, line: StartFinishLine) {
  const lineA = toPoint2d(line.a);
  const lineB = toPoint2d(line.b);
  const p = toPoint2d(point);
  return cross(subtract(lineB, lineA), subtract(p, lineA));
}

function normalizeHeadingDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function toLocalMeters(point: GpsPoint, origin: GpsPoint): Point2d {
  const latScale = metersPerDegreeLatitude;
  const lngScale = metersPerDegreeLatitude * Math.cos((origin.lat * Math.PI) / 180);

  return {
    x: (point.lng - origin.lng) * lngScale,
    y: (point.lat - origin.lat) * latScale
  };
}

function segmentLengthMeters(line: StartFinishLine) {
  const startMeters = toLocalMeters(line.a, line.a);
  const endMeters = toLocalMeters(line.b, line.a);
  const segment = subtract(endMeters, startMeters);
  return Math.hypot(segment.x, segment.y);
}

function interpolateGpsPoint(pointA: GpsPoint, pointB: GpsPoint, fraction: number) {
  return {
    lat: pointA.lat + (pointB.lat - pointA.lat) * fraction,
    lng: pointA.lng + (pointB.lng - pointA.lng) * fraction
  };
}

function getLineHeadingDegrees(line: StartFinishLine) {
  const startMeters = toLocalMeters(line.a, line.a);
  const endMeters = toLocalMeters(line.b, line.a);
  const segment = subtract(endMeters, startMeters);

  if (segment.x === 0 && segment.y === 0) {
    return null;
  }

  return normalizeHeadingDegrees((Math.atan2(segment.x, segment.y) * 180) / Math.PI);
}

function getPerpendicularHeadingDegrees(
  line: StartFinishLine,
  expectedDirection: CrossingDirection | null = null
) {
  const lineHeading = getLineHeadingDegrees(line);

  if (lineHeading === null) {
    return null;
  }

  return normalizeHeadingDegrees(lineHeading + (expectedDirection === -1 ? 90 : -90));
}

function getGpsAccuracy(point: GpsPoint) {
  return typeof point.accuracy === "number" && Number.isFinite(point.accuracy)
    ? Math.max(0, point.accuracy)
    : 0;
}

function getMaxGpsAccuracy(previousPoint: GpsPoint, currentPoint: GpsPoint) {
  return Math.max(getGpsAccuracy(previousPoint), getGpsAccuracy(currentPoint));
}

function getEndpointToleranceMeters(
  currentPoint: GpsPoint,
  endpointBaseExtensionMeters = defaultStartFinishEndpointExtensionMeters
) {
  return endpointBaseExtensionMeters + getGpsAccuracy(currentPoint);
}

function distanceFromPointToSegmentMeters(point: GpsPoint, line: StartFinishLine) {
  const pointMeters = toLocalMeters(point, line.a);
  const startMeters = toLocalMeters(line.a, line.a);
  const endMeters = toLocalMeters(line.b, line.a);
  const segment = subtract(endMeters, startMeters);
  const segmentLengthSquared = segment.x * segment.x + segment.y * segment.y;

  if (segmentLengthSquared <= 0) {
    return Math.hypot(pointMeters.x - startMeters.x, pointMeters.y - startMeters.y);
  }

  const pointOnSegment = subtract(pointMeters, startMeters);
  const t = Math.max(
    0,
    Math.min(1, (pointOnSegment.x * segment.x + pointOnSegment.y * segment.y) / segmentLengthSquared)
  );
  const closest = {
    x: startMeters.x + segment.x * t,
    y: startMeters.y + segment.y * t
  };

  return Math.hypot(pointMeters.x - closest.x, pointMeters.y - closest.y);
}

function interpolateCrossingTime(previousPoint: GpsPoint, currentPoint: GpsPoint, fraction: number) {
  const previousTime = Date.parse(previousPoint.timestamp);
  const currentTime = Date.parse(currentPoint.timestamp);

  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) {
    return currentPoint.timestamp;
  }

  const interpolated = previousTime + (currentTime - previousTime) * fraction;
  return new Date(interpolated).toISOString();
}

function getLinePlaneIntersection(
  previousPoint: GpsPoint,
  currentPoint: GpsPoint,
  line: StartFinishLine
) {
  const p = toLocalMeters(previousPoint, line.a);
  const current = toLocalMeters(currentPoint, line.a);
  const r = subtract(current, p);
  const q = toLocalMeters(line.a, line.a);
  const lineEnd = toLocalMeters(line.b, line.a);
  const s = subtract(lineEnd, q);
  const denominator = cross(r, s);
  const lengthMeters = Math.hypot(s.x, s.y);

  if (Math.abs(denominator) < 1e-9 || lengthMeters <= 0) {
    return null;
  }

  const qMinusP = subtract(q, p);
  const t = cross(qMinusP, s) / denominator;
  const u = cross(qMinusP, r) / denominator;

  if (t < 0 || t > 1) {
    return null;
  }

  const distanceBeyondEndpointMeters =
    u < 0 ? Math.abs(u) * lengthMeters : u > 1 ? (u - 1) * lengthMeters : 0;

  return {
    distanceBeyondEndpointMeters,
    fraction: t,
    segmentPosition: u,
    segmentLengthMeters: lengthMeters
  };
}

function elapsedMs(from: string | null | undefined, to: string) {
  if (!from) {
    return Number.POSITIVE_INFINITY;
  }

  const start = Date.parse(from);
  const end = Date.parse(to);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Number.POSITIVE_INFINITY;
  }

  return end - start;
}

export function getStartFinishLine(startFinishPath: GpsPoint[]): StartFinishLine | null {
  if (startFinishPath.length < 2) {
    return null;
  }

  return {
    a: startFinishPath[0],
    b: startFinishPath[startFinishPath.length - 1]
  };
}

export function getStartFinishLineDiagnostics(
  line: StartFinishLine | null,
  expectedDirection: CrossingDirection | null = null
): StartFinishLineDiagnostics | null {
  if (!line) {
    return null;
  }

  return {
    endpointA: {
      lat: line.a.lat,
      lng: line.a.lng
    },
    endpointB: {
      lat: line.b.lat,
      lng: line.b.lng
    },
    segmentLengthMeters: segmentLengthMeters(line),
    expectedDirection,
    gateMidpoint: interpolateGpsPoint(line.a, line.b, 0.5),
    perpendicularHeadingDegrees: getPerpendicularHeadingDegrees(line, expectedDirection),
    baseEndpointExtensionMeters: defaultStartFinishEndpointExtensionMeters
  };
}

export function detectStartFinishCrossing(
  previousPoint: GpsPoint | null,
  currentPoint: GpsPoint,
  line: StartFinishLine | null,
  options: CrossingDetectionOptions = {}
): CrossingDetectionResult {
  if (!previousPoint || !line) {
    return {
      crossed: false,
      crossingTime: null,
      direction: null,
      distanceFromLineMeters: null,
      distanceBeyondEndpointMeters: null,
      endpointToleranceMeters: null,
      gateCrossing: false,
      linePlaneIntersection: false,
      lineCrossingCandidate: false,
      rejectionCategory: "timer_state",
      segmentPosition: null,
      validDirectionalCrossing: false,
      reason: "Need two GPS samples and a saved start/finish line."
    };
  }

  const previousSide = sideOfLine(previousPoint, line);
  const currentSide = sideOfLine(currentPoint, line);
  const distanceFromLineMeters = distanceFromPointToSegmentMeters(currentPoint, line);

  if (previousSide === 0 || currentSide === 0 || Math.sign(previousSide) === Math.sign(currentSide)) {
    return {
      crossed: false,
      crossingTime: null,
      direction: null,
      distanceFromLineMeters,
      distanceBeyondEndpointMeters: null,
      endpointToleranceMeters: null,
      gateCrossing: false,
      linePlaneIntersection: false,
      lineCrossingCandidate: false,
      rejectionCategory: "none",
      segmentPosition: null,
      validDirectionalCrossing: false,
      reason: "GPS path did not cross the start/finish line."
    };
  }

  const intersection = getLinePlaneIntersection(previousPoint, currentPoint, line);

  if (intersection === null) {
    return {
      crossed: false,
      crossingTime: null,
      direction: null,
      distanceFromLineMeters,
      distanceBeyondEndpointMeters: null,
      endpointToleranceMeters: null,
      gateCrossing: false,
      linePlaneIntersection: false,
      lineCrossingCandidate: true,
      rejectionCategory: "timer_state",
      segmentPosition: null,
      validDirectionalCrossing: false,
      reason: "Line-plane side changed, but the GPS movement segment could not be intersected."
    };
  }

  const direction: CrossingDirection = previousSide < currentSide ? 1 : -1;
  const endpointToleranceMeters = getEndpointToleranceMeters(
    currentPoint,
    options.endpointBaseExtensionMeters
  );
  const gpsAccuracyMeters = getMaxGpsAccuracy(previousPoint, currentPoint);
  const gateCrossing = intersection.distanceBeyondEndpointMeters <= endpointToleranceMeters;
  const crossingTime = interpolateCrossingTime(previousPoint, currentPoint, intersection.fraction);

  if (gpsAccuracyMeters > (options.maxGpsAccuracyMeters ?? defaultMaxGpsAccuracyMeters)) {
    return {
      crossed: false,
      crossingTime,
      direction,
      distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
      distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
      endpointToleranceMeters,
      gateCrossing,
      linePlaneIntersection: true,
      lineCrossingCandidate: true,
      rejectionCategory: "gps_accuracy",
      segmentPosition: intersection.segmentPosition,
      validDirectionalCrossing: false,
      reason: "Line-plane intersection rejected because GPS accuracy was too poor."
    };
  }

  if (!gateCrossing) {
    return {
      crossed: false,
      crossingTime,
      direction,
      distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
      distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
      endpointToleranceMeters,
      gateCrossing: false,
      linePlaneIntersection: true,
      lineCrossingCandidate: true,
      rejectionCategory: "too_far_beyond_endpoint",
      segmentPosition: intersection.segmentPosition,
      validDirectionalCrossing: false,
      reason: "Line-plane intersection was too far beyond the saved start/finish gate."
    };
  }

  if (options.expectedDirection && options.expectedDirection !== direction) {
    return {
      crossed: false,
      crossingTime,
      direction,
      distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
      distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
      endpointToleranceMeters,
      gateCrossing: true,
      linePlaneIntersection: true,
      lineCrossingCandidate: true,
      rejectionCategory: "wrong_direction",
      segmentPosition: intersection.segmentPosition,
      validDirectionalCrossing: false,
      reason: "Crossing direction did not match the session direction."
    };
  }

  const debounceMs = options.debounceMs ?? defaultDebounceMs;
  const minLapTimeMs = options.minLapTimeMs ?? defaultMinLapTimeMs;

  if (elapsedMs(options.lastCrossingAt, crossingTime) < debounceMs) {
    return {
      crossed: false,
      crossingTime,
      direction,
      distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
      distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
      endpointToleranceMeters,
      gateCrossing: true,
      linePlaneIntersection: true,
      lineCrossingCandidate: true,
      rejectionCategory: "cooldown_or_min_lap",
      segmentPosition: intersection.segmentPosition,
      validDirectionalCrossing: true,
      reason: "Duplicate crossing ignored inside debounce window."
    };
  }

  if (options.lastLapStartedAt && elapsedMs(options.lastLapStartedAt, crossingTime) < minLapTimeMs) {
    return {
      crossed: false,
      crossingTime,
      direction,
      distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
      distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
      endpointToleranceMeters,
      gateCrossing: true,
      linePlaneIntersection: true,
      lineCrossingCandidate: true,
      rejectionCategory: "cooldown_or_min_lap",
      segmentPosition: intersection.segmentPosition,
      validDirectionalCrossing: true,
      reason: "Crossing happened too quickly to be a real lap."
    };
  }

  return {
    crossed: true,
    crossingTime,
    direction,
    distanceFromLineMeters: intersection.distanceBeyondEndpointMeters,
    distanceBeyondEndpointMeters: intersection.distanceBeyondEndpointMeters,
    endpointToleranceMeters,
    gateCrossing: true,
    linePlaneIntersection: true,
    lineCrossingCandidate: true,
    rejectionCategory: "none",
    segmentPosition: intersection.segmentPosition,
    validDirectionalCrossing: true,
    reason: null
  };
}

