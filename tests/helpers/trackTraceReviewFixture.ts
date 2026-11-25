import type {SavedLapSession,SavedLapRecord,LapTelemetrySample} from '../../src/features/track-trace/circuit/types.ts';
import {circuitTrack} from './trackTraceGps.ts';
export function reviewFixture():SavedLapSession{
 const point=(p:number,r=.001)=>({lat:35+Math.sin(p*Math.PI*2)*r,lng:-118+Math.cos(p*Math.PI*2)*r/Math.cos(35*Math.PI/180),accuracy:.2,altitude:100,heading:null,speed:25,timestamp:''});
 const track=circuitTrack();Object.assign(track.map,{direction:'counterclockwise',track_name:'Synthetic benchmark oval',version:3,representative_path_raw:Array.from({length:401},(_,i)=>point(i/400)),inside_path:Array.from({length:401},(_,i)=>point(i/400,.0008)),outside_path:Array.from({length:401},(_,i)=>point(i/400,.0012))});
 const corners=Array.from({length:4},(_,i)=>({cornerNumber:i+1,startProgress:.05+i*.25,apexProgress:.125+i*.25,endProgress:.2+i*.25,primaryDirection:'left' as const,physicalLengthMeters:95,confidence:1,detectionMethod:'manual_range' as const,detectionVersion:'manual_v1',apex:point(.125+i*.25)}));
 const definitions={version:'manual_v1',generatedAt:'2026-11-25T00:00:00Z',trackType:track.map.track_type,travelDirection:track.map.direction,source:'manual_track_editor' as const,corners};
 const timings=[[2,3,4,5],[3,2,4.5,4.5],[3,4,2,3]],samples:LapTelemetrySample[]=[],laps:SavedLapRecord[]=[];
 for(let n=0;n<3;n++){
  const base=Date.parse('2026-11-25T00:00:00Z')+n*30000;
  const elapsed=(p:number)=>20*p+corners.reduce((sum,c,i)=>sum+Math.max(0,Math.min(p-c.startProgress,c.endProgress-c.startProgress))*(timings[n][i]/.15-20),0);
  for(let i=0;i<=400;i++){
   const p=i/400,position=point(p);samples.push({id:'s-'+n+'-'+i,sessionId:'session',userId:'owner',lapId:'lap-'+(n+1),lapNumber:n+1,trackId:track.map.id,timestamp:new Date(base+elapsed(p)*1000).toISOString(),latitude:position.lat,longitude:position.lng,gpsAccuracy:.2,speed:25+n,heading:null,altitude:100,accelX:1,accelY:2,accelZ:0,gyroX:null,gyroY:null,gyroZ:null,lateralG:p%0.25>.05?.4:0,longitudinalG:p%0.25<.11?.3:-.2,verticalG:0,sampleIndex:samples.length});
  }
  laps.push({id:'lap-'+(n+1),sessionId:'session',userId:'owner',trackId:track.map.id,lapNumber:n+1,lapTimeMs:elapsed(1)*1000,startedAt:new Date(base).toISOString(),endedAt:new Date(base+elapsed(1)*1000).toISOString(),createdAt:new Date(base).toISOString(),isValid:true,excludedReason:null,sectorTimesMs:[elapsed(.5)*1000,(elapsed(1)-elapsed(.5))*1000],averageSpeed:25+n,maxSpeed:25+n,maxLateralG:.4,maxLongitudinalG:.3,maxVerticalG:0,maxAccelG:.2,maxBrakingG:.3,rawTrace:Array.from({length:401},(_,i)=>({...point(i/400),timestamp:new Date(base+elapsed(i/400)*1000).toISOString()}))});
 }
 return {id:'session',rawId:'session',userId:'owner',trackId:track.map.id,trackName:'Synthetic benchmark oval',sessionName:'Measured practice fixture',sessionMode:'normal',startedAt:laps[0].startedAt,endedAt:laps.at(-1)!.endedAt,status:'completed',totalLapsRecorded:3,totalLapsSaved:3,fastestLapTimeMs:Math.min(...laps.map(l=>l.lapTimeMs)),averageLapTimeMs:18000,notes:'Synthetic fixture only',createdAt:laps[0].createdAt,phoneMountOrientation:'top_forward',telemetryGForceConvention:'vehicle_braking_positive_v2',trackMap:track.map,laps,telemetrySamples:samples,sectorCount:2,sectorDefinitionVersion:2,cornerDefinitions:definitions,hasStoredCornerDefinitions:true,geometryCompatibility:'snapshot'};
}
