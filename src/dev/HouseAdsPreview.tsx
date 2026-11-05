import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { HOUSE_AD_PLANS_PATH, HouseBottomBanner, HouseInterstitialDialog } from '@/components/HouseAdPlacement';
import PlanSelection from '@/components/PlanSelection';
import RookieAdSlot from '@/components/RookieAdSlot';
import { HouseAdDesignDialog, houseAdDesigns, type HouseAdDesign } from './HouseAdDesigns';
import '../index.css';

type Tier = 'Rookie' | 'Pro' | 'Team';
type Design = HouseAdDesign | 'approved';
type PreviewState = { tier: Tier; design: Design; open: boolean; reset: number };
const initial: PreviewState = { tier: 'Rookie', design: 'A', open: true, reset: 0 };
const choices: Design[] = ['A', 'B', 'C', 'approved'];
const widths = { 'Small phone': 320, iPhone: 390, Android: 430, Desktop: 1120 };
const control = 'rounded-lg border border-[#CAD5E0] bg-white px-3 py-2 text-sm font-semibold text-[#1A1B23] hover:bg-[#EAF7FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00668F]';

function PreviewControls() {
  const [state, setState] = useState(initial);
  const [width, setWidth] = useState(390);
  const frame = useRef<HTMLIFrameElement>(null);
  const sync = () => frame.current?.contentWindow?.postMessage({ houseAdPreview: state }, location.origin);
  useEffect(sync, [state]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data === 'onlyfast-house-ad-closed') setState(value => ({ ...value, open: false }));
      if (event.data === 'onlyfast-house-ad-ready') sync();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [state]);
  return (
    <main className="min-h-screen bg-[#F5F5F7] p-2 text-[#1A1B23] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-xl border border-[#D4DDE6] bg-white p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#00668F]">OnlyFast · Local design review</p>
          <h1 className="mt-1 text-2xl font-black">House ad preview</h1>
          <p className="mt-1 text-sm text-[#4B5563]">Select a design to open it. Close it to see the Rookie banner. Upgrade links open the plan comparison with checkout disabled in this preview.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <fieldset>
              <legend className="mb-1 text-xs font-bold text-[#4B5563]">Interstitial design</legend>
              <div className="flex flex-wrap gap-1.5">
                {choices.map(design => <button key={design} type="button" className={`${control} aria-pressed:border-[#00668F] aria-pressed:bg-[#EAF7FC]`}
                  aria-pressed={state.design === design} onClick={() => setState(value => ({ ...value, design, open: value.tier === 'Rookie' }))}>
                  {design === 'approved' ? 'Approved default' : `${design} · ${houseAdDesigns[design].label}`}
                </button>)}
              </div>
            </fieldset>
            <label className="grid gap-1 text-xs font-bold text-[#4B5563]">Test membership
              <select className={control} value={state.tier} onChange={event => setState(value => ({ ...value,
                tier: event.target.value as Tier, open: false, reset: value.reset + 1 }))}>
                {(['Rookie', 'Pro', 'Team'] as const).map(tier => <option key={tier}>{tier}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-[#4B5563]">Screen width
              <select className={control} value={width} onChange={event => setWidth(Number(event.target.value))}>
                {Object.entries(widths).map(([label, pixels]) => <option key={label} value={pixels}>{label} · {pixels}px</option>)}
              </select>
            </label>
            <button type="button" disabled={state.tier !== 'Rookie'} className={`${control} disabled:opacity-50`}
              onClick={() => setState(value => ({ ...value, open: true }))}>Open interstitial</button>
            <button type="button" className={control}
              onClick={() => setState(value => ({ ...value, open: false, reset: value.reset + 1 }))}>Back to ad stage</button>
          </div>
        </header>
        <iframe ref={frame} onLoad={sync} src="/house-ads-preview.html?stage" title="OnlyFast ad stage"
          className="mx-auto mt-4 block h-[min(74dvh,760px)] min-h-[490px] max-w-full rounded-xl border border-[#9BAABC] bg-white shadow-md"
          style={{ width }} />
      </div>
    </main>
  );
}

function PreviewStage() {
  const [state, setState] = useState<PreviewState>({ ...initial, open: false });
  const lastReset = useRef(initial.reset);
  const navigate = useNavigate();
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || !event.data?.houseAdPreview) return;
      const next = event.data.houseAdPreview as PreviewState;
      if (next.open || next.reset !== lastReset.current) navigate('/', { replace: true });
      lastReset.current = next.reset;
      setState(next);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [navigate]);
  useEffect(() => { window.parent.postMessage('onlyfast-house-ad-ready', location.origin); }, []);
  const close = () => {
    setState(value => ({ ...value, open: false }));
    window.parent.postMessage('onlyfast-house-ad-closed', location.origin);
  };
  const rookie = state.tier === 'Rookie';
  return (
    <Routes>
      <Route path={HOUSE_AD_PLANS_PATH} element={
        <main className="min-h-screen bg-[#F5F5F7] p-4 sm:p-8">
          <p className="mb-5 rounded-lg bg-[#EAF7FC] p-3 text-sm font-medium text-[#075575]">Local preview · Checkout disabled</p>
          <PlanSelection allowWebCheckout onComplete={() => navigate('/')} onBack={() => navigate('/')} />
        </main>
      } />
      {/* The existing approved art uses the /pricing route in the app and in this stage. */}
      <Route path="/" element={
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#F5F5F7] p-4 pb-16 text-[#1A1B23] sm:p-6">
          <img src="/onlyfast-logo.png" alt="OnlyFast" className="mb-5 h-10 w-auto" />
          <h2 className="text-xl font-black">{state.tier} ad stage</h2>
          <p className="mb-4 mt-2 text-sm text-[#4B5563]">{rookie ? 'The inline house ad and bottom house banner appear on eligible Rookie screens.' : `${state.tier} members see no ads.`}</p>
          {rookie && <RookieAdSlot placement="home_middle" previewMode />}
          {rookie && !state.open && <HouseBottomBanner />}
          {rookie && state.open && (state.design === 'approved' ? (
            <HouseInterstitialDialog title="OnlyFast Pro upgrade" onClose={close}>
              <RookieAdSlot placement="after_save_interstitial" previewMode onContinue={close} />
            </HouseInterstitialDialog>
          ) : <HouseAdDesignDialog design={state.design} onClose={close} />)}
        </main>
      } />
      <Route path="/upgrade" element={<PlanSelection allowWebCheckout onComplete={() => navigate('/')} onBack={() => navigate('/')} />} />
    </Routes>
  );
}

if (import.meta.env.DEV) {
  const stage = new URLSearchParams(location.search).has('stage');
  createRoot(document.getElementById('root')!).render(stage ? <MemoryRouter><PreviewStage /></MemoryRouter> : <PreviewControls />);
}
