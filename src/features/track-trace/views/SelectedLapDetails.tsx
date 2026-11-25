// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatLapTime } from "../circuit/lapFiltering.ts";
import { getLapTopSpeedMph } from "../circuit/sessionReview.ts";
import type { SavedLapRecord, SavedLapSession } from "../circuit/types.ts";

function formatMetric(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}${suffix}`
    : "--";
}

export function SelectedLapDetails({
  lap,
  session,
  isOptimum = false
}: {
  lap: SavedLapRecord | null;
  session: SavedLapSession;
  isOptimum?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [lap?.id]);

  const lapCornerMetrics = useMemo(
    () =>
      lap
        ? session.cornerAnalysis?.laps.find(
            (analysisLap) => analysisLap.lapId === lap.id
          )?.corners ?? []
        : [],
    [lap, session.cornerAnalysis]
  );

  if (!lap) return null;

  const samples = (session.telemetrySamples ?? []).filter(
    (sample) => sample.lapNumber === lap.lapNumber
  );
  const validAccuracy = samples
    .map((sample) => sample.gpsAccuracy)
    .filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value)
    );
  const averageAccuracy =
    validAccuracy.length > 0
      ? validAccuracy.reduce((total, value) => total + value, 0) / validAccuracy.length
      : null;
  const topSpeedMph = isOptimum
    ? lap.maxSpeed
    : getLapTopSpeedMph(lap, session.telemetrySamples ?? []);

  return (
    <div className="mt-3 border-t border-[#D7DEE8] pt-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="selected-lap-details"
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[12px] px-2 text-sm font-black text-[#007DAE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007DAE]"
      >
        {expanded ? "Collapse lap details" : "Expand lap details"}
        <ChevronDown
          className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {expanded ? (
        <div id="selected-lap-details" className="pt-2">
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ["Lap time", formatLapTime(lap.lapTimeMs)],
              ["Top speed", formatMetric(topSpeedMph, " mph")],
              ["Telemetry samples", isOptimum ? "Composite" : String(samples.length)],
              ["GPS quality", averageAccuracy === null ? "--" : `${averageAccuracy.toFixed(1)}m avg`],
              ["Max lateral G", formatMetric(lap.maxLateralG, "g")],
              ["Max longitudinal G", formatMetric(lap.maxLongitudinalG, "g")]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] bg-[#EFF6FF] p-2">
                <dt className="font-black text-[#5D6675]">{label}</dt>
                <dd className="mt-1 font-black">{value}</dd>
              </div>
            ))}
          </dl>
          {lap.sectorTimesMs?.length ? (
            <div className="mt-2 rounded-[10px] bg-[#EFF6FF] p-2 text-xs font-bold text-[#5D6675]">
              <p className="font-black text-[#071018]">Sector times</p>
              {lap.sectorTimesMs.map((time, index) => (
                <span key={index} className="mr-3 mt-1 inline-block">
                  Sector {index + 1}: {formatLapTime(time)}
                </span>
              ))}
            </div>
          ) : null}
          {lapCornerMetrics.length ? (
            <div className="mt-2 rounded-[10px] bg-[#EFF6FF] p-2 text-xs font-bold text-[#5D6675]">
              <p className="font-black text-[#071018]">Corner times</p>
              {lapCornerMetrics.map((corner) => (
                <span key={corner.cornerNumber} className="mr-3 mt-1 inline-block">
                  Turn {corner.cornerNumber}: {corner.cornerTimeSeconds.toFixed(2)}s
                </span>
              ))}
            </div>
          ) : null}
          {lap.smoothingWarning ? (
            <p className="mt-2 rounded-[10px] border border-amber-300 bg-amber-50 p-2 text-xs font-bold leading-5 text-amber-950">
              {lap.smoothingWarning}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
