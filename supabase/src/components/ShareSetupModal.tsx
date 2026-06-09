import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface ShareSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  setup: any;
  user: User | null;
}

// Helper used by the PDF export to convert timing_data jsonb into rows that
// render cleanly into the printable HTML. Returns the 5 colored stat rows
// (matching the on-screen color scheme) and the lap-by-lap rows.
function timingDataForPdf(timingData: any): {
  rows: Array<[string, string, string]>; // [label, value, css-accent-class]
  lapRows: Array<[string | number, string]>;
} {
  if (!timingData || typeof timingData !== 'object') {
    return { rows: [], lapRows: [] };
  }
  const fmt = (v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };
  const posDelta = timingData.positions_gained_lost;
  const posText =
    posDelta === null || posDelta === undefined ? '—' :
    posDelta > 0 ? `+${posDelta} gained` :
    posDelta < 0 ? `${posDelta} lost` :
    '0';
  const posAccent =
    posDelta === null || posDelta === undefined ? '' :
    posDelta > 0 ? 'green' :
    posDelta < 0 ? 'red' : '';

  const rows: Array<[string, string, string]> = [
    ['Fastest Lap', fmt(timingData.fastest_lap_time), 'green'],
    ['On Lap #', fmt(timingData.fastest_lap_on_lap), 'emerald'],
    ['Slowest Lap', fmt(timingData.slowest_lap_time), 'red'],
    ['Average Lap', fmt(timingData.average_lap_time), 'blue'],
    ['Positions', posText, posAccent],
  ];
  // Only return rows if at least ONE value is populated
  const hasAny = rows.some(([, v]) => v !== '—');
  if (!hasAny) return { rows: [], lapRows: [] };

  const laps: any[] = Array.isArray(timingData.lap_times) ? timingData.lap_times : [];
  const lapRows: Array<[string | number, string]> = laps.map((l, i) => {
    const lapNum =
      typeof l?.lap === 'number' ? l.lap :
      typeof l?.lap_number === 'number' ? l.lap_number :
      i + 1;
    const timeStr =
      typeof l?.time === 'string' ? l.time :
      typeof l?.lap_time === 'string' ? l.lap_time :
      (l?.time != null ? String(l.time) :
       l?.lap_time != null ? String(l.lap_time) : '');
    return [lapNum, timeStr];
  });

  return { rows, lapRows };
}


const ShareSetupModal: React.FC<ShareSetupModalProps> = ({ isOpen, onClose, setup, user }) => {
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
      generateShareCode();
    } else {
      setShareCode('');
      setCopied(false);
      setError('');
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const generateShareCode = async () => {
    if (!user || !setup?.id) return;
    setLoading(true);
    setError('');

    try {
      // Check if already shared
      const { data: existing } = await supabase
        .from('shared_setups')
        .select('share_code')
        .eq('setup_id', setup.id)
        .eq('shared_by', user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setShareCode(existing[0].share_code);
        setLoading(false);
        return;
      }

      // Generate new share code
      const code = generateCode();
      const { error: insertError } = await supabase
        .from('shared_setups')
        .insert({
          setup_id: setup.id,
          shared_by: user.id,
          shared_by_email: user.email,
          share_code: code,
          is_public: true,
        });

      if (insertError) throw insertError;
      setShareCode(code);
    } catch (err: any) {
      setError('Failed to generate share link. Please try again.');
    }
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const shareUrl = shareCode ? `${window.location.origin}?share=${shareCode}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}
  };

  // ── Save as PDF ──────────────────────────────────────────────────────
  // Opens a new window with a print-friendly view of the setup and triggers
  // the browser's print dialog. The user can then choose "Save as PDF" as
  // the destination. No external dependencies required.
  const handleSaveAsPdf = () => {
    if (!setup) return;
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      alert('Pop-up blocked. Please allow pop-ups for this site to save as PDF.');
      return;
    }

    const esc = (v: any): string =>
      v === null || v === undefined ? '' :
      String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const t = timingDataForPdf(setup?.timing_data);
    const timingRows = t.rows;
    const lapRows = t.lapRows;

    const sectionHtml = (title: string, entries: Array<[string, any]>) => {
      const rows = entries
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
        .join('');
      if (!rows) return '';
      return `
        <section class="card">
          <h2>${esc(title)}</h2>
          <table>${rows}</table>
        </section>
      `;
    };

    const trackSection = sectionHtml('Track & Event', [
      ['Track', setup.track_name],
      ['Event', setup.event_name],
      ['Date', setup.race_date],
      ['Class', setup.race_class],
      ['Setup Type', setup.setup_type === 'main' ? 'Main Event' : setup.setup_type === 'heat' ? 'Heat Race' : 'Base / Hot Laps'],
      ['Track Type', setup.track_type],
      ['Surface', setup.surface_condition],
      ['Weather', setup.weather],
      ['Air Temp', setup.air_temp],
      ['Track Temp', setup.track_temp],
    ]);

    const chassisSection = sectionHtml('Chassis Setup', [
      ['LF Spring', setup.lf_spring],
      ['RF Spring', setup.rf_spring],
      ['LR Spring', setup.lr_spring],
      ['RR Spring', setup.rr_spring],
      ['LF Shock', setup.lf_shock],
      ['RF Shock', setup.rf_shock],
      ['LR Shock', setup.lr_shock],
      ['RR Shock', setup.rr_shock],
      ['LF Tire Pressure', setup.lf_tire_pressure],
      ['RF Tire Pressure', setup.rf_tire_pressure],
      ['LR Tire Pressure', setup.lr_tire_pressure],
      ['RR Tire Pressure', setup.rr_tire_pressure],
      ['Stagger', setup.stagger],
      ['Cross Weight %', setup.cross_weight],
      ['Left Side %', setup.left_side_weight],
      ['Rear %', setup.rear_weight],
      ['Wheelbase', setup.wheelbase],
    ]);

    const notesSection = setup.notes
      ? `<section class="card"><h2>Notes</h2><p>${esc(setup.notes).replace(/\n/g, '<br/>')}</p></section>`
      : '';

    const timingSection = timingRows.length
      ? `
        <section class="card">
          <h2>Timing Data</h2>
          <div class="stats">
            ${timingRows.map(([label, value, accent]) => `
              <div class="stat ${accent || ''}">
                <div class="stat-label">${esc(label)}</div>
                <div class="stat-value">${esc(value)}</div>
              </div>
            `).join('')}
          </div>
          ${lapRows.length ? `
            <h3>Lap-by-lap</h3>
            <table class="laps">
              <thead><tr><th>Lap</th><th>Time</th></tr></thead>
              <tbody>
                ${lapRows.map(([lap, time]) => `<tr><td>${esc(lap)}</td><td>${esc(time)}</td></tr>`).join('')}
              </tbody>
            </table>
          ` : ''}
        </section>
      `
      : '';

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(setup.track_name || 'Race Setup')} — PDF Export</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1A1B23; margin: 0; padding: 32px; background: #fff; }
    h1 { font-size: 24px; margin: 0 0 4px 0; color: #00A8E8; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin: 0 0 12px 0; border-bottom: 2px solid #E5E7EB; padding-bottom: 6px; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin: 16px 0 8px 0; }
    .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #E5E7EB; }
    .meta { font-size: 12px; color: #6B7280; }
    .badge { display: inline-block; background: #00A8E8; color: white; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #F0F0F2; }
    th { width: 45%; color: #6B7280; font-weight: 500; }
    td { color: #1A1B23; font-weight: 600; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 8px; }
    .stat { padding: 8px; border-radius: 8px; border: 1px solid #E5E7EB; background: #F9FAFB; }
    .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; font-weight: 700; }
    .stat-value { font-size: 14px; font-weight: 700; color: #1A1B23; margin-top: 2px; }
    .stat.green { background: #f0fdf4; border-color: #bbf7d0; }
    .stat.green .stat-value { color: #166534; }
    .stat.red { background: #fef2f2; border-color: #fecaca; }
    .stat.red .stat-value { color: #991b1b; }
    .stat.blue { background: #eff6ff; border-color: #bfdbfe; }
    .stat.blue .stat-value { color: #1e40af; }
    .stat.emerald { background: #ecfdf5; border-color: #a7f3d0; }
    .stat.emerald .stat-value { color: #065f46; }
    .stat.purple { background: #faf5ff; border-color: #e9d5ff; }
    .stat.purple .stat-value { color: #6b21a8; }
    .laps th, .laps td { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; text-align: center; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${esc(setup.track_name || 'Race Setup')}</h1>
      <div class="meta">
        ${setup.race_class ? `${esc(setup.race_class)} · ` : ''}
        ${setup.race_date ? `${esc(setup.race_date)} · ` : ''}
        <span class="badge">${esc(setup.setup_type === 'main' ? 'Main Event' : setup.setup_type === 'heat' ? 'Heat' : 'Base')}</span>
      </div>
    </div>
    <div class="meta">Exported ${new Date().toLocaleString()}</div>
  </div>
  ${trackSection}
  ${chassisSection}
  ${timingSection}
  ${notesSection}
  <div class="footer">Generated by Loomis Setup Builder${shareCode ? ` · Share code: ${esc(shareCode)}` : ''}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 200);
    };
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="share-modal-title" className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Setup
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1A1B23] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            aria-label="Close share modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Setup Info */}
        <div className="bg-[#F9FAFB] rounded-xl p-4 mb-4 border border-[#E5E7EB]">
          <p className="font-semibold text-sm text-[#1A1B23]">{setup?.track_name || 'Untitled Setup'}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
            <span className={`font-medium px-1.5 py-0.5 rounded ${
              setup?.setup_type === 'main' ? 'bg-[#00A8E8]/10 text-[#00A8E8]' :
              setup?.setup_type === 'heat' ? 'bg-amber-100 text-amber-700' :
              'bg-[#F0F0F2] text-[#6B7280]'
            }`}>
              {setup?.setup_type === 'main' ? 'Main Event' : setup?.setup_type === 'heat' ? 'Heat' : 'Base'}
            </span>
            <span>{setup?.race_class}</span>
            <span>{setup?.race_date}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6" role="status">
            <svg className="animate-spin h-6 w-6 mx-auto text-[#00A8E8]" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#6B7280] mt-2">Generating share link...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={generateShareCode} className="mt-2 text-sm text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1">
              Try Again
            </button>
          </div>
        ) : shareCode ? (
          <div className="space-y-4">
            {/* Share Code */}
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">Share Code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-4 py-3 font-mono text-lg font-bold text-[#1A1B23] text-center tracking-widest">
                  {shareCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="bg-[#00A8E8]/10 hover:bg-[#00A8E8]/20 text-[#00A8E8] p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  aria-label="Copy share code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">Share Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] bg-[#F9FAFB] truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-[#00A8E8] hover:bg-[#0090c7] text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF] text-center">
              Anyone with this link or code can view your setup. Share expires in 30 days.
            </p>
          </div>
        ) : null}

        {/* Save as PDF — always available, doesn't require a share code */}
        <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
          <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-2">
            Export
          </label>
          <button
            onClick={handleSaveAsPdf}
            className="w-full bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#1A1B23] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            title="Opens a print-friendly view. Choose 'Save as PDF' as the destination in the print dialog."
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
            Save as PDF
          </button>
          <p className="text-[10px] text-[#9CA3AF] text-center mt-1.5">
            Opens your browser's print dialog. Choose <strong>Save as PDF</strong> as the destination.
          </p>
        </div>
      </div>
    </div>
  );
};


export default ShareSetupModal;
