import React, { useState, useEffect } from 'react';

export interface RaceEntry {
  id?: string;
  race_date: string;
  track: string;
  organization: string;
  finishing_position: string;
}

interface RaceScheduleFormProps {
  isOpen: boolean;
  initial?: RaceEntry | null;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (entry: RaceEntry) => void;
}

const emptyEntry = (): RaceEntry => ({
  race_date: new Date().toISOString().split('T')[0],
  track: '',
  organization: '',
  finishing_position: 'TBD',
});

const RaceScheduleForm: React.FC<RaceScheduleFormProps> = ({
  isOpen, initial, saving, error, onClose, onSave,
}) => {
  const [entry, setEntry] = useState<RaceEntry>(emptyEntry());
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEntry(initial ? { ...initial } : emptyEntry());
      setLocalError('');
    }
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.race_date) { setLocalError('Please choose a date.'); return; }
    if (!entry.track.trim()) { setLocalError('Please enter a track name.'); return; }
    setLocalError('');
    onSave({
      ...entry,
      track: entry.track.trim(),
      organization: entry.organization.trim(),
      finishing_position: entry.finishing_position.trim(),
    });
  };

  const labelCls = 'block text-xs font-semibold text-[#6B7280] mb-1';
  const inputCls = 'w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] placeholder:text-[#9CA3AF]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="race-form-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="race-form-title" className="text-xl font-bold text-[#1A1B23]">
            {initial?.id ? 'Edit Race' : 'Add Race'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rf-date" className={labelCls}>Date <span className="text-[#00A8E8]">*</span></label>
            <input id="rf-date" type="date" required value={entry.race_date}
              onChange={(e) => setEntry(p => ({ ...p, race_date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="rf-track" className={labelCls}>Track <span className="text-[#00A8E8]">*</span></label>
            <input id="rf-track" type="text" required value={entry.track} placeholder="e.g. Barona Speedway"
              onChange={(e) => setEntry(p => ({ ...p, track: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="rf-org" className={labelCls}>Organization</label>
            <input id="rf-org" type="text" value={entry.organization} placeholder="e.g. SoCal Dwarf Cars, VRA, POWRi"
              onChange={(e) => setEntry(p => ({ ...p, organization: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="rf-pos" className={labelCls}>Finishing Position</label>
            <input id="rf-pos" type="text" value={entry.finishing_position} placeholder="e.g. 1st, 5th, DNF, TBD"
              onChange={(e) => setEntry(p => ({ ...p, finishing_position: e.target.value }))} className={inputCls} />
            <p className="text-[10px] text-[#9CA3AF] mt-1">Leave as TBD until after the race, then edit it.</p>
          </div>

          {(localError || error) && (
            <p className="text-sm text-red-600 font-medium" role="alert">{localError || error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaceScheduleForm;
