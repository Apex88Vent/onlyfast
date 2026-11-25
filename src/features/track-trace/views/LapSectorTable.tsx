// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { useEffect, useRef } from "react";
import { Play, Sparkles } from "lucide-react";
import { formatLapTime } from "../circuit/lapFiltering.ts";
import type { OptimumLapResult } from "../circuit/optimumLap.ts";
import { getLapTopSpeedMph } from "../circuit/sessionReview.ts";
import type { SavedLapRecord, SavedLapSession } from "../circuit/types.ts";

function formatCornerSpeed(value: number | null) {
  return value === null ? "--" : `${(value * 2.2369362921).toFixed(1)} mph`;
}

function formatOptimumLine(value: OptimumLapResult["cornerContexts"][number]["lineClassification"]) {
  return value === "not_meaningful"
    ? "Line difference below confidence threshold"
    : value.replace("meaningfully_", "").replace("_", " ");
}

type LapSectorTableProps = {
  session: SavedLapSession;
  validLaps: SavedLapRecord[];
  optimum: OptimumLapResult | null;
  onReplayLap: (lap: SavedLapRecord) => void;
  onReplayOptimum: (optimum: OptimumLapResult) => void;
  canReplayLap?: (lap: SavedLapRecord) => boolean;
  emptyMessage?: string;
  readOnly?: boolean;
  selectedLapId?: string | null;
  showOptimumDetails?: boolean;
  title?: string;
};

export function LapSectorTable({
  session,
  validLaps,
  optimum,
  onReplayLap,
  onReplayOptimum,
  canReplayLap = () => true,
  emptyMessage,
  readOnly = false,
  selectedLapId = null,
  showOptimumDetails = true,
  title = "Sector times"
}: LapSectorTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const configuredSectorCount = session.sectorCount ?? 0;
  const sectorCount = Math.min(5, configuredSectorCount > 0
    ? configuredSectorCount
    : Math.max(0, ...validLaps.map((lap) => lap.sectorTimesMs?.length ?? 0)));
  const fastestBySector = Array.from({ length: sectorCount }, (_, sectorIndex) =>
    Math.min(
      ...validLaps
        .map((lap) => lap.sectorTimesMs?.[sectorIndex])
        .filter((value): value is number =>
          typeof value === "number" && Number.isFinite(value) && value > 0
        )
    )
  );

  useEffect(() => {
    if (!selectedLapId || validLaps.length <= 5) return;
    const container = scrollContainerRef.current;
    const row = rowRefs.current.get(selectedLapId);
    if (!container || !row) return;

    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;

    if (rowTop < visibleTop) {
      container.scrollTop = rowTop;
    } else if (rowBottom > visibleBottom) {
      container.scrollTop = rowBottom - container.clientHeight;
    }
  }, [selectedLapId, validLaps.length]);

  if (validLaps.length === 0 && !emptyMessage) return null;

  return (
    <section className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5D6675]">Lap Table</p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <div className="text-right">
          {readOnly ? <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5D6675]">Read only</p> : null}
          {sectorCount > 0 ? <p className="text-xs font-bold text-[#7E22CE]">Purple = session best</p> : null}
        </div>
      </div>
      {validLaps.length === 0 ? (
        <p className="mt-3 rounded-[14px] bg-[#EFF6FF] p-3 text-sm font-bold text-[#5D6675]">{emptyMessage}</p>
      ) : (
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        aria-label={`Lap table scroll area, showing up to five of ${validLaps.length} laps`}
        className={`mt-3 max-w-full rounded-[16px] border border-[#D7DEE8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007DAE] ${
          validLaps.length > 5 ? "max-h-[286px] overflow-auto" : "overflow-x-auto"
        }`}
      >
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#EFF6FF] text-[11px] font-black uppercase tracking-[0.1em] text-[#5D6675]">
            <tr>
              <th className="px-3 py-3">Lap</th>
              <th className="whitespace-nowrap px-3 py-3">Lap Time</th>
              <th className="whitespace-nowrap px-3 py-3">Top Speed</th>
              {Array.from({ length: sectorCount }, (_, index) => (
                <th key={index} className="whitespace-nowrap px-3 py-3">
                  Sector {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D7DEE8]">
            {validLaps.map((lap) => {
              const selectable = canReplayLap(lap);
              const selected = selectedLapId === lap.id;
              const selectLap = () => {
                if (selectable) onReplayLap(lap);
              };

              return (
              <tr
                key={lap.id}
                ref={(row) => {
                  if (row) rowRefs.current.set(lap.id, row);
                  else rowRefs.current.delete(lap.id);
                }}
                tabIndex={selectable ? 0 : -1}
                aria-selected={selected}
                aria-label={`${selected ? "Selected, " : ""}Lap ${lap.lapNumber}, ${formatLapTime(lap.lapTimeMs)}`}
                onClick={selectLap}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectLap();
                  }
                }}
                className={`transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#007DAE] ${
                  selected ? "bg-[#EAF6FF]" : "bg-white hover:bg-[#F8FAFC]"
                } ${selectable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <td className="whitespace-nowrap px-3 py-3 font-black">
                  {lap.lapNumber}
                  {lap.lapTimeMs === session.fastestLapTimeMs ? <span className="ml-2 rounded-full bg-[#007DAE]/12 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#007DAE]">Fastest</span> : null}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 font-black ${lap.lapTimeMs === session.fastestLapTimeMs ? "text-[#007DAE]" : ""}`}>
                  {formatLapTime(lap.lapTimeMs)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-bold text-[#5D6675]">
                  {(() => {
                    const topSpeed = getLapTopSpeedMph(lap, session.telemetrySamples ?? []);
                    return topSpeed === null ? "—" : `${topSpeed.toFixed(1)} mph`;
                  })()}
                </td>
                {Array.from({ length: sectorCount }, (_, sectorIndex) => {
                  const value = lap.sectorTimesMs?.[sectorIndex] ?? null;
                  const isValid = typeof value === "number" && Number.isFinite(value) && value > 0;
                  const isFastest = isValid && value === fastestBySector[sectorIndex];
                  return <td key={sectorIndex} className={`whitespace-nowrap px-3 py-3 ${isFastest ? "font-black text-[#7E22CE]" : "font-bold text-[#5D6675]"}`}>{isValid ? formatLapTime(value) : "—"}</td>;
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {validLaps.length > 0 && sectorCount === 0 ? (
        <p className="mt-4 rounded-[14px] bg-[#EFF6FF] p-3 text-sm font-bold text-[#5D6675]">Sector data is unavailable for this session.</p>
      ) : null}

      {showOptimumDetails && validLaps.length > 0 && optimum ? (
        <div className="mt-4 rounded-[18px] border border-[#A855F7]/30 bg-purple-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-[#581C87]"><Sparkles className="size-4" />Optimum Lap</p>
              <p className="mt-1 text-2xl font-black text-[#7E22CE]">{formatLapTime(optimum.lap.lapTimeMs)}</p>
              <p className="mt-1 text-xs font-bold text-[#6B21A8]">Fastest actual lap: {formatLapTime(session.fastestLapTimeMs)}</p>
              <p className="mt-1 text-xs font-bold text-[#6B21A8]">{formatLapTime(optimum.deltaToFastestLapMs)} faster than the fastest actual lap</p>
            </div>
            <button type="button" onClick={() => onReplayOptimum(optimum)} disabled={!optimum.replayAvailable} className="flex min-h-10 items-center gap-2 rounded-full bg-[#7E22CE] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-[#AFA3B8]"><Play className="size-3.5" />{optimum.replayAvailable ? "Replay" : "Replay unavailable"}</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {optimum.sectors.map((sector) => (
              <div key={sector.sectorIndex} className="rounded-[12px] bg-white/80 p-2 text-xs font-bold text-[#581C87]">
                Sector {sector.sectorIndex}: <span className="font-black">{formatLapTime(sector.durationMs)}</span> from Lap {sector.sourceLapNumber}
                {optimum.cornerContexts
                  .filter((corner) => corner.sectorIndex === sector.sectorIndex)
                  .map((corner) => (
                    <div key={`${sector.sectorIndex}-${corner.cornerNumber}`} className="mt-2 rounded-[10px] bg-purple-100/70 p-2 leading-5">
                      <p className="font-black">Turn {corner.cornerNumber} · source Lap {corner.sourceLapNumber}</p>
                      <p>
                        Entry {formatCornerSpeed(corner.entrySpeedMps)} · minimum{" "}
                        {formatCornerSpeed(corner.minimumSpeedMps)} · exit{" "}
                        {formatCornerSpeed(corner.exitSpeedMps)}
                      </p>
                      <p className="capitalize">Line: {formatOptimumLine(corner.lineClassification)}</p>
                      {corner.possibleScrub ? (
                        <p>
                          Possible speed scrub remains ({corner.scrubConfidence} confidence);
                          a fastest segment is not automatically a technically perfect one.
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            ))}
          </div>
          {!optimum.replayAvailable ? <p className="mt-3 text-xs font-bold text-[#6B21A8]">The optimum times are valid, but one or more source sectors have no replay telemetry.</p> : null}
        </div>
      ) : showOptimumDetails && validLaps.length > 0 && sectorCount > 0 ? (
        <p className="mt-4 rounded-[14px] bg-[#EFF6FF] p-3 text-sm font-bold text-[#5D6675]">Optimum lap unavailable because one or more sectors have no valid recorded time.</p>
      ) : null}
    </section>
  );
}
