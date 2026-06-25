import React, { useState } from 'react';

/**
 * Renders the timing_data jsonb (saved on a race_setups row) as a compact
 * read-only summary card. Only the five "kept" fields are surfaced in the UI
 * per the simplified spec:
 *   - Fastest Lap Time
 *   - Fastest Lap On Lap #
 *   - Slowest Lap Time
 *   - Average Lap Time
 *   - Positions Gained / Lost
 *
 * lap_times[] is still in timing_data on the DB record and is now rendered
 * in a collapsible dropdown so the user can verify individual laps.
 */
export interface TimingData {
  source?: string;
  scanned_at?: string;
  fastest_lap_time?: string | number | null;
  fastest_lap_on_lap?: number | null;
  finishing_position?: number | string | null;
  starting_position?: number | string | null;
  slowest_lap_time?: string | number | null;
  average_lap_time?: string | number | null;
  positions_gained_lost?: number | null;
  lap_times?: any[];
  raw_text?: string | null;
  scan_model?: string | null;
  scan_confidence?: number | null;
  function_version?: string | null;
  [key: string]: any;
}

interface Props {
  timingData?: TimingData | null;
  // Which setup tab this is being shown under, just for the label
  setupType?: 'base' | 'heat' | 'main' | 'extra1' | 'extra2' | 'extra3';
}

const fmt = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return String(v);
  return v;
};

const fmtPosDelta = (v: number | null | undefined): { text: string; tone: 'good' | 'bad' | 'neutral' } => {
  if (v === null || v === undefined) return { text: '—', tone: 'neutral' };
  if (v > 0) return { text: `+${v} gained`, tone: 'good' };
  if (v < 0) return { text: `${v} lost`, tone: 'bad' };
  return { text: '0', tone: 'neutral' };
};

// Color palettes for the five stat cards, matching the colors used in the
// scan review screen so a user immediately recognizes them.
const STAT_COLORS = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'text-green-700',
    value: 'text-green-800',
    icon: '#16a34a',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'text-emerald-700',
    value: 'text-emerald-800',
    icon: '#059669',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'text-red-700',
    value: 'text-red-800',
    icon: '#dc2626',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'text-blue-700',
    value: 'text-blue-800',
    icon: '#2563eb',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'text-purple-700',
    value: 'text-purple-800',
    icon: '#7c3aed',
  },
  neutral: {
    bg: 'bg-[#F9FAFB]',
    border: 'border-[#E5E7EB]',
    label: 'text-[#6B7280]',
    value: 'text-[#1A1B23]',
    icon: '#6B7280',
  },
} as const;

type ColorKey = keyof typeof STAT_COLORS;

const TimingDataDisplay: React.FC<Props> = ({ timingData, setupType }) => {
  if (!timingData || typeof timingData !== 'object') {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <h3 className="text-base font-bold text-[#1A1B23]">Timing Data</h3>
        </div>
        <p className="text-xs text-[#6B7280]">
          No timing data saved for this {setupType === 'base' ? 'Hot Laps' : setupType === 'heat' ? 'Heat' : setupType === 'main' ? 'Main' : 'setup'} session yet. Use Scan Timing Screen above to extract results from a screenshot.
        </p>
      </section>
    );
  }

  const pos = fmtPosDelta(timingData.positions_gained_lost ?? null);
  const lapCount = Array.isArray(timingData.lap_times) ? timingData.lap_times.length : 0;

  const scannedAt = timingData.scanned_at
    ? new Date(timingData.scanned_at).toLocaleString()
    : null;

  const posColor: ColorKey =
    pos.tone === 'good' ? 'green' : pos.tone === 'bad' ? 'red' : 'neutral';

  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="timing-data-heading">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 id="timing-data-heading" className="text-base font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Timing Data
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            Saved on this setup record
            {scannedAt && <> · scanned {scannedAt}</>}
            {timingData.source === 'screenshot_scan' && <> · from screenshot</>}
          </p>
        </div>
        {lapCount > 0 && (
          <span className="text-[10px] font-semibold bg-[#00A8E8]/10 text-[#00A8E8] px-2 py-1 rounded-full border border-[#00A8E8]/20">
            {lapCount} lap{lapCount === 1 ? '' : 's'} recorded
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat
          label="Fastest Lap"
          value={fmt(timingData.fastest_lap_time)}
          color="green"
          icon="zap"
        />
        <Stat
          label="On Lap #"
          value={fmt(timingData.fastest_lap_on_lap as any)}
          color="emerald"
          icon="hash"
        />
        <Stat
          label="Slowest Lap"
          value={fmt(timingData.slowest_lap_time)}
          color="red"
          icon="turtle"
        />
        <Stat
          label="Average Lap"
          value={fmt(timingData.average_lap_time)}
          color="blue"
          icon="activity"
        />
        <Stat
          label="Positions"
          value={pos.text}
          color={posColor}
          icon="trending"
        />
      </dl>

      {/* Lap-by-lap times dropdown */}
      {lapCount > 0 && (
        <div className="mt-4">
          <LapTimesDropdown laps={timingData.lap_times || []} />
        </div>
      )}
    </section>
  );
};

// ─── Stat card ─────────────────────────────────────────────────────────
const StatIcon: React.FC<{ icon: string; color: string }> = ({ icon, color }) => {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (icon) {
    case 'zap':
      return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'hash':
      return <svg {...common}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>;
    case 'turtle':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></svg>;
    case 'activity':
      return <svg {...common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case 'trending':
      return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    default:
      return null;
  }
};

const Stat: React.FC<{
  label: string;
  value: string;
  color?: ColorKey;
  icon?: string;
}> = ({ label, value, color = 'neutral', icon }) => {
  const p = STAT_COLORS[color] || STAT_COLORS.neutral;
  return (
    <div className={`${p.bg} border ${p.border} rounded-lg p-3`}>
      <dt className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${p.label}`}>
        {icon && <StatIcon icon={icon} color={p.icon} />}
        {label}
      </dt>
      <dd className={`text-base font-bold mt-1 ${p.value}`}>{value}</dd>
    </div>
  );
};

// ─── Lap-times dropdown ────────────────────────────────────────────────
const LapTimesDropdown: React.FC<{ laps: any[] }> = ({ laps }) => {
  const [open, setOpen] = useState(false);

  // Normalize lap entries (accept multiple shapes)
  const normalized = laps.map((l, i) => {
    const lapNum =
      typeof l?.lap === 'number' ? l.lap :
      typeof l?.lap_number === 'number' ? l.lap_number :
      i + 1;
    const timeStr =
      typeof l?.time === 'string' ? l.time :
      typeof l?.lap_time === 'string' ? l.lap_time :
      (l?.time != null ? String(l.time) :
       l?.lap_time != null ? String(l.lap_time) : '');
    const seconds =
      typeof l?.seconds === 'number' ? l.seconds :
      typeof l?.lap_time === 'number' ? l.lap_time :
      parseFloat(timeStr);
    return { lap: lapNum, time: timeStr, seconds };
  });

  const numericLaps = normalized
    .map((l, i) => ({ idx: i, n: l.seconds }))
    .filter(x => !isNaN(x.n) && isFinite(x.n));
  const fastestIdx = numericLaps.length ? numericLaps.reduce((a, b) => (a.n < b.n ? a : b)).idx : -1;
  const slowestIdx = numericLaps.length ? numericLaps.reduce((a, b) => (a.n > b.n ? a : b)).idx : -1;

  return (
    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F0F0F2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1A1B23]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Lap-by-lap times
          <span className="text-[10px] font-semibold bg-[#00A8E8]/10 text-[#00A8E8] px-2 py-0.5 rounded-full border border-[#00A8E8]/20">
            {normalized.length} lap{normalized.length === 1 ? '' : 's'}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6B7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB] max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0">
              <tr className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                <th className="text-left px-4 py-2 font-semibold w-20">Lap</th>
                <th className="text-left px-4 py-2 font-semibold">Time</th>
                <th className="text-right px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {normalized.map((l, i) => {
                const isFast = i === fastestIdx;
                const isSlow = i === slowestIdx && fastestIdx !== slowestIdx;
                return (
                  <tr
                    key={`${l.lap}-${i}`}
                    className={`border-t border-[#E5E7EB] ${isFast ? 'bg-green-50' : isSlow ? 'bg-red-50' : 'bg-white'}`}
                  >
                    <td className="px-4 py-1.5 font-mono font-semibold text-[#1A1B23]">{l.lap}</td>
                    <td className="px-4 py-1.5 font-mono text-[#1A1B23]">{l.time || '—'}</td>
                    <td className="px-4 py-1.5 text-right">
                      {isFast && <span className="text-[10px] font-bold text-green-700 uppercase">Fastest</span>}
                      {isSlow && <span className="text-[10px] font-bold text-red-700 uppercase">Slowest</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TimingDataDisplay;
