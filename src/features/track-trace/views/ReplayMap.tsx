// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useId, useMemo } from "react";
import type { GpsPoint, SavedTrackMap } from "../circuit/onlylapsTrackScanUtils.ts";
import {
  projectTrackForReplay,
  sampleAtProgress,
  toSvgPath,
  type ProjectedPoint
} from "../circuit/trackProjection.ts";

export type ReplayViewMode = "full" | "follow";
export type ReplayFollowTarget = string | "both";

export type ReplayMapTrace = {
  id: string;
  label: string;
  path: GpsPoint[];
  progress: number;
  color: string;
  dotColor?: string;
  dashed?: boolean;
  showDot?: boolean;
};

export type ReplayMapMarker = {
  id: string;
  label: string;
  point: GpsPoint;
};

type ReplayMapProps = {
  track: SavedTrackMap | null | undefined;
  traces: ReplayMapTrace[];
  title: string;
  viewMode: ReplayViewMode;
  onViewModeChange: (mode: ReplayViewMode) => void;
  followTarget?: ReplayFollowTarget;
  onFollowTargetChange?: (target: ReplayFollowTarget) => void;
  className?: string;
  markers?: ReplayMapMarker[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
};

const fullView = { x: 0, y: 0, width: 320, height: 220 };
const followWidth = 80;
const followZoom = fullView.width / followWidth;
const viewportCenter = {
  x: fullView.width / 2,
  y: fullView.height / 2
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function splitProjectedPaths(points: ProjectedPoint[], lengths: number[]) {
  let offset = 0;

  return lengths.map((length) => {
    const path = points.slice(offset, offset + length);
    offset += length;
    return path;
  });
}

function getFollowView(points: ProjectedPoint[]) {
  if (points.length === 0) {
    return fullView;
  }

  const center = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 }
  );
  center.x /= points.length;
  center.y /= points.length;
  const spreadX = Math.max(...points.map((point) => Math.abs(point.x - center.x))) * 2;
  const spreadY = Math.max(...points.map((point) => Math.abs(point.y - center.y))) * 2;
  const width = clamp(Math.max(followWidth, spreadX * 1.75, spreadY * (320 / 220) * 1.75), followWidth, 320);
  const height = width * (220 / 320);

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height
  };
}

export function ReplayMap({
  track,
  traces,
  title,
  viewMode,
  onViewModeChange,
  followTarget = traces[0]?.id ?? "both",
  onFollowTargetChange,
  className = "h-[230px]",
  markers = [],
  selectedMarkerId = null,
  onMarkerSelect
}: ReplayMapProps) {
  const rawId = useId();
  const filterId = `replay-dot-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const flatPath = useMemo(() => traces.flatMap((trace) => trace.path), [traces]);
  const projected = useMemo(
    () =>
      projectTrackForReplay({
        outsidePath: track?.outside_path ?? [],
        startFinishPath: track?.start_finish_path ?? [],
        insidePath: track?.inside_path ?? [],
        lapPath: flatPath,
        rawLapPath: markers.map((marker) => marker.point)
      }),
    [flatPath, markers, track]
  );
  const projectedTracePaths = useMemo(
    () => splitProjectedPaths(projected.lap, traces.map((trace) => trace.path.length)),
    [projected.lap, traces]
  );
  const currentPoints = projectedTracePaths.map((path, index) =>
    sampleAtProgress(path, traces[index]?.progress ?? 0)
  );
  const targetPoints = currentPoints.filter(
    (point, index): point is ProjectedPoint =>
      Boolean(point) && (followTarget === "both" || traces[index]?.id === followTarget)
  );
  const followedTraceIndex = followTarget === "both"
    ? -1
    : traces.findIndex((trace) => trace.id === followTarget);
  const followedPoint = followedTraceIndex >= 0 ? currentPoints[followedTraceIndex] : null;
  const lockFollowDot = viewMode === "follow" && followTarget !== "both" && Boolean(followedPoint);
  const desiredView = getFollowView(targetPoints);
  const viewBox = viewMode === "full" || lockFollowDot ? fullView : desiredView;
  // The current interpolated telemetry point is the authoritative camera center.
  // Moving the map beneath a fixed dot keeps camera and marker in the same render
  // cycle without effects, incremental lerping, or a second animation loop.
  const followTransform = lockFollowDot && followedPoint
    ? `translate(${viewportCenter.x} ${viewportCenter.y}) scale(${followZoom}) translate(${-followedPoint.x} ${-followedPoint.y})`
    : undefined;
  const fixedDotScale = lockFollowDot ? followZoom : 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/[0.16] bg-[#02060A] p-1" role="group" aria-label="Replay map view">
          <button
            type="button"
            onClick={() => onViewModeChange("full")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${
              viewMode === "full" ? "bg-white text-[#071018]" : "text-[#B8C0CC]"
            }`}
          >
            Full Track
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("follow")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${
              viewMode === "follow" ? "bg-[#007DAE] text-white" : "text-[#B8C0CC]"
            }`}
          >
            Follow Car - 4x
          </button>
        </div>
        {viewMode === "follow" && traces.length > 1 && onFollowTargetChange ? (
          <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#B8C0CC]">
            Follow
            <select
              value={followTarget}
              onChange={(event) => onFollowTargetChange(event.target.value)}
              className="min-h-9 rounded-full border border-white/[0.16] bg-[#071018] px-3 text-xs font-black text-white"
            >
              {traces.map((trace) => (
                <option key={trace.id} value={trace.id}>{trace.label}</option>
              ))}
              <option value="both">Both Cars</option>
            </select>
          </label>
        ) : null}
      </div>

      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label={title}
        data-replay-viewport="true"
        className={`${className} w-full overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#02060A]`}
      >
        <defs>
          <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="320" height="220" fill="rgba(255,255,255,0.02)" />
        <g transform={followTransform}>
          {projected.outside.length > 1 ? (
            <path d={toSvgPath(projected.outside)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {projected.inside.length > 1 ? (
            <path d={toSvgPath(projected.inside)} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {projected.startFinish.length > 1 ? (
            <path d={toSvgPath(projected.startFinish)} fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {projectedTracePaths.map((path, index) => {
            const trace = traces[index];
            return path.length > 1 ? (
              <path
                key={trace.id}
                d={toSvgPath(path)}
                fill="none"
                stroke={trace.color}
                strokeWidth="4"
                strokeDasharray={trace.dashed ? "7 7" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })}
          {projected.rawLap.map((point, index) => {
            const marker = markers[index];
            if (!marker) return null;
            const selected = marker.id === selectedMarkerId;
            return (
              <g
                key={marker.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${marker.label}`}
                aria-pressed={selected}
                onClick={() => onMarkerSelect?.(marker.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onMarkerSelect?.(marker.id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={selected ? 11 : 9}
                  fill={selected ? "#F59E0B" : "#071018"}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={point.y + 3.2}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="900"
                  fill="#FFFFFF"
                  pointerEvents="none"
                >
                  {marker.label.replace(/^Turn\s*/i, "")}
                </text>
              </g>
            );
          })}
          {currentPoints.map((point, index) => point && traces[index].showDot !== false && (!lockFollowDot || index !== followedTraceIndex) ? (
            <g
              key={`${traces[index].id}-dot`}
              filter={`url(#${filterId})`}
              role="img"
              aria-label={`${traces[index].label} GPS position`}
            >
              <circle cx={point.x} cy={point.y} r="8" fill={traces[index].dotColor ?? traces[index].color} opacity="0.28" />
              <circle cx={point.x} cy={point.y} r="4.8" fill={traces[index].dotColor ?? traces[index].color} stroke="#FFFFFF" strokeWidth="1.5" />
            </g>
          ) : null)}
        </g>
        {lockFollowDot && followedTraceIndex >= 0 && traces[followedTraceIndex]?.showDot !== false ? (
          <g
            filter={`url(#${filterId})`}
            role="img"
            aria-label={`${traces[followedTraceIndex].label} GPS position`}
          >
            <circle
              cx={viewportCenter.x}
              cy={viewportCenter.y}
              r={8 * fixedDotScale}
              fill={traces[followedTraceIndex].dotColor ?? traces[followedTraceIndex].color}
              opacity="0.28"
            />
            <circle
              cx={viewportCenter.x}
              cy={viewportCenter.y}
              r={4.8 * fixedDotScale}
              fill={traces[followedTraceIndex].dotColor ?? traces[followedTraceIndex].color}
              stroke="#FFFFFF"
              strokeWidth={1.5 * fixedDotScale}
              data-replay-follow-dot="true"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
