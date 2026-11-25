// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19; circuit branches only.
import { useEffect, useMemo, useState } from "react";
import Link from "./TraceLink";
import { AlertTriangle, ChevronLeft, GitBranch, Library, Loader2, Pencil, RotateCcw, ScanLine } from "lucide-react";
import { LapComparison } from "./LapComparison";
import { LapSectorTable } from "./LapSectorTable";
import { LapSessionShell } from "./LapSessionShell";
import { LapTraceView } from "./LapTraceView";
import { OptimumLapSummary } from "./OptimumLapSummary";
import { ShareTelemetryPanel } from "./ShareTelemetryPanel";
import { formatLapTime } from "../circuit/lapFiltering";
import { fetchLapSessionDetail, regenerateSessionCornerAnalysis, renameLapSession } from "../reviewService";
import { buildOptimumLap } from "../circuit/optimumLap";
import { getDefaultSelectedLap } from "../circuit/sessionReview";
import { getSessionDisplayName } from "../circuit/sessionNames";
import type { SavedLapRecord, SavedLapSession } from "../circuit/types";
type SessionDetailPageProps = {
    authBypassEnabled?: boolean;
    sessionId: string; readOnly?: boolean;
};
function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}
function formatStat(value: number | null | undefined, suffix = "") {
    return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(2)}${suffix}`;
}
function formatDuration(startedAt: string, endedAt: string) {
    if (!endedAt || !Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(endedAt))) return "--";
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}
function formatDistanceMeters(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) {
        return "--";
    }
    return value >= 1609.344 ? `${(value / 1609.344).toFixed(2)} mi` : `${value.toFixed(1)} m`;
}
function formatMilliseconds(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) {
        return "--";
    }
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}
function formatAccuracyRange(minValue: number | null | undefined, averageValue: number | null | undefined, maxValue: number | null | undefined) {
    if (minValue == null && averageValue == null && maxValue == null) {
        return "--";
    }
    return `${formatStat(minValue, "m")} / ${formatStat(averageValue, "m")} / ${formatStat(maxValue, "m")}`;
}
function formatShortTime(value: string) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        return value;
    }
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(new Date(parsed));
}
function formatCoordinate(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "--";
}
function formatDetectionConfidence(value: number | null | undefined) {
    return value == null || !Number.isFinite(value) ? "Unavailable" : `${Math.round(value * 100)}%`;
}
function formatMetersPerSecond(value: number | null | undefined) {
    return value == null || !Number.isFinite(value) ? "--" : `${(value * 2.2369362921).toFixed(1)} mph`;
}
function getSessionStatusBadge(session: SavedLapSession) {
    if (!session.endedAt && session.status!=='failed') return {label:"Unfinished session",className:"border-amber-300/24 bg-amber-300/12 text-amber-50"};
    if (session.reviewStatus === "recording_error" || session.status === "failed") {
        return {
            label: "Recording Error",
            className: "border-red-300/24 bg-red-400/12 text-red-50"
        };
    }
    if (session.reviewStatus === "no_gps_data" || session.gpsSampleCount === 0) {
        return {
            label: "No GPS Data",
            className: "border-amber-300/24 bg-amber-300/12 text-amber-50"
        };
    }
    return {
        label: "Complete",
        className: "border-emerald-300/24 bg-emerald-300/12 text-emerald-50"
    };
}
export function SessionDetailPage({ authBypassEnabled = false, sessionId, readOnly = true }: SessionDetailPageProps) {
    const [session, setSession] = useState<SavedLapSession | null>(null);
    const [selectedReplayLap, setSelectedReplayLap] = useState<SavedLapRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    useEffect(() => {
        let active = true;
        async function loadSession() {
            setLoading(true);
            const result = await fetchLapSessionDetail(sessionId);
            if (!active) {
                return;
            }
            setSession(result.data);
            setError(result.error);
            setLoading(false);
            setSelectedReplayLap(getDefaultSelectedLap(result.data?.laps?.filter((lap) => lap.isValid) ?? []));
        }
        void loadSession();
        return () => {
            active = false;
        };
    }, [sessionId]);
    const validLaps = useMemo(() => (session?.laps ?? []).filter((lap) => lap.isValid), [session?.laps]);
    const optimumLap = useMemo(() => session ? buildOptimumLap(session) : null, [session]);
    const isOptimumSelected = Boolean(selectedReplayLap && optimumLap?.lap.id === selectedReplayLap.id);
    const excludedLaps = useMemo(() => (session?.laps ?? []).filter((lap) => !lap.isValid), [session?.laps]);
    const telemetrySampleCount = session?.telemetrySamples?.length ?? session?.gpsSampleCount ?? 0;
    const hasNoGpsData = Boolean(session &&
        (session.reviewStatus === "no_gps_data" ||
            (telemetrySampleCount === 0 && validLaps.length === 0)));
    const hasSessionTrace = Boolean(session && !hasNoGpsData && validLaps.length === 0 && telemetrySampleCount > 1);
    const sessionStatusBadge = session ? getSessionStatusBadge(session) : null;
    const diagnostics = session?.recordingDiagnostics ?? null;
    const renameSession = async () => {
        if (!session)
            return;
        const nextName = window.prompt("Session name (leave blank to use the default)", session.sessionName ?? "");
        if (nextName === null || nextName.trim() === (session.sessionName ?? "")) {
            return;
        }
        setActionBusy(true);
        const result = await renameLapSession(session.id, nextName);
        setActionBusy(false);
        if (result.data)
            setSession(result.data);
        setActionMessage(result.data
            ? result.data.sessionName
                ? "Session renamed."
                : "Using the default session name."
            : result.error);
    };
    const regenerateCorners = async () => {
        if (!session)
            return;
        setActionBusy(true);
        const result = await regenerateSessionCornerAnalysis(session.id);
        setActionBusy(false);
        if (result.data)
            setSession(result.data);
        setActionMessage(result.data
            ? `Detected ${result.data.cornerDefinitions?.corners.length ?? 0} numbered corners in this preview. Stored analysis is unchanged.`
            : result.error);
    };
    return (<LapSessionShell authBypassEnabled={authBypassEnabled}>
      <section className="space-y-4">
        <Link href="/review-sessions" className="inline-flex items-center gap-2 text-sm font-black text-[#9CE2FF]">
          <ChevronLeft className="size-4" aria-hidden="true"/>
          Review Sessions
        </Link>

        {loading ? (<div className="rounded-[22px] border border-white/[0.12] bg-[#050B11]/86 p-6 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-[#00A8E8]" aria-hidden="true"/>
            <p className="mt-3 font-black">Loading session</p>
          </div>) : null}

        {error && !loading ? (<p className="rounded-[16px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold leading-6 text-red-50">
            {error}
          </p>) : null}

        {session ? (<>
            <div className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-5 shadow-[0_22px_55px_rgba(0,0,0,0.36)]">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
                Session Detail
              </p>
              {session.isDemo ? (<p className="mt-3 w-fit rounded-full border border-[#00A8E8]/30 bg-[#007DAE]/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-50">
                  Demo test data
                </p>) : null}
              {null}
              {sessionStatusBadge ? (<p className={`mt-3 w-fit rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${sessionStatusBadge.className}`}>
                  {sessionStatusBadge.label}
                </p>) : null}
              <div className="mt-2 flex items-start gap-2">
                <h1 className="min-w-0 text-[32px] font-black leading-tight text-white">
                  {getSessionDisplayName(session)}
                </h1>
                <button type="button" onClick={renameSession} disabled={actionBusy || readOnly} className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60" aria-label="Rename session" title="Rename session">
                  <Pencil className="size-4" aria-hidden="true"/>
                </button>
              </div>
              {session.sessionName?.trim() ? (<p className="mt-2 text-sm font-bold text-[#9CE2FF]">
                  {session.trackName}
                </p>) : null}
              <p className="mt-3 text-sm font-semibold leading-6 text-[#D7DEE8]">
                {formatDateTime(session.startedAt)}
              </p>
            </div>

            <ShareTelemetryPanel session={session}/>

            {(<>
                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Session summary">
                  {[
                    ["Fastest Lap", formatLapTime(session.fastestLapTimeMs)],
                    ["Average", formatLapTime(session.averageLapTimeMs)],
                    ["Laps", String(validLaps.length)],
                    ["Duration", formatDuration(session.startedAt, session.endedAt)]
                ].map(([label, value]) => (<div key={label} className="rounded-[18px] bg-white p-3 text-[#071018]">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5D6675]">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-black sm:text-xl">{value}</p>
                    </div>))}
                </section>

                <LapSectorTable session={session} validLaps={validLaps} optimum={optimumLap} onReplayLap={setSelectedReplayLap} onReplayOptimum={(optimum) => setSelectedReplayLap(optimum.lap)} selectedLapId={isOptimumSelected ? null : selectedReplayLap?.id} showOptimumDetails={false}/>

                <OptimumLapSummary session={session} optimum={optimumLap} onReplay={(optimum) => setSelectedReplayLap(optimum.lap)}/>

                {!hasNoGpsData ? (<LapComparison session={session} validLaps={validLaps} selectedLap={selectedReplayLap} optimum={optimumLap} selectedSamplesOverride={isOptimumSelected ? optimumLap?.samples : undefined} selectedLabel={isOptimumSelected ? "Optimum Lap · Virtual Composite" : undefined}/>) : null}
              </>)}

            {actionMessage ? (<p className="rounded-[16px] border border-[#00A8E8]/24 bg-[#007DAE]/12 p-3 text-sm font-bold leading-6 text-blue-50">
                {actionMessage}
              </p>) : null}

            {session.cornerDefinitions?.corners.length ? (<section className="rounded-[18px] border border-white/[0.12] bg-[#071018]/90 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CE2FF]">
                      Numbered corners
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {session.cornerDefinitions.corners.map((corner) => `Turn ${corner.cornerNumber}`).join(" · ")}
                    </p>
                  </div>
                  <button type="button" onClick={() => void regenerateCorners()} disabled={actionBusy || readOnly} className="min-h-10 rounded-full border border-white/[0.2] px-3 text-xs font-black text-white disabled:opacity-60">
                    Regenerate Corners
                  </button>
                </div>
              </section>) : null}

            {null}

            {null}

            {diagnostics ? (<details className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
                <summary className="cursor-pointer list-none text-base font-black [&::-webkit-details-marker]:hidden">
                  Lap Detection Diagnostics
                </summary>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Total GPS points recorded</dt>
                    <dd className="mt-1 font-black">{diagnostics.totalGpsPoints}</dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Total distance recorded</dt>
                    <dd className="mt-1 font-black">
                      {formatDistanceMeters(diagnostics.totalDistanceMeters)}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Line-plane intersections</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.linePlaneIntersectionsDetected ??
                    diagnostics.startFinishCrossingsDetected}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Inside extended gate</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.startFinishGateCrossingsDetected ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Valid directional crossings</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.validDirectionalCrossingsDetected ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Completed laps</dt>
                    <dd className="mt-1 font-black">{diagnostics.completedLaps ?? validLaps.length}</dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Too far beyond endpoint</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.rejectedTooFarBeyondEndpointCount ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Wrong direction rejects</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.rejectedWrongDirectionCount ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Cooldown/min lap rejects</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.rejectedCooldownOrMinLapCount ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">GPS accuracy rejects</dt>
                    <dd className="mt-1 font-black">
                      {diagnostics.rejectedGpsAccuracyCount ?? "--"}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">GPS gaps over 2s</dt>
                    <dd className="mt-1 font-black">{diagnostics.gpsGapsOverTwoSeconds}</dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Longest GPS gap</dt>
                    <dd className="mt-1 font-black">
                      {formatMilliseconds(diagnostics.longestGpsGapMs)}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Average sample interval</dt>
                    <dd className="mt-1 font-black">
                      {formatMilliseconds(diagnostics.averageGpsSampleIntervalMs)}
                    </dd>
                  </div>
                  <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Accuracy min / avg / max</dt>
                    <dd className="mt-1 font-black">
                      {formatAccuracyRange(diagnostics.minGpsAccuracyMeters, diagnostics.averageGpsAccuracyMeters, diagnostics.maxGpsAccuracyMeters)}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-[12px] bg-[#EFF6FF] p-2">
                    <dt className="font-black text-[#5D6675]">Lap detection gate status</dt>
                    <dd className="mt-1 font-black">{diagnostics.lapDetectionGateStatus}</dd>
                  </div>
                  {diagnostics.startFinishLine ? (<>
                      <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Gate segment length</dt>
                        <dd className="mt-1 font-black">
                          {formatDistanceMeters(diagnostics.startFinishLine.segmentLengthMeters)}
                        </dd>
                      </div>
                      <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Base endpoint extension</dt>
                        <dd className="mt-1 font-black">
                          {formatDistanceMeters(diagnostics.startFinishLine.baseEndpointExtensionMeters)}
                        </dd>
                      </div>
                      <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Expected direction</dt>
                        <dd className="mt-1 font-black">
                          {diagnostics.startFinishLine.expectedDirection ?? "--"}
                        </dd>
                      </div>
                      <div className="rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Perpendicular heading</dt>
                        <dd className="mt-1 font-black">
                          {formatStat(diagnostics.startFinishLine.perpendicularHeadingDegrees, " deg")}
                        </dd>
                      </div>
                      <div className="col-span-2 rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Gate endpoint A</dt>
                        <dd className="mt-1 font-black">
                          {formatCoordinate(diagnostics.startFinishLine.endpointA.lat)},{" "}
                          {formatCoordinate(diagnostics.startFinishLine.endpointA.lng)}
                        </dd>
                      </div>
                      <div className="col-span-2 rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Gate endpoint B</dt>
                        <dd className="mt-1 font-black">
                          {formatCoordinate(diagnostics.startFinishLine.endpointB.lat)},{" "}
                          {formatCoordinate(diagnostics.startFinishLine.endpointB.lng)}
                        </dd>
                      </div>
                      <div className="col-span-2 rounded-[12px] bg-[#EFF6FF] p-2">
                        <dt className="font-black text-[#5D6675]">Gate midpoint</dt>
                        <dd className="mt-1 font-black">
                          {formatCoordinate(diagnostics.startFinishLine.gateMidpoint?.lat)},{" "}
                          {formatCoordinate(diagnostics.startFinishLine.gateMidpoint?.lng)}
                        </dd>
                      </div>
                    </>) : null}
                </dl>
                <div className="mt-3 rounded-[14px] border border-[#D7DEE8] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5D6675]">
                    Line-plane / Gate Events
                  </p>
                  {diagnostics.crossingEvents.length === 0 ? (<p className="mt-2 text-sm font-bold text-[#5D6675]">
                      No line-plane intersections were detected.
                    </p>) : (<div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {diagnostics.crossingEvents.map((event, index) => (<div key={`${event.timestamp}-${index}`} className="rounded-[12px] bg-[#EFF6FF] p-2">
                          <p className="text-sm font-black">
                            {formatShortTime(event.timestamp)} -{" "}
                            {event.createdLap
                            ? `Created lap ${event.lapNumber ?? "--"}`
                            : event.gateCrossing
                                ? event.reason ?? "Gate crossing evaluated"
                                : event.reason ?? "Line-plane intersection"}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[#5D6675]">
                            Speed {formatStat(event.speed, " m/s")} | Heading{" "}
                            {formatStat(event.heading, " deg")} | Beyond endpoint{" "}
                            {formatStat(event.distanceBeyondEndpointMeters ?? event.distanceFromLineMeters, " m")}{" "}
                            | Tolerance {formatStat(event.endpointToleranceMeters, " m")} | Accuracy{" "}
                            {formatStat(event.gpsAccuracy, " m")} | Category{" "}
                            {event.rejectionCategory ?? "--"}
                          </p>
                        </div>))}
                    </div>)}
                </div>
                {diagnostics.ignoredCrossingReasons.length > 0 ? (<div className="mt-3 rounded-[14px] border border-amber-300 bg-amber-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-900">
                      Rejected Intersection Reasons
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold leading-6 text-amber-950">
                      {diagnostics.ignoredCrossingReasons.map((reason, index) => (<li key={`${reason}-${index}`}>{reason}</li>))}
                    </ul>
                  </div>) : null}
              </details>) : null}

            {session.notes ? (<p className="rounded-[16px] border border-[#00A8E8]/24 bg-[#007DAE]/12 p-3 text-sm font-bold leading-6 text-blue-50">
                {session.notes}
              </p>) : null}

            {hasNoGpsData ? (<section className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true"/>
                  <div>
                    <p className="text-lg font-black">
                      No GPS data was recorded for this session.
                    </p>
                    <p className="mt-3 text-sm font-bold text-[#5D6675]">
                      Possible reasons:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold leading-6 text-[#5D6675]">
                      <li>GPS watcher did not start</li>
                      <li>GPS permission was denied</li>
                      <li>Phone lost GPS signal</li>
                      <li>Browser/app was suspended</li>
                      <li>Device did not provide location updates</li>
                    </ul>
                    {session.gpsErrorMessage ? (<p className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                        {session.gpsErrorMessage}
                      </p>) : null}
                  </div>
                </div>
              </section>) : null}

            {!hasNoGpsData && hasSessionTrace && true ? (<LapTraceView track={session.trackMap} samples={session.telemetrySamples ?? []} progress={1} title="Session GPS Trace"/>) : null}

            {null}

            {null}

            {(<details className="rounded-[20px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
                <summary className="cursor-pointer list-none text-base font-black [&::-webkit-details-marker]:hidden">
                  Excluded Laps ({excludedLaps.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {excludedLaps.length === 0 ? (<p className="text-sm font-bold text-[#5D6675]">No excluded laps.</p>) : (excludedLaps.map((lap) => (<div key={lap.id} className="rounded-[16px] border border-[#D7DEE8] p-3">
                        <p className="font-black">
                          Lap {lap.lapNumber}: {formatLapTime(lap.lapTimeMs)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#5D6675]">
                          {lap.excludedReason}
                        </p>
                      </div>)))}
                </div>
              </details>)}
          </>) : null}
      </section>
    </LapSessionShell>);
}
