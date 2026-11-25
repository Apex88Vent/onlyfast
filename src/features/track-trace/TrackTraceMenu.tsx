import { Play, ClipboardList, Map, ScanLine } from 'lucide-react';
import { homeActionCardClassName, homeActionIconContainerClassName, homeActionIconClassName, homeActionLabelClassName } from '@/components/homeActionStyles';
import { TrackTraceBetaNotice } from './TrackTraceBeta';

export type TrackTraceView = 'menu' | 'start' | 'review' | 'library' | 'scan';
const actions = [
  { view: 'start', label: 'Start Session', icon: Play },
  { view: 'review', label: 'Review Session', icon: ClipboardList },
  { view: 'library', label: 'Track Library', icon: Map },
  { view: 'scan', label: 'Scan Track', icon: ScanLine },
] as const;

export default function TrackTraceMenu({ onSelect, canRecord = true }: { onSelect: (view: TrackTraceView) => void; canRecord?: boolean }) {
  return <><TrackTraceBetaNotice /><section className="grid grid-cols-2 gap-1.5 sm:gap-4" aria-label="Track Trace menu">
    {actions.map(({ view, label, icon: Icon }) => <button key={view} type="button" disabled={!canRecord && (view === 'start' || view === 'scan')} onClick={() => { if (canRecord || (view !== 'start' && view !== 'scan')) onSelect(view); }}
      className={homeActionCardClassName + ' grid grid-cols-[48px_minmax(0,1fr)] gap-2 max-[379px]:grid-cols-[32px_minmax(0,1fr)] max-[379px]:gap-1.5 sm:flex sm:flex-col sm:text-center sm:gap-0'}>
      <span className={homeActionIconContainerClassName}><Icon className={homeActionIconClassName} strokeWidth={2.2} aria-hidden="true" /></span>
      <span className={homeActionLabelClassName + ' sm:mt-5'}>{label}</span>
    </button>)}
  </section></>;
}
