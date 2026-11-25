// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { useId, useMemo } from "react";
import {
  getTrackEditorPath,
  sampleTrackPath,
  sliceTrackPath
} from "../circuit/trackEditorGeometry";
import { projectTrackForReplay, toSvgPath } from "../circuit/trackProjection";
import type { GpsPoint, SavedTrackMap } from "../circuit/onlylapsTrackScanUtils";
import type { CleanupPathPair } from "../circuit/trackCleanupPreview";

export type TrackMapRange = {
  start: number;
  end: number;
  color: string;
  label: string;
  preview?: boolean;
};

type TrackDefinitionMapProps = {
  track: SavedTrackMap;
  ranges: TrackMapRange[];
  ariaLabel: string;
  compact?: boolean;
  cleanup?: { pairs: CleanupPathPair[]; outliers: GpsPoint[]; rejectedSegments: GpsPoint[][] };
  cursor?: {
    progress: number;
    color: string;
  };
};

export function TrackDefinitionMap({
  track,
  ranges,
  ariaLabel,
  compact = false,
  cursor,
  cleanup
}: TrackDefinitionMapProps) {
  const rawId = useId();
  const markerId = rawId.replace(/:/g, "");
  const model = useMemo(() => {
    const editorPath = getTrackEditorPath(track);
    const segmentPaths = ranges.map((range) =>
      sliceTrackPath(editorPath, range.start, range.end)
    );
    const labelPoints = ranges.map((range) =>
      sampleTrackPath(editorPath, (range.start + range.end) / 2)
    ).filter((point): point is GpsPoint => point !== null);
    const cursorPoint = cursor ? sampleTrackPath(editorPath, cursor.progress) : null;
    const combined = [
      ...editorPath,
      ...segmentPaths.flat(),
      ...labelPoints,
      ...(cursorPoint ? [cursorPoint] : []),
      ...(cleanup?.pairs.flatMap(pair => [...pair.before, ...pair.after]) ?? []),
      ...(cleanup?.outliers ?? []),
      ...(cleanup?.rejectedSegments.flat() ?? [])
    ];
    const projected = projectTrackForReplay({
      outsidePath: track.outside_path,
      startFinishPath: track.start_finish_path,
      insidePath: track.inside_path,
      lapPath: combined
    });
    let projectionOffset = 0;
    const projectedEditorPath = projected.lap.slice(
      projectionOffset,
      projectionOffset + editorPath.length
    );
    projectionOffset += editorPath.length;
    const projectedSegments = segmentPaths.map((segment) => {
      const projectedSegment = projected.lap.slice(
        projectionOffset,
        projectionOffset + segment.length
      );
      projectionOffset += segment.length;
      return projectedSegment;
    });
    const projectedLabels = projected.lap.slice(
      projectionOffset,
      projectionOffset + labelPoints.length
    );
    projectionOffset += labelPoints.length;
    const projectedCursor = cursorPoint ? projected.lap[projectionOffset] : null;
    if (cursorPoint) projectionOffset++;
    const cleanupPaths = (cleanup?.pairs ?? []).map(pair => {
      const before = projected.lap.slice(projectionOffset, projectionOffset + pair.before.length);
      projectionOffset += pair.before.length;
      const after = projected.lap.slice(projectionOffset, projectionOffset + pair.after.length);
      projectionOffset += pair.after.length;
      return { before, after };
    });
    const outliers = projected.lap.slice(projectionOffset, projectionOffset + (cleanup?.outliers.length ?? 0));
    projectionOffset += cleanup?.outliers.length ?? 0;
    const rejectedSegments = (cleanup?.rejectedSegments ?? []).map(segment => {
      const projectedSegment = projected.lap.slice(projectionOffset, projectionOffset + segment.length);
      projectionOffset += segment.length;
      return projectedSegment;
    });
    return {
      projected,
      projectedEditorPath,
      projectedSegments,
      projectedLabels,
      projectedCursor,
      cleanupPaths,
      outliers,
      rejectedSegments
    };
  }, [cursor, ranges, track, cleanup]);

  return (
    <svg
      viewBox="0 0 320 220"
      role="img"
      aria-label={ariaLabel}
      className={`w-full rounded-[16px] border border-white/[0.08] bg-[#02060A] ${
        compact ? "h-[170px]" : "h-[260px]"
      }`}
    >
      <defs>
        <pattern id={`track-editor-grid-${markerId}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="220" fill={`url(#track-editor-grid-${markerId})`} />
      {model.cleanupPaths.map((pair, index) => (
        <path key={`raw-${index}`} d={toSvgPath(pair.before)} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
      ))}
      {model.projected.outside.length > 1 ? (
        <path
          d={toSvgPath(model.projected.outside)}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {model.projected.inside.length > 1 ? (
        <path
          d={toSvgPath(model.projected.inside)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {!cleanup && model.projectedEditorPath.length > 1 ? (
        <path
          d={toSvgPath(model.projectedEditorPath)}
          fill="none"
          stroke="rgba(226,232,240,0.38)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {model.projectedSegments.map((segment, index) =>
        segment.length > 1 ? (
          <path
            key={`${ranges[index].label}-${ranges[index].start}`}
            d={toSvgPath(segment)}
            fill="none"
            stroke={ranges[index].color}
            strokeWidth={ranges[index].preview ? 9 : 11}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={ranges[index].preview ? 0.72 : 0.95}
          />
        ) : null
      )}
      {model.cleanupPaths.map((pair, index) => (
        <path key={`clean-${index}`} d={toSvgPath(pair.after)} fill="none" stroke="#00A8E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {model.rejectedSegments.map((segment, index) => (
        <path key={`excursion-${index}`} d={toSvgPath(segment)} fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {model.outliers.map((point, index) => (
        <circle key={`outlier-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#FBBF24" stroke="#02060A" strokeWidth="1.5" />
      ))}
      {model.projected.startFinish.length > 1 ? (
        <g>
          <path
            d={toSvgPath(model.projected.startFinish)}
            fill="none"
            stroke="#02060A"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d={toSvgPath(model.projected.startFinish)}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <text
            x={(model.projected.startFinish[0].x + model.projected.startFinish[model.projected.startFinish.length - 1].x) / 2}
            y={(model.projected.startFinish[0].y + model.projected.startFinish[model.projected.startFinish.length - 1].y) / 2 - 9}
            textAnchor="middle"
            paintOrder="stroke"
            stroke="#02060A"
            strokeWidth="4"
            className="fill-white text-[10px] font-black"
          >
            START / FINISH
          </text>
        </g>
      ) : null}
      {!compact
        ? model.projectedLabels.map((point, index) => (
            <g key={`${ranges[index].label}-label`}>
              <circle cx={point.x} cy={point.y} r="10" fill="#02060A" stroke={ranges[index].color} strokeWidth="2" />
              <text
                x={point.x}
                y={point.y + 3.5}
                textAnchor="middle"
                className="fill-white text-[9px] font-black"
              >
                {ranges[index].label.replace(/[^0-9]/g, "") || ranges[index].label.slice(0, 2)}
              </text>
            </g>
          ))
        : null}
      {!compact && cursor && model.projectedCursor ? (
        <circle
          cx={model.projectedCursor.x}
          cy={model.projectedCursor.y}
          r="7"
          fill={cursor.color}
          stroke="#02060A"
          strokeWidth="3"
        />
      ) : null}
    </svg>
  );
}
