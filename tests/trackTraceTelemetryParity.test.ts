import assert from 'node:assert/strict';
import test from 'node:test';
import { mapReviewBundle, mapTelemetryRows } from '../src/features/track-trace/telemetryModel.ts';
import { CircuitRecorder } from '../src/features/track-trace/circuit/recorder.ts';
import { buildOptimumLap } from '../src/features/track-trace/circuit/optimumLap.ts';
import { circuitTrack, syntheticCircuit } from './helpers/trackTraceGps.ts';
const start='2026-11-24T12:00:00.000Z';
test('legacy columns/raw fields restore measured speed, G, motion and lap assignment without a recorder ID',()=>{
  const session={id:'s',user_id:'owner',track_map_id:'map'};
  const row={id:'9007199254740993',recorded_at:start,latitude:35,longitude:-118,speed_mps:20,g_force_lateral:.4,g_force_longitudinal:.3,raw:{lapNumber:1,accelX:2,verticalG:.2,sampleIndex:7}};
  const [sample]=mapTelemetryRows([row],session,[]);
  assert.equal(sample.id,'9007199254740993');assert.equal(sample.speed,20);assert.equal(sample.longitudinalG,-.3);assert.equal(sample.lateralG,.4);assert.equal(sample.accelX,2);assert.equal(sample.lapNumber,1);
});
test('Phase 2D nested samples retain the current braking convention, including null sensor values',()=>{
  const [sample]=mapTelemetryRows([{id:'2',recorded_at:start,latitude:35,longitude:-118,speed_mps:0,raw:{gForceConvention:'vehicle_braking_positive_v2',sample:{longitudinalG:.3,accelX:null,gyroZ:.4,phoneMountOrientation:'left_forward'}}}],{id:'s'},[]);
  assert.equal(sample.speed,0);assert.equal(sample.longitudinalG,.3);assert.equal(sample.accelX,null);assert.equal(sample.gyroZ,.4);
});
test('invalid/missing coordinates never turn into a fabricated 0,0 GPS sample',()=>{
  assert.deepEqual(mapTelemetryRows([{id:'1',recorded_at:start},{id:'2',recorded_at:start,latitude:999,longitude:1}],{},[]),[]);
});
test('legacy laps without raw lap tags use stored time intervals; missing measurements remain null',()=>{
  const lap={id:'lap',lapNumber:4,startedAt:start,endedAt:'2026-11-24T12:00:20Z'} as any;
  const [sample]=mapTelemetryRows([{id:'1',recorded_at:'2026-11-24T12:00:01Z',latitude:35,longitude:-118}],{},[lap]);
  assert.equal(sample.lapNumber,4);assert.equal(sample.speed,null);assert.equal(sample.lateralG,null);
});
test('source replay/optimum/corner models restore a legacy circuit recording with no new recorder columns',()=>{
  const track=circuitTrack(),recorder=new CircuitRecorder(track);for(const p of syntheticCircuit(Date.parse(start)))recorder.add(p);
  const laps=recorder.finish('s','owner').map(l=>({id:'lap-'+l.lapNumber,lap_number:l.lapNumber,duration_ms:l.lapTimeMs,started_at:l.startedAt,ended_at:l.endedAt,is_valid:true,sector_times_ms:l.sectors.map(s=>s.durationMs)}));
  const rows=recorder.samples.map((p,i)=>({id:String(i+1),recorded_at:p.timestamp,latitude:p.latitude,longitude:p.longitude,speed_mps:p.speed,accuracy_meters:p.gpsAccuracy,raw:{lapNumber:p.lapNumber}}));
  const result=mapReviewBundle({session:{id:'s',name:'Legacy circuit',user_id:'owner',track_map_id:track.map.id,started_at:start,ended_at:'2026-11-24T12:01:10Z'},map:track.map,laps,sectors:[],sample_count:64,layout:{sectorCount:2,version:2,source:'track_default'}},rows);
  assert.equal(result.trackName,'Legacy circuit');assert.equal(result.telemetrySamples!.length,64);assert.equal(result.laps!.length,3);assert(result.laps!.every(l=>l.rawTrace!.length>0&&l.smoothedTrace!.length>0));
  assert.equal(result.fastestLapTimeMs,20000);assert.equal(result.reviewStatus,'complete');assert(result.cornerAnalysis);assert(result.cornerDefinitions?.corners.length);
  const optimum=buildOptimumLap(result);assert(optimum);assert.equal(optimum.lap.lapTimeMs,20000);assert(optimum.samples.length>0);
});
test('metadata-only listing never calls a non-empty historical recording an empty GPS session',()=>{
  const result=mapReviewBundle({session:{id:'s',name:'History',started_at:start,ended_at:start},laps:[],sectors:[],sample_count:12},[]);
  assert.equal(result.gpsSampleCount,12);assert.equal(result.reviewStatus,'complete');
});

test('historical device JSON retains source analysis, mounting orientation, diagnostics and recording failures',()=>{
  const definitions={version:'stored-version',corners:[]};
  const analysis={version:'analysis-version',definitions,dataQuality:{warnings:['Stored quality warning']},laps:[]};
  const diagnostics={crossingEvents:[],ignoredCrossingReasons:['GPS gap'],totalGpsPoints:20};
  const result=mapReviewBundle({session:{id:'s',name:'Legacy JSON',started_at:start,device_info:{sessionStatus:'recording_error',gpsErrorMessage:'Original GPS error',phoneMountOrientation:'right_forward',cornerDefinitions:definitions,cornerAnalysis:analysis,recordingDiagnostics:diagnostics}},sample_count:20},[]);
  assert.deepEqual(result.cornerDefinitions,definitions);assert.deepEqual(result.cornerAnalysis,analysis);assert.deepEqual(result.recordingDiagnostics,diagnostics);
  assert.equal(result.phoneMountOrientation,'right_forward');assert.equal(result.status,'failed');assert.equal(result.reviewStatus,'recording_error');assert.equal(result.gpsErrorMessage,'Original GPS error');
});

test('relational historical sectors survive empty embedded arrays and later personal layout edits',()=>{
  const result=mapReviewBundle({session:{id:'s',name:'Stored sectors',started_at:start,ended_at:'2026-11-24T12:00:20Z'},laps:[{id:'l',lap_number:1,duration_ms:20000,started_at:start,ended_at:'2026-11-24T12:00:20Z',is_valid:true,sector_times_ms:[]}],sectors:[{lap_id:'l',sector_index:1,duration_ms:9000,source_definition_version:2,source_kind:'track_default',is_valid:true},{lap_id:'l',sector_index:2,duration_ms:11000,source_definition_version:2,source_kind:'track_default',is_valid:true}],layout:{sectorCount:3,version:9,source:'user_override'}},[]);
  assert.deepEqual(result.laps![0].sectorTimesMs,[9000,11000]);assert.equal(result.sectorCount,2);assert.equal(result.sectorDefinitionVersion,2);assert.equal(result.sectorSourceKind,'track_default');
  assert.equal(buildOptimumLap(result)?.lap.lapTimeMs,20000);
});
