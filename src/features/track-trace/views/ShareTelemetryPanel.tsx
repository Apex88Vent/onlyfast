import type { SavedLapSession } from '../circuit/types';
export function ShareTelemetryPanel({session}:{session:SavedLapSession}){
  return <p className="text-xs text-slate-300" role="status">Telemetry sharing is unavailable in this testing integration. This session remains private.</p>;
}
