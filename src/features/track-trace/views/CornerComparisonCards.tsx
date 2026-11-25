// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";
type LapInsightPersistenceContext = Record<string, unknown>;
import { buildCornerComparisonAiInput } from "../circuit/cornerAnalysis.ts";
import type {
  CornerComparisonResult,
  LapCornerComparison
} from "../circuit/types.ts";

function formatSpeed(value: number | null) {
  return value === null ? "Unavailable" : `${(value * 2.2369362921).toFixed(1)} mph`;
}

function formatSpeedDelta(value: number | null) {
  if (value === null) return "Unavailable";
  const mph = value * 2.2369362921;
  return `${mph >= 0 ? "+" : ""}${mph.toFixed(1)} mph`;
}

function formatSigned(value: number | null, suffix: string, digits = 2) {
  if (value === null) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function lineLabel(corner: CornerComparisonResult) {
  switch (corner.lineDifference.classification) {
    case "meaningfully_higher":
      return "Noticeably higher";
    case "meaningfully_lower":
      return "Noticeably lower";
    case "meaningfully_wider":
      return "Wider line";
    case "meaningfully_tighter":
      return "Tighter line";
    default:
      return "No meaningful difference";
  }
}

function formatCornerTimeDifference(value: number) {
  if (Math.abs(value) < 0.005) return "No meaningful difference";
  return `${Math.abs(value).toFixed(2)}s ${value <= 0 ? "faster" : "slower"}`;
}

function CornerDetails({
  corner,
  referenceLabel,
  referenceSourceLapNumber
}: {
  corner: CornerComparisonResult;
  referenceLabel: string;
  referenceSourceLapNumber?: number;
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-[#D7DEE8] pt-3">
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {[
          ["Entry speed", formatSpeedDelta(corner.entrySpeedDeltaMps)],
          ["Minimum speed", formatSpeedDelta(corner.minimumSpeedDeltaMps)],
          ["Exit speed", formatSpeedDelta(corner.exitSpeedDeltaMps)],
          ["Peak lateral G", formatSigned(corner.maximumLateralGDelta, "g", 3)],
          ["Entry delta", formatSigned(corner.entryTimeDeltaSeconds, "s")],
          ["Apex delta", formatSigned(corner.apexTimeDeltaSeconds, "s")],
          ["Exit delta", formatSigned(corner.exitTimeDeltaSeconds, "s")],
          [
            "Distance",
            formatSigned(corner.lineDifference.estimatedDistanceDeltaMeters, " m", 1)
          ],
          ["Line", lineLabel(corner)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[12px] bg-[#EFF6FF] p-2">
            <dt className="font-black text-[#5D6675]">{label}</dt>
            <dd className="mt-1 font-black text-[#071018]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-[14px] bg-[#F8FAFC] p-3 text-xs font-bold leading-5 text-[#334155]">
        <p><span className="font-black">Racing line:</span> {corner.lineDifference.explanation}</p>
        <p className="mt-2">
          <span className="font-black">Possible scrub:</span>{" "}
          {corner.possibleScrub.explanation}
        </p>
        <p className="mt-2">
          <span className="font-black">Why:</span> {corner.interpretation}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[12px] border border-[#D7DEE8] p-2">
          <p className="font-black text-[#5D6675]">Comparison lap</p>
          <p className="mt-1 font-bold">Entry {formatSpeed(corner.comparisonLap.entrySpeedMps)}</p>
          <p className="font-bold">Minimum {formatSpeed(corner.comparisonLap.minimumSpeedMps)}</p>
          <p className="font-bold">Exit {formatSpeed(corner.comparisonLap.exitSpeedMps)}</p>
        </div>
        <div className="rounded-[12px] border border-[#D7DEE8] p-2">
          <p className="font-black text-[#5D6675]">{referenceLabel}</p>
          {referenceSourceLapNumber ? (
            <p className="mt-1 font-black text-[#7E22CE]">
              Source Lap {referenceSourceLapNumber}
            </p>
          ) : null}
          <p className="mt-1 font-bold">Entry {formatSpeed(corner.referenceLap.entrySpeedMps)}</p>
          <p className="font-bold">Minimum {formatSpeed(corner.referenceLap.minimumSpeedMps)}</p>
          <p className="font-bold">Exit {formatSpeed(corner.referenceLap.exitSpeedMps)}</p>
        </div>
      </div>

      <p className="text-xs font-bold text-[#5D6675]">
        Confidence: {corner.confidence}. Conclusions use matched normalized track positions,
        not arbitrary sample indexes.
      </p>
    </div>
  );
}

export function CornerComparisonCards({
  comparison,
  selectedCornerNumber,
  onSelectCorner,
  aiEnabled = true,
  referenceDescription,
  primaryLabel,
  referenceLabel,
  referenceSourceLapNumbers,
  analysisPersistence
}: {
  comparison: LapCornerComparison;
  selectedCornerNumber: number | null;
  onSelectCorner: (cornerNumber: number) => void;
  aiEnabled?: boolean;
  referenceDescription?: string;
  primaryLabel?: string;
  referenceLabel?: string;
  referenceSourceLapNumbers?: Record<number, number>;
  analysisPersistence?: LapInsightPersistenceContext;
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedCornerNumber, setExpandedCornerNumber] = useState<number | null>(null);
  const importantCorners = useMemo(() => {
    const important = comparison.corners.filter((corner) => corner.important);
    return important.length ? important : comparison.corners;
  }, [comparison]);
  const aiInput = useMemo(
    () => buildCornerComparisonAiInput(comparison),
    [comparison]
  );

  useEffect(() => { setAiLoading(false); setAiSummary(null); setAiError(aiEnabled ? "AI corner summaries require the testing provider integration. Calculated corner metrics remain available." : null); }, [aiEnabled]);

  useEffect(() => {
    setExpandedCornerNumber(null);
  }, [comparison.comparisonLapId, comparison.referenceLapId]);

  if (!comparison.corners.length) return null;

  const resolvedPrimaryLabel =
    primaryLabel ?? `Lap ${comparison.comparisonLapNumber}`;
  const resolvedReferenceLabel =
    referenceLabel ?? `Lap ${comparison.referenceLapNumber}`;

  return (
    <section
      className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
      aria-labelledby="corner-analysis-title"
    >
      <div>
        <h2 id="corner-analysis-title" className="text-xl font-black">
          Corner Analysis — {resolvedPrimaryLabel} vs {resolvedReferenceLabel}
        </h2>
        {referenceDescription ? (
          <p className="mt-1 text-xs font-bold text-[#5D6675]">{referenceDescription}</p>
        ) : null}
      </div>

      {comparison.gpsQuality.warnings.length ? (
        <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950">
          {comparison.gpsQuality.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {aiLoading || aiSummary ? (
        <div className="mt-3 rounded-[16px] border border-[#BAE6FD] bg-[#F0F9FF] p-3">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#0369A1]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            AI corner summary
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-[#0C4A6E]">
            {aiLoading ? "Summarizing the calculated corner findings..." : aiSummary}
          </p>
        </div>
      ) : null}
      {aiError && !aiLoading ? (
        <p className="mt-3 text-xs font-bold text-[#64748B]">
          {aiError} Deterministic corner metrics remain available below.
        </p>
      ) : null}

      <div className="mt-3 divide-y divide-[#D7DEE8] overflow-hidden rounded-[14px] border border-[#D7DEE8]">
        {importantCorners.map((corner) => {
          const selected = corner.cornerNumber === selectedCornerNumber;
          const expanded = corner.cornerNumber === expandedCornerNumber;
          return (
            <article
              id={`corner-comparison-${corner.cornerNumber}`}
              key={corner.cornerNumber}
              className={`px-3 py-1.5 transition ${
                selected
                  ? "bg-amber-50 shadow-[inset_3px_0_0_#F59E0B]"
                  : "bg-white"
              }`}
            >
              <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <p className="text-sm font-black">Turn {corner.cornerNumber}</p>
                <p
                  className={`text-right text-xs font-black sm:text-sm ${
                    Math.abs(corner.cornerTimeDeltaSeconds) < 0.005
                      ? "text-[#5D6675]"
                      : corner.cornerTimeDeltaSeconds <= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {formatCornerTimeDifference(corner.cornerTimeDeltaSeconds)}
                </p>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`corner-details-${corner.cornerNumber}`}
                  aria-label={`${expanded ? "Hide" : "More"} details for Turn ${corner.cornerNumber}`}
                  onClick={() => {
                    onSelectCorner(corner.cornerNumber);
                    setExpandedCornerNumber((current) =>
                      current === corner.cornerNumber ? null : corner.cornerNumber
                    );
                  }}
                  className="flex min-h-10 items-center gap-1 rounded-full px-2 text-xs font-black text-[#007DAE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007DAE]"
                >
                  {expanded ? "Hide details" : "More details"}
                  <ChevronDown
                    className={`size-3.5 transition ${expanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {expanded ? (
                <div id={`corner-details-${corner.cornerNumber}`}>
                <CornerDetails
                  corner={corner}
                  referenceLabel={resolvedReferenceLabel}
                  referenceSourceLapNumber={
                    referenceSourceLapNumbers?.[corner.cornerNumber]
                  }
                />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
