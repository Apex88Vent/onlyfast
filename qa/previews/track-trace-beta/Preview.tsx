import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {BrowserRouter,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import TrackTracePage from '../../../src/features/track-trace/TrackTracePage';
import {calls} from './data';
Object.assign(window,{__traceCalls:calls});
export function Preview(){const[tier,setTier]=useState('pro'),route=useLocation();return <><aside className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Synthetic BETA preview</strong> · No backend or physical GPS. <nav className="flex flex-wrap gap-3" aria-label="Preview controls"><a className="inline-flex min-h-11 items-center underline" href="/track-trace">Menu</a><a className="inline-flex min-h-11 items-center underline" href="/track-trace?view=review&session=10000000-0000-4000-8000-000000000001">Review fixture</a>{['sportsman','pro','factory'].map(t=><button key={t} className="min-h-11 underline" aria-pressed={tier===t} onClick={()=>{setTier(t);Object.assign(window,{__traceTier:t});dispatchEvent(new Event('trace-tier'));}}>{t}</button>)}</nav></aside>{route.pathname==='/app'?<section className="m-4 rounded-2xl border bg-white p-5"><h1 className="font-semibold">OnlyFast testing application</h1><p className="my-3 text-sm">This isolated visual preview contains Track Trace views only. Recording, scanning and saved setup actions use the authenticated testing application.</p><a className="text-[#007DAE] underline" href="http://127.0.0.1:4201/app">Open the testing application</a></section>:<TrackTracePage/>}</>;}
Object.assign(window,{__traceTier:'pro'});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><Preview/></BrowserRouter></QueryClientProvider>);
