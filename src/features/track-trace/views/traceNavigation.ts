export function traceHref(href:string){
  const url=new URL(href,'https://onlyfast.local'),path=url.pathname;
  const editor=path.match(/^\/my-tracks\/([^/]+)\/(edit|corners|sectors)$/);
  if(editor){const next=new URLSearchParams(url.search);next.set('view',editor[2]==='edit'?'track-edit':editor[2]);next.set('track',decodeURIComponent(editor[1]));return '/track-trace?'+next.toString();}
  const detail=path.match(/^\/review-sessions\/([^/]+)$/);
  if(detail)return '/track-trace?view=review&session='+encodeURIComponent(decodeURIComponent(detail[1]));
  return path==='/review-sessions'?'/track-trace?view=review':path==='/timing/start'?'/track-trace?view=start':path.startsWith('/my-tracks')?'/track-trace?view=library':path.startsWith('/track-scan')?'/track-trace?view=scan':'/track-trace';
}
