import React from 'react';
import { createRoot } from 'react-dom/client';
import { previewBackend, supabaseUrl } from './previewBackend';
import App from '../App';
import '../index.css';

// Isolated HTML entry: normal production builds never import this module.
if (location.pathname === '/review-preview.html') history.replaceState(null, '', '/' + location.search);
if (new URLSearchParams(location.search).get('fresh') === '1') {
  for (const key of Object.keys(localStorage)) if (key.startsWith('onlyfast') || key.startsWith('test_reset_done_')) localStorage.removeItem(key);
  previewBackend.reset();
  const resumedURL = new URL(location.href);
  resumedURL.searchParams.delete('fresh');
  history.replaceState(null, '', resumedURL.pathname + resumedURL.search);
}
const networkFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (url.pathname.startsWith(supabaseUrl + '/rest/v1/rpc/')) {
    const result = await previewBackend.rpc(url.pathname.split('/').pop()!, init?.body ? JSON.parse(String(init.body)) : {});
    return new Response(JSON.stringify(result.error || result.data), { status: result.error ? 400 : 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.pathname === supabaseUrl + '/auth/v1/user') {
    const result = await previewBackend.updateUser(init?.body ? JSON.parse(String(init.body)) : {});
    return new Response(JSON.stringify(result.data.user), { headers: { 'Content-Type': 'application/json' } });
  }
  if (url.origin !== location.origin || url.pathname.startsWith(supabaseUrl)) return new Response(JSON.stringify({ message: 'Live backend services are unavailable in this local-data test preview.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  return networkFetch(input, init);
};

function Review() {
  return <>
    <aside className="sticky top-0 z-[200] border-b border-[#00A8E8]/20 bg-white px-4 py-2 text-xs text-[#6B7280]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <span>Test preview · Browser-local test account and saves · Live services unavailable</span>
        <div className="flex items-center gap-3">
          <label>Test plan <select aria-label="Test plan" defaultValue={previewBackend.getPlan()} className="rounded border border-[#E5E7EB] px-2 py-1" onChange={e => {
            previewBackend.setPlan(e.target.value as 'free' | 'pro' | 'teams');
            const next = new URL(location.href); next.searchParams.delete('fresh'); location.replace(next.href);
          }}><option value="free">Rookie</option><option value="pro">Pro</option><option value="teams">Teams</option></select></label>
          <button className="font-semibold text-[#00A8E8]" onClick={() => { const next = new URL(location.href); next.pathname = '/'; next.search = '?fresh=1'; location.assign(next.href); }}>Restart from slide one</button>
        </div>
      </div>
    </aside>
    <App />
  </>;
}
createRoot(document.getElementById('root')!).render(<Review />);
