import { Play, ClipboardList, Map, ScanLine } from 'lucide-react';
import { TrackTraceBetaNotice } from './TrackTraceBeta';

export type TrackTraceView = 'menu' | 'start' | 'review' | 'library' | 'scan';
const actions = [
  { view: 'start', label: 'Start Session', icon: Play, description: 'Prepare a linked or independent circuit session' },
  { view: 'review', label: 'Review Session', icon: ClipboardList, description: 'Open saved circuit sessions and telemetry' },
  { view: 'library', label: 'Track Library', icon: Map, description: 'Browse shared circuits and your saved scans' },
  { view: 'scan', label: 'Scan Track', icon: ScanLine, description: 'Capture a private circuit scan with GPS' },
] as const;

export default function TrackTraceMenu({ onSelect, canRecord = true }: { onSelect: (view: TrackTraceView) => void; canRecord?: boolean }) {
  return <><TrackTraceBetaNotice /><section className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Track Trace menu">
    {actions.map(({ view, label, icon: Icon, description }) => <button key={view} type="button" disabled={!canRecord && (view === 'start' || view === 'scan')} onClick={() => { if (canRecord || (view !== 'start' && view !== 'scan')) onSelect(view); }}
      className="flex min-h-[160px] min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3 text-center shadow-sm transition-all hover:border-[#00A8E8]/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 sm:min-h-[210px] sm:p-6">
      <Icon className="h-10 w-10 text-[#00A8E8] sm:h-14 sm:w-14" aria-hidden="true" />
      <span className="text-lg font-semibold text-[#1A1B23] sm:text-2xl">{label}</span>
      <span className="text-xs text-[#6B7280] sm:text-sm">{!canRecord && (view === 'start' || view === 'scan') ? 'Recording requires Pro or Factory' : description}</span>
    </button>)}
  </section></>;
}
