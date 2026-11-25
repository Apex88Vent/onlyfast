// Ported from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// Circuit-only adapter changes are documented in docs/ONLYFAST_2027_TRACK_TRACE_PARITY.md.
import { ArrowRight, ClipboardList, X } from "lucide-react";
import {
  isOvalTrackType,
  trackLengthOptions,
  trackShapeOptions,
  trackTypeOptions,
  type TrackShapeValue,
  type TrackTypeValue
} from "../circuit/onlylapsTrackScanUtils.ts";

type TrackScanDetailsProps = {
  error: string | null;
  onCancel: () => void;
  onContinue: () => void;
  onTrackLengthChange: (trackLength: string) => void;
  onTrackShapeChange: (trackShape: TrackShapeValue | "") => void;
  onTrackTypeChange: (trackType: TrackTypeValue | "") => void;
  trackLength: string;
  trackShape: TrackShapeValue | "";
  trackType: TrackTypeValue | "";
};

export function TrackScanDetails({
  error,
  onCancel,
  onContinue,
  onTrackLengthChange,
  onTrackShapeChange,
  onTrackTypeChange,
  trackLength,
  trackShape,
  trackType
}: TrackScanDetailsProps) {
  const requiresOvalDetails = isOvalTrackType(trackType);

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-white/[0.12] bg-[#050B11]/86 p-5 shadow-[0_22px_55px_rgba(0,0,0,0.36)]">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00A8E8]">
          Track setup
        </p>
        <h1 className="mt-2 text-[32px] font-black leading-none text-white">
          Track Details
        </h1>
        <p className="mt-4 text-base font-semibold leading-7 text-[#D7DEE8]">
          Select the track characteristics before OnlyFast Track Trace starts the GPS scan.
        </p>
      </div>

      <div className="space-y-4 rounded-[22px] bg-white p-4 text-[#071018] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3 rounded-[18px] bg-[#EFF6FF] p-4">
          <ClipboardList className="size-5 shrink-0 text-[#007DAE]" aria-hidden="true" />
          <p className="text-sm font-black leading-6 text-[#071018]">
            These details are saved with the scanned track and shown again on review.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-black text-[#5D6675]">Track Type</span>
          <select
            aria-label="Track Type"
            value={trackType}
            onChange={(event) => onTrackTypeChange(event.target.value as TrackTypeValue | "")}
            className="mt-2 min-h-[52px] w-full rounded-[16px] border border-[#C8D1DD] bg-white px-4 text-base font-black text-[#071018] outline-none transition focus:border-[#007DAE] focus:ring-4 focus:ring-[#007DAE]/14"
          >
            <option value="">Select track type</option>
            {trackTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {requiresOvalDetails ? (
          <>
            <label className="block">
              <span className="text-sm font-black text-[#5D6675]">Track Shape</span>
              <select
                aria-label="Track Shape"
                value={trackShape}
                onChange={(event) => onTrackShapeChange(event.target.value as TrackShapeValue | "")}
                className="mt-2 min-h-[52px] w-full rounded-[16px] border border-[#C8D1DD] bg-white px-4 text-base font-black text-[#071018] outline-none transition focus:border-[#007DAE] focus:ring-4 focus:ring-[#007DAE]/14"
              >
                <option value="">Select track shape</option>
                {trackShapeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-[#5D6675]">Track Length</span>
              <select
                aria-label="Track Length"
                value={trackLength}
                onChange={(event) => onTrackLengthChange(event.target.value)}
                className="mt-2 min-h-[52px] w-full rounded-[16px] border border-[#C8D1DD] bg-white px-4 text-base font-black text-[#071018] outline-none transition focus:border-[#007DAE] focus:ring-4 focus:ring-[#007DAE]/14"
              >
                <option value="">Select track length</option>
                {trackLengthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {error ? (
          <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-[#007DAE] px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(30,136,255,0.28)] transition hover:bg-[#00A8E8]"
        >
          Continue to GPS Scan
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#D7DEE8] px-4 text-sm font-black text-[#5D6675] transition hover:border-[#007DAE] hover:text-[#007DAE]"
        >
          <X className="size-4" aria-hidden="true" />
          Cancel Scan
        </button>
      </div>
    </section>
  );
}
