// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useState } from "react";
import { ChevronDown, Play, Sparkles } from "lucide-react";
import { formatLapTime } from "../circuit/lapFiltering.ts";
import type { OptimumLapResult } from "../circuit/optimumLap.ts";
import type { SavedLapSession } from "../circuit/types.ts";

function formatCornerSpeed(value: number | null) {
  return value === null ? "--" : `${(value * 2.2369362921).toFixed(1)} mph`;
}

function formatOptimumLine(
  value: OptimumLapResult["cornerContexts"][number]["lineClassification"]
) {
  return value === "not_meaningful"
    ? "Line difference below confidence threshold"
    : value.replace("meaningfully_", "").replace("_", " ");
}

export function OptimumLapSummary({
  optimum,
  session,
  onReplay
}: {
  optimum: OptimumLapResult | null;
  session: SavedLapSession;
  onReplay: (optimum: OptimumLapResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!optimum) return null;

  return (
    <section className="rounded-[20px] border border-[#A855F7]/30 bg-purple-50 p-4 text-[#581C87]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
            <Sparkles className="size-4" aria-hidden="true" />
            Optimum Lap
          </p>
          <p className="mt-1 text-2xl font-black text-[#7E22CE]">
            {formatLapTime(optimum.lap.lapTimeMs)}
          </p>
          <p className="mt-1 text-xs font-bold text-[#6B21A8]">
            {formatLapTime(optimum.deltaToFastestLapMs)} faster than the fastest actual lap
            ({formatLapTime(session.fastestLapTimeMs)})
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="optimum-lap-details"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-h-10 items-center gap-2 rounded-full border border-[#7E22CE]/35 bg-white px-3 text-xs font-black text-[#7E22CE]"
        >
          {expanded ? "Hide optimum details" : "Show optimum details"}
          <ChevronDown
            className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded ? (
        <div id="optimum-lap-details" className="mt-4 border-t border-[#A855F7]/20 pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {optimum.sectors.map((sector) => (
              <div key={sector.sectorIndex} className="rounded-[12px] bg-white/80 p-3 text-xs font-bold">
                <p>
                  Sector {sector.sectorIndex}:{" "}
                  <span className="font-black">{formatLapTime(sector.durationMs)}</span> from
                  Lap {sector.sourceLapNumber}
                </p>
                {optimum.cornerContexts
                  .filter((corner) => corner.sectorIndex === sector.sectorIndex)
                  .map((corner) => (
                    <div
                      key={`${sector.sectorIndex}-${corner.cornerNumber}`}
                      className="mt-2 rounded-[10px] bg-purple-100/70 p-2 leading-5"
                    >
                      <p className="font-black">
                        Turn {corner.cornerNumber} · source Lap {corner.sourceLapNumber}
                      </p>
                      <p>
                        Entry {formatCornerSpeed(corner.entrySpeedMps)} · minimum{" "}
                        {formatCornerSpeed(corner.minimumSpeedMps)} · exit{" "}
                        {formatCornerSpeed(corner.exitSpeedMps)}
                      </p>
                      <p className="capitalize">
                        Line: {formatOptimumLine(corner.lineClassification)}
                      </p>
                      {corner.possibleScrub ? (
                        <p>
                          Possible speed scrub remains ({corner.scrubConfidence} confidence).
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onReplay(optimum)}
            disabled={!optimum.replayAvailable}
            className="mt-3 flex min-h-10 items-center gap-2 rounded-full bg-[#7E22CE] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-[#AFA3B8]"
          >
            <Play className="size-3.5" aria-hidden="true" />
            {optimum.replayAvailable ? "Replay optimum lap" : "Optimum replay unavailable"}
          </button>
          {!optimum.replayAvailable ? (
            <p className="mt-2 text-xs font-bold">
              One or more source sectors do not contain usable replay telemetry.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
