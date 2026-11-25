// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19; circuit branches only.
import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { GForceIndicator, GForceTelemetryReadouts } from "./GForceIndicator";
type MotionPermissionStatus = "idle" | "granted" | "denied" | "unsupported";
import { metersPerSecondToMilesPerHour, splitVehicleLongitudinalG } from "../circuit/telemetryMath";
import type { MotionTelemetrySnapshot } from "../circuit/types";
import type { GpsPoint } from "../circuit/onlylapsTrackScanUtils";
type LiveGpsDebugState = {
    watcherStarted: boolean;
    watchId: number | null;
    pointsReceived: number;
    pointsSaved: number;
    activeSessionId: string | null;
    lastErrorCode: number | null;
    lastErrorMessage: string | null;
};
type LiveRouteStats = {
    totalDistanceMeters: number;
    currentSpeedMps: number | null;
    maximumSpeedMps: number | null;
    averageSpeedMps: number | null;
};
import type { GumballDetectionStatus, SessionMode } from "../circuit/types";
type SessionActiveScreenProps = {
    ending?: boolean; children?: import("react").ReactNode;
    gpsDebug?: LiveGpsDebugState | null;
    gpsError?: string | null;
    latestGpsPoint: GpsPoint | null;
    courseName?: string | null;
    detectionStatus?: GumballDetectionStatus | null;
    liveRouteStats?: LiveRouteStats | null;
    liveStartedAt: string | null;
    mountOrientationWarning?: string | null;
    motionPermissionStatus?: MotionPermissionStatus;
    motionSnapshot?: MotionTelemetrySnapshot | null;
    onEndSession: () => void;
    sessionMode?: SessionMode;
    wakeLockMessage?: string | null;
};
function formatSessionTime(elapsedMs: number) {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const twoDigit = (value: number) => String(value).padStart(2, "0");
    if (hours > 0) {
        return `${hours}:${twoDigit(minutes)}:${twoDigit(seconds)}`;
    }
    return `${twoDigit(minutes)}:${twoDigit(seconds)}`;
}
function getGpsAccuracyLabel(accuracyMeters: number | null | undefined) {
    if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) {
        return "GPS accuracy: Unknown";
    }
    const roundedAccuracy = Math.round(accuracyMeters);
    if (accuracyMeters <= 10) {
        return `GPS accuracy: Good · ${roundedAccuracy}m`;
    }
    if (accuracyMeters <= 20) {
        return `GPS accuracy: Fair · ${roundedAccuracy}m`;
    }
    return `GPS accuracy: Poor · ${roundedAccuracy}m`;
}
function formatGpsTimestamp(value: string | null | undefined) {
    if (!value) {
        return "Last GPS update: No GPS update yet";
    }
    return `Last GPS update: ${new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(new Date(value))}`;
}
function formatDistance(meters: number | null | undefined) {
    if (meters == null || !Number.isFinite(meters))
        return "--";
    return meters >= 1609.344
        ? `${(meters / 1609.344).toFixed(2)} mi`
        : `${Math.round(meters)} m`;
}
function formatSpeed(speedMps: number | null | undefined) {
    const mph = metersPerSecondToMilesPerHour(speedMps);
    return mph === null ? "--" : `${mph.toFixed(1)} mph`;
}
export function SessionActiveScreen({ courseName = null, detectionStatus = null, ending = false, gpsDebug = null, gpsError = null, latestGpsPoint, liveRouteStats = null, liveStartedAt, mountOrientationWarning = null, motionPermissionStatus = "idle", motionSnapshot = null, onEndSession, sessionMode = "normal", wakeLockMessage = null, children }: SessionActiveScreenProps) {
    const [now, setNow] = useState(() => Date.now());
    const gpsSampleAt = latestGpsPoint ? Date.parse(latestGpsPoint.timestamp) : null;
    const gpsHasFix = gpsSampleAt !== null && Number.isFinite(gpsSampleAt);
    const gpsIsStale = gpsSampleAt !== null && Number.isFinite(gpsSampleAt) && now - gpsSampleAt > 10000;
    const waitingForGps = !latestGpsPoint &&
        liveStartedAt !== null &&
        Number.isFinite(Date.parse(liveStartedAt)) &&
        now - Date.parse(liveStartedAt) > 10000;
    const gpsStatusLabel = !gpsHasFix
        ? gpsError
            ? "GPS error"
            : "Searching for GPS"
        : gpsIsStale
            ? "GPS signal stale"
            : "GPS found";
    const sessionTime = useMemo(() => formatSessionTime(liveStartedAt ? now - Date.parse(liveStartedAt) : 0), [liveStartedAt, now]);
    const liveLateralG = motionSnapshot?.lateralG ?? null;
    const liveLongitudinalG = motionSnapshot?.longitudinalG ?? null;
    const { accelG: liveAccelG, brakingG: liveBrakingG } = splitVehicleLongitudinalG(liveLongitudinalG);
    const liveSpeedMph = metersPerSecondToMilesPerHour(latestGpsPoint?.speed);
    const hasLiveMotion = motionSnapshot?.motionAvailable === true;
    const totalLiveG = hasLiveMotion && liveLateralG !== null && liveLongitudinalG !== null
        ? Math.hypot(liveLateralG, liveLongitudinalG)
        : null;
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return (<div className="flex min-h-dvh items-center justify-center bg-[#02060A] px-5 text-white">
      <section className="w-full max-w-[430px] text-center">
        <h1 className="text-[46px] font-black leading-none">
          {gpsHasFix && !gpsIsStale && !gpsError ? "Session Live" : "Session Armed"}
        </h1>
        {courseName ? (<p className="mt-3 text-base font-black text-[#9CE2FF]">{courseName}</p>) : null}
        {null}
        <div className="mt-8 grid gap-3 text-left">
          {null}
          <div className="rounded-[20px] border border-[#00A8E8]/24 bg-[#071018] p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#007DAE]/15 text-[#00A8E8]">
                <MapPin className="size-5" aria-hidden="true"/>
              </span>
              <div>
                <p className="text-lg font-black">{gpsStatusLabel}</p>
                <p className="mt-1 text-sm font-bold text-[#B8C0CC]">
                  {getGpsAccuracyLabel(latestGpsPoint?.accuracy)}
                </p>
                <p className="mt-1 text-xs font-bold text-[#8EA0B5]">
                  {formatGpsTimestamp(latestGpsPoint?.timestamp)}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] border border-white/[0.12] bg-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white">
                <Clock className="size-5" aria-hidden="true"/>
              </span>
              <p className="text-lg font-black">Session Time: {sessionTime}</p>
            </div>
          </div>
          {null}
          <section className="rounded-[20px] border border-white/[0.12] bg-white/[0.06] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CE2FF]">
              G-force
            </p>
            <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
              <GForceIndicator speedMph={liveSpeedMph} lateralG={liveLateralG} accelG={liveAccelG} brakingG={liveBrakingG} active={hasLiveMotion}/>
              <GForceTelemetryReadouts speedMph={liveSpeedMph} lateralG={liveLateralG} accelG={liveAccelG} brakingG={liveBrakingG} active={hasLiveMotion}/>
            </div>
            {!hasLiveMotion ? (<p className="mt-3 rounded-[14px] border border-amber-300/24 bg-amber-300/12 p-3 text-xs font-bold leading-5 text-amber-50">
                Motion sensor data unavailable
              </p>) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold leading-5 text-[#D7DEE8]">
              <p>Raw X: {motionSnapshot?.accelX?.toFixed(3) ?? "--"}</p>
              <p>Raw Y: {motionSnapshot?.accelY?.toFixed(3) ?? "--"}</p>
              <p>Raw Z: {motionSnapshot?.accelZ?.toFixed(3) ?? "--"}</p>
              <p>Motion permission: {motionPermissionStatus}</p>
              <p>Calculated lateral G: {liveLateralG?.toFixed(3) ?? "--"}</p>
              <p>Calculated longitudinal G: {liveLongitudinalG?.toFixed(3) ?? "--"}</p>
              <p>Total G magnitude: {totalLiveG?.toFixed(3) ?? "--"}</p>
              <p>Motion samples: {motionSnapshot?.motionSampleCount ?? 0}</p>
              <p className="col-span-2">
                Last motion sample: {motionSnapshot?.lastMotionSampleAt ?? "--"}
              </p>
              <p className="col-span-2">Motion source: {motionSnapshot?.motionSource ?? "--"}</p>
            </div>
          </section>
          {mountOrientationWarning ? (<p className="rounded-[18px] border border-amber-300/24 bg-amber-300/12 p-3 text-sm font-bold leading-6 text-amber-50">
              {mountOrientationWarning}
            </p>) : null}
          <p className="rounded-[18px] border border-[#00A8E8]/24 bg-[#007DAE]/12 p-3 text-sm font-bold leading-6 text-blue-50">
            For best results, keep the app open and the screen awake during recording.
          </p>
          {wakeLockMessage ? (<p className="rounded-[18px] border border-amber-300/24 bg-amber-300/12 p-3 text-sm font-bold leading-6 text-amber-50">
              {wakeLockMessage}
            </p>) : null}
          {waitingForGps ? (<p className="rounded-[18px] border border-amber-300/24 bg-amber-300/12 p-3 text-sm font-bold leading-6 text-amber-50">
              GPS has not produced a point yet.
            </p>) : null}
          {gpsIsStale ? (<p className="rounded-[18px] border border-amber-300/24 bg-amber-300/12 p-3 text-sm font-bold leading-6 text-amber-50">
              GPS signal stale
            </p>) : null}
          {gpsError ? (<p className="rounded-[18px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold leading-6 text-red-50">
              {gpsError}
            </p>) : null}
          {gpsDebug ? (<section className="rounded-[18px] border border-white/[0.12] bg-white/[0.06] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9CE2FF]">
                Temporary GPS Debug
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold leading-5 text-[#D7DEE8]">
                <p>GPS watcher started: {gpsDebug.watcherStarted ? "yes" : "no"}</p>
                <p>Watch ID: {gpsDebug.watchId ?? "--"}</p>
                <p>Points received count: {gpsDebug.pointsReceived}</p>
                <p>Points saved count: {gpsDebug.pointsSaved}</p>
                <p className="col-span-2 break-all">
                  Active session ID: {gpsDebug.activeSessionId ?? "--"}
                </p>
                <p className="col-span-2">
                  Last GPS point timestamp: {latestGpsPoint?.timestamp ?? "--"}
                </p>
                <p className="col-span-2">
                  Last latitude/longitude:{" "}
                  {latestGpsPoint
                ? `${latestGpsPoint.lat.toFixed(6)}, ${latestGpsPoint.lng.toFixed(6)}`
                : "--"}
                </p>
                <p>Accuracy: {latestGpsPoint?.accuracy ?? "--"}</p>
                <p>Last error code: {gpsDebug.lastErrorCode ?? "--"}</p>
                <p className="col-span-2 break-words">
                  Last error message: {gpsDebug.lastErrorMessage ?? "--"}
                </p>
              </div>
            </section>) : null}
        </div>
        {children}
        <button type="button" onClick={onEndSession} disabled={ending} className="mt-10 min-h-[84px] w-full rounded-full bg-red-600 px-6 text-xl font-black text-white shadow-[0_18px_38px_rgba(220,38,38,0.36)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70">
          {ending ? "Ending Session..." : "End Session"}
        </button>
      </section>
    </div>);
}
