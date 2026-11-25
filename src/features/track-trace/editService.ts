import { traceRpc } from './api';
import type { SavedTrackMap } from './circuit/onlylapsTrackScanUtils';
import type { StoredCornerDefinitions, TrackSectorLayout } from './circuit/types';
import { createDefaultSectorLayout, validateSectorLayout } from './circuit/sectorTiming';

type SectorRow={id:string;sector_count:number;version:number;lines:TrackSectorLayout['lines'];owner_id?:string;user_id?:string;created_at:string;updated_at:string};
type EditableTrack=SavedTrackMap & {is_owner:boolean;sector_defaults:SectorRow[];user_sectors:SectorRow[]};
const failure='Track could not be saved. Reload to check its version and your edit permissions before retrying.';
export async function getTrackMapById(id:string){
  try{return {data:await traceRpc<EditableTrack>('get_track_trace_edit_map',{p_track_id:id}),error:null};}
  catch{return {data:null,error:'This circuit could not be loaded or access changed.'};}
}
export async function getEditableCornerTrack(id:string){
  const result=await getTrackMapById(id);
  return result.data?.is_owner&&result.data.publication_status==='private'?result:{data:null,error:'Only the owner can edit a private circuit. Published corners are read-only.'};
}
export async function getCornerDefinitionsForTrack(track:SavedTrackMap){
  const value=track.corner_definitions;
  return {data:value&&Array.isArray(value.corners)?value as unknown as StoredCornerDefinitions:null,error:null};
}
export async function saveTrackCornerDefinitions(track:SavedTrackMap,definitions:StoredCornerDefinitions){
  try{
    const saved=await traceRpc<EditableTrack>('update_track_trace_private_map',{p_track_id:track.id,p_expected_version:track.version,p_changes:{corner_definitions:definitions,corner_detection_version:definitions.version}});
    return getCornerDefinitionsForTrack(saved);
  }catch{return {data:null,error:failure};}
}
export async function getSectorLayoutForTrack(track:SavedTrackMap){
  const map=track as EditableTrack,row=map.user_sectors?.[0]??map.sector_defaults?.[0];
  const data:TrackSectorLayout=row?{id:row.id,trackId:map.id,sectorCount:row.sector_count,version:row.version,lines:row.lines,source:map.user_sectors?.length?'user_override':'track_default',ownerId:row.user_id??row.owner_id??null,confidence:'high',createdAt:row.created_at,updatedAt:row.updated_at}:createDefaultSectorLayout(track);
  return {data,error:null};
}
export async function saveSectorLayout(track:SavedTrackMap,layout:TrackSectorLayout){
  const validation=validateSectorLayout(layout.lines);
  if(validation)return {data:null,error:validation};
  const map=track as EditableTrack;
  const target=map.is_owner&&map.publication_status==='private'?map.sector_defaults?.[0]:map.user_sectors?.[0];
  try{
    const saved=await traceRpc<EditableTrack>('save_track_trace_sector_layout',{p_track_id:track.id,p_expected_version:target?.version??0,p_sector_count:layout.sectorCount,p_lines:layout.lines});
    return getSectorLayoutForTrack(saved);
  }catch{return {data:null,error:failure};}
}
