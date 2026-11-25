// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19.
// OnlyFast permissions, routing and immutable historical versions are adapted.
import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { TrackDefinitionMap } from "./TrackDefinitionMap";
import { buildTrackCleanupPreview, previousCleanupGeometry, type TrackCleanupPreview } from "../circuit/trackCleanupPreview";
import { getTrackShapeLabel, getTrackTypeLabel, isOvalTrackType, type SavedTrackMap } from "../circuit/onlylapsTrackScanUtils";

export function TrackScanCleanupPanel({ track }: { track: SavedTrackMap }) {
  const [preview, setPreview] = useState<TrackCleanupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function analyze(restore = false) {
    setError(null);
    setMessage(null);
    try {
      const next = buildTrackCleanupPreview(track, restore);
      setPreview(next);
      if (import.meta.env.DEV) console.debug("OnlyFast Track Trace cleanup diagnostics", next.diagnostics);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This scan could not be cleaned safely."); }
  }
  const corrected = preview?.outliers.length ?? 0;
  const excursions = preview?.anomalies.filter(anomaly => anomaly.kind === "excursion").length ?? 0;
  return (
    <section className="space-y-4 rounded-[24px] border border-white/[0.12] bg-[#050B11]/90 p-5" aria-label="Scan cleanup">
      <div className="flex items-center gap-3">
        <WandSparkles className="size-6 text-[#9CE2FF]" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Clean Up Scan</h2>
      </div>
      <p className="text-sm font-semibold leading-6 text-[#B8C0CC]">
        Preview the original scan cleanup calculations. Saving cleanup is unavailable until the atomic geometry/sector remapping contract is integrated into the testing backend.
      </p>
      <p className="text-xs font-bold text-[#9CE2FF]">
        {[getTrackTypeLabel(track.track_type), isOvalTrackType(track.track_type) && track.track_shape ? getTrackShapeLabel(track.track_shape) : null].filter(Boolean).join(" · ")}
      </p>
      {preview ? (
        <>
          <TrackDefinitionMap track={preview.track} ranges={[]} cleanup={preview} ariaLabel="Scan cleanup preview: original scan dashed gray, proposed scan blue, rejected GPS excursions and samples amber" />
          <p className="text-xs font-semibold text-[#B8C0CC]">Dashed gray: saved scan · Blue: proposed scan · Amber: rejected excursions and GPS outliers</p>
          <p role="status" className="text-sm font-bold text-white">
            {preview.restored ? "Previous scan ready to restore" : excursions ? `${excursions} GPS ${excursions === 1 ? "excursion" : "excursions"} detected · ${corrected} GPS samples corrected` : corrected ? `${corrected} GPS ${corrected === 1 ? "anomaly" : "anomalies"} corrected` : "No high-confidence GPS anomalies found. Your scan is unchanged."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled title="Atomic scan cleanup saving is not integrated" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#007DAE] px-4 text-sm font-black text-white disabled:opacity-40">
              {preview.restored ? "Save Restored Track" : "Save Cleaned Track"}
            </button>
            <button type="button" onClick={() => { setPreview(null); setError(null); setMessage("Cleanup canceled. Your saved scan is unchanged."); }} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-bold text-white disabled:opacity-40">Cancel / Revert</button>
          </div>
          <p className="text-xs leading-5 text-[#B8C0CC]">Preview only. The saved scan, start/finish, sectors, corners and historical sessions are unchanged.</p>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => analyze()} className="min-h-11 rounded-xl bg-[#007DAE] px-4 text-sm font-black text-white">Clean Up Scan</button>
          {previousCleanupGeometry(track) ? <button type="button" onClick={() => analyze(true)} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-bold text-white">Restore Previous Scan</button> : null}
        </div>
      )}
      {message ? <p role="status" className="text-sm font-semibold text-emerald-200">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm font-semibold text-red-100">{error}</p> : null}
    </section>
  );
}
