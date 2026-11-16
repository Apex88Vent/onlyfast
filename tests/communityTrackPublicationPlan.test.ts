import assert from 'node:assert/strict';
import test from 'node:test';
import {validateReviewPlan,reviewPlan,TEST_PROJECT} from '../scripts/review-community-tracks.mjs';
import {prepareCommunityPublication} from '../scripts/prepare-community-track-publication.mjs';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const plan=()=>({projectRef:TEST_PROJECT,entries:[{trackId:id,fingerprint:'a'.repeat(64),approve:true,note:'Reviewed scan',acknowledgedDuplicates:[]}]});
test('community review defaults to no-network dry run and refuses production or malformed plans',async()=>{
  let called=false;const clientFactory=()=>{called=true;throw Error('Should not connect');};
  assert.equal((await reviewPlan(plan(),{clientFactory})).mode,'dry-run');assert.equal(called,false);
  await assert.rejects(reviewPlan(plan(),{url:'https://thpyjvwtfvfxiufchrxn.supabase.co',apply:true,key:'unused',clientFactory}),/exact isolated/);
  assert.throws(()=>validateReviewPlan({...plan(),entries:[...plan().entries,...plan().entries]}),/duplicate/);
  assert.throws(()=>validateReviewPlan({...plan(),projectRef:'production'}),/Testing project/);
});
test('operator review verifies testing environment first and stops on stale publication requests',async()=>{
  const calls:string[]=[];
  const factory=(marker=TEST_PROJECT,error:unknown=null)=>()=>({rpc:async(name:string)=>{calls.push(name);return name==='get_onlyfast_2027_environment'?{data:{project_ref:marker},error:null}:{data:{status:'published'},error};}});
  assert.equal((await reviewPlan(plan(),{apply:true,key:'server-only',clientFactory:factory()})).results[0].status,'published');
  assert.deepEqual(calls,['get_onlyfast_2027_environment','review_track_trace_scan']);calls.length=0;
  await assert.rejects(reviewPlan(plan(),{apply:true,key:'server-only',clientFactory:factory('other')}),/environment verification/);assert.deepEqual(calls,['get_onlyfast_2027_environment']);
  await assert.rejects(reviewPlan(plan(),{apply:true,key:'server-only',clientFactory:factory(TEST_PROJECT,{message:'SUBMISSION_CHANGED'})}),/SUBMISSION_CHANGED/);
});
test('initial publication plan retains source IDs/version/hash and never marks a source approved',async()=>{
  const p=(lat:number,lng:number)=>({lat,lng});const path=[p(35,-118),p(35.001,-118),p(35.001,-117.999),p(35,-118)];
  const track={id,track_name:'Saved legacy circuit',source:'track_scan',track_type:'dirt_oval',is_open_route:false,is_active:true,center_lat:35,center_lng:-118,area_key:'35_-118',version:3,outside_path:path,inside_path:path,start_finish_path:[p(35,-118),p(35.001,-118)]};
  const result=await prepareCommunityPublication({sourceProjectRef:'source',rows:[{track,sector_defaults:[]}]});
  assert.equal(result.entries[0].trackId,id);assert.equal(result.entries[0].sourceVersion,3);assert.equal(result.entries[0].geometryEligible,true);assert.equal(result.entries[0].publicationApproved,false);assert.match(result.entries[0].sourceRowSha256,/^[0-9a-f]{64}$/);
  await assert.rejects(prepareCommunityPublication({sourceProjectRef:'source',rows:[{track},{track}]}),/duplicate source/);
});
