// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { isOvalTrackType, type GpsPoint, type TrackTypeValue, type TrackShapeValue } from "./onlylapsTrackScanUtils.ts";
import { detectTraceExcursions } from "./trackExcursions.ts";

type XY = { x: number; y: number };
export type CleanupContext = {
  trackType: TrackTypeValue | null;
  trackShape: TrackShapeValue | null;
  closed: boolean;
};
export type ScanAnomaly = { indices: number[]; confidence: number; kind: "spike" | "excursion"; anchorIndices?: [number, number] };

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted[mid] + sorted[Math.max(0, mid - (sorted.length % 2 === 0 ? 1 : 0))]) / 2 : 0;
}
const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
const subtract = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
function cosine(a: XY, b: XY) {
  const size = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return size > 0 ? (a.x * b.x + a.y * b.y) / size : 1;
}
function segmentDistance(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Local spike pass; the separate course-level pass below handles long excursions.
 * Requires two abnormal boundary jumps AND a short plausible bridge, plus local
 * deviation/reversal evidence. Long/ambiguous gaps are deliberately untouched.
 */
function cleanLocalSpikes(path: GpsPoint[], context: CleanupContext) {
  const unchanged = () => ({ path: path.map(p => ({ ...p })), anomalies: [] as ScanAnomaly[] });
  if (path.length < 16 || path.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) return unchanged();
  const lat0 = median(path.map(p => p.lat)), lng0 = median(path.map(p => p.lng));
  const scaleX = 111_320 * Math.cos(lat0 * Math.PI / 180), scaleY = 111_320;
  if (Math.abs(scaleX) < 100 || Math.max(...path.map(p => p.lng)) - Math.min(...path.map(p => p.lng)) > 180) return unchanged();
  const projected = path.map(p => ({ x: (p.lng - lng0) * scaleX, y: (p.lat - lat0) * scaleY }));
  const duplicate = context.closed && distance(projected[0], projected[projected.length - 1]) < 0.1;
  const points = duplicate ? projected.slice(0, -1) : projected;
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  const edges = Array.from({ length: context.closed ? n : n - 1 }, (_, i) => distance(at(i), at(i + 1)));
  const spacing = median(edges.filter(d => d > 0.05));
  if (spacing < 0.1) return unchanged();
  // A tri-oval/dogleg/custom course needs more evidence than a traditional oval.
  const irregular = ["tri_oval", "dogleg_oval", "d_shaped_oval", "custom_unknown"].includes(context.trackShape ?? "custom_unknown");
  const oval = isOvalTrackType(context.trackType);
  const factor = oval ? (irregular ? 4.5 : 3.5) : 6;
  const minimumScore = oval ? (irregular ? 0.82 : 0.78) : 0.9;
  const xs = points.map(p => p.x).sort((a, b) => a - b), ys = points.map(p => p.y).sort((a, b) => a - b);
  const quantile = (v: number[], q: number) => v[Math.floor((v.length - 1) * q)];
  const envelope = { left: quantile(xs, 0.05), right: quantile(xs, 0.95), bottom: quantile(ys, 0.05), top: quantile(ys, 0.95) };
  const candidates: Array<ScanAnomaly & { start: number; count: number; replacement: XY[] }> = [];
  const maxGap = Math.min(6, Math.floor(n * 0.05));
  for (let start = 0; start < n; start++) {
    for (let count = 1; count <= maxGap; count++) {
      if (!context.closed && (start < 2 || start + count + 1 >= n)) continue;
      const before = start - 1, after = start + count;
      const localEdges: number[] = [];
      const localSpeeds: number[] = [];
      for (const first of [before - 8, after]) {
        for (let j = first; j < first + 8; j++) {
          if (!context.closed && (j < 0 || j + 1 >= n)) continue;
          const index = (j + n) % n, next = (j + 1 + n) % n;
          const d = distance(at(j), at(j + 1));
          localEdges.push(d);
          const dt = (Date.parse(path[next].timestamp) - Date.parse(path[index].timestamp)) / 1000;
          if (dt > 0 && d > 0.05) localSpeeds.push(d / dt);
        }
      }
      const typical = Math.max(0.1, median(localEdges));
      const mad = median(localEdges.map(d => Math.abs(d - typical)));
      const threshold = Math.max(18, typical * factor, typical + 8 * mad);
      const a = at(before), b = at(after), entry = distance(a, at(start)), exit = distance(at(after - 1), b);
      if (entry < threshold || exit < threshold) continue;
      const bridge = distance(a, b);
      if (bridge < typical * 0.3 || bridge > typical * (count + 1) * 1.8) continue;
      const indices = Array.from({ length: count }, (_, j) => (start + j) % n);
      let detour = entry + exit;
      for (let j = 1; j < count; j++) detour += distance(at(start + j - 1), at(start + j));
      if (detour < Math.max(bridge * (oval ? 2.8 : 4), typical * (count + 1) * 2.5)) continue;
      const deviation = median(indices.map(i => segmentDistance(points[i], a, b)));
      const reversal = cosine(subtract(at(start), a), subtract(b, at(after - 1))) < -0.65;
      const outside = indices.some(i => {
        const p = points[i], margin = Math.max(typical * 3, 15);
        return p.x < envelope.left - margin || p.x > envelope.right + margin || p.y < envelope.bottom - margin || p.y > envelope.top + margin;
      });
      const boundarySpeeds = [before, after - 1].map(j => {
        const i = (j + n) % n, k = (j + 1 + n) % n;
        const seconds = (Date.parse(path[k].timestamp) - Date.parse(path[i].timestamp)) / 1000;
        return seconds > 0 ? distance(at(j), at(j + 1)) / seconds : null;
      });
      const localSpeed = median(localSpeeds);
      // Long sampling gaps can explain a real excursion/hairpin. Geometry alone
      // should not override credible movement at the surrounding session speed.
      if (localSpeeds.length >= 4 && boundarySpeeds.every(speed => speed !== null && speed <= localSpeed * 2.5)) continue;
      const abnormalSpeed = localSpeeds.length >= 4 && boundarySpeeds.every(speed => speed !== null && speed > localSpeed * factor);
      const score = 0.5 + (deviation > Math.max(12, typical * 2.5) ? 0.2 : 0) + (reversal ? 0.2 : 0) + (abnormalSpeed ? 0.05 : 0) + (oval && outside ? 0.05 : 0);
      if (score + 1e-9 < minimumScore) continue;
      // Use surrounding reliable tangents in a bounded cubic Hermite bridge.
      const incoming = subtract(a, at(before - 1)), outgoing = subtract(at(after + 1), b), chord = subtract(b, a);
      if (distance(a, at(before - 1)) > threshold || distance(b, at(after + 1)) > threshold || cosine(incoming, chord) < 0.25 || cosine(outgoing, chord) < 0.25) continue;
      const tangent = (v: XY) => { const length = Math.hypot(v.x, v.y) || 1; return { x: v.x / length * bridge, y: v.y / length * bridge }; };
      const m0 = tangent(incoming), m1 = tangent(outgoing);
      const replacement = indices.map((_, j) => {
        const t = (j + 1) / (count + 1), t2 = t * t, t3 = t2 * t;
        return {
          x: (2*t3-3*t2+1)*a.x + (t3-2*t2+t)*m0.x + (-2*t3+3*t2)*b.x + (t3-t2)*m1.x,
          y: (2*t3-3*t2+1)*a.y + (t3-2*t2+t)*m0.y + (-2*t3+3*t2)*b.y + (t3-t2)*m1.y
        };
      });
      if (replacement.some(p => segmentDistance(p, a, b) > bridge * 0.25)) continue;
      candidates.push({ kind: "spike", indices, confidence: Math.min(1, score), start, count, replacement });
    }
  }
  const result = unchanged();
  const occupied = new Set<number>();
  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence || a.count - b.count)) {
    const neighborhood = Array.from({ length: candidate.count + 4 }, (_, j) => (candidate.start - 2 + j + n) % n);
    if (neighborhood.some(i => occupied.has(i))) continue;
    candidate.indices.forEach((i, j) => {
      result.path[i] = { ...path[i], lat: lat0 + candidate.replacement[j].y / scaleY, lng: lng0 + candidate.replacement[j].x / scaleX };
      occupied.add(i);
    });
    result.anomalies.push({ kind: "spike", indices: candidate.indices, confidence: candidate.confidence });
  }
  // Widespread corruption is outside the scope of a safe automatic repair.
  if (occupied.size > n * 0.12) return unchanged();
  if (duplicate && occupied.has(0)) result.path[path.length - 1] = { ...path[path.length - 1], lat: result.path[0].lat, lng: result.path[0].lng };
  return result;
}

export function cleanTrackScan(path: GpsPoint[], context: CleanupContext) {
  const local = cleanLocalSpikes(path, context);
  const excursions = detectTraceExcursions(local.path, context);
  const segmentIndices = new Set(excursions.anomalies.flatMap(anomaly => anomaly.indices));
  return { ...excursions, anomalies: [...local.anomalies.filter(anomaly => !anomaly.indices.some(i => segmentIndices.has(i))), ...excursions.anomalies] };
}
