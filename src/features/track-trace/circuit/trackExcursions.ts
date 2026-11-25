// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { isOvalTrackType, type GpsPoint } from "./onlylapsTrackScanUtils.ts";
import type { CleanupContext, ScanAnomaly } from "./trackScanCleanup.ts";

type XY = { x: number; y: number };
type OvalModel = { center: XY; a: number; b: number; angle: number };
export type ExcursionDiagnostic = {
  startIndex: number;
  endIndex: number;
  pointCount: number;
  maximumDistanceFromDominantCourse: number;
  medianCourseDeviation: number;
  detourRatio: number;
  courseEnvelopeRatio: number;
  boundingBoxImpact: number;
  reconnectDistance: number;
  trackType: CleanupContext["trackType"];
  trackShape: CleanupContext["trackShape"];
  anomalyScore: number;
  accepted: boolean;
  reasons: string[];
};
export type ExcursionDiagnostics = {
  reasons: string[];
  model: { medianDeviation: number; envelopeMeters: number; supportedFraction: number } | null;
  segments: ExcursionDiagnostic[];
};

const tau = Math.PI * 2;
const mod = (i: number, n: number) => (i % n + n) % n;
const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const unit = (v: XY): XY => { const length = Math.hypot(v.x, v.y) || 1; return { x: v.x / length, y: v.y / length }; };
const dot = (a: XY, b: XY) => a.x * b.x + a.y * b.y;
const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)] ?? 0;
const median = (values: number[]) => quantile(values, 0.5);
const angularDifference = (a: number, b: number) => mod(b - a + Math.PI, tau) - Math.PI;

/** Pivoted elimination for the five coefficients of a normalized conic. */
function solve(matrix: number[][], rhs: number[]) {
  const rows = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < rhs.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < rhs.length; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    if (Math.abs(rows[pivot][col]) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= rhs.length; j++) rows[col][j] /= divisor;
    for (let row = 0; row < rhs.length; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j <= rhs.length; j++) rows[row][j] -= factor * rows[col][j];
    }
  }
  return rows.map(row => row[rhs.length]);
}

function fitConic(points: XY[], origin: XY, scale: number): OvalModel | null {
  const rows = points.map(p => {
    const x = (p.x - origin.x) / scale, y = (p.y - origin.y) / scale;
    return [x * x, x * y, y * y, x, y];
  });
  const coefficients = rows.length === 5 ? solve(rows, rows.map(() => 1)) : solve(
    Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => rows.reduce((sum, row) => sum + row[i] * row[j], 0))),
    Array.from({ length: 5 }, (_, i) => rows.reduce((sum, row) => sum + row[i], 0))
  );
  if (!coefficients) return null;
  const [a, b, c, d, e] = coefficients, determinant = a * c - b * b / 4;
  if (determinant <= 1e-9 || a <= 0 || c <= 0) return null;
  const x = (b * e / 2 - c * d) / (2 * determinant);
  const y = (b * d / 2 - a * e) / (2 * determinant);
  const radius = 1 + a * x * x + b * x * y + c * y * y;
  const spread = Math.hypot(a - c, b);
  const major = scale * Math.sqrt(radius / ((a + c - spread) / 2));
  const minor = scale * Math.sqrt(radius / ((a + c + spread) / 2));
  if (!Number.isFinite(major) || !Number.isFinite(minor) || minor < scale * 0.1 || major > scale * 3 || major / minor > 8) return null;
  const center = { x: origin.x + x * scale, y: origin.y + y * scale };
  if (distance(center, origin) > scale) return null;
  return { center, a: major, b: minor, angle: Math.atan2(b, a - c) / 2 + Math.PI / 2 };
}

function ovalCoordinates(p: XY, model: OvalModel) {
  const dx = p.x - model.center.x, dy = p.y - model.center.y;
  return { x: (dx * Math.cos(model.angle) + dy * Math.sin(model.angle)) / model.a,
    y: (-dx * Math.sin(model.angle) + dy * Math.cos(model.angle)) / model.b };
}
function deviation(p: XY, model: OvalModel) {
  const normalized = ovalCoordinates(p, model), radius = Math.hypot(normalized.x, normalized.y);
  return radius > 1e-9 ? (radius - 1) * distance(p, model.center) / radius : -model.b;
}
function angleAt(p: XY, model: OvalModel) {
  const normalized = ovalCoordinates(p, model);
  return Math.atan2(normalized.y, normalized.x);
}
function tangentAt(angle: number, model: OvalModel, direction: number) {
  const x = -model.a * Math.sin(angle), y = model.b * Math.cos(angle);
  return unit({ x: direction * (x * Math.cos(model.angle) - y * Math.sin(model.angle)),
    y: direction * (x * Math.sin(model.angle) + y * Math.cos(model.angle)) });
}
function ovalPoint(angle: number, model: OvalModel): XY {
  const x = model.a * Math.cos(angle), y = model.b * Math.sin(angle);
  return { x: model.center.x + x * Math.cos(model.angle) - y * Math.sin(model.angle),
    y: model.center.y + x * Math.sin(model.angle) + y * Math.cos(model.angle) };
}

/** Fixed-seed RANSAC plus trimmed refitting. Hypotheses are scored by the best
 * 65% of the scan, so a densely sampled branch cannot stretch its own envelope.
 * Coordinates are conditioned in meters; only the model is fitted, never the trace.
 */
function dominantOval(points: XY[]) {
  // Bound fitting work without weighting long straight detours by their length.
  const sampled = points.length > 480 ? Array.from({ length: 480 }, (_, i) => points[Math.floor(i * points.length / 480)]) : points;
  // Propose a retraced branch before fitting, without assuming any ellipse.
  // This prevents 50 densely sampled detour points from outvoting a legitimate
  // asymmetric corner. Exclusion is only a fitting aid, never a removal rule.
  const initialCenter = { x: median(sampled.map(p => p.x)), y: median(sampled.map(p => p.y)) };
  const initialScale = median(sampled.map(p => distance(p, initialCenter)));
  const cumulative = [0];
  for (let i = 0; i < sampled.length * 2; i++) cumulative.push(cumulative[i] + distance(sampled[i % sampled.length], sampled[(i + 1) % sampled.length]));
  let proposal: { start: number; count: number; score: number } | null = null;
  for (let start = 0; start < sampled.length; start++) {
    for (let count = 2; count <= sampled.length * 0.35; count++) {
      const detour = cumulative[start + count] - cumulative[start];
      const chord = distance(sampled[start], sampled[(start + count) % sampled.length]);
      if (chord > initialScale * 0.3 || detour < initialScale * 0.6 || detour < Math.max(chord, initialScale * 0.03) * 5) continue;
      const score = detour - 4 * chord;
      if (!proposal || score > proposal.score) proposal = { start, count, score };
    }
  }
  const sample = proposal ? sampled.filter((_, i) => {
    const offset = mod(i - proposal.start, sampled.length);
    return offset === 0 || offset >= proposal.count;
  }) : sampled;
  const origin = { x: median(sample.map(p => p.x)), y: median(sample.map(p => p.y)) };
  const scale = median(sample.map(p => distance(p, origin)));
  if (scale < 5) return null;
  let seed = 0x51f15e, best: OvalModel | null = null, bestScore = Infinity;
  for (let trial = 0; trial < 320; trial++) {
    const indices = new Set<number>();
    while (indices.size < 5) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      indices.add(seed % sample.length);
    }
    const model = fitConic([...indices].map(i => sample[i]), origin, scale);
    if (!model) continue;
    const errors = sample.map(p => Math.abs(deviation(p, model))).sort((a, b) => a - b);
    const count = Math.floor(errors.length * 0.65);
    const score = errors.slice(0, count).reduce((sum, value) => sum + value * value, 0) / count;
    if (score < bestScore) { best = model; bestScore = score; }
  }
  if (!best) return null;
  for (let iteration = 0; iteration < 3; iteration++) {
    const current: OvalModel = best;
    const ranked = sample.map(p => ({ p, error: Math.abs(deviation(p, current)) })).sort((a, b) => a.error - b.error);
    best = fitConic(ranked.slice(0, Math.ceil(sample.length * (proposal ? 0.9 : 0.7))).map(item => item.p), origin, scale) ?? best;
  }
  return best;
}

function circularRuns(mask: boolean[]) {
  const start = mask.findIndex(value => !value);
  if (start < 0) return [];
  const runs: number[][] = [];
  let current: number[] = [];
  for (let offset = 1; offset <= mask.length; offset++) {
    const i = mod(start + offset, mask.length);
    if (mask[i]) current.push(i);
    else if (current.length) { runs.push(current); current = []; }
  }
  return runs;
}

function arcLength(model: OvalModel, angle: number, sweep: number) {
  let length = 0, previous = ovalPoint(angle, model);
  for (let step = 1; step <= 32; step++) {
    const current = ovalPoint(angle + sweep * step / 32, model);
    length += distance(previous, current);
    previous = current;
  }
  return length;
}

function hermiteBridge(a: XY, b: XY, incoming: XY, outgoing: XY, incomingLength: number, outgoingLength: number) {
  const curve = Array.from({ length: 97 }, (_, i) => {
    const t = i / 96, t2 = t * t, t3 = t2 * t;
    return { x: (2*t3-3*t2+1)*a.x + (t3-2*t2+t)*incoming.x*incomingLength + (-2*t3+3*t2)*b.x + (t3-t2)*outgoing.x*outgoingLength,
      y: (2*t3-3*t2+1)*a.y + (t3-2*t2+t)*incoming.y*incomingLength + (-2*t3+3*t2)*b.y + (t3-t2)*outgoing.y*outgoingLength };
  });
  const cumulative = [0];
  for (let i = 1; i < curve.length; i++) cumulative.push(cumulative[i - 1] + distance(curve[i - 1], curve[i]));
  const length = cumulative.at(-1)!;
  const sample = (fraction: number) => {
    const target = fraction * length;
    const i = Math.max(1, cumulative.findIndex(d => d >= target));
    const t = (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
    return { x: curve[i - 1].x + (curve[i].x - curve[i - 1].x) * t,
      y: curve[i - 1].y + (curve[i].y - curve[i - 1].y) * t };
  };
  return { curve, length, sample };
}

export function detectTraceExcursions(path: GpsPoint[], context: CleanupContext) {
  const diagnostics: ExcursionDiagnostics = { reasons: [], model: null, segments: [] };
  const result = { path: path.map(p => ({ ...p })), correspondencePath: path.map(p => ({ ...p })), anomalies: [] as ScanAnomaly[], diagnostics };
  if (!context.closed || !isOvalTrackType(context.trackType)) {
    diagnostics.reasons.push("oval_prior_not_applicable");
    return result;
  }
  if (path.length < 24 || path.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) {
    diagnostics.reasons.push("insufficient_valid_course_samples");
    return result;
  }
  const origin = { lat: median(path.map(p => p.lat)), lng: median(path.map(p => p.lng)) };
  const scaleX = 111_320 * Math.cos(origin.lat * Math.PI / 180);
  if (Math.abs(scaleX) < 100 || path.some(p => Math.abs(p.lng - origin.lng) > 180)) {
    diagnostics.reasons.push("unsupported_projection_extent");
    return result;
  }
  const toXY = (p: GpsPoint): XY => ({ x: (p.lng - origin.lng) * scaleX, y: (p.lat - origin.lat) * 111_320 });
  const toGps = (p: XY, source: GpsPoint): GpsPoint => ({ ...source, lat: origin.lat + p.y / 111_320, lng: origin.lng + p.x / scaleX });
  const projected = path.map(toXY);
  const duplicate = distance(projected[0], projected.at(-1)!) < 0.1;
  const points = duplicate ? projected.slice(0, -1) : projected;
  const n = points.length, at = (i: number) => points[mod(i, n)];
  const spacing = median(points.map((p, i) => distance(p, at(i + 1))).filter(d => d > 0.05));
  const model = dominantOval(points);
  if (!model || spacing < 0.1) { diagnostics.reasons.push("no_supported_oval_model"); return result; }
  const deviations = points.map(p => Math.abs(deviation(p, model)));
  const coreDeviations = [...deviations].sort((a, b) => a - b).slice(0, Math.ceil(n * 0.8));
  const typical = median(coreDeviations), mad = median(coreDeviations.map(d => Math.abs(d - typical)));
  const strong = ["symmetrical_oval", "paperclip_oval", "flat_oval", "high_banked_oval", "short_track_oval"].includes(context.trackShape ?? "");
  const triOval = context.trackShape === "tri_oval";
  const tolerance = Math.max(5, model.b * 0.05, spacing * 1.5, typical + (strong ? 7 : triOval ? 9 : 11) * mad);
  const supported = deviations.filter(d => d <= tolerance).length / n;
  const angularBins = new Set(points.filter((_, i) => deviations[i] <= tolerance).map(p => Math.floor(mod(angleAt(p, model), tau) / tau * 24)));
  diagnostics.model = { medianDeviation: typical, envelopeMeters: tolerance, supportedFraction: supported };
  if (supported < 0.65 || angularBins.size < 19 || tolerance > model.b * 0.55) {
    diagnostics.reasons.push("dominant_loop_not_reliable");
    return result;
  }
  const angles = points.map(p => angleAt(p, model));
  const direction = Math.sign(median(points.flatMap((_, i) => deviations[i] <= tolerance && deviations[mod(i + 1, n)] <= tolerance ? [angularDifference(angles[i], angles[mod(i + 1, n)])] : [])));
  if (!direction) { diagnostics.reasons.push("travel_direction_ambiguous"); return result; }
  const trustedTolerance = Math.max(spacing * 0.65, typical + 3 * mad, tolerance * 0.25);
  const neighborhoodTangent = (i: number, side: -1 | 1) => unit(side === -1 ? sub(at(i), at(i - 3)) : sub(at(i + 3), at(i)));
  const trustedAnchor = (i: number, side: -1 | 1) =>
    [0, 1, 2, 3].every(offset => deviations[mod(i + side * offset, n)] <= trustedTolerance) &&
    dot(neighborhoodTangent(i, side), tangentAt(angles[mod(i, n)], model, direction)) > 0.65 &&
    dot(unit(side === -1 ? sub(at(i), at(i - 1)) : sub(at(i + 1), at(i))), tangentAt(angles[mod(i, n)], model, direction)) > 0.45;
  const occupied = new Set<number>();
  const replacements = new Map<number, GpsPoint[]>();
  const removed = new Set<number>();
  for (const run of circularRuns(deviations.map(d => d > tolerance))) {
    if (run.some(i => occupied.has(i))) continue;
    let before = run[0] - 1, after = run.at(-1)! + 1;
    const searchLimit = Math.floor(n * 0.35);
    let backward = 0, forward = 0;
    while (!trustedAnchor(before, -1) && backward < searchLimit) { before--; backward++; }
    while (!trustedAnchor(after, 1) && forward < searchLimit) { after++; forward++; }
    // A tangent departure can initially resemble a straightaway, then overshoot
    // its eventual return point. Backtrack to a reliable anchor BEFORE that
    // return in travel order; do not interpret the overshoot as an almost-full lap.
    while (mod(direction * (angles[mod(after, n)] - angles[mod(before, n)]), tau) > 1.8 && distance(at(before), at(after)) > spacing * 0.5 && backward < searchLimit) {
      before--; backward++;
      while (!trustedAnchor(before, -1) && backward < searchLimit) { before--; backward++; }
    }
    before = mod(before, n); after = mod(after, n);
    const count = mod(after - before - 1, n);
    const indices = Array.from({ length: count }, (_, offset) => mod(before + offset + 1, n));
    if (!indices.length) continue;
    const a = at(before), b = at(after), anchorDistance = distance(a, b);
    let actualDistance = 0, previous = a;
    for (const i of [...indices, after]) { actualDistance += distance(previous, at(i)); previous = at(i); }
    let sweep = mod(direction * (angles[after] - angles[before]), tau);
    if (anchorDistance < spacing * 0.5 && sweep > Math.PI) sweep = 0;
    const expectedLength = arcLength(model, angles[before], direction * sweep);
    const detourRatio = actualDistance / Math.max(expectedLength, anchorDistance, spacing * 2);
    const maximumDeviation = Math.max(...indices.map(i => deviations[i]));
    const envelopeRatio = maximumDeviation / tolerance;
    // Scale measured in the model's axes, not the contaminated scan bounding box.
    const boundingBoxImpact = Math.max(...indices.map(i => {
      const p = ovalCoordinates(at(i), model);
      return Math.max(Math.abs(p.x), Math.abs(p.y)) - 1;
    }));
    const branch = anchorDistance < model.b * 0.8 && detourRatio > 4;
    const reasons = ["outside_oval_envelope", "leave_and_return"];
    const score = Math.min(1, 0.25 + (envelopeRatio > 2 ? 0.2 : 0) + (detourRatio > 3 ? 0.25 : 0) + (branch ? 0.15 : 0) + (boundingBoxImpact > 0.15 ? 0.05 : 0) + (strong ? 0.1 : triOval ? 0.05 : 0));
    if (envelopeRatio > 2) reasons.push("large_course_excursion");
    if (detourRatio > 3) reasons.push("excessive_detour_ratio");
    if (branch) reasons.push("branch_geometry");
    if (boundingBoxImpact > 0.15) reasons.push("bounding_box_expansion");
    const diagnostic: ExcursionDiagnostic = { startIndex: indices[0], endIndex: indices.at(-1)!, pointCount: count,
      maximumDistanceFromDominantCourse: maximumDeviation, medianCourseDeviation: typical,
      detourRatio, courseEnvelopeRatio: envelopeRatio, boundingBoxImpact, reconnectDistance: anchorDistance,
      trackType: context.trackType, trackShape: context.trackShape, anomalyScore: score, accepted: false, reasons };
    diagnostics.segments.push(diagnostic);
    if (backward >= searchLimit || forward >= searchLimit || count > n * 0.35 || sweep > (strong ? 1.8 : 1.3) || indices.some(i => occupied.has(i))) {
      reasons.push("insufficient_reliable_anchors"); continue;
    }
    if (envelopeRatio < (strong ? 2 : triOval ? 2.5 : 3) || detourRatio < (strong ? 3.5 : triOval ? 4.5 : 5) || score < (strong ? 0.85 : 0.9)) {
      reasons.push("insufficient_segment_evidence"); continue;
    }
    const reconstructionTangent = (i: number, side: -1 | 1) => {
      const near = side === -1 ? unit(sub(at(i), at(i - 1))) : unit(sub(at(i + 1), at(i)));
      const far = side === -1 ? unit(sub(at(i - 1), at(i - 2))) : unit(sub(at(i + 2), at(i + 1)));
      const extrapolated = unit({ x: near.x * 1.5 - far.x * 0.5, y: near.y * 1.5 - far.y * 0.5 });
      return dot(extrapolated, tangentAt(angles[i], model, direction)) > 0.65 ? extrapolated : neighborhoodTangent(i, side);
    };
    const tangentLength = (angle: number) => Math.min(Math.hypot(model.a * Math.sin(angle), model.b * Math.cos(angle)) * sweep, anchorDistance * 2.5);
    const bridge = hermiteBridge(a, b, reconstructionTangent(before, -1), reconstructionTangent(after, 1), tangentLength(angles[before]), tangentLength(angles[after]));
    const leavesEnvelope = bridge.curve.some(p => Math.abs(deviation(p, model)) > tolerance);
    const reverses = bridge.curve.some((p, i) => i > 0 && distance(p, bridge.curve[i - 1]) > 0.01 && dot(unit(sub(p, bridge.curve[i - 1])), tangentAt(angleAt(p, model), model, direction)) < 0);
    if (leavesEnvelope || reverses || bridge.length > Math.max(expectedLength * 1.5, spacing * 3)) {
      reasons.push("reconstruction_not_confident"); continue;
    }
    if (occupied.size + count > n * 0.35) { reasons.push("too_much_uncertain_geometry"); continue; }
    diagnostic.accepted = true;
    indices.forEach((i, offset) => {
      occupied.add(i); removed.add(i);
      result.correspondencePath[i] = toGps(bridge.sample((offset + 1) / (count + 1)), path[i]);
    });
    // Compact the repaired arc to ordinary sample spacing. The dense mapping is
    // retained separately for marker projection and exact reverse correspondence.
    const replacementCount = Math.max(0, Math.round(bridge.length / spacing) - 1);
    const replacement = Array.from({ length: replacementCount }, (_, i) => {
      const fraction = (i + 1) / (replacementCount + 1);
      return toGps(bridge.sample(fraction), path[indices[Math.min(count - 1, Math.floor(fraction * count))]]);
    });
    replacements.set(indices[0], replacement);
    result.anomalies.push({ kind: "excursion", indices, confidence: score, anchorIndices: [before, after] });
  }
  if (!result.anomalies.length) { diagnostics.reasons.push("no_confident_excursions"); return result; }
  // Start at the first retained sample when an excursion crosses the recording
  // seam. The saved start/finish gate, rather than array index zero, defines a lap.
  const first = removed.has(0) ? points.findIndex((_, i) => !removed.has(i)) : 0;
  result.path = [];
  for (let offset = 0; offset < n; offset++) {
    const i = mod(first + offset, n);
    if (replacements.has(i)) result.path.push(...replacements.get(i)!);
    if (!removed.has(i)) result.path.push({ ...path[i] });
  }
  if (duplicate) {
    result.path.push({ ...result.path[0], timestamp: path.at(-1)!.timestamp });
    result.correspondencePath[path.length - 1] = { ...path.at(-1)!, lat: result.correspondencePath[0].lat, lng: result.correspondencePath[0].lng };
  }
  return result;
}
