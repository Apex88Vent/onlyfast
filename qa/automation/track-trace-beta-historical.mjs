// Operator-created synthetic historical-format fixture, exported read-only from testing.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapReviewBundle} from '../../src/features/track-trace/telemetryModel.ts';
import {buildOverallAssist} from '../../src/features/track-trace/circuit/overallAssist.ts';
import {normalizePersistedLongitudinalG} from '../../src/features/track-trace/circuit/telemetryMath.ts';
const data=JSON.parse(await readFile('tmp/track-trace-beta/historical-fixture.json','utf8')),before=JSON.stringify(data);
assert.equal(data.bundle.session.name,'QA legacy OnlyLaps parity 3b743970');assert.equal(data.bundle.session.id,'9e3bf213-79e7-4cfb-86fe-ceecb3341b23');
const session=mapReviewBundle(data.bundle,data.rows);assert.equal(session.telemetrySamples.length,502);assert.equal(session.laps.length,2);assert.equal(session.sectorResults.length,4);assert(session.trackMap);
for(let i=0;i<data.rows.length;i++){const row=data.rows[i],sample=session.telemetrySamples[i];assert.equal(sample.latitude,row.latitude);assert.equal(sample.longitude,row.longitude);assert.equal(sample.speed,row.speed_mps);assert.equal(sample.lateralG,row.g_force_lateral);const convention=row.raw.gForceConvention??data.bundle.session.device_info?.gForceConvention??'vehicle_acceleration_positive_v1';assert.equal(sample.longitudinalG,normalizePersistedLongitudinalG(row.g_force_longitudinal,convention));assert.equal(sample.accelX,row.raw.accelX);}
const evidence=buildOverallAssist(session);assert.equal(evidence.eligibleLapIds.length,2);assert.equal(JSON.stringify(data),before);
const report={testingFixture:session.id,samples:502,laps:2,sectors:4,geometryPreserved:true,speedMotionGPreserved:true,analysisRecords:data.bundle.analysis.length,eligibleLaps:evidence.eligibleLapIds.length,optimumSectorSumMs:evidence.optimumSectorSumMs,cornerPlans:evidence.plan.length,limitations:evidence.limitations,sourceDataModified:false,productionAccess:false};
await writeFile('tmp/track-trace-beta/historical-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
