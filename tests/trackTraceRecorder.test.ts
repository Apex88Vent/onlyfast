import assert from 'node:assert/strict';
import test from 'node:test';
import { CircuitRecorder, samplePoint } from '../src/features/track-trace/circuit/recorder.ts';
import { detectStartFinishCrossing } from '../src/features/track-trace/circuit/startFinishCrossing.ts';
import { circuitTrack, syntheticCircuit } from './helpers/trackTraceGps.ts';

test('synthetic circuit: original directional crossings produce three 20-second laps and sectors',()=>{
  const recorder=new CircuitRecorder(circuitTrack());for(const p of syntheticCircuit())recorder.add(p);
  assert.equal(recorder.samples.length,64);assert.equal(recorder.laps.length,3);
  const laps=recorder.finish('session','owner');
  for(const lap of laps){assert.equal(lap.lapTimeMs,20000);assert.equal(lap.isValid,true);assert.equal(lap.sectors.length,2);assert.deepEqual(lap.sectors.map(s=>s.durationMs),[10000,10000]);assert(lap.smoothingSummary.keptSampleCount>0);}
  assert.equal(laps[0].smoothingSummary.algorithm,'onlylaps_deterministic_telemetry_v1');
});
test('GPS gates reject poor accuracy, wrong direction, and distant plane intersections',()=>{
  const points=syntheticCircuit();const line={a:circuitTrack().map.start_finish_path[0],b:circuitTrack().map.start_finish_path[1]};
  const normal=detectStartFinishCrossing(points[0],points[2],line);assert(normal.crossed);
  assert.equal(detectStartFinishCrossing({...points[0],accuracy:150},{...points[2],accuracy:150},line).crossed,false);
  assert.equal(detectStartFinishCrossing(points[0],points[2],line,{expectedDirection:normal.direction===1?-1:1}).crossed,false);
  assert.equal(detectStartFinishCrossing(points[10],points[12],line).crossed,false);
});
test('Free Record retains actual supplied GPS without synthesizing laps or maps',()=>{
  const recorder=new CircuitRecorder(null);const points=syntheticCircuit();for(const point of points)recorder.add(point);
  assert.equal(recorder.samples.length,points.length);assert.deepEqual(recorder.finish('s','u'),[]);assert.equal(recorder.samples[0].trackId,null);
  assert.deepEqual(samplePoint(recorder.samples[0]),points[0]);
});
test('interruption and long gaps retain samples and completed laps but reset incomplete timing',()=>{
  const recorder=new CircuitRecorder(circuitTrack());const points=syntheticCircuit();for(const p of points.slice(0,25))recorder.add(p);
  assert.equal(recorder.laps.length,1);recorder.interrupt();
  for(const p of points.slice(25))recorder.add(p);assert.equal(recorder.laps.length,2);
  const count=recorder.samples.length;const late={...points[0],timestamp:new Date(Date.parse(points[63].timestamp)+30000).toISOString()};recorder.add(late);
  assert.equal(recorder.samples.length,count+1);assert.equal(recorder.lapStarted,null);assert(recorder.interruptions>=2);
});
test('invalid and stale GPS callbacks cannot create samples or duplicate timing',()=>{
  const r=new CircuitRecorder(circuitTrack()),p=syntheticCircuit()[0];assert(r.add(p));
  assert.equal(r.add(p),null);assert.equal(r.add({...p,lat:999}),null);assert.equal(r.samples.length,1);
});
test('server samples preserve interruption boundaries for deterministic recovery',()=>{
  const r=new CircuitRecorder(circuitTrack()),points=syntheticCircuit();
  for(let i=0;i<points.length;i++){if(i===25)r.interrupt();r.add(points[i]);}
  const restored=new CircuitRecorder(circuitTrack());
  for(const sample of r.samples){if((sample as {interruptionBefore?:boolean}).interruptionBefore)restored.interrupt();restored.add(samplePoint(sample));}
  assert.deepEqual(restored.laps,r.laps);assert.equal(restored.laps.length,2);
});
