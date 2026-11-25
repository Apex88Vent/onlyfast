// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_BETA_REVIEW.md.
import { useEffect, useId, useState } from "react";
import {gForceVisual,G_FORCE_VISUAL} from "../circuit/gForceVisual.ts";

type GForceIndicatorProps = {
  speedMph: number | null | undefined;
  lateralG: number | null | undefined;
  accelG: number | null | undefined;
  brakingG: number | null | undefined;
  maxLateralG?: number | null;
  maxAccelG?: number | null;
  maxBrakingG?: number | null;
  active?: boolean;
  size?: "normal" | "large";
};

type QuarterSegment = "frontLeft" | "frontRight" | "rearLeft" | "rearRight";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) : "--";
}

function formatSigned(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function getGZoneColor(totalG: number) {
  if (totalG >= G_FORCE_VISUAL.red) {
    return "#DC2626";
  }

  if (totalG >= G_FORCE_VISUAL.yellow) {
    return "#FFD84A";
  }

  return "#007DAE";
}

function polarPoint(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians)
  };
}

function describeArcPath(radius: number, startAngleDegrees: number, endAngleDegrees: number) {
  const start = polarPoint(80, 80, radius, startAngleDegrees);
  const end = polarPoint(80, 80, radius, endAngleDegrees);
  const largeArcFlag = Math.abs(endAngleDegrees - startAngleDegrees) > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

const quarterArcAngles: Record<QuarterSegment, [number, number]> = {
  frontRight: [-90, 0],
  rearRight: [0, 90],
  rearLeft: [90, 180],
  frontLeft: [180, 270]
};

const loadRings = [
  {
    color: "#15803D",
    name: "green",
    radius: 19
  },
  {
    color: "#FFD84A",
    name: "yellow",
    radius: 24
  },
  {
    color: "#DC2626",
    name: "red",
    radius: 48
  }
] as const;

function getActiveRingIndex(totalG: number) {
  if (totalG >= G_FORCE_VISUAL.red) {
    return 2;
  }

  if (totalG >= G_FORCE_VISUAL.yellow) {
    return 1;
  }

  return 0;
}

function getActiveQuarterSegments(lateral: number, longitudinal: number, totalG: number) {
  if (totalG < 0.05) {
    return [] satisfies QuarterSegment[];
  }

  const axisOffsetDegrees =
    Math.atan2(Math.abs(lateral), Math.max(Math.abs(longitudinal), 0.001)) * (180 / Math.PI);

  if (axisOffsetDegrees <= 20 && Math.abs(longitudinal) > 0.05) {
    return longitudinal >= 0
      ? (["frontLeft", "frontRight"] satisfies QuarterSegment[])
      : (["rearLeft", "rearRight"] satisfies QuarterSegment[]);
  }

  if (longitudinal >= 0 && lateral < 0) {
    return ["frontLeft"] satisfies QuarterSegment[];
  }

  if (longitudinal >= 0) {
    return ["frontRight"] satisfies QuarterSegment[];
  }

  if (lateral < 0) {
    return ["rearLeft"] satisfies QuarterSegment[];
  }

  return ["rearRight"] satisfies QuarterSegment[];
}

export function GForceIndicator({
  active,
  lateralG,
  accelG,
  brakingG,
  size = "normal"
}: GForceIndicatorProps) {
  const idPrefix = useId().replace(/:/g, "");
  const hasMotion =
    active ??
    [lateralG, accelG, brakingG].some(
      (value) => typeof value === "number" && Number.isFinite(value)
  );
  const lateral = hasMotion ? getNumber(lateralG) : 0;
  const acceleration = hasMotion ? getNumber(accelG) : 0;
  const braking = hasMotion ? getNumber(brakingG) : 0;
  const longitudinal = braking > acceleration ? braking : -acceleration;
  const [displayedLoad, setDisplayedLoad] = useState({
    lateral: 0,
    longitudinal: 0
  });
  const displayedTotalG = Math.hypot(displayedLoad.lateral, displayedLoad.longitudinal);
  const limitG = G_FORCE_VISUAL.red;
  const usableRadius = 48;
  const displayCoordinates = gForceVisual(displayedLoad.lateral, displayedLoad.longitudinal);
  const dotX = 80 + displayCoordinates.x * usableRadius;
  const dotY = 80 + displayCoordinates.y * usableRadius;
  const load = clamp(displayedTotalG / limitG, 0, 1);
  const zoneColor = getGZoneColor(displayedTotalG);
  const leftLoad = clamp(Math.max(0, -displayedLoad.lateral) / limitG, 0, 1);
  const rightLoad = clamp(Math.max(0, displayedLoad.lateral) / limitG, 0, 1);
  const brakeLoad = clamp(Math.max(0, displayedLoad.longitudinal) / limitG, 0, 1);
  const accelLoad = clamp(Math.max(0, -displayedLoad.longitudinal) / limitG, 0, 1);
  const activeRingIndex = getActiveRingIndex(displayedTotalG);
  const activeRing = loadRings[activeRingIndex];
  const activeQuarterSegments = getActiveQuarterSegments(
    displayedLoad.lateral,
    displayedLoad.longitudinal,
    Math.hypot(displayedLoad.lateral, displayedLoad.longitudinal)
  );
  const sizeClassName =
    size === "large"
      ? "aspect-square w-full max-w-[141px] overflow-visible sm:max-w-[174px]"
      : "aspect-square w-full max-w-[94px] overflow-visible sm:max-w-[116px]";

  useEffect(() => {
    let animationFrame = 0;
    const target = {
      lateral,
      longitudinal
    };

    function step() {
      setDisplayedLoad((current) => {
        const next = {
          lateral: current.lateral + (target.lateral - current.lateral) * 0.28,
          longitudinal:
            current.longitudinal + (target.longitudinal - current.longitudinal) * 0.28
        };
        const settled =
          Math.abs(next.lateral - target.lateral) < 0.01 &&
          Math.abs(next.longitudinal - target.longitudinal) < 0.01;

        if (!settled) {
          animationFrame = window.requestAnimationFrame(step);
          return next;
        }

        return target;
      });
    }

    animationFrame = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [lateral, longitudinal]);

  return (
    <div className="flex h-full items-center justify-center">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label="G-force indicator"
        data-visual-limit-g={G_FORCE_VISUAL.red}
        data-yellow-threshold-g={G_FORCE_VISUAL.yellow}
        data-actual-g={Math.hypot(lateral,longitudinal)}
        className={sizeClassName}
      >


        <circle cx="80" cy="80" r="72" fill="rgba(47,155,255,0.05)" />
        <circle
          cx="80"
          cy="80"
          r="62"
          fill="#FFFFFF"
          stroke="rgba(71,85,105,0.25)"
          strokeWidth="1.5"
        />
        {loadRings.map((ring) => (
          <circle
            key={ring.name}
            cx="80"
            cy="80"
            r={ring.radius}
            fill="none"
            stroke={ring.color}
            strokeWidth="2"
            opacity={hasMotion ? 0.2 : 0.08}
          />
        ))}
        {hasMotion
          ? activeQuarterSegments.map((segment) => {
              const [startAngle, endAngle] = quarterArcAngles[segment];

              return (
                <path
                  key={`${segment}-${activeRing.name}`}
                  d={describeArcPath(activeRing.radius, startAngle, endAngle)}
                  fill="none"
                  stroke={activeRing.color}
                  strokeLinecap="round"
                  strokeWidth="7"

                  opacity="0.96"
                />
              );
            })
          : null}
        <line
          x1="80"
          y1="80"
          x2="28"
          y2="80"
          stroke="#007DAE"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={hasMotion ? 0.12 + leftLoad * 0.82 : 0.08}
        />
        <line
          x1="80"
          y1="80"
          x2="132"
          y2="80"
          stroke="#007DAE"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={hasMotion ? 0.12 + rightLoad * 0.82 : 0.08}
        />
        <line
          x1="80"
          y1="80"
          x2="80"
          y2="28"
          stroke="#DC2626"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={hasMotion ? 0.12 + brakeLoad * 0.82 : 0.08}
        />
        <line
          x1="80"
          y1="80"
          x2="80"
          y2="132"
          stroke="#15803D"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={hasMotion ? 0.12 + accelLoad * 0.82 : 0.08}
        />
        <line x1="24" y1="80" x2="136" y2="80" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
        <line x1="80" y1="24" x2="80" y2="136" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
        <circle cx="80" cy="80" r="22" fill="#F9FAFB" stroke="rgba(71,85,105,0.25)" strokeWidth="1.5" />
        <text x="80" y="78" textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
          {hasMotion ? formatNumber(displayedTotalG, 1) : "--"}
        </text>
        <text x="80" y="93" textAnchor="middle" className="fill-[#007DAE] text-[10px] font-semibold tracking-[0.18em]">
          {hasMotion ? "G" : "IDLE"}
        </text>
        <text x="80" y="21" textAnchor="middle" className="fill-[#B91C1C] text-[7px] font-semibold tracking-[0.12em]">
          BRAKE
        </text>
        <text x="80" y="144" textAnchor="middle" className="fill-[#15803D] text-[7px] font-semibold tracking-[0.12em]">
          ACCEL
        </text>
        <text x="14" y="83" textAnchor="middle" className="fill-[#9CE2FF] text-[7px] font-semibold">
          L
        </text>
        <text x="146" y="83" textAnchor="middle" className="fill-[#9CE2FF] text-[7px] font-semibold">
          R
        </text>
        {hasMotion ? (
          <>
            <line
              x1="80"
              y1="80"
              x2={dotX}
              y2={dotY}
              stroke="#1A1B23"
              strokeLinecap="round"
              strokeWidth="2"
              opacity="0.58"
            />
            <circle
              cx={dotX}
              cy={dotY}
              r={9 + load * 5}
              fill={`${zoneColor}55`}
              filter={`url(#${idPrefix}-g-meter-dot-glow)`}
            />
            <circle
              cx={dotX}
              cy={dotY}
              r="6"
              fill="#1A1B23"
              stroke={zoneColor}
              strokeWidth="2"
            />
            <circle cx={dotX} cy={dotY} r="2.25" fill="#F9FAFB" opacity="0.82" />
          </>
        ) : (
          <circle cx="80" cy="80" r="5" fill="#1A1B23" opacity="0.54" />
        )}
      </svg>
    </div>
  );
}

export function GForceTelemetryReadouts({
  active,
  speedMph,
  lateralG,
  accelG,
  brakingG,
  maxLateralG,
  maxAccelG,
  maxBrakingG
}: GForceIndicatorProps) {
  const hasMotion =
    active ??
    [lateralG, accelG, brakingG].some(
      (value) => typeof value === "number" && Number.isFinite(value)
    );
  const lateral = hasMotion ? getNumber(lateralG) : 0;
  const acceleration = hasMotion ? getNumber(accelG) : 0;
  const braking = hasMotion ? getNumber(brakingG) : 0;
  const totalG = hasMotion ? Math.hypot(lateral, acceleration > braking ? acceleration : braking) : null;
  const activeMode = hasMotion ? (braking > acceleration ? "Brake" : "Accel") : "Inactive";
  const lateralLabel = hasMotion
    ? lateral < -0.05
      ? "Left"
      : lateral > 0.05
        ? "Right"
        : "Center"
    : "No motion";

  return (
    <div className="mt-3 grid w-full grid-cols-3 gap-2">
      <div className="relative col-span-3 rounded-[14px] bg-muted/50 px-3 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7E8998]">
          Speed
        </p>
        <p className="mt-1 text-[28px] font-semibold leading-none text-foreground">
          {formatNumber(speedMph, 1)}
        </p>
        <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#007DAE]">
          mph
        </p>
      </div>

      <div className="rounded-[10px] bg-muted/50 px-2 py-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7E8998]">Lat</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#007DAE]">{formatSigned(lateralG)}</p>
      </div>
      <div className="rounded-[10px] bg-muted/50 px-2 py-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7E8998]">Accel</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#15803D]">{formatNumber(accelG, 2)}</p>
      </div>
      <div className="rounded-[10px] bg-muted/50 px-2 py-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7E8998]">Brake</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#B91C1C]">{formatNumber(brakingG, 2)}</p>
      </div>

      <div className="col-span-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7E8998]">
        <span className="rounded-[9px] bg-muted/50 px-2 py-1.5">{lateralLabel}</span>
        <span
          className={`rounded-[9px] bg-muted/50 px-2 py-1.5 ${
            activeMode === "Brake"
              ? "text-[#B91C1C]"
              : activeMode === "Accel"
                ? "text-[#15803D]"
                : ""
          }`}
        >
          {activeMode}
        </span>
        <span className="rounded-[9px] bg-muted/50 px-2 py-1.5">G {formatNumber(totalG, 1)}</span>
      </div>
      <div className="col-span-3 grid grid-cols-3 gap-2 border-t border-border pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7E8998]">
        <span>Max L {formatNumber(maxLateralG, 1)}</span>
        <span>A {formatNumber(maxAccelG, 1)}</span>
        <span>B {formatNumber(maxBrakingG, 1)}</span>
      </div>
    </div>
  );
}
