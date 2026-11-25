// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type {
  GpsPoint,
  TrackScanStage,
  TrackShapeValue,
  TrackTypeValue
} from "../circuit/onlylapsTrackScanUtils.ts";
import {
  buildTelemetryBaseLayer,
  formatTrackMetadataSummary
} from "../circuit/onlylapsTrackScanUtils.ts";

type TrackScanPreviewProps = {
  outsidePath: GpsPoint[];
  startFinishLinePath: GpsPoint[];
  insidePath: GpsPoint[];
  currentPoint?: GpsPoint | null;
  label?: string;
  scanStage?: TrackScanStage;
  trackLength?: string | null;
  trackShape?: TrackShapeValue | null;
  trackType?: TrackTypeValue | null;
};

const previewWidth = 320;
const previewHeight = 184;

function toPath(points: { x: number; y: number }[], close = false) {
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return close && points.length > 2 ? `${path} Z` : path;
}

function getFallbackStartFinishLine(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return null;
  }

  const point = points[Math.floor(points.length * 0.72) % points.length];

  return {
    x1: point.x,
    y1: Math.max(14, point.y - 15),
    x2: point.x,
    y2: Math.min(previewHeight - 14, point.y + 15)
  };
}

export function TrackScanPreview({
  outsidePath,
  startFinishLinePath,
  insidePath,
  currentPoint,
  label = "Live track preview",
  scanStage,
  trackLength,
  trackShape,
  trackType
}: TrackScanPreviewProps) {
  const { baseLayer, normalized } = buildTelemetryBaseLayer({
    outsidePath,
    startFinishLinePath,
    insidePath,
    currentPoint,
    trackLength,
    trackShape,
    trackType,
    width: previewWidth,
    height: previewHeight
  });
  const hasAnyPath =
    normalized.outside.length > 0 || normalized.startFinish.length > 0 || normalized.inside.length > 0;
  const basePath = baseLayer.centerlinePreview.length > 1 ? baseLayer.centerlinePreview : baseLayer.templatePath;
  const hasBaseLayer = basePath.length > 1;
  const fallbackStartFinish = getFallbackStartFinishLine(basePath);
  const trackDetailsSummary = formatTrackMetadataSummary({
    trackLength: trackLength ?? null,
    trackShape: trackShape ?? null,
    trackType: trackType ?? null
  });

  return (
    <section className="rounded-[20px] border border-white/[0.12] bg-[#050B11]/88 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B8C0CC]">
          {label}
        </p>
        <span className="rounded-full bg-[#007DAE]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#00A8E8]">
          {scanStage === "review" || scanStage === "saved" ? "Base" : "GPS"}
        </span>
      </div>
      {trackDetailsSummary ? (
        <p className="mb-2 truncate text-xs font-bold text-[#9CE2FF]">
          {trackDetailsSummary}
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${previewWidth} ${previewHeight}`}
        role="img"
        aria-label={label}
        className="h-[184px] w-full overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#02060A]"
      >
        <defs>
          <pattern id="scan-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>
          <filter id="scan-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={previewWidth} height={previewHeight} fill="url(#scan-grid)" />
        {hasBaseLayer ? (
          <>
            <path
              d={toPath(basePath, true)}
              fill="none"
              stroke="rgba(226,232,240,0.58)"
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={toPath(basePath, true)}
              fill="none"
              stroke="rgba(2,6,10,0.72)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={toPath(basePath, true)}
              fill="none"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="2"
              strokeDasharray="6 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {hasAnyPath ? (
          <>
            {normalized.outside.length > 1 ? (
              <path
                d={toPath(normalized.outside)}
                fill="none"
                stroke="#00A8E8"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#scan-glow)"
              />
            ) : null}
            {normalized.inside.length > 1 ? (
              <path
                d={toPath(normalized.inside)}
                fill="none"
                stroke="#7DD3FC"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {normalized.startFinish.length > 1 ? (
              <path
                d={toPath(normalized.startFinish)}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </>
        ) : (
          <text
            x="160"
            y="96"
            textAnchor="middle"
            className="fill-[#B8C0CC] text-[12px] font-bold"
          >
            Waiting for GPS trace
          </text>
        )}
        {normalized.startFinish.length <= 1 && fallbackStartFinish ? (
          <line
            x1={fallbackStartFinish.x1}
            y1={fallbackStartFinish.y1}
            x2={fallbackStartFinish.x2}
            y2={fallbackStartFinish.y2}
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : null}
        {normalized.current ? (
          <>
            <circle
              cx={normalized.current.x}
              cy={normalized.current.y}
              r="13"
              fill="rgba(56,189,248,0.24)"
            />
            <circle
              cx={normalized.current.x}
              cy={normalized.current.y}
              r="5.5"
              fill="#38D9FF"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </>
        ) : null}
      </svg>
    </section>
  );
}
