import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFixture} from './helpers/trackTraceReviewFixture.ts';
import {buildCornerBenchmarks,compareCornerTraversal} from '../src/features/track-trace/circuit/cornerBenchmarks.ts';
import {buildOverallAssist,buildCompatibleOptimum,validateDrivingExplanation,cornerComparisonNarrative} from '../src/features/track-trace/circuit/overallAssist.ts';
import {gForceVisual} from '../src/features/track-trace/circuit/gForceVisual.ts';
import {mapReviewBundle} from '../src/features/track-trace/telemetryModel.ts';

test('each corner uses its own fastest complete traversal, rather than the fastest lap',()=>{
 const session=reviewFixture(),before=structuredClone(session),result=buildCornerBenchmarks(session);
 assert.deepEqual(result.corners.map(c=>c.best?.lapNumber),[1,2,3,3]);
 assert.deepEqual(result.corners.map(c=>Math.round(c.best!.timeMs)),[2000,2000,2000,3000]);
 assert(result.corners.every(c=>c.best!.positionReliable));assert.deepEqual(session,before);
 const comparison=compareCornerTraversal(result.corners[0].traversals.find(t=>t.lapNumber===3)!,result.corners[0].best!);
 assert(Math.abs(comparison.deltaMs-1000)<3);assert(comparison.distinguishable);
});
test('invalid laps and incompatible versions/directions/layouts cannot supply benchmarks',()=>{
 for(const incompatibility of [{trackVersion:4},{direction:'clockwise'},{sectorVersion:99},{cornerVersion:'other'},{trackId:'other'}]){
  const session=reviewFixture();session.laps![0].traceCompatibility=incompatibility;
  const result=buildCornerBenchmarks(session);assert(!result.eligibleLapIds.includes('lap-1'));assert(result.excluded.some(e=>e.lapId==='lap-1'));
 }
 const session=reviewFixture();session.laps![0].isValid=false;assert.notEqual(buildCornerBenchmarks(session).corners[0].best?.lapId,'lap-1');
});
test('GPS gaps, missing coverage and invalid corner ranges exclude incomplete traversals',()=>{
 const session=reviewFixture();session.telemetrySamples=session.telemetrySamples!.filter(s=>!(s.lapNumber===1&&Date.parse(s.timestamp)-Date.parse(session.laps![0].startedAt)>1000&&Date.parse(s.timestamp)-Date.parse(session.laps![0].startedAt)<9000));
 assert.notEqual(buildCornerBenchmarks(session).corners[0].best?.lapId,'lap-1');
 const invalid=reviewFixture();invalid.cornerDefinitions!.corners[0].endProgress=.01;assert.equal(buildCornerBenchmarks(invalid).corners[0].best,null);
});
test('actual lap and original optimum-sector sum remain distinct, with attributable sources and continuous references',()=>{
 const result=buildOverallAssist(reviewFixture());assert(result.fastestLap);assert(result.optimumSectorSumMs!==null);assert(result.optimumSectorSumMs<=result.fastestLap.timeMs);
 assert.deepEqual(result.plan.map(p=>p.referenceLapNumber),[1,2,3,3]);assert.equal(result.sectorSources.length,2);
 assert(result.plan.every(p=>p.evidenceIds.every(id=>result.facts.some(f=>f.id===id&&f.lapIds.includes(p.referenceLapId)))));
 assert(result.transitions.slice(0,3).every(t=>t.lapId&&t.message.includes('continuous recorded reference')));
 assert.equal(result.transitions.at(-1)!.lapId,null,'A start/finish transition cannot wrap backward in time or bridge missing GPS');
 assert(result.limitations.some(s=>s.includes('does not guarantee')));assert(!/guaranteed|flag stand/.test(result.narrative));
});
test('review and Lap Blueprint use identical compatible sector sources and reject invalid sector records',()=>{
 const session=reviewFixture();session.sectorResults=session.laps!.map(l=>({lapId:l.id,sectorIndex:1,durationMs:l.sectorTimesMs![0],crossingTimestamp:null,isValid:false,sourceDefinitionVersion:2}));
 assert.equal(buildCompatibleOptimum(session),null);assert.equal(buildOverallAssist(session).optimumSectorSumMs,null);
 session.sectorResults=[];session.laps![0].traceCompatibility={trackVersion:99};
 const optimum=buildCompatibleOptimum(session)!;assert(optimum.sectors.every(s=>s.sourceLapId!=='lap-1'));assert.equal(buildOverallAssist(session).optimumSectorSumMs,optimum.lap.lapTimeMs);
});
test('start/finish transitions require the next recorded lap and a continuous GPS span',()=>{
 const session=reviewFixture();
 for(const sample of session.telemetrySamples!){const offset=sample.lapNumber===2?8000:sample.lapNumber===3?16000:0;sample.timestamp=new Date(Date.parse(sample.timestamp)-offset).toISOString();}
 for(const lap of session.laps!){const offset=lap.lapNumber===2?8000:lap.lapNumber===3?16000:0;lap.startedAt=new Date(Date.parse(lap.startedAt)-offset).toISOString();lap.endedAt=new Date(Date.parse(lap.endedAt)-offset).toISOString();}
 const connection=buildOverallAssist(session).transitions.at(-1)!;assert(connection.lapId);assert.equal(connection.sourceLapNumbers.length,2);assert.equal(connection.sourceLapNumbers[1],connection.sourceLapNumbers[0]+1);
});
test('missing boundaries, corners, motion and poor GPS never become precise invented guidance',()=>{
 const session=reviewFixture();session.trackMap!.inside_path=[];session.phoneMountOrientation=null;
 session.telemetrySamples!.forEach(s=>{s.gpsAccuracy=8;s.longitudinalG=null;s.lateralG=null;});
 const result=buildOverallAssist(session);assert(result.benchmarks.corners.every(c=>c.traversals.every(t=>t.insideAtApexM===null&&t.turnInM===null&&t.brakeStartM===null)));
 assert(!result.facts.some(f=>/turn-in|braking-start|inside-apex/.test(f.id)));
 const absent=reviewFixture();absent.cornerDefinitions=null;assert.equal(buildOverallAssist(absent).plan.length,0);
 absent.hasStoredCornerDefinitions=false;assert.equal(buildOverallAssist(absent).benchmarks.corners.length,0);
 const unknown=reviewFixture();unknown.geometryCompatibility='unverified';assert.equal(buildOverallAssist(unknown).plan.length,0);
 const reference=reviewFixture();reference.trackMap!.representative_path_raw.forEach(p=>p.accuracy=null);assert(buildCornerBenchmarks(reference).corners.every(c=>c.traversals.every(t=>!t.positionReliable&&t.turnInM===null)));
 const direction=reviewFixture();direction.cornerDefinitions!.travelDirection='clockwise';assert.equal(buildCornerBenchmarks(direction).corners.length,0);
 const noOrigin=reviewFixture();noOrigin.trackMap!.start_finish_path=[];assert(buildCornerBenchmarks(noOrigin).corners.every(c=>c.traversals.every(t=>t.turnInM===null)));
 const shifted=reviewFixture();shifted.cornerDefinitions!.corners[0].apex=shifted.cornerDefinitions!.corners[2].apex;assert.equal(buildCornerBenchmarks(shifted).corners[0].best,null);
});
test('historical row and nested-sample track provenance is retained rather than overwritten by the parent map',()=>{
 const mapped=mapReviewBundle({session:{id:'s',track_map_id:'parent-map',started_at:'2026-11-25T00:00:00Z'},laps:[{id:'lap',lap_number:1,track_map_id:'other-map',track_version:9,direction:'clockwise',sector_definition_version:4,duration_ms:20000,is_valid:true}]},[{id:'sample',latitude:35,longitude:-118,recorded_at:'2026-11-25T00:00:01Z',raw:{sample:{trackId:'other-map',lapNumber:1}}}]);
 assert.equal(mapped.laps![0].trackId,'other-map');assert.equal(mapped.laps![0].traceCompatibility!.trackVersion,9);assert.equal(mapped.telemetrySamples![0].trackId,'other-map');assert.equal(buildCornerBenchmarks(mapped).eligibleLapIds.length,0);
});
test('no valid laps and a single valid lap degrade without invented improvements',()=>{
 const session=reviewFixture();session.laps!.forEach(l=>l.isValid=false);const empty=buildOverallAssist(session);assert.equal(empty.fastestLap,null);assert.equal(empty.plan.length,0);
 const single=reviewFixture();single.laps=single.laps!.slice(0,1);const one=buildOverallAssist(single);assert(one.plan.every(p=>p.focus==='record_more'));assert(one.limitations.some(s=>s.includes('Only one')));
});
test('AI explanations must cite approved facts and cannot insert arbitrary numbers, prose or reference laps',()=>{
 const evidence=buildOverallAssist(reviewFixture()),valid={plan:evidence.plan.map(p=>({cornerNumber:p.cornerNumber,referenceLapId:p.referenceLapId,evidenceIds:p.evidenceIds,focus:p.focus}))};
 assert(validateDrivingExplanation(valid,evidence));
 const bad=structuredClone(valid);Object.assign(bad.plan[0],{timeMs:1,recommendation:'Brake 30 yards later'});assert.equal(validateDrivingExplanation(bad,evidence),null);
 const wrong=structuredClone(valid);wrong.plan[0].evidenceIds=['invented'];assert.equal(validateDrivingExplanation(wrong,evidence),null);
 const source=structuredClone(valid);source.plan[0].referenceLapId='other-user';assert.equal(validateDrivingExplanation(source,evidence),null);
});
test('G-force display is proportional, radial-clamped, directional and preserves the actual number',()=>{
 assert.deepEqual(gForceVisual(0,0),{actual:0,x:0,y:-0,zone:'neutral'});
 assert.equal(gForceVisual(.75,0).zone,'yellow');assert.equal(gForceVisual(.75,0).x,.5);
 assert.equal(gForceVisual(1.5,0).zone,'red');assert.equal(gForceVisual(3,0).actual,3);assert.equal(gForceVisual(3,0).x,1);
 const diagonal=gForceVisual(1.5,1.5);assert(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
 assert(gForceVisual(0,.5).y<0);assert(gForceVisual(0,-.5).y>0);assert(gForceVisual(-.5,0).x<0);
});
test('position differences below combined GPS uncertainty are suppressed and explanations distinguish calculations',()=>{
 const result=buildCornerBenchmarks(reviewFixture()),a=result.corners[0].traversals[0];const other={...a,lapNumber:2,entry:{...a.entry,lat:a.entry.lat+.000001}};
 assert.equal(compareCornerTraversal(other,a).entryPositionDeltaM,null);assert(cornerComparisonNarrative(other,a,'metric').some(s=>s.includes('not proof')));
});
test('ongoing loads without an observed threshold crossing do not invent turn-in or braking onset locations',()=>{
 const session=reviewFixture();session.telemetrySamples!.forEach(s=>{s.lateralG=.4;s.longitudinalG=.3;});
 const result=buildCornerBenchmarks(session);assert(result.corners.every(c=>c.traversals.every(t=>t.turnInM===null&&t.brakeStartM===null&&t.accelerationM===null)));
});
