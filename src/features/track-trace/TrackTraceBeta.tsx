import { TRACK_TRACE_CONFIG } from './config';

export function TrackTraceBetaBadge() {
  // Exact discipline badge styles from OnboardingFlow and ClassChangeModal.
  return TRACK_TRACE_CONFIG.beta ? <span className="inline-flex shrink-0 align-middle rounded border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#00A8E8]">BETA</span> : null;
}

export function TrackTraceBetaNotice() {
  return TRACK_TRACE_CONFIG.beta ? <p className="rounded-xl bg-[#00A8E8]/5 px-4 py-3 text-xs leading-relaxed text-[#6B7280]" role="note">{TRACK_TRACE_CONFIG.betaMessage}</p> : null;
}
