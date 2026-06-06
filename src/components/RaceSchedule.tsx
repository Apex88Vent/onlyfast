import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import RaceScheduleForm, { RaceEntry } from './RaceScheduleForm';
import RaceScheduleExport from './RaceScheduleExport';

interface RaceScheduleProps {
  user: User | null;
  onSignInClick: () => void;
}

const sortByDate = (rows: RaceEntry[]) =>
  [...rows].sort((a, b) => (a.race_date < b.race_date ? -1 : a.race_date > b.race_date ? 1 : 0));

const RaceSchedule: React.FC<RaceScheduleProps> = ({ user, onSignInClick }) => {
  const [races, setRaces] = useState<RaceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RaceEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const fetchRaces = useCallback(async () => {
    if (!user) { setRaces([]); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('race_schedule')
        .select('*')
        .eq('user_id', user.id)
        .order('race_date', { ascending: true });
      if (error) throw error;
      setRaces(sortByDate((data || []).map((r: any) => ({
        id: r.id,
        race_date: r.race_date,
        track: r.track || '',
        organization: r.organization || '',
        finishing_position: r.finishing_position || 'TBD',
      }))));
    } catch (e: any) {
      setError('Could not load your schedule. ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchRaces(); }, [fetchRaces]);

  const openAdd = () => {
    if (!user) { onSignInClick(); return; }
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (entry: RaceEntry) => {
    setEditing(entry);
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (entry: RaceEntry) => {
    if (!user) { onSignInClick(); return; }
    setSaving(true);
    setFormError('');
    try {
      if (entry.id) {
        const { error } = await supabase
          .from('race_schedule')
          .update({
            race_date: entry.race_date,
            track: entry.track,
            organization: entry.organization || null,
            finishing_position: entry.finishing_position || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('race_schedule')
          .insert({
            user_id: user.id,
            race_date: entry.race_date,
            track: entry.track,
            organization: entry.organization || null,
            finishing_position: entry.finishing_position || null,
          });
        if (error) throw error;
      }
      setFormOpen(false);
      setEditing(null);
      await fetchRaces();
    } catch (e: any) {
      setFormError('Could not save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: RaceEntry) => {
    if (!user || !entry.id) return;
    if (!confirm(`Delete the race at ${entry.track}?`)) return;
    setError('');
    try {
      const { error } = await supabase
        .from('race_schedule')
        .delete()
        .eq('id', entry.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setRaces(prev => prev.filter(r => r.id !== entry.id));
    } catch (e: any) {
      setError('Could not delete: ' + (e.message || 'Unknown error'));
    }
  };

  const dateBadge = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return {
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      day: String(d.getDate()),
      year: String(d.getFullYear()),
    };
  };

  // Signed-out state
  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#00A8E8]/10 flex items-center justify-center mb-4 text-[#00A8E8]">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[#1A1B23]">Race Schedule</h2>
        <p className="text-sm text-[#6B7280] mt-2">Sign in to build and track your race schedule.</p>
        <button onClick={onSignInClick} className="mt-5 bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1B23]">Race Schedule</h2>
          <p className="text-[#6B7280] text-sm mt-1">Your upcoming &amp; past races, sorted by date.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setExportOpen(true)}
            disabled={races.length === 0}
            className="bg-[#F9FAFB] hover:bg-[#00A8E8]/10 text-[#6B7280] hover:text-[#00A8E8] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 border border-[#E5E7EB] hover:border-[#00A8E8]/30 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            Export Schedule
          </button>
          <button
            onClick={openAdd}
            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Race
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[88px] rounded-2xl bg-[#F0F0F2] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && races.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E5E7EB]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00A8E8]/10 flex items-center justify-center mb-4 text-[#00A8E8]">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
          <p className="text-[#1A1B23] font-semibold">No races added yet.</p>
          <button
            onClick={openAdd}
            className="mt-4 bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Your First Race
          </button>
        </div>
      )}

      {/* Cards */}
      {!loading && races.length > 0 && (
        <ul className="space-y-3">
          {races.map(r => {
            const b = dateBadge(r.race_date);
            return (
              <li key={r.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-4 shadow-sm hover:border-[#00A8E8]/30 transition-colors">
                {/* Date badge */}
                <div className="flex-shrink-0 w-16 sm:w-20 rounded-xl bg-[#00A8E8] text-white flex flex-col items-center justify-center py-2">
                  <span className="text-[11px] font-bold tracking-wide">{b.month}</span>
                  <span className="text-2xl font-extrabold leading-none">{b.day}</span>
                  <span className="text-[10px] opacity-80">{b.year}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-[#1A1B23] truncate">{r.track}</h3>
                  <p className="text-sm text-[#6B7280] truncate">{r.organization || '—'}</p>
                  <p className="text-xs mt-1">
                    <span className="text-[#9CA3AF]">Finish: </span>
                    <span className="font-semibold text-[#00A8E8]">{r.finishing_position || 'TBD'}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(r)}
                    aria-label={`Edit race at ${r.track}`}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#00A8E8] hover:bg-[#00A8E8]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    aria-label={`Delete race at ${r.track}`}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RaceScheduleForm
        isOpen={formOpen}
        initial={editing}
        saving={saving}
        error={formError}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      <RaceScheduleExport
        isOpen={exportOpen}
        races={races}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
};

export default RaceSchedule;
