// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_BETA_REVIEW.md.
import {
  GForceIndicator,
  GForceTelemetryReadouts
} from "./GForceIndicator";
import { sampleAtProgress } from "../circuit/trackProjection.ts";
import {
  metersPerSecondToMilesPerHour,
  splitVehicleLongitudinalG
} from "../circuit/telemetryMath.ts";
import type { LapTelemetrySample, SavedLapRecord } from "../circuit/types.ts";

type ReplayTelemetryPanelProps = {
  title: string;
  samples: LapTelemetrySample[];
  progress: number;
  lap?: SavedLapRecord | null;
  accentColor?: string;
  compact?: boolean;
  positionLabel?: string;
};

function formatCompactMetric(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "--";
}

function formatSignedMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}g`
    : "—";
}

export function ReplayTelemetryPanel({
  title,
  samples,
  progress,
  lap,
  accentColor = "#00A8E8",
  compact = false,
  positionLabel
}: ReplayTelemetryPanelProps) {
  const currentSample = sampleAtProgress(samples, progress);
  const speedMph = metersPerSecondToMilesPerHour(currentSample?.speed);
  const lateralG = currentSample?.lateralG ?? null;
  const longitudinalG = currentSample?.longitudinalG ?? null;
  const { accelG, brakingG } = splitVehicleLongitudinalG(longitudinalG);
  const active = [
    currentSample?.lateralG,
    currentSample?.longitudinalG,
    currentSample?.verticalG,
    currentSample?.accelX,
    currentSample?.accelY,
    currentSample?.accelZ
  ].some((value) => typeof value === "number" && Number.isFinite(value));

  return (
    <section
      className={`min-w-0 rounded-[16px] ${compact ? "border-2 p-2" : "border p-3"}`}
      style={{ borderColor: accentColor, backgroundColor: "hsl(var(--card))" }}
      aria-label={`${title} telemetry, matched to ${title} GPS position`}
    >
      <div className={`${compact ? "mb-1.5 justify-center text-center" : "mb-3"} flex items-center gap-2`}>
        <span className="size-2.5 rounded-lg" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        <h3 className="truncate text-xs font-semibold sm:text-sm" style={{ color: accentColor }}>
          {title}
        </h3>
      </div>
      {compact ? (
        <div className="flex flex-col items-center">
          <div
            className="w-full max-w-[128px] rounded-lg border-2 p-0.5"
            style={{ borderColor: accentColor }}
            aria-label={`${title} G-force: lateral ${formatSignedMetric(lateralG)}, longitudinal ${formatSignedMetric(longitudinalG)}`}
          >
            <GForceIndicator
              speedMph={speedMph}
              lateralG={lateralG}
              accelG={accelG}
              brakingG={brakingG}
              active={active}
              size="large"
              maxLateralG={lap?.maxLateralG}
              maxAccelG={lap?.maxAccelG}
              maxBrakingG={lap?.maxBrakingG}
            />
          </div>
          <dl className="mt-1.5 grid w-full grid-cols-2 gap-x-2 gap-y-1 text-center text-[11px] leading-4 text-muted-foreground sm:text-[11px]">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Speed</dt>
              <dd className="truncate font-semibold text-foreground">
                {speedMph == null ? "—" : `${formatCompactMetric(speedMph, 1)} mph`}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Lat G</dt>
              <dd className="truncate font-semibold text-foreground">{formatSignedMetric(lateralG)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Long G</dt>
              <dd className="truncate font-semibold text-foreground">{formatSignedMetric(longitudinalG)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">
                {positionLabel?.startsWith("Turn ") ? "Turn" : "Position"}
              </dt>
              <dd className="truncate font-semibold" style={{ color: accentColor }}>
                {positionLabel?.replace(/^Turn\s*/i, "") ?? `${Math.round(progress * 100)}%`}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
        <GForceIndicator
          speedMph={speedMph}
          lateralG={lateralG}
          accelG={accelG}
          brakingG={brakingG}
          active={active}
          size={compact ? "normal" : "large"}
          maxLateralG={lap?.maxLateralG}
          maxAccelG={lap?.maxAccelG}
          maxBrakingG={lap?.maxBrakingG}
        />
        <GForceTelemetryReadouts
          speedMph={speedMph}
          lateralG={lateralG}
          accelG={accelG}
          brakingG={brakingG}
          active={active}
          maxLateralG={lap?.maxLateralG}
          maxAccelG={lap?.maxAccelG}
          maxBrakingG={lap?.maxBrakingG}
        />
        </>
      )}
    </section>
  );
}
