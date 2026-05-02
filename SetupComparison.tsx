import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface SetupComparisonProps {
  user: User | null;
  onSignInClick: () => void;
}

interface SetupRow {
  id: string;
  [key: string]: any;
}

const FIELD_GROUPS = [
  {
    label: 'Track & Conditions',
    fields: [
      { key: 'track_name', label: 'Track Name', type: 'text' },
      { key: 'race_date', label: 'Date', type: 'text' },
      { key: 'race_class', label: 'Class', type: 'text' },
      { key: 'setup_type', label: 'Setup Type', type: 'text', format: (v: string) => v === 'main' ? 'Main Event' : v === 'heat' ? 'Heat' : 'Base' },
      { key: 'track_condition', label: 'Condition', type: 'text' },
      { key: 'temperature', label: 'Temp (°F)', type: 'number' },
      { key: 'humidity', label: 'Humidity (%)', type: 'number' },
    ],
  },
  {
    label: 'General Chassis',
    fields: [
      { key: 'cross_weight', label: 'Cross Weight (%)', type: 'number' },
      { key: 'toe', label: 'Toe', type: 'text' },
      { key: 'front_ride_height', label: 'Front Ride Height', type: 'number' },
      { key: 'rear_ride_height', label: 'Rear Ride Height', type: 'number' },
      { key: 'stagger', label: 'Stagger', type: 'number' },
    ],
  },
  {
    label: 'Right Front (RF)',
    fields: [
      { key: 'rf_caster', label: 'RF Caster', type: 'number' },
      { key: 'rf_camber', label: 'RF Camber', type: 'number' },
      { key: 'rf_pressure', label: 'RF Pressure (psi)', type: 'number' },
      { key: 'rf_shock', label: 'RF Shock', type: 'text' },
      { key: 'rf_spring', label: 'RF Spring (lbs)', type: 'number' },
    ],
  },
  {
    label: 'Left Front (LF)',
    fields: [
      { key: 'lf_caster', label: 'LF Caster', type: 'number' },
      { key: 'lf_camber', label: 'LF Camber', type: 'number' },
      { key: 'lf_pressure', label: 'LF Pressure (psi)', type: 'number' },
      { key: 'lf_shock', label: 'LF Shock', type: 'text' },
      { key: 'lf_spring', label: 'LF Spring (lbs)', type: 'number' },
    ],
  },
  {
    label: 'Left Rear (LR)',
    fields: [
      { key: 'lr_tire_size', label: 'LR Tire Size', type: 'text' },
      { key: 'lr_pressure', label: 'LR Pressure (psi)', type: 'number' },
      { key: 'lr_shock', label: 'LR Shock', type: 'text' },
      { key: 'lr_spring', label: 'LR Spring (lbs)', type: 'number' },
    ],
  },
  {
    label: 'Right Rear (RR)',
    fields: [
      { key: 'rr_tire_size', label: 'RR Tire Size', type: 'text' },
      { key: 'rr_pressure', label: 'RR Pressure (psi)', type: 'number' },
      { key: 'rr_shock', label: 'RR Shock', type: 'text' },
      { key: 'rr_spring', label: 'RR Spring (lbs)', type: 'number' },
    ],
  },
  {
    label: 'Suspension & Drivetrain',
    fields: [
      { key: 'lr_trailing_arm', label: 'LR Trailing Arm', type: 'number' },
      { key: 'rr_trailing_arm', label: 'RR Trailing Arm', type: 'number' },
      { key: 'third_link', label: 'Third Link', type: 'text' },
      { key: 'panhard_bar', label: 'Panhard Bar', type: 'text' },
      { key: 'gear_ratio', label: 'Gear Ratio', type: 'text' },
    ],
  },
  {
    label: 'Handling',
    fields: [
      { key: 'entry_handling', label: 'Entry', type: 'handling' },
      { key: 'mid_handling', label: 'Mid', type: 'handling' },
      { key: 'exit_handling', label: 'Exit', type: 'handling' },
    ],
  },
];

const SetupComparison: React.FC<SetupComparisonProps> = ({ user, onSignInClick }) => {
  const [allSetups, setAllSetups] = useState<SetupRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchSetups();
  }, [user]);

  const fetchSetups = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('race_setups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setAllSetups(data);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const selectedSetups = allSetups.filter(s => selected.includes(s.id));
  const filteredAvailable = filterType === 'all' ? allSetups : allSetups.filter(s => s.setup_type === filterType);

  const getDisplayValue = (setup: SetupRow, key: string, field: any): string => {
    const val = setup[key];
    if (val === null || val === undefined || val === '') return '\u2014';
    if (field.format) return field.format(val);
    if (field.type === 'handling') return val ? val.charAt(0).toUpperCase() + val.slice(1) : '\u2014';
    return String(val);
  };

  const isDifferent = (key: string): boolean => {
    if (selectedSetups.length < 2) return false;
    const vals = selectedSetups.map(s => {
      const v = s[key];
      return v === null || v === undefined || v === '' ? null : String(v);
    });
    return new Set(vals).size > 1;
  };

  const getDiffColor = (setup: SetupRow, key: string, field: any, idx: number): string => {
    if (selectedSetups.length < 2 || !isDifferent(key)) return '';
    if (field.type === 'handling') {
      const val = setup[key];
      if (val === 'perfect') return 'bg-green-50 text-green-700';
      if (val === 'loose' || val === 'tight') return 'bg-red-50 text-red-600';
      return '';
    }
    if (field.type !== 'number') return 'bg-amber-50 text-amber-700';
    const baseVal = selectedSetups[0][key];
    const curVal = setup[key];
    if (baseVal === null || curVal === null) return 'bg-amber-50 text-amber-700';
    if (idx === 0) return 'bg-[#F0F0F2] text-[#6B7280]';
    const diff = Number(curVal) - Number(baseVal);
    if (diff === 0) return '';
    return diff > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600';
  };

  const getDiffBadge = (setup: SetupRow, key: string, field: any, idx: number): string | null => {
    if (idx === 0 || selectedSetups.length < 2 || field.type !== 'number') return null;
    const baseVal = selectedSetups[0][key];
    const curVal = setup[key];
    if (baseVal === null || curVal === null) return null;
    const diff = Number(curVal) - Number(baseVal);
    if (diff === 0) return null;
    return diff > 0 ? `+${diff.toFixed(2).replace(/\.?0+$/, '')}` : diff.toFixed(2).replace(/\.?0+$/, '');
  };

  const handlePrint = () => {
    const printContent = tableRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><title>OnlyFast Setup Comparison</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;color:#1A1B23;background:#F5F5F7}
.logo{height:50px;margin-bottom:16px}h1{font-size:20px;margin-bottom:4px}
.subtitle{color:#6B7280;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #E5E7EB;padding:6px 10px;text-align:left}
th{background:#F9FAFB;font-weight:600}
@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<img src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png" class="logo" alt="OnlyFast"/>
<h1>Setup Comparison</h1>
<p class="subtitle">Generated ${new Date().toLocaleDateString()} \u2014 ${selectedSetups.length} setups compared</p>
${printContent.innerHTML}</body></html>`);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  if (!user) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-sm" aria-labelledby="compare-locked">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3 id="compare-locked" className="text-lg font-bold text-[#1A1B23] mb-1">Sign in to compare setups</h3>
        <p className="text-[#6B7280] text-sm mb-4">You need saved setups to use the comparison tool</p>
        <button onClick={onSignInClick} className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">Sign In</button>
      </section>
    );
  }


  return (
    <div className="space-y-6">
      {/* Selection Panel */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Compare Setups
            </h3>
            <p className="text-sm text-[#6B7280] mt-0.5">Select 2-3 setups to compare side-by-side. First selected is the baseline.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1A1B23] bg-[#F9FAFB] focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none">
              <option value="all">All Types</option>
              <option value="base">Base</option>
              <option value="heat">Heat</option>
              <option value="main">Main Event</option>
            </select>
            <button onClick={fetchSetups} className="text-[#00A8E8] hover:text-[#0090c7] text-sm font-medium px-3 py-2">Refresh</button>
          </div>
        </div>

        {loading ? (
          <p className="text-[#9CA3AF] text-sm text-center py-4">Loading setups...</p>
        ) : filteredAvailable.length === 0 ? (
          <p className="text-[#9CA3AF] text-sm text-center py-4">No saved setups found. Save some setups first!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {filteredAvailable.map(setup => {
              const isSelected = selected.includes(setup.id);
              const idx = selected.indexOf(setup.id);
              const disabled = !isSelected && selected.length >= 3;
              return (
                <button key={setup.id} onClick={() => toggleSelect(setup.id)} disabled={disabled}
                  className={`relative text-left p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-[#00A8E8] bg-[#00A8E8]/5 shadow-sm' : disabled ? 'border-[#E5E7EB] bg-[#F9FAFB] opacity-50 cursor-not-allowed' : 'border-[#E5E7EB] hover:border-[#00A8E8]/40 hover:bg-[#F9FAFB]'}`}>
                  {isSelected && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#00A8E8] text-white text-xs font-bold flex items-center justify-center">{idx === 0 ? 'B' : idx + 1}</span>}
                  <p className="font-semibold text-sm text-[#1A1B23] truncate pr-8">{setup.track_name || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${setup.setup_type === 'main' ? 'bg-[#00A8E8]/10 text-[#00A8E8]' : setup.setup_type === 'heat' ? 'bg-amber-100 text-amber-700' : 'bg-[#F0F0F2] text-[#6B7280]'}`}>
                      {setup.setup_type === 'main' ? 'Main' : setup.setup_type === 'heat' ? 'Heat' : 'Base'}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">{setup.race_class}</span>
                    <span className="text-xs text-[#9CA3AF]">{setup.race_date}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B7280]">{selected.length} selected</span>
              <button onClick={() => setSelected([])} className="text-xs text-red-500 hover:text-red-600 font-medium">Clear all</button>
            </div>
            <span className="text-xs text-[#9CA3AF] flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#00A8E8] inline-block" /> = Baseline</span>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {selectedSetups.length >= 2 && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#4B5563] cursor-pointer select-none">
              <input type="checkbox" checked={showOnlyDiffs} onChange={e => setShowOnlyDiffs(e.target.checked)} className="w-4 h-4 rounded border-[#E5E7EB] text-[#00A8E8] focus:ring-[#00A8E8] bg-white" />
              Show only differences
            </label>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-[#00A8E8] text-white rounded-lg text-sm font-medium hover:bg-[#0090c7] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Print / PDF
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Increase</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Decrease</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> Text changed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#F0F0F2] border border-[#E5E7EB] inline-block" /> Baseline</span>
          </div>

          <div ref={tableRef} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wider w-[200px]">Field</th>
                  {selectedSetups.map((s, i) => (
                    <th key={s.id} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider" style={{ minWidth: 160 }}>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-[#00A8E8] text-white' : 'bg-[#E5E7EB] text-[#4B5563]'}`}>{i === 0 ? 'B' : i + 1}</span>
                        <span className="text-[#1A1B23] truncate max-w-[120px]">{s.track_name || 'Untitled'}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.setup_type === 'main' ? 'bg-[#00A8E8]/10 text-[#00A8E8]' : s.setup_type === 'heat' ? 'bg-amber-100 text-amber-700' : 'bg-[#F0F0F2] text-[#6B7280]'}`}>
                          {s.setup_type === 'main' ? 'Main' : s.setup_type === 'heat' ? 'Heat' : 'Base'}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">{s.race_date}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELD_GROUPS.map(group => {
                  const visibleFields = showOnlyDiffs ? group.fields.filter(f => isDifferent(f.key)) : group.fields;
                  if (visibleFields.length === 0) return null;
                  return (
                    <React.Fragment key={group.label}>
                      <tr><td colSpan={selectedSetups.length + 1} className="bg-[#F5F5F7] text-[#00A8E8] px-4 py-2 text-xs font-bold uppercase tracking-wider border-b border-[#E5E7EB]">{group.label}</td></tr>
                      {visibleFields.map(field => {
                        const hasDiff = isDifferent(field.key);
                        return (
                          <tr key={field.key} className="border-b border-[#F0F0F2]">
                            <td className="px-4 py-2.5 text-[#6B7280] font-medium text-xs">
                              {field.label}
                              {hasDiff && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#00A8E8] inline-block" />}
                            </td>
                            {selectedSetups.map((setup, idx) => {
                              const val = getDisplayValue(setup, field.key, field);
                              const colorClass = hasDiff ? getDiffColor(setup, field.key, field, idx) : '';
                              const badge = getDiffBadge(setup, field.key, field, idx);
                              return (
                                <td key={setup.id} className={`px-4 py-2.5 text-[#1A1B23] ${colorClass}`}>
                                  <span className="font-medium">{val}</span>
                                  {badge && <span className={`ml-1.5 text-[10px] font-semibold ${badge.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>({badge})</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
            <h4 className="text-base font-bold text-[#1A1B23] mb-3">Comparison Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#F9FAFB] rounded-xl p-4 text-center border border-[#E5E7EB]">
                <p className="text-2xl font-bold text-[#1A1B23]">{FIELD_GROUPS.reduce((acc, g) => acc + g.fields.filter(f => isDifferent(f.key)).length, 0)}</p>
                <p className="text-xs text-[#6B7280] mt-1">Fields Different</p>
              </div>
              <div className="bg-[#F9FAFB] rounded-xl p-4 text-center border border-[#E5E7EB]">
                <p className="text-2xl font-bold text-[#1A1B23]">{FIELD_GROUPS.reduce((acc, g) => acc + g.fields.filter(f => !isDifferent(f.key) && selectedSetups.some(s => s[f.key] != null && s[f.key] !== '')).length, 0)}</p>
                <p className="text-xs text-[#6B7280] mt-1">Fields Matching</p>
              </div>
              <div className="bg-[#F9FAFB] rounded-xl p-4 text-center border border-[#E5E7EB]">
                <p className="text-2xl font-bold text-[#1A1B23]">{selectedSetups.filter(s => s.entry_handling === 'perfect' && s.mid_handling === 'perfect' && s.exit_handling === 'perfect').length}<span className="text-sm font-normal text-[#9CA3AF]">/{selectedSetups.length}</span></p>
                <p className="text-xs text-[#6B7280] mt-1">Perfect Handling</p>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedSetups.length === 1 && (
        <div className="bg-[#00A8E8]/5 border border-[#00A8E8]/20 rounded-2xl p-8 text-center">
          <p className="text-[#00A8E8] font-medium">Select at least one more setup to begin comparison</p>
        </div>
      )}
    </div>
  );
};

export default SetupComparison;
