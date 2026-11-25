// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { cleanTrackScan, type ScanAnomaly } from "./trackScanCleanup.ts";
import type { ExcursionDiagnostics } from "./trackExcursions.ts";
import { buildTelemetryBaseLayer, calculateDistanceMeters, summarizeGpsAccuracy, type GpsPoint, type SavedTrackMap } from "./onlylapsTrackScanUtils.ts";
import { getTrackEditorPath, sampleTrackPath, trackPathLengthMeters } from "./trackEditorGeometry.ts";
import type { StoredCornerDefinitions, SectorLineDefinition } from "./types.ts";

type Coordinate = { lat: number; lng: number };
export type CleanupPathPair = { before: GpsPoint[]; after: GpsPoint[]; path?: string };
export const cleanupGeometryKeys = [
  "outside_path", "inside_path", "representative_path_smoothed", "start_finish_path",
  "automatic_start_finish_data", "manual_start_finish_data", "corner_definitions", "geojson",
  "base_layer", "preview_bounds", "bbox", "gps_summary", "center_lat", "center_lng",
  "track_length_meters", "estimated_length_meters"
] as const;

export function cleanupGeometrySnapshot(track: SavedTrackMap) {
  return Object.fromEntries(cleanupGeometryKeys.map(key => [key, track[key] ?? null]));
}

export function cleanupSourceSnapshot(track: SavedTrackMap) {
  return { ...cleanupGeometrySnapshot(track), version: track.version, direction: track.direction,
    track_type: track.track_type, track_shape: track.track_shape, representative_path_raw: track.representative_path_raw,
    revision_history: track.revision_history, is_open_route: track.is_open_route };
}

export function sameCleanupSource(a: SavedTrackMap, b: SavedTrackMap) {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  return JSON.stringify(stable(cleanupSourceSnapshot(a))) === JSON.stringify(stable(cleanupSourceSnapshot(b)));
}

/** Segment correspondence keeps markers on the same piece of track at hairpins
 * and crossings; it does not find an unrelated nearest point after repair. */
export function mapCleanupCoordinate(point: Coordinate, pairs: CleanupPathPair[]): Coordinate {
  let best = Infinity, mapped = { ...point };
  const scale = Math.cos(point.lat * Math.PI / 180);
  for (const pair of pairs) {
    for (let i = 1; i < pair.before.length; i++) {
      const a = pair.before[i - 1], b = pair.before[i];
      const dx = (b.lng - a.lng) * scale, dy = b.lat - a.lat;
      const t = Math.max(0, Math.min(1, (((point.lng - a.lng) * scale) * dx + (point.lat - a.lat) * dy) / (dx * dx + dy * dy || 1)));
      const distance = ((point.lng - a.lng) * scale - t * dx) ** 2 + (point.lat - a.lat - t * dy) ** 2;
      if (distance >= best) continue;
      best = distance;
      const c = pair.after[i - 1], d = pair.after[i];
      mapped = {
        lat: point.lat + (c.lat - a.lat) * (1 - t) + (d.lat - b.lat) * t,
        lng: point.lng + (c.lng - a.lng) * (1 - t) + (d.lng - b.lng) * t
      };
    }
  }
  return mapped;
}

export function cleanupProgress(point: Coordinate, path: GpsPoint[]) {
  let best = Infinity, progress = 0, traveled = 0;
  const total = trackPathLengthMeters(path), scale = Math.cos(point.lat * Math.PI / 180);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = calculateDistanceMeters(a, b);
    const dx = (b.lng - a.lng) * scale, dy = b.lat - a.lat;
    const t = Math.max(0, Math.min(1, (((point.lng - a.lng) * scale) * dx + (point.lat - a.lat) * dy) / (dx * dx + dy * dy || 1)));
    const d = ((point.lng - a.lng) * scale - t * dx) ** 2 + (point.lat - a.lat - t * dy) ** 2;
    if (d < best) { best = d; progress = total ? (traveled + t * length) / total : 0; }
    traveled += length;
  }
  return progress;
}

export function remapCleanupSector(line: SectorLineDefinition, pairs: CleanupPathPair[], editorPath: GpsPoint[]) {
  const center = { lat: (line.start.lat + line.end.lat) / 2, lng: (line.start.lng + line.end.lng) / 2 };
  const mapped = mapCleanupCoordinate(center, pairs);
  const move = (p: Coordinate) => ({ lat: p.lat + mapped.lat - center.lat, lng: p.lng + mapped.lng - center.lng });
  return { ...line, start: move(line.start), end: move(line.end), progress: cleanupProgress(mapped, editorPath) };
}

function remapStartFinishData(data: Record<string, unknown> | null, pairs: CleanupPathPair[]) {
  if (!data) return data;
  const center = data.center as Coordinate | undefined;
  const line = data.line as { a: Coordinate; b: Coordinate } | undefined;
  if (!center || !line?.a || !line?.b) return data;
  const mapped = mapCleanupCoordinate(center, pairs);
  const move = (p: Coordinate) => ({ ...p, lat: p.lat + mapped.lat - center.lat, lng: p.lng + mapped.lng - center.lng });
  return { ...data, center: mapped, line: { ...line, a: move(line.a), b: move(line.b) } };
}

export type TrackCleanupPreview = {
  readonly expectedVersion: number;
  track: SavedTrackMap;
  pairs: CleanupPathPair[];
  editorPath: GpsPoint[];
  anomalies: Array<ScanAnomaly & { path: string }>;
  outliers: GpsPoint[];
  rejectedSegments: GpsPoint[][];
  diagnostics: Array<ExcursionDiagnostics & { path: string }>;
  restored: boolean;
};

export function previousCleanupGeometry(track: SavedTrackMap) {
  const latest = track.revision_history.at(-1);
  return latest?.kind === "scan_cleanup" && latest.before && typeof latest.before === "object"
    ? latest.before as Record<string, unknown> : null;
}

/** Pure preview: no writes and no mutation of the saved track or raw telemetry. */
export function buildTrackCleanupPreview(track: SavedTrackMap, restore = false): TrackCleanupPreview {
  const snapshot = restore ? previousCleanupGeometry(track) : null;
  if (restore && !snapshot) throw new Error("There is no previous scan to restore.");
  const context = { trackType: track.track_type, trackShape: track.track_shape, closed: !track.is_open_route };
  const next = { ...track };
  const pairs: CleanupPathPair[] = [], anomalies: TrackCleanupPreview["anomalies"] = [], outliers: GpsPoint[] = [];
  const rejectedSegments: GpsPoint[][] = [], diagnostics: TrackCleanupPreview["diagnostics"] = [];
  const storedPairs = (track.geojson?.properties as Record<string, unknown> | undefined)?.scanCleanupCorrespondence;
  for (const key of ["outside_path", "inside_path", "representative_path_smoothed"] as const) {
    const original = key === "representative_path_smoothed" && !track[key].length ? track.representative_path_raw : track[key];
    const result = snapshot ? { path: (snapshot[key] as GpsPoint[] | undefined) ?? [], anomalies: [], correspondencePath: null, diagnostics: null } : cleanTrackScan(original, context);
    // A raw-only representative scan becomes a processed path on save, while raw stays intact.
    next[key] = result.path;
    const target = result.path.length ? result.path : (key === "representative_path_smoothed" ? track.representative_path_raw : []);
    const restoredPair = snapshot && Array.isArray(storedPairs) ? (storedPairs as CleanupPathPair[]).find(pair => pair.path === key) : null;
    if (restoredPair && Array.isArray(restoredPair.before) && Array.isArray(restoredPair.after) && restoredPair.before.length === restoredPair.after.length) {
      pairs.push({ path: key, before: restoredPair.after, after: restoredPair.before });
    } else {
      const correspondence = result.correspondencePath ?? target;
      if (original.length !== correspondence.length) throw new Error("Scan point correspondence changed. Reload the track before cleaning it.");
      if (original.length > 1) pairs.push({ path: key, before: context.closed ? [...original, original[0]] : original, after: context.closed ? [...correspondence, correspondence[0]] : correspondence });
    }
    if (result.diagnostics) diagnostics.push({ ...result.diagnostics, path: key });
    for (const anomaly of result.anomalies) {
      anomalies.push({ ...anomaly, path: key });
      outliers.push(...anomaly.indices.map(i => original[i]));
      if (anomaly.kind === "excursion" && anomaly.anchorIndices) {
        rejectedSegments.push([original[anomaly.anchorIndices[0]], ...anomaly.indices.map(i => original[i]), original[anomaly.anchorIndices[1]]]);
      }
    }
  }
  if (!restore && !anomalies.length) return { expectedVersion: track.version ?? 1, track, pairs, editorPath: getTrackEditorPath(track), anomalies, outliers, rejectedSegments, diagnostics, restored: false };
  // Translate the complete timing gate so its width and crossing orientation survive.
  if (track.start_finish_path.length) {
    const center = {
      lat: track.start_finish_path.reduce((sum, p) => sum + p.lat, 0) / track.start_finish_path.length,
      lng: track.start_finish_path.reduce((sum, p) => sum + p.lng, 0) / track.start_finish_path.length
    };
    const mapped = mapCleanupCoordinate(center, pairs);
    next.start_finish_path = track.start_finish_path.map(p => ({ ...p, lat: p.lat + mapped.lat - center.lat, lng: p.lng + mapped.lng - center.lng }));
  }
  next.automatic_start_finish_data = remapStartFinishData(track.automatic_start_finish_data, pairs);
  next.manual_start_finish_data = remapStartFinishData(track.manual_start_finish_data, pairs);
  const oldEditor = getTrackEditorPath(track), editorPath = getTrackEditorPath(next);
  const definitions = track.corner_definitions as StoredCornerDefinitions | null | undefined;
  if (definitions?.corners?.length) {
    const corners = definitions.corners.map(corner => {
      const remap = (progress: number) => {
        if (progress === 0 || progress === 1) return progress;
        const oldPoint = sampleTrackPath(oldEditor, progress);
        return oldPoint ? cleanupProgress(mapCleanupCoordinate(oldPoint, pairs), editorPath) : progress;
      };
      const startProgress = remap(corner.startProgress), endProgress = remap(corner.endProgress), apexProgress = remap(corner.apexProgress);
      if (startProgress > apexProgress || apexProgress > endProgress) throw new Error("Cleanup would make a corner ambiguous. Keep this scan and adjust its markers first.");
      const apex = sampleTrackPath(editorPath, apexProgress) ?? corner.apex;
      return { ...corner, startProgress, endProgress, apexProgress, apex: { lat: apex.lat, lng: apex.lng }, physicalLengthMeters: (endProgress - startProgress) * trackPathLengthMeters(editorPath) };
    });
    next.corner_definitions = { ...definitions, corners };
  }
  const representative = next.representative_path_smoothed;
  const summary = summarizeGpsAccuracy(next.outside_path.length ? next.outside_path : representative, next.start_finish_path, next.inside_path);
  next.gps_summary = summary;
  next.bbox = summary.bbox ?? next.bbox;
  next.center_lat = summary.center?.lat ?? next.center_lat;
  next.center_lng = summary.center?.lng ?? next.center_lng;
  next.track_length_meters = trackPathLengthMeters(editorPath);
  if (track.estimated_length_meters !== null) next.estimated_length_meters = next.track_length_meters;
  // Disable template blending explicitly; retain the selected shape as metadata only.
  const layer = buildTelemetryBaseLayer({ outsidePath: next.outside_path.length ? next.outside_path : representative, insidePath: next.inside_path, startFinishLinePath: next.start_finish_path, trackType: next.track_type, trackShape: null, trackLength: next.track_length });
  next.base_layer = { ...layer.baseLayer, type: track.base_layer?.type ?? layer.baseLayer.type, trackShape: next.track_shape };
  next.preview_bounds = layer.previewBounds;
  next.geojson = { type: "FeatureCollection", features: [], ...track.geojson, properties: {
    ...(track.geojson?.properties as Record<string, unknown> ?? {}),
    traces: { ...((track.geojson?.properties as Record<string, unknown>)?.traces as Record<string, unknown> ?? {}), outside: next.outside_path, inside: next.inside_path, startFinish: next.start_finish_path,
      representativeRaw: next.representative_path_raw, representativeSmoothed: next.representative_path_smoothed },
    bbox: next.bbox, summary, cornerDefinitions: next.corner_definitions,
    scanCleanupCorrespondence: pairs
  } };
  return { expectedVersion: track.version ?? 1, track: next, pairs, editorPath, anomalies, outliers, rejectedSegments, diagnostics, restored: restore };
}
