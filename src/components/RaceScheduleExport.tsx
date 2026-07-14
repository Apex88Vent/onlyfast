import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RaceEntry } from './RaceScheduleForm';

interface RaceScheduleExportProps {
  isOpen: boolean;
  races: RaceEntry[];
  onClose: () => void;
}

const LOGO_URL = '/onlyfast-logo.png';
const BLUE = '#00A8E8';
const DARK = '#1A1B23';
const GRAY = '#6B7280';
const OFFWHITE = '#F9FAFB';

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
};

const RaceScheduleExport: React.FC<RaceScheduleExportProps> = ({ isOpen, races, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [building, setBuilding] = useState(false);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBuilding(true);
    const W = 1080;
    const headerH = 230;
    const rowH = 116;
    const footerH = 90;
    const H = Math.max(1080, headerH + races.length * rowH + footerH + 40);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBuilding(false); return; }

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, W, 10);

    // Logo
    const drawHeaderText = () => {
      ctx.fillStyle = DARK;
      ctx.font = 'bold 64px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Race Schedule', W / 2, headerH - 40);
      ctx.fillStyle = BLUE;
      ctx.fillRect(W / 2 - 70, headerH - 18, 140, 6);
    };

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const lw = 320;
        const ratio = img.height / img.width;
        const lh = lw * ratio;
        ctx.drawImage(img, W / 2 - lw / 2, 36, lw, lh);
        drawHeaderText();
        resolve();
      };
      img.onerror = () => {
        ctx.fillStyle = BLUE;
        ctx.font = 'bold 56px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OnlyFast', W / 2, 110);
        drawHeaderText();
        resolve();
      };
      img.src = LOGO_URL;
    });

    // Rows
    let y = headerH + 10;
    ctx.textAlign = 'left';
    races.forEach((r, i) => {
      // Card background
      ctx.fillStyle = i % 2 === 0 ? OFFWHITE : '#FFFFFF';
      roundRect(ctx, 40, y, W - 80, rowH - 16, 16);
      ctx.fill();
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1.5;
      roundRect(ctx, 40, y, W - 80, rowH - 16, 16);
      ctx.stroke();

      // Date badge
      ctx.fillStyle = BLUE;
      roundRect(ctx, 60, y + 16, 150, rowH - 48, 12);
      ctx.fill();
      const d = new Date(r.race_date + 'T00:00:00');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText(d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(), 135, y + 46);
      ctx.font = 'bold 42px Arial, sans-serif';
      ctx.fillText(String(d.getDate()), 135, y + 88);

      // Track + org
      ctx.textAlign = 'left';
      ctx.fillStyle = DARK;
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillText(truncate(ctx, r.track || 'Track', 560), 240, y + 50);
      ctx.fillStyle = GRAY;
      ctx.font = '26px Arial, sans-serif';
      const finalDate = r.race_end_date && r.race_end_date !== r.race_date
        ? `Through ${formatDate(r.race_end_date)}`
        : '';
      const sub = [r.organization, finalDate].filter(Boolean).join(' · ') || '—';
      ctx.fillText(truncate(ctx, sub, 560), 240, y + 86);

      // Finishing position (right)
      const pos = r.finishing_position || 'TBD';
      ctx.textAlign = 'right';
      ctx.fillStyle = GRAY;
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText('FINISH', W - 60, y + 44);
      ctx.fillStyle = BLUE;
      ctx.font = 'bold 38px Arial, sans-serif';
      ctx.fillText(truncate(ctx, pos, 220), W - 60, y + 86);
      ctx.textAlign = 'left';

      y += rowH;
    });

    // Footer
    ctx.fillStyle = GRAY;
    ctx.font = '24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Made with OnlyFast Setup Assist', W / 2, H - 40);

    setDataUrl(canvas.toDataURL('image/png'));
    setBuilding(false);
  }, [races]);

  useEffect(() => {
    if (isOpen) { setMsg(''); draw(); }
  }, [isOpen, draw]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dataUrlToFile = async (): Promise<File | null> => {
    if (!dataUrl) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return new File([blob], 'race-schedule.png', { type: 'image/png' });
    } catch { return null; }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'race-schedule.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMsg('Schedule image saved.');
  };

  const handleShare = async () => {
    const file = await dataUrlToFile();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (file && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Race Schedule', text: 'My Race Schedule' });
        setMsg('Shared!');
        return;
      } catch {
        // user cancelled or failed — fall through to download
      }
    }
    handleDownload();
    setMsg('Sharing not supported here — image saved instead.');
  };

  const handleFacebook = () => {
    handleDownload();
    setMsg('Schedule image saved. Upload it to Facebook to post.');
    window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer');
  };

  const handleInstagram = () => {
    handleDownload();
    setMsg('Schedule image saved. Upload it to Instagram as a post or story.');
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  };

  const btnBase = 'flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 id="export-title" className="text-lg font-bold text-[#1A1B23]">Export Schedule</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-[#F5F5F7] p-3 mb-4 flex items-center justify-center min-h-[200px]">
          {building && (
            <span className="text-sm text-[#6B7280] flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Building preview…
            </span>
          )}
          {!building && dataUrl && (
            <img src={dataUrl} alt="Race schedule preview" className="max-w-full h-auto rounded-lg shadow-sm" />
          )}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </div>

        {msg && <p className="text-sm text-[#00A8E8] font-medium mb-3" role="status">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownload} disabled={!dataUrl} className={`${btnBase} bg-[#00A8E8] hover:bg-[#0090c7] text-white focus:ring-[#00A8E8] disabled:opacity-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Save Image
          </button>
          <button onClick={handleShare} disabled={!dataUrl} className={`${btnBase} bg-[#F5F5F7] hover:bg-[#EBEBED] text-[#1A1B23] border border-[#E5E7EB] focus:ring-[#00A8E8] disabled:opacity-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            Share
          </button>
          <button onClick={handleFacebook} disabled={!dataUrl} className={`${btnBase} bg-[#1877F2] hover:bg-[#1465cc] text-white focus:ring-[#1877F2] disabled:opacity-50`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>
            Facebook
          </button>
          <button onClick={handleInstagram} disabled={!dataUrl} className={`${btnBase} text-white focus:ring-pink-500 disabled:opacity-50`} style={{ background: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            Instagram
          </button>
        </div>
      </div>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export { formatDate };
export default RaceScheduleExport;
