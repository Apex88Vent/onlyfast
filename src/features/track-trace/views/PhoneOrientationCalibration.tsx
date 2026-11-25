// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19 StartSessionPage.
import {ArrowUp,ArrowDown,ArrowLeft,ArrowRight} from "lucide-react";
import type {PhoneMountOrientation} from "../circuit/types";
const phoneOrientationOptions: {
  orientation: PhoneMountOrientation;
  label: string;
  shortLabel: string;
  Icon: typeof ArrowUp;
}[] = [
  {
    orientation: "top_forward",
    label: "Top of phone",
    shortLabel: "Top",
    Icon: ArrowUp
  },
  {
    orientation: "bottom_forward",
    label: "Bottom of phone",
    shortLabel: "Bottom",
    Icon: ArrowDown
  },
  {
    orientation: "left_forward",
    label: "Left side of phone",
    shortLabel: "Left",
    Icon: ArrowLeft
  },
  {
    orientation: "right_forward",
    label: "Right side of phone",
    shortLabel: "Right",
    Icon: ArrowRight
  }
];
export function PhoneOrientationCalibration({
  onChange,
  selectedOrientation,
  warning
}: {
  onChange: (orientation: PhoneMountOrientation) => void;
  selectedOrientation: PhoneMountOrientation | null;
  warning: string | null;
}) {
  const selectedOption = phoneOrientationOptions.find(
    (option) => option.orientation === selectedOrientation
  );

  return (
    <section className="rounded-[18px] border border-[#007DAE]/20 bg-[#EFF6FF] p-4">
      <p className="text-sm font-black leading-6 text-[#0F4A7A]">
        Lay your phone flat and secure it before starting. Tap the arrow that points
        toward the front of the car.
      </p>
      <div className="mx-auto mt-4 grid w-full max-w-[210px] grid-cols-3 gap-2">
        {phoneOrientationOptions.map(({ orientation, label, shortLabel, Icon }) => {
          const selected = orientation === selectedOrientation;
          const positionClass =
            orientation === "top_forward"
              ? "col-start-2 row-start-1"
              : orientation === "left_forward"
                ? "col-start-1 row-start-2"
                : orientation === "right_forward"
                  ? "col-start-3 row-start-2"
                  : "col-start-2 row-start-3";

          return (
            <button
              key={orientation}
              type="button"
              onClick={() => onChange(orientation)}
              aria-label={`${label} points toward front of car`}
              className={`${positionClass} flex aspect-square flex-col items-center justify-center rounded-[16px] border text-xs font-black transition ${
                selected
                  ? "border-[#007DAE] bg-[#007DAE] text-white shadow-[0_12px_26px_rgba(30,136,255,0.28)]"
                  : "border-[#B9D8F4] bg-white text-[#0F4A7A] hover:border-[#007DAE] hover:bg-[#EAF6FF]"
              }`}
            >
              <Icon className="size-6" aria-hidden="true" />
              <span className="mt-1">{shortLabel}</span>
            </button>
          );
        })}
      </div>
      {selectedOption ? (
        <p className="mt-3 rounded-[14px] bg-[#007DAE]/10 p-3 text-xs font-black leading-5 text-[#0F4A7A]">
          Forward direction set: {selectedOption.label}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-xs font-black leading-5 text-amber-800">
          {warning}
        </p>
      ) : null}
    </section>
  );
}