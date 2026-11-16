import type { GpsPoint, SavedTrackMap } from '../../src/features/track-trace/circuit/onlylapsTrackScanUtils.ts';
import type { RecordingTrack } from '../../src/features/track-trace/circuit/recorder.ts';
export const gpsPoint=(lat:number,lng:number,time:number):GpsPoint=>({lat,lng,accuracy:4,speed:25,heading:null,altitude:100,timestamp:new Date(time).toISOString()});
export function circuitTrack(id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'):RecordingTrack {
  return {map:{id,track_name:'Synthetic closed circuit',version:3,start_finish_path:[gpsPoint(35,-117.9994,0),gpsPoint(35,-117.9986,0)],outside_path:[],inside_path:[],base_layer:null,track_type:'dirt_oval'} as SavedTrackMap,
    sectors:{trackId:id,sectorCount:2,version:2,source:'track_default',id:null,ownerId:null,confidence:'high',createdAt:null,updatedAt:null,
      lines:[{id:'sector-1',sectorIndex:1,progress:.5,start:{lat:35,lng:-118.0014},end:{lat:35,lng:-118.0006},expectedDirection:null}]}};
}
export function syntheticCircuit(start=Date.now()-120000,points=64) {
  return Array.from({length:points},(_,i)=>{const theta=(i-.5)*Math.PI/10;return gpsPoint(35+Math.sin(theta)*.001,-118+Math.cos(theta)*.001,start+i*1000);});
}
