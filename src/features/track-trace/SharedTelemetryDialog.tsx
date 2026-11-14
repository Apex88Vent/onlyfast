import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTrackTracePermission } from './useTrackTrace';
import { TrackTraceBetaBadge } from './TrackTraceBeta';

export default function SharedTelemetryDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const access = useTrackTracePermission(userId);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-[#E5E7EB] bg-white p-6 text-[#1A1B23]">
      <DialogHeader><div className="flex flex-wrap items-center gap-2"><DialogTitle>View Shared Telemetry</DialogTitle><TrackTraceBetaBadge /></div>
        <DialogDescription>Enter a share code to view telemetry</DialogDescription>
      </DialogHeader>
      {access.fullAccess ? <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
        <h3 className="font-semibold">Telemetry sharing is not available yet</h3>
        <p className="mt-2 text-sm text-[#6B7280]">The telemetry share-code service still needs to be connected to OnlyFast Track Trace before shared sessions can be viewed here.</p>
        <p className="mt-2 text-sm text-[#6B7280]">Share codes cannot be checked in OnlyFast yet.</p>
      </div> : access.navigationLocked ? <div><p>OnlyFast Track Trace is included with Pro and Factory.</p>
        <Link to="/upgrade" onClick={onClose} className="mt-3 inline-block font-semibold text-[#007DAE] underline">Upgrade to Pro to Unlock</Link></div>
        : <p role="status">{access.isError ? 'Access could not be verified. Refresh to try again.' : 'Checking access…'}</p>}
    </DialogContent>
  </Dialog>;
}
