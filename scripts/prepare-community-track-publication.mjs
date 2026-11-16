// Pure, read-only planning from an operator-supplied source inventory. No network.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

export async function prepareCommunityPublication(inventory){
  if(typeof inventory?.sourceProjectRef!=='string'||!Array.isArray(inventory.rows))throw Error('A source inventory is required.');
  const sql=await readFile(new URL('../supabase/testing-2027/20261114194747_track_trace_community_catalog.sql',import.meta.url),'utf8');
  const functions=sql.match(/create function onlyfast_private\.community_(?:point_valid|distance|scan_errors)\([\s\S]*?\$\$;/g);
  if(functions?.length!==3)throw Error('Geometry validator source drift.');
  const db=new PGlite(),seen=new Set(),entries=[];
  try{
    await db.exec('create schema onlyfast_private;'+functions.join('\n'));
    for(const {track,sector_defaults:sectors=[]} of inventory.rows){
      if(!/^[a-f0-9-]{36}$/i.test(track?.id)||seen.has(track.id))throw Error('Invalid or duplicate source identity.');seen.add(track.id);
      const result=(await db.query("select onlyfast_private.community_scan_errors($1::jsonb,$2::jsonb) errors,encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') row_hash,encode(sha256(convert_to($2::jsonb::text,'UTF8')),'hex') sector_hash",[JSON.stringify(track),JSON.stringify(sectors)])).rows[0];
      const reasons=[...result.errors];if(!track.is_active)reasons.push('Retired source version: retain for history, do not publish as current.');
      const identityReview=/\btest\b|^track scan\s*-/i.test(track.track_name);
      entries.push({trackId:track.id,trackName:track.track_name,sourceVersion:track.version,sourceRowSha256:result.row_hash,sourceSectorSha256:result.sector_hash,
        areaKey:track.area_key,facilityKey:track.facility_key,sourcePublicationStatus:track.publication_status??'not-installed',
        geometryEligible:reasons.length===0,reasons,identityReviewRequired:identityReview,
        sectorDefinitions:sectors.map(s=>({id:s.id,version:s.version,sectorCount:s.sector_count})),
        cornerDetectionVersion:track.corner_detection_version??null,supersedesTrackId:track.supersedes_track_map_id??null,
        proposedLayout:null,proposedLocation:null,publicationApproved:false,
        requiredReview:['Confirm publication authority and source-owner permission','Assign the exact facility layout and human-readable location','Review scan/start-finish/sector/corner geometry','Recheck source hashes before publishing the same track ID in place']});
    }
  }finally{await db.close();}
  return{mode:'read-only-plan',sourceProjectRef:inventory.sourceProjectRef,sourceCommit:inventory.sourceCommit,
    strategy:'Publish the existing canonical row IDs in place after approval. No per-user import, clone or automatic source update.',entries};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const input=process.argv[2],output=process.argv[3];if(!input||!output)throw Error('Usage: node scripts/prepare-community-track-publication.mjs source-inventory.json publication-plan.json');
    const plan=await prepareCommunityPublication(JSON.parse(await readFile(input,'utf8')));await writeFile(output,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({mode:plan.mode,tracks:plan.entries.length,geometryEligible:plan.entries.filter(e=>e.geometryEligible).length,output}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
