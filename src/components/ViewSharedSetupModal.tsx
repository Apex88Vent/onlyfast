import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { getClassConfig, FieldDef } from '@/lib/classConfigs';
import { openSetupPdf, getCarStyle, CAR_STYLE_A } from '@/lib/setupPdf';
import { hasFeatureAccess, readMembership } from '@/lib/membership';

interface ViewSharedSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

const has = (v: any) => v !== null && v !== undefined && String(v).trim() !== '';

function fieldValue(setup: any, key: string): string {
  if (key === 'toe') {
    if (!has(setup.toe)) return '';
    const dir = setup.toe_direction;
    return has(dir) ? `${setup.toe} ${dir === 'in' ? 'In' : dir === 'out' ? 'Out' : dir}` : String(setup.toe);
  }
  if (key === 'rear_stagger') return has(setup.rear_stagger) ? String(setup.rear_stagger) : (has(setup.stagger) ? String(setup.stagger) : '');
  if (key === 'front_stagger') return has(setup.front_stagger) ? String(setup.front_stagger) : '';
  return has(setup[key]) ? String(setup[key]) : '';
}

const rowsFor = (setup: any, fields: FieldDef[], prefix = ''): Array<[string, string]> =>
  fields
    .map((f): [string, string] => {
      const key = prefix ? `${prefix}_${f.key}` : f.key;
      const val = prefix ? (has(setup[key]) ? String(setup[key]) : '') : fieldValue(setup, f.key);
      return [f.label, val];
    })
    .filter(([, v]) => has(v));

const MiniTable: React.FC<{ rows: Array<[string, string]> }> = ({ rows }) => {
  if (!rows.length) return <p className="text-xs text-[#C0C4CC]">—</p>;
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-[#F0F0F2] last:border-0">
            <th className="text-left font-medium text-[#6B7280] py-1 pr-2 w-1/2">{k}</th>
            <td className="text-left font-bold text-[#1A1B23] py-1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ViewSharedSetupModal: React.FC<ViewSharedSetupModalProps> = ({ isOpen, onClose, user }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setCode('');
      setError('');
      setSetup(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleView = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setError('Enter a share code to view a setup.'); return; }
    setLoading(true);
    setError('');
    setSetup(null);
    try {
      const { data: share } = await supabase
        .from('shared_setups')
        .select('setup_id, is_public, share_code')
        .eq('share_code', trimmed)
        .eq('is_public', true)
        .limit(1)
        .maybeSingle();

      if (!share || !share.setup_id) {
        setError('Setup not found. Check the code and try again.');
        setLoading(false);
        return;
      }

      const { data: row } = await supabase
        .from('race_setups')
        .select('*')
        .eq('id', share.setup_id)
        .limit(1)
        .maybeSingle();

      if (!row) {
        setError('This shared setup is no longer available.');
        setLoading(false);
        return;
      }
      setSetup({ ...row, __share_code: trimmed });
    } catch {
      setError('Could not load that setup. Please try again.');
    }
    setLoading(false);
  };

  const handlePdf = () => {
    if (!setup) return;
    if (!user || !hasFeatureAccess(readMembership(user.user_metadata || {}), 'setupExport')) {
      alert('PDF export is available on Pro and Team plans.');
      return;
    }
    openSetupPdf(setup, { shareCode: setup.__share_code });
  };

  if (!isOpen) return null;

  const config = setup ? getClassConfig(setup.race_class || '') : null;
  const carStyle = setup ? getCarStyle(setup.race_class) : 'none';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="view-shared-title">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="view-shared-title" className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            View Shared Setup
          </h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!setup ? (
          <>
            <p className="text-sm text-[#6B7280] mb-4">Enter a share code to view a setup shared with you.</p>
            <label htmlFor="share-code-input" className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">Share Code</label>
            <input
              ref={inputRef}
              id="share-code-input"
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleView(); }}
              placeholder="e.g. 9Jx7yLfy"
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg font-mono text-base tracking-widest text-center text-[#1A1B23] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]"
              autoComplete="off"
              aria-describedby={error ? 'share-code-error' : undefined}
            />
            {error && <p id="share-code-error" className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
                Cancel
              </button>
              <button
                onClick={handleView}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#00A8E8] hover:bg-[#0090c7] text-white transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Looking up…
                  </>
                ) : 'View Setup'}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Read-only header */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block bg-[#00A8E8]/10 text-[#00A8E8] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Read-only</span>
              </div>
              <p className="font-bold text-[#1A1B23]">{setup.setup_name || setup.track_name || 'Shared Setup'}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-[#6B7280]">
                {has(setup.race_class) && <span>{setup.race_class}</span>}
                {has(setup.track_name) && <span>· {setup.track_name}</span>}
                {has(setup.race_date) && <span>· {setup.race_date}</span>}
              </div>
            </div>

            {carStyle === 'A' && (
              <div className="flex justify-center">
                <img src={CAR_STYLE_A} alt="Chassis diagram" className="max-h-48 w-auto" />
              </div>
            )}

            {config && (
              <>
                <section className="border border-[#E5E7EB] rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A8E8] mb-2 border-b border-[#E5E7EB] pb-1.5">General Chassis</h3>
                  <MiniTable rows={rowsFor(setup, config.generalFields)} />
                </section>

                <section className="border border-[#E5E7EB] rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A8E8] mb-2 border-b border-[#E5E7EB] pb-1.5">Four Corners</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-[11px] font-extrabold text-[#1A1B23] mb-1">Left Front (LF)</p><MiniTable rows={rowsFor(setup, config.frontCornerFields, 'lf')} /></div>
                    <div><p className="text-[11px] font-extrabold text-[#1A1B23] mb-1">Right Front (RF)</p><MiniTable rows={rowsFor(setup, config.frontCornerFields, 'rf')} /></div>
                    <div><p className="text-[11px] font-extrabold text-[#1A1B23] mb-1">Left Rear (LR)</p><MiniTable rows={rowsFor(setup, config.rearCornerFields, 'lr')} /></div>
                    <div><p className="text-[11px] font-extrabold text-[#1A1B23] mb-1">Right Rear (RR)</p><MiniTable rows={rowsFor(setup, config.rearCornerFields, 'rr')} /></div>
                  </div>
                </section>

                <section className="border border-[#E5E7EB] rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A8E8] mb-2 border-b border-[#E5E7EB] pb-1.5">Rear End &amp; Drive Train</h3>
                  <MiniTable rows={rowsFor(setup, config.suspensionFields)} />
                </section>
              </>
            )}

            {setup.custom_fields && typeof setup.custom_fields === 'object' && Object.keys(setup.custom_fields).length > 0 && (
              <section className="border border-[#E5E7EB] rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A8E8] mb-2 border-b border-[#E5E7EB] pb-1.5">Custom Fields</h3>
                <MiniTable rows={Object.entries(setup.custom_fields).map(([k, v]): [string, string] => [k, v == null ? '' : String(v)]).filter(([, v]) => has(v))} />
              </section>
            )}

            {has(setup.notes) && (
              <section className="border border-[#E5E7EB] rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A8E8] mb-2 border-b border-[#E5E7EB] pb-1.5">Notes</h3>
                <p className="text-xs text-[#1A1B23] whitespace-pre-wrap">{setup.notes}</p>
              </section>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <button
                onClick={() => { setSetup(null); setCode(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                View Another
              </button>
              <button
                onClick={handlePdf}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-[#E5E7EB] text-[#1A1B23] hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Save as PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewSharedSetupModal;
