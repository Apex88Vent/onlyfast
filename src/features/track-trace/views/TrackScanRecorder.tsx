// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { AlertTriangle, CircleDot, Pause, Play, TimerReset, X } from "lucide-react";
import type {
  GpsPoint,
  TrackScanMetadata,
  TrackScanStage
} from "../circuit/onlylapsTrackScanUtils.ts";
type TrackScanWakeLockStatus = "idle"|"active"|"released"|"unavailable"|"failed";
import { TrackScanPreview } from "./TrackScanPreview";

type TrackScanRecorderProps = {
  stage: TrackScanStage;
  outsidePath: GpsPoint[];
  startFinishPath: GpsPoint[];
  insidePath: GpsPoint[];
  currentPoint: GpsPoint | null;
  elapsedSeconds: number;
  gpsError: string | null;
  isPaused: boolean;
  isWatching: boolean;
  trackDetails: TrackScanMetadata;
  wakeLockMessage: string | null;
  wakeLockStatus: TrackScanWakeLockStatus;
  onCancel: () => void;
  onEndInside: () => void;
  onEndOutside: () => void;
  onEndStartFinish: () => void;
  onStartOutside: () => void;
  onTogglePause: () => void;
};

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getAccuracyStatus(accuracy: number | null | undefined) {
  if (accuracy == null) {
    return {
      label: "Waiting",
      className: "bg-white/[0.08] text-[#D7DEE8]",
      isPoor: false
    };
  }

  if (accuracy < 10) {
    return {
      label: "Good",
      className: "bg-emerald-400/15 text-emerald-200",
      isPoor: false
    };
  }

  if (accuracy <= 25) {
    return {
      label: "Okay",
      className: "bg-amber-300/18 text-amber-100",
      isPoor: false
    };
  }

  return {
    label: "Poor",
    className: "bg-red-400/16 text-red-100",
    isPoor: true
  };
}

function getStageDetails(stage: TrackScanStage) {
  if (stage === "outside_recording") {
    return {
      eyebrow: "Outside trace",
      title: "Drive the outside wall",
      copy: "Walk or drive slowly around the outside perimeter of the track.",
      endLabel: "End Outside Lap",
      pointsLabel: "Outside points"
    };
  }

  if (stage === "start_finish_recording") {
    return {
      eyebrow: "Start/finish line",
      title: "Trace straight across",
      copy: "Now walk or slowly drive straight across the start/finish line from the outside wall to the inside edge of the track.",
      endLabel: "End Start/Finish Line",
      pointsLabel: "Start/finish points"
    };
  }

  return {
    eyebrow: "Inside trace",
    title: "Trace the inside edge",
    copy: "Now trace the inside perimeter of the track. Stay as close to the inside edge as safely possible.",
    endLabel: "End Inside Lap",
    pointsLabel: "Inside points"
  };
}

function getActivePointCount(
  stage: TrackScanStage,
  outsidePath: GpsPoint[],
  startFinishPath: GpsPoint[],
  insidePath: GpsPoint[]
) {
  if (stage === "outside_recording") {
    return outsidePath.length;
  }

  if (stage === "start_finish_recording") {
    return startFinishPath.length;
  }

  if (stage === "inside_recording") {
    return insidePath.length;
  }

  return 0;
}

function getWakeLockLabel(status: TrackScanWakeLockStatus) {
  if (status === "active") {
    return "Active";
  }

  if (status === "released") {
    return "Released";
  }

  if (status === "failed" || status === "unavailable") {
    return "Manual";
  }

  return "Pending";
}

export function TrackScanRecorder({
  stage,
  outsidePath,
  startFinishPath,
  insidePath,
  currentPoint,
  elapsedSeconds,
  gpsError,
  isPaused,
  isWatching,
  trackDetails,
  wakeLockMessage,
  wakeLockStatus,
  onCancel,
  onEndInside,
  onEndOutside,
  onEndStartFinish,
  onStartOutside,
  onTogglePause
}: TrackScanRecorderProps) {
  if (stage === "outside_ready") {
    return (
      <section className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-5 shadow-[0_22px_55px_rgba(0,0,0,0.36)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
            Ready
          </p>
          <h1 className="mt-2 text-[32px] font-black leading-none text-white">
            Start outside
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-[#D7DEE8]">
            Stand at the outside wall on the start/finish line. This is where the
            outside lap trace begins.
          </p>
        </div>

        <TrackScanPreview
          outsidePath={outsidePath}
          startFinishLinePath={startFinishPath}
          insidePath={insidePath}
          currentPoint={currentPoint}
          scanStage={stage}
          trackType={trackDetails.trackType}
          trackShape={trackDetails.trackShape}
          trackLength={trackDetails.trackLength}
        />

        <div className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <button
            type="button"
            onClick={onStartOutside}
            className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-[#007DAE] px-5 text-lg font-black text-white shadow-[0_10px_24px_rgba(30,136,255,0.28)] transition hover:bg-[#00A8E8]"
          >
            <Play className="size-5" aria-hidden="true" />
            Start Outside Trace
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#D7DEE8] px-4 text-sm font-black text-[#5D6675] transition hover:border-[#007DAE] hover:text-[#007DAE]"
          >
            <X className="size-4" aria-hidden="true" />
            Cancel Scan
          </button>
        </div>
      </section>
    );
  }

  const details = getStageDetails(stage);
  const pointCount = getActivePointCount(stage, outsidePath, startFinishPath, insidePath);
  const accuracyStatus = getAccuracyStatus(currentPoint?.accuracy);
  const endAction =
    stage === "outside_recording"
      ? onEndOutside
      : stage === "start_finish_recording"
        ? onEndStartFinish
        : onEndInside;

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-4 shadow-[0_22px_55px_rgba(0,0,0,0.36)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
              {details.eyebrow}
            </p>
            <h1 className="mt-2 text-[28px] font-black leading-none text-white">
              {details.title}
            </h1>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              isPaused ? "bg-amber-300/18 text-amber-100" : "bg-[#007DAE]/18 text-[#9CE2FF]"
            }`}
          >
            {isPaused ? "Paused" : "Recording"}
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-[#D7DEE8]">
          {details.copy}
        </p>
      </div>

      <TrackScanPreview
        outsidePath={outsidePath}
        startFinishLinePath={startFinishPath}
        insidePath={insidePath}
        currentPoint={currentPoint}
        scanStage={stage}
        trackType={trackDetails.trackType}
        trackShape={trackDetails.trackShape}
        trackLength={trackDetails.trackLength}
      />

      <section className="rounded-[20px] border border-white/[0.12] bg-[#071018]/90 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
              Accuracy
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${accuracyStatus.className}`}>
                {accuracyStatus.label}
              </span>
              <span className="text-sm font-black text-white">
                {currentPoint?.accuracy != null ? `${currentPoint.accuracy.toFixed(1)} m` : "--"}
              </span>
            </div>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
              Elapsed
            </p>
            <p className="mt-2 text-xl font-black text-white">{formatElapsed(elapsedSeconds)}</p>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
              {details.pointsLabel}
            </p>
            <p className="mt-2 text-xl font-black text-white">{pointCount}</p>
          </div>
          <div className="rounded-[16px] bg-white/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B8C0CC]">
              Wake lock
            </p>
            <p className="mt-2 text-xl font-black text-white">{getWakeLockLabel(wakeLockStatus)}</p>
          </div>
        </div>

        {accuracyStatus.isPoor ? (
          <p className="mt-3 rounded-[14px] border border-amber-300/24 bg-amber-300/12 p-3 text-xs font-bold leading-5 text-amber-50">
            GPS accuracy is low. Keep the phone visible to the sky and avoid battery saver mode.
          </p>
        ) : null}

        {wakeLockMessage ? (
          <p className="mt-3 rounded-[14px] border border-[#00A8E8]/24 bg-[#007DAE]/12 p-3 text-xs font-bold leading-5 text-blue-50">
            {wakeLockMessage}
          </p>
        ) : null}

        {gpsError ? (
          <p className="mt-3 flex gap-2 rounded-[14px] border border-red-300/24 bg-red-400/12 p-3 text-xs font-bold leading-5 text-red-50">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {gpsError}
          </p>
        ) : null}
      </section>

      <div className="rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        <button
          type="button"
          onClick={endAction}
          className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-[#007DAE] px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(30,136,255,0.28)] transition hover:bg-[#00A8E8]"
        >
          <CircleDot className="size-5" aria-hidden="true" />
          {details.endLabel}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTogglePause}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-[#007DAE] px-3 text-sm font-black text-[#007DAE] transition hover:bg-[#EFF6FF]"
          >
            {isPaused ? (
              <Play className="size-4" aria-hidden="true" />
            ) : (
              <Pause className="size-4" aria-hidden="true" />
            )}
            {isPaused ? "Resume GPS" : "Pause GPS"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-[#D7DEE8] px-3 text-sm font-black text-[#5D6675] transition hover:border-[#007DAE] hover:text-[#007DAE]"
          >
            <TimerReset className="size-4" aria-hidden="true" />
            Cancel Scan
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] font-bold text-[#6F7B88]">
          GPS watch is {isWatching ? "running" : "waiting"}.
        </p>
      </div>
    </section>
  );
}
