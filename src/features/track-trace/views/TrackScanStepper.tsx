// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import type { TrackScanStage } from "../circuit/onlylapsTrackScanUtils.ts";

type TrackScanStepperProps = {
  stage: TrackScanStage;
};

const steps = [
  { label: "Outside", stages: ["outside_ready", "outside_recording"] },
  { label: "Start/Finish", stages: ["start_finish_recording"] },
  { label: "Inside", stages: ["inside_recording"] },
  { label: "Review", stages: ["review", "saved"] }
] as const;

function getActiveStep(stage: TrackScanStage) {
  const stepIndex = steps.findIndex((step) =>
    (step.stages as readonly TrackScanStage[]).includes(stage)
  );

  if (stepIndex >= 0) {
    return stepIndex;
  }

  return 0;
}

export function TrackScanStepper({ stage }: TrackScanStepperProps) {
  const activeStep = getActiveStep(stage);

  return (
    <ol className="grid grid-cols-4 gap-1.5 rounded-[18px] border border-white/[0.12] bg-[#050B11]/78 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.26)] backdrop-blur">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep || stage === "saved";

        return (
          <li key={step.label} className="min-w-0">
            <div
              className={`flex h-14 flex-col items-center justify-center rounded-[14px] border px-1 text-center transition ${
                isActive
                  ? "border-[#00A8E8] bg-[#007DAE] text-white shadow-[0_0_22px_rgba(47,155,255,0.34)]"
                  : isComplete
                    ? "border-[#00A8E8]/40 bg-[#007DAE]/16 text-[#9CE2FF]"
                    : "border-white/[0.08] bg-white/[0.04] text-[#B8C0CC]"
              }`}
            >
              <span className="text-[11px] font-black leading-none">{index + 1}</span>
              <span className="mt-1 max-w-full truncate text-[10px] font-black leading-tight">
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
