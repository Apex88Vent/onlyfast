import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CustomCarSetupForm, { CustomCarGate, useCustomCarTemplate } from '@/components/CustomCarSheet';
import { CUSTOM_CAR, CUSTOM_SHEET_KEY, emptyCustomSheet } from '@/lib/customCar';
import '@/index.css';

function PreviewSetup() {
  const { initialSheet, template } = useCustomCarTemplate();
  const [data, setData] = useState<Record<string, string>>(() => ({
    [CUSTOM_SHEET_KEY]: JSON.stringify(initialSheet || template || emptyCustomSheet()),
  }));
  return <div className="max-w-5xl mx-auto p-4"><CustomCarSetupForm data={data} onChange={(field, value) => setData(prev => ({ ...prev, [field]: value }))} /></div>;
}

function Preview() {
  const [generation, setGeneration] = useState(0);
  return <div className="min-h-screen bg-[#F5F5F7]">
    <header className="bg-white border-b border-[#E5E7EB] p-4"><div className="max-w-5xl mx-auto flex flex-wrap items-center gap-4">
      <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-12 w-auto" />
      <div><p className="font-bold text-[#1A1B23]">Dirt Track · Custom Car</p><p className="text-xs text-[#6B7280]">Local editor preview. No race setups are written to Supabase.</p></div>
      <button className="text-sm font-semibold text-[#00A8E8]" onClick={() => {
        localStorage.removeItem(`${CUSTOM_SHEET_KEY}_guest`);
        setGeneration(n => n + 1);
      }}>Reset Preview</button>
    </div></header>
    <CustomCarGate key={generation} user={null} selectedCar={CUSTOM_CAR}><PreviewSetup /></CustomCarGate>
  </div>;
}

// Standalone development preview; not part of the production HTML entry or routing.
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />);
