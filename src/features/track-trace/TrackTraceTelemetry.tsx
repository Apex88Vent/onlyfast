import { SessionDetailPage } from './views/SessionDetailPage';

// Keep the established owner/revision boundary while using the source circuit
// review UI and its legacy-compatible read adapter.
export default function TrackTraceTelemetry({userId,revision,sessionId,canModify=false}:{userId:string;revision:string;sessionId:string;canModify?:boolean}){
  return <SessionDetailPage key={userId+revision+sessionId} sessionId={sessionId} readOnly={!canModify}/>;
}
