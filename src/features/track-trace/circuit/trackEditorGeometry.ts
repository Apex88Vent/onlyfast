// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type { CornerDefinition, StoredCornerDefinitions } from "./types.ts";
import { CORNER_DETECTION_VERSION } from "./cornerAnalysis.ts";
import {
  calculateDistanceMeters,
  type GpsPoint,
  type SavedTrackMap
} from "./onlylapsTrackScanUtils.ts";

const defaultTimestamp = "1970-01-01T00:00:00.000Z";

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function editorPoint(point: Pick<GpsPoint, "lat" | "lng">): GpsPoint {
  return {
    lat: point.lat,
    lng: point.lng,
    accuracy: null,
    altitude: null,
    speed: null,
    heading: null,
    timestamp: defaultTimestamp
  };
}

function removeClosingDuplicate(path: GpsPoint[]) {
  if (path.length < 2) return [...path];
  return calculateDistanceMeters(path[0], path[path.length - 1]) < 2
    ? path.slice(0, -1)
    : [...path];
}

function startFinishCenter(track: SavedTrackMap) {
  const line = track.start_finish_path;
  if (line.length > 0) {
    return {
      lat: line.reduce((total, point) => total + point.lat, 0) / line.length,
      lng: line.reduce((total, point) => total + point.lng, 0) / line.length
    };
  }
  return { lat: track.center_lat, lng: track.center_lng };
}

function nearestIndex(path: GpsPoint[], target: { lat: number; lng: number }) {
  return path.reduce(
    (best, point, index) => {
      const distance = calculateDistanceMeters(point, target);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY }
  ).index;
}

function signedArea(path: GpsPoint[]) {
  if (path.length < 3) return 0;
  const latitudeScale = Math.cos((path[0].lat * Math.PI) / 180);
  return path.reduce((total, point, index) => {
    const next = path[(index + 1) % path.length];
    const x = point.lng * latitudeScale;
    const nextX = next.lng * latitudeScale;
    return total + x * next.lat - nextX * point.lat;
  }, 0);
}

/**
 * Returns a closed path that begins at the saved start/finish line and advances
 * in the track's saved travel direction.
 */
export function orientTrackPath(path: GpsPoint[], track: SavedTrackMap) {
  if (track.is_open_route) return [...path];
  let oriented = removeClosingDuplicate(path);
  if (oriented.length < 2) return oriented;
  const area = signedArea(oriented);
  const shouldReverse =
    (track.direction === "clockwise" && area > 0) ||
    (track.direction === "counterclockwise" && area < 0);
  if (shouldReverse) oriented = [...oriented].reverse();
  const startIndex = nearestIndex(oriented, startFinishCenter(track));
  oriented = [...oriented.slice(startIndex), ...oriented.slice(0, startIndex)];
  return [...oriented, oriented[0]];
}

function pathDistances(path: GpsPoint[]) {
  const cumulative = [0];
  for (let index = 1; index < path.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] + calculateDistanceMeters(path[index - 1], path[index])
    );
  }
  return cumulative;
}

export function trackPathLengthMeters(path: GpsPoint[]) {
  const cumulative = pathDistances(path);
  return cumulative[cumulative.length - 1] ?? 0;
}

export function sampleTrackPath(path: GpsPoint[], requestedProgress: number) {
  if (path.length === 0) return null;
  if (path.length === 1) return editorPoint(path[0]);
  const progress = clamp(requestedProgress);
  const cumulative = pathDistances(path);
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return editorPoint(path[0]);
  const target = progress * total;
  for (let index = 1; index < cumulative.length; index += 1) {
    if (cumulative[index] < target) continue;
    const span = cumulative[index] - cumulative[index - 1];
    const fraction = span > 0 ? (target - cumulative[index - 1]) / span : 0;
    return editorPoint({
      lat: path[index - 1].lat + (path[index].lat - path[index - 1].lat) * fraction,
      lng: path[index - 1].lng + (path[index].lng - path[index - 1].lng) * fraction
    });
  }
  return editorPoint(path[path.length - 1]);
}

function resample(path: GpsPoint[], pointCount: number) {
  return Array.from({ length: pointCount + 1 }, (_, index) =>
    sampleTrackPath(path, index / pointCount)
  ).filter((point): point is GpsPoint => point !== null);
}

/**
 * Builds the lap-progress path used by both guided editors. A recorded
 * representative path is preferred; scanned inside/outside paths are averaged
 * into a centerline when one is not available.
 */
export function getTrackEditorPath(track: SavedTrackMap, pointCount = 180) {
  const representative =
    track.representative_path_smoothed.length >= 2
      ? track.representative_path_smoothed
      : track.representative_path_raw;
  if (representative.length >= 2) {
    return resample(orientTrackPath(representative, track), pointCount);
  }

  if (track.outside_path.length >= 2 && track.inside_path.length >= 2) {
    const outside = resample(orientTrackPath(track.outside_path, track), pointCount);
    const inside = resample(orientTrackPath(track.inside_path, track), pointCount);
    return outside.map((point, index) =>
      editorPoint({
        lat: (point.lat + inside[index].lat) / 2,
        lng: (point.lng + inside[index].lng) / 2
      })
    );
  }

  const fallback = track.outside_path.length >= 2 ? track.outside_path : track.inside_path;
  return resample(orientTrackPath(fallback, track), pointCount);
}

export function sliceTrackPath(path: GpsPoint[], startProgress: number, endProgress: number) {
  const start = clamp(startProgress);
  const end = clamp(Math.max(start, endProgress));
  const first = sampleTrackPath(path, start);
  const last = sampleTrackPath(path, end);
  if (!first || !last) return [];
  const denominator = Math.max(1, path.length - 1);
  return [
    first,
    ...path.filter((_, index) => {
      const progress = index / denominator;
      return progress > start && progress < end;
    }),
    last
  ];
}

export function buildPreviewBoundary(path: GpsPoint[], progress: number, halfWidthMeters = 9) {
  const center = sampleTrackPath(path, progress);
  const before = sampleTrackPath(path, clamp(progress - 0.006));
  const after = sampleTrackPath(path, clamp(progress + 0.006));
  if (!center || !before || !after) return null;
  const latitudeRadians = (center.lat * Math.PI) / 180;
  const x = (after.lng - before.lng) * Math.cos(latitudeRadians);
  const y = after.lat - before.lat;
  const length = Math.hypot(x, y);
  if (length <= 0) return null;
  const normalX = -y / length;
  const normalY = x / length;
  const latitudeDegrees = halfWidthMeters / 111_320;
  const longitudeDegrees = halfWidthMeters / (111_320 * Math.max(0.1, Math.cos(latitudeRadians)));
  return {
    start: editorPoint({
      lat: center.lat - normalY * latitudeDegrees,
      lng: center.lng - normalX * longitudeDegrees
    }),
    end: editorPoint({
      lat: center.lat + normalY * latitudeDegrees,
      lng: center.lng + normalX * longitudeDegrees
    })
  };
}

function directionAtProgress(path: GpsPoint[], progress: number): CornerDefinition["primaryDirection"] {
  const before = sampleTrackPath(path, clamp(progress - 0.012));
  const middle = sampleTrackPath(path, progress);
  const after = sampleTrackPath(path, clamp(progress + 0.012));
  if (!before || !middle || !after) return "left";
  const latitudeScale = Math.cos((middle.lat * Math.PI) / 180);
  const incoming = {
    x: (middle.lng - before.lng) * latitudeScale,
    y: middle.lat - before.lat
  };
  const outgoing = {
    x: (after.lng - middle.lng) * latitudeScale,
    y: after.lat - middle.lat
  };
  return incoming.x * outgoing.y - incoming.y * outgoing.x >= 0 ? "left" : "right";
}

export function buildManualCornerDefinitions(
  track: SavedTrackMap,
  ranges: Array<{ start: number; end: number }>
): StoredCornerDefinitions {
  const path = getTrackEditorPath(track);
  const lengthMeters =
    track.track_length_meters ??
    track.estimated_length_meters ??
    trackPathLengthMeters(path);
  return {
    version: CORNER_DETECTION_VERSION,
    generatedAt: new Date().toISOString(),
    trackType: track.track_type,
    travelDirection: track.direction,
    source: "manual_track_editor",
    corners: ranges.map((range, index) => {
      const apexProgress = (range.start + range.end) / 2;
      const apex = sampleTrackPath(path, apexProgress) ?? editorPoint({
        lat: track.center_lat,
        lng: track.center_lng
      });
      return {
        cornerNumber: index + 1,
        startProgress: range.start,
        apexProgress,
        endProgress: range.end,
        primaryDirection: directionAtProgress(path, apexProgress),
        physicalLengthMeters: Math.round((range.end - range.start) * lengthMeters * 10) / 10,
        confidence: 1,
        detectionMethod: "manual_range",
        detectionVersion: CORNER_DETECTION_VERSION,
        apex: { lat: apex.lat, lng: apex.lng }
      };
    })
  };
}
