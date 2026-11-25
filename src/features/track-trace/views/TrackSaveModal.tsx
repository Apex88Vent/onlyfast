// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { Loader2, X } from "lucide-react";

type TrackSaveModalProps = {
  title: string;
  summary: string;
  explanation: string;
  saving: boolean;
  preview: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
};

export function TrackSaveModal({
  title,
  summary,
  explanation,
  saving,
  preview,
  onCancel,
  onSave
}: TrackSaveModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-save-title"
        className="w-full max-w-[420px] rounded-[26px] border border-white/[0.14] bg-[#071018] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00A8E8]">
              Confirm track update
            </p>
            <h2 id="track-save-title" className="mt-1 text-2xl font-black text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] text-white disabled:opacity-50"
            aria-label="Close save confirmation"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm font-black text-white">{summary}</p>
        <div className="mt-3">{preview}</div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#B8C0CC]">{explanation}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-12 rounded-full border border-white/[0.18] text-sm font-black text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#007DAE] text-sm font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
