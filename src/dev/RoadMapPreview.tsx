import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RoadCourseTrack from '@/components/RoadCourseTrack';
import RookieAdSlot from '@/components/RookieAdSlot';
import '@/index.css';

// Standalone development view: no account, setup saves or production routing.
function RoadMapPreview() {
  const [data, setData] = useState<Record<string, string>>({});
  const [showAd, setShowAd] = useState(false);
  return <main className="min-h-screen bg-[#F5F5F7] p-4">
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[#1A1B23]">Road map preview</h1>
        <label className="flex items-center gap-2 text-sm text-[#6B7280]">
          <input type="checkbox" checked={showAd} onChange={event => setShowAd(event.target.checked)} />Show ad layout check
        </label>
      </div>
      {showAd && <RookieAdSlot placement="setup_track_conditions" previewMode />}
      <RoadCourseTrack data={data} onChange={(key, value) => setData(previous => ({ ...previous, [key]: value }))} />
    </div>
  </main>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<BrowserRouter><RoadMapPreview /></BrowserRouter>);
