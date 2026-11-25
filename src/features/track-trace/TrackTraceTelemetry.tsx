import { SessionDetailPage } from './views/SessionDetailPage';
import type {TraceContext} from './api';

// Keep the established owner/revision boundary while using the source circuit
// review UI and its legacy-compatible read adapter.
export default function TrackTraceTelemetry({userId,revision,sessionId,summary,canModify=false}:{userId:string;revision:string;sessionId:string;summary:TraceContext;canModify?:boolean}){
  return <SessionDetailPage key={userId+revision+sessionId} userId={userId} revision={revision} sessionId={sessionId} summary={summary} readOnly={!canModify}/>;
}
