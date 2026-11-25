import type { SavedLapRecord, SavedLapSession, LapTelemetrySample, StoredCornerDefinitions, SessionCornerAnalysis } from './circuit/types.ts';
import type { SavedTrackMap } from './circuit/onlylapsTrackScanUtils.ts';
import { smoothLapTelemetry } from './circuit/telemetrySmoothing.ts';
import { normalizePersistedLongitudinalG } from './circuit/telemetryMath.ts';
import { buildSessionCornerAnalysis } from './circuit/cornerAnalysis.ts';

export type TelemetryRow=Record<string,unknown>;
const object=(v:unknown):TelemetryRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as TelemetryRow:{};
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const text=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const definitions=(value:unknown):StoredCornerDefinitions|null=>{
  const d=object(value);
  return typeof d.version==='string'&&Array.isArray(d.corners)&&d.corners.every(c=>{
    const corner=object(c),apex=object(corner.apex);
    return ['startProgress','apexProgress','endProgress','cornerNumber'].every(k=>number(corner[k])!==null)&&number(apex.lat)!==null&&number(apex.lng)!==null;
  })?d as unknown as StoredCornerDefinitions:null;
};
const analysis=(value:unknown):SessionCornerAnalysis|null=>{
  const a=object(value);
  return typeof a.version==='string'&&definitions(a.definitions)&&Array.isArray(a.laps)&&a.laps.every(l=>Array.isArray(object(l).corners))&&Array.isArray(object(a.dataQuality).warnings)?a as unknown as SessionCornerAnalysis:null;
};
function lapSectors(lap:TelemetryRow,sectors:TelemetryRow[]):(number|null)[]{
  if(Array.isArray(lap.sector_times_ms)&&lap.sector_times_ms.length)return lap.sector_times_ms.map(number);
  const stored=sectors.filter(s=>s.lap_id===lap.id);
  const count=Math.min(5,Math.max(0,...stored.map(s=>number(s.sector_index)??0)));
  return Array.from({length:count},(_,index)=>number(stored.find(s=>s.sector_index===index+1)?.duration_ms));
}
export function mapTelemetryRows(rows:TelemetryRow[],session:TelemetryRow,laps:SavedLapRecord[]):LapTelemetrySample[]{
  const device=object(session.device_info);
  return rows.flatMap((row,index)=>{
    const raw=object(row.raw),sample=object(raw.sample);
    // Source column values stay authoritative; nested samples supply motion and
    // interruption metadata. Missing coordinates never become fabricated 0,0.
    const latitude=number(row.latitude)??number(sample.latitude),longitude=number(row.longitude)??number(sample.longitude);
    const timestamp=text(row.recorded_at,text(sample.timestamp));
    if(latitude===null||longitude===null||Math.abs(latitude)>90||Math.abs(longitude)>180||!Number.isFinite(Date.parse(timestamp)))return[];
    const lapId=text(raw.lapId,text(sample.lapId));
    const assigned=number(raw.lapNumber)??number(sample.lapNumber)??laps.find(l=>l.id===lapId)?.lapNumber??laps.find(l=>Date.parse(timestamp)>=Date.parse(l.startedAt)&&Date.parse(timestamp)<Date.parse(l.endedAt))?.lapNumber??null;
    const convention=raw.gForceConvention??device.gForceConvention??'vehicle_acceleration_positive_v1';
    const longitudinal=number(row.g_force_longitudinal)??number(sample.longitudinalG);
    return [{id:text(row.id,String(row.id)),sessionId:text(session.id),userId:text(session.user_id),trackId:text(session.track_map_id)||null,
      lapId:lapId||null,lapNumber:assigned,timestamp,latitude,longitude,
      gpsAccuracy:number(row.accuracy_meters)??number(sample.gpsAccuracy),speed:number(row.speed_mps)??number(sample.speed),heading:number(row.heading_degrees)??number(sample.heading),altitude:number(row.altitude_meters)??number(sample.altitude),
      accelX:number(raw.accelX)??number(sample.accelX),accelY:number(raw.accelY)??number(sample.accelY),accelZ:number(raw.accelZ)??number(sample.accelZ),
      gyroX:number(raw.gyroX)??number(sample.gyroX),gyroY:number(raw.gyroY)??number(sample.gyroY),gyroZ:number(raw.gyroZ)??number(sample.gyroZ),
      lateralG:number(row.g_force_lateral)??number(sample.lateralG),longitudinalG:normalizePersistedLongitudinalG(longitudinal,convention==='vehicle_braking_positive_v2'?'vehicle_braking_positive_v2':'vehicle_acceleration_positive_v1'),
      verticalG:number(raw.verticalG)??number(sample.verticalG),sampleIndex:number(row.sample_index)??number(raw.sampleIndex)??number(sample.sampleIndex)??index}];
  });
}
export function mapReviewBundle(bundle:TelemetryRow,rows:TelemetryRow[]):SavedLapSession{
  const s=object(bundle.session),device=object(s.device_info),recording=object(device.track_trace_recording),snapshot=object(recording.track);
  const map=object(snapshot.map),rawMap=Object.keys(map).length?map:object(bundle.map);
  const track=Object.keys(rawMap).length?{...rawMap,outside_path:rawMap.outside_path??[],inside_path:rawMap.inside_path??[],start_finish_path:rawMap.start_finish_path??[],representative_path_raw:rawMap.representative_path_raw??[],representative_path_smoothed:rawMap.representative_path_smoothed??[],revision_history:rawMap.revision_history??[],corner_definitions:definitions(rawMap.corner_definitions)} as unknown as SavedTrackMap:null;
  const sectors=(bundle.sectors??[]) as TelemetryRow[];
  const laps=((bundle.laps??[]) as TelemetryRow[]).map((l):SavedLapRecord=>({id:text(l.id),sessionId:text(s.id),userId:text(s.user_id),trackId:text(s.track_map_id)||null,
    lapNumber:number(l.lap_number)??0,lapTimeMs:number(l.duration_ms)??0,startedAt:text(l.started_at),endedAt:text(l.ended_at),createdAt:text(l.created_at),isValid:l.is_valid!==false,excludedReason:text(l.excluded_reason)||null,
    averageSpeed:number(l.average_speed),maxSpeed:number(l.max_speed),maxLateralG:number(l.max_lateral_g),maxLongitudinalG:number(l.max_longitudinal_g),maxVerticalG:number(l.max_vertical_g),maxAccelG:number(l.max_accel_g),maxBrakingG:number(l.max_braking_g),
    sectorTimesMs:lapSectors(l,sectors),
    rawTrace:Array.isArray(l.raw_trace)?l.raw_trace as SavedLapRecord['rawTrace']:undefined,smoothedTrace:Array.isArray(l.smoothed_trace)?l.smoothed_trace as SavedLapRecord['smoothedTrace']:undefined,
    smoothingConfidence:l.smoothing_confidence as SavedLapRecord['smoothingConfidence'],smoothingSummary:l.smoothing_summary as SavedLapRecord['smoothingSummary'],smoothingWarning:text(l.smoothing_warning)||text(object(l.smoothing_summary).warning)||null}));
  const samples=mapTelemetryRows(rows,s,laps);
  for(const lap of laps){
    if(!lap.smoothedTrace?.length){const smoothed=smoothLapTelemetry({samples:samples.filter(p=>p.lapNumber===lap.lapNumber),track,lapTimeMs:lap.lapTimeMs});
      lap.rawTrace=lap.rawTrace?.length?lap.rawTrace:smoothed.rawTrace;lap.smoothedTrace=smoothed.smoothedTrace;lap.smoothingConfidence=smoothed.confidence;lap.smoothingWarning=smoothed.warning;lap.smoothingSummary??=smoothed.summary;}
  }
  const valid=laps.filter(l=>l.isValid),times=valid.map(l=>l.lapTimeMs),layout=object(snapshot.sectors??bundle.layout);
  // Historical result widths outrank today's personal/default layout. Editing a
  // library layout must not add phantom sectors to an older session's optimum.
  const recordedSectorCount=Math.max(0,...laps.map(l=>l.sectorTimesMs?.length??0));
  const storedSectorVersion=number(sectors[0]?.source_definition_version);
  const failed=device.sessionStatus==='recording_error';
  const diagnostics=object(device.recordingDiagnostics);
  const result:SavedLapSession={id:text(s.id),rawId:text(s.id),userId:text(s.user_id),trackId:text(s.track_map_id)||null,trackName:text(s.name,track?.track_name??'Circuit session'),sessionName:text(s.session_name)||null,sessionMode:'normal',
    startedAt:text(s.started_at,text(s.created_at)),endedAt:text(s.ended_at),createdAt:text(s.created_at),notes:text(s.notes)||null,status:failed?'failed':s.ended_at?'completed':'active',
    reviewStatus:failed?'recording_error':s.ended_at?(samples.length||number(bundle.sample_count)||laps.length?'complete':'no_gps_data'):'recording',gpsSampleCount:number(bundle.sample_count)??samples.length,gpsErrorMessage:text(device.gpsErrorMessage)||null,
    recordingDiagnostics:Array.isArray(diagnostics.crossingEvents)&&Array.isArray(diagnostics.ignoredCrossingReasons)?diagnostics as SavedLapSession['recordingDiagnostics']:null,
    totalLapsRecorded:laps.length,totalLapsSaved:valid.length,fastestLapTimeMs:times.length?Math.min(...times):null,averageLapTimeMs:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null,rawAverageLapTimeMs:laps.length?Math.round(laps.reduce((a,b)=>a+b.lapTimeMs,0)/laps.length):null,
    phoneMountOrientation:(s.phone_mount_orientation??device.phoneMountOrientation??object(rows[0]?.raw).phoneMountOrientation??object(object(rows[0]?.raw).sample).phoneMountOrientation) as SavedLapSession['phoneMountOrientation']??null,telemetryGForceConvention:'vehicle_braking_positive_v2',trackMap:track,laps,telemetrySamples:samples,
    sectorCount:recordedSectorCount||number(layout.sectorCount)||0,sectorDefinitionVersion:storedSectorVersion??number(layout.version),sectorSourceKind:(sectors[0]?.source_kind??layout.source) as SavedLapSession['sectorSourceKind'],
    sectorResults:sectors.map(x=>({lapId:text(x.lap_id),sectorIndex:number(x.sector_index)??0,durationMs:number(x.duration_ms),crossingTimestamp:text(x.crossing_timestamp)||null,isValid:x.is_valid===true,sourceDefinitionVersion:number(x.source_definition_version)??0,sourceKind:x.source_kind as SavedLapSession['sectorSourceKind']})),
    cornerDefinitions:definitions(s.corner_definitions)??definitions(device.cornerDefinitions)??definitions(track?.corner_definitions),cornerAnalysis:analysis(s.corner_analysis)??analysis(device.cornerAnalysis)};
  if(!result.cornerAnalysis){result.cornerAnalysis=buildSessionCornerAnalysis(result);result.cornerDefinitions??=result.cornerAnalysis?.definitions??null;}
  return result;
}
