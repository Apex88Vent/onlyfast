import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface SavedSetupsProps {
  user: User | null;
  onLoad: (setup: any) => void;
  refreshTrigger: number;
}

// --- Race-day grouping helpers (UI-only organization) ---------------------
// NOTE: This is purely a display grouping. Individual session setups remain
// separate rows in the database and are loaded individually, so the existing
// session swipe system is untouched.
//
// IMPORTANT: Per the latest request, the per-session pencil/edit (rename &
// delete) controls have been REMOVED from these chips. Rename/Delete now live
// on the active session page itself (see SetupDashboard). Only the [+] add
// button remains here.

interface SetupGroup {
  key: string;
  isGroup: boolean;        // true => parent race-day card, false => standalone save
  isBaseSetup: boolean;
  title: string;           // e.g. "Barona 6-9-26"
  trackName: string;
  raceDate: string;
  raceClass: string;
  org: string;
  setups: any[];           // session setups belonging to this race day
}

const norm = (v: any) => (v == null ? '' : String(v).trim());
const isBaseSetupRow = (s: any) =>
  norm(s.setup_type) === 'base_template' || norm(s.setup_name).toUpperCase().startsWith('[BASE TEMPLATE]');
const cleanBaseTitle = (name: string) => name.replace(/^\[BASE TEMPLATE\]\s*/i, '').trim();

// A setup can be grouped cleanly only when it has BOTH a track name and a date.
const canGroup = (s: any) => norm(s.track_name) !== '' && norm(s.race_date) !== '';

const buildGroupKey = (s: any) =>
  [
    norm(s.track_name).toLowerCase(),
    norm(s.race_date).toLowerCase(),
    norm(s.race_class).toLowerCase(),
    norm(s.organization || s.org || '').toLowerCase(),
  ].join('|');

const buildGroups = (setups: any[]): SetupGroup[] => {
  const map = new Map<string, SetupGroup>();
  const baseSetups: SetupGroup[] = [];
  const standalone: SetupGroup[] = [];

  setups.forEach((s, idx) => {
    if (isBaseSetupRow(s)) {
      baseSetups.push({
        key: `base-${s.id ?? idx}`,
        isGroup: false,
        isBaseSetup: true,
        title: cleanBaseTitle(norm(s.setup_name)) || norm(s.race_class) || 'Base Setup',
        trackName: '',
        raceDate: norm(s.race_date),
        raceClass: norm(s.race_class),
        org: norm(s.organization || s.org || ''),
        setups: [s],
      });
      return;
    }

    if (!canGroup(s)) {
      standalone.push({
        key: `solo-${s.id ?? idx}`,
        isGroup: false,
        isBaseSetup: false,
        title: norm(s.setup_name) || norm(s.track_name) || 'Untitled',
        trackName: norm(s.track_name),
        raceDate: norm(s.race_date),
        raceClass: norm(s.race_class),
        org: norm(s.organization || s.org || ''),
        setups: [s],
      });
      return;
    }
    const key = buildGroupKey(s);
    if (!map.has(key)) {
      map.set(key, {
        key,
        isGroup: true,
        isBaseSetup: false,
        title: `${norm(s.track_name)} ${norm(s.race_date)}`.trim(),
        trackName: norm(s.track_name),
        raceDate: norm(s.race_date),
        raceClass: norm(s.race_class),
        org: norm(s.organization || s.org || ''),
        setups: [],
      });
    }
    map.get(key)!.setups.push(s);
  });

  const groups = Array.from(map.values());
  return [...baseSetups, ...groups, ...standalone];
};

const sessionOrder: Record<string, number> = { base: 1, heat: 2, main: 3, extra1: 4, extra2: 5, extra3: 6 };

const CANONICAL_TYPES = ['base', 'heat', 'main', 'extra1', 'extra2', 'extra3'] as const;
const defaultLabelForType = (type: string) =>
  type === 'main' ? 'Main Event' :
  type === 'heat' ? 'Heat Race' :
  type === 'extra1' ? 'Session 4' :
  type === 'extra2' ? 'Session 5' :
  type === 'extra3' ? 'Session 6' :
  'Hot Laps';
const sessionLabelOf = (s: any) =>
  isBaseSetupRow(s) ? 'Base Setup' :
  norm(s.session_label) || defaultLabelForType(s.setup_type);

const getSetupTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    base_template: 'bg-[#1A1B23] text-white',
    base: 'bg-[#F0F0F2] text-[#4B5563]',
    heat: 'bg-amber-100 text-amber-700',
    main: 'bg-[#00A8E8]/10 text-[#00A8E8]',
  };
  return colors[type] || colors.base;
};
// -------------------------------------------------------------------------

const SavedSetups: React.FC<SavedSetupsProps> = ({ user, onLoad, refreshTrigger }) => {
  const [setups, setSetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Add-session modal state (the ONLY session control remaining on this screen).
  const [addTarget, setAddTarget] = useState<SetupGroup | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  // Delete-event confirmation state (deletes the ENTIRE race day / all sessions).
  const [deleteTarget, setDeleteTarget] = useState<SetupGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchSetups();
  }, [user, refreshTrigger]);

  const fetchSetups = async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        setFetchError(error.message || 'Unable to fetch your setups right now.');
      } else if (data) {
        setSetups(data);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Network error — unable to reach the server.');
    }
    setLoading(false);
  };

  const groups = useMemo(() => buildGroups(setups), [setups]);

  // ---- ADD SESSION ---------------------------------------------------------
  const openAdd = (group: SetupGroup) => {
    setAddTarget(group);
    setAddValue('');
    setAddError(null);
  };

  const closeAdd = () => {
    setAddTarget(null);
    setAddValue('');
    setAddError(null);
  };

  const submitAdd = async () => {
    if (!addTarget || !user) return;
    const group = addTarget;
    const name = addValue.trim();
    if (!name) {
      setAddError('Session name cannot be empty.');
      return;
    }
    const dup = group.setups.some(
      s => sessionLabelOf(s).toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      setAddError('A session with that name already exists for this race day.');
      return;
    }
    const usedTypes = new Set(group.setups.map(s => s.setup_type));
    const freeType = CANONICAL_TYPES.find(t => !usedTypes.has(t));
    if (!freeType) {
      setAddError('This race day already has all 6 sessions.');
      return;
    }
    const existingOrders = group.setups
      .map(s => Number(s.session_order ?? sessionOrder[s.setup_type] ?? 0))
      .filter(n => Number.isFinite(n) && n > 0);
    const nextOrder = Math.min((existingOrders.length ? Math.max(...existingOrders) : 0) + 1, 6);
    const sharedName =
      group.setups.find(s => norm(s.setup_name))?.setup_name || group.title;

    setAddBusy(true);
    const payload: any = {
      user_id: user.id,
      setup_type: freeType,
      setup_name: sharedName,
      session_label: name,
      session_order: nextOrder,
      track_name: group.trackName,
      race_date: group.raceDate || null,
      race_class: group.raceClass || 'Open',
    };
    const { data, error } = await supabase
      .from('race_setups')
      .insert(payload)
      .select('*')
      .single();
    setAddBusy(false);
    if (error) {
      setAddError(error.message || 'Could not add session.');
      return;
    }
    if (data) setSetups(prev => [data, ...prev]);
    closeAdd();
  };

  // ---- DELETE RACE EVENT (entire race day / all sessions) ------------------
  const openDelete = (group: SetupGroup) => {
    setDeleteTarget(group);
    setDeleteError(null);
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !user) return;
    const ids = deleteTarget.setups.map(s => s.id).filter(id => id != null);
    if (ids.length === 0) {
      closeDelete();
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const { error } = await supabase
        .from('race_setups')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id); // RLS-safe: only the owner can delete
      if (error) {
        setDeleteError(error.message || 'Could not delete this race event. Please try again.');
        setDeleteBusy(false);
        return;
      }
      // Remove every session in this event from local state after success.
      const idSet = new Set(ids);
      setSetups(prev => prev.filter(s => !idSet.has(s.id)));
      setDeleteBusy(false);
      closeDelete();
    } catch (err: any) {
      setDeleteError(err?.message || 'Network error — unable to delete right now.');
      setDeleteBusy(false);
    }
  };

  if (!user) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3 className="text-lg font-bold text-[#1A1B23] mb-1">Sign in to view saved setups</h3>
        <p className="text-[#6B7280] text-sm">Your setups will be saved to your account</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1A1B23]">Saved Setups</h3>
          <button onClick={fetchSetups} className="text-[#00A8E8] hover:text-[#0090c7] text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1">
            Refresh
          </button>
        </div>

        <div aria-live="polite">
          {loading ? (
            <div className="text-center py-8 text-[#9CA3AF]" role="status">Loading setups...</div>
          ) : fetchError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm" role="alert">
              <div className="flex items-start gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex-1">
                  <div className="font-semibold text-red-800">Unable to fetch your saved setups</div>
                  <div className="text-red-700 text-xs mt-1">{fetchError}</div>
                </div>
              </div>
              <button
                onClick={fetchSetups}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          ) : setups.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF]">
              <p className="text-sm">No saved setups yet</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[560px] overflow-y-auto" aria-label="Saved setups list">
              {groups.map(group => {
                const subtitleParts = [group.raceClass, group.trackName, group.org].filter(p => p && p.trim() !== '');
                const orderedSetups = [...group.setups].sort((a, b) => {
                  const orderA = Number(a.session_order ?? sessionOrder[a.setup_type] ?? 99);
                  const orderB = Number(b.session_order ?? sessionOrder[b.setup_type] ?? 99);
                  return orderA - orderB;
                });
                const firstSetup = orderedSetups[0];
                const openFirstSetup = () => {
                  if (firstSetup) onLoad(firstSetup);
                };

                return (
                  <li
                    key={group.key}
                    className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-4 cursor-pointer focus-within:ring-2 focus-within:ring-[#00A8E8]/30"
                    role="button"
                    tabIndex={0}
                    onClick={openFirstSetup}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFirstSetup();
                      }
                    }}
                    aria-label={`Open ${group.title || 'saved setup'}`}
                  >
                    {/* Parent race-day title + delete-entire-event trash icon */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {group.isBaseSetup && (
                            <span className="flex-shrink-0 rounded-full bg-[#1A1B23] text-white px-2 py-0.5 text-[10px] font-bold tracking-[0.08em]">
                              BASE SETUP
                            </span>
                          )}
                          <div className="font-bold text-base text-[#1A1B23] truncate">{group.title || 'Untitled'}</div>
                        </div>
                        {subtitleParts.length > 0 && (
                          <div className="text-xs text-[#9CA3AF] truncate mt-0.5">
                            {subtitleParts.join(' • ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(group);
                        }}
                        className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={group.isBaseSetup ? `Delete base setup ${group.title}` : `Delete entire race event ${group.title} and all its sessions`}
                        title={group.isBaseSetup ? 'Delete base setup' : 'Delete entire race event'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>

                    {/* Session chips: tap a chip to LOAD that session. Per-session
                        delete now lives on the active session page; this screen's
                        trash icon (above) deletes the whole race event. */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {orderedSetups.map(s => (
                        <button
                          key={`chip-${s.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoad(s);
                          }}
                          className={`inline-flex items-center px-3.5 py-1.5 rounded-full border border-[#E5E7EB] text-xs font-semibold hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${getSetupTypeBadge(s.setup_type)}`}
                          aria-label={`Load ${sessionLabelOf(s)} for ${group.title}`}
                          title={`Load ${sessionLabelOf(s)}`}
                        >
                          {sessionLabelOf(s)}
                        </button>
                      ))}

                      {/* Trailing [+] add-session button */}
                      {!group.isBaseSetup && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAdd(group);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-[#9CA3AF] text-[#6B7280] hover:text-[#00A8E8] hover:border-[#00A8E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                          aria-label={`Add session to ${group.title}`}
                          title="Add session"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ADD SESSION MODAL */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add Session">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-1">Add Session</h4>
            <p className="text-xs text-[#6B7280] mb-3">A new blank session for {addTarget.title}.</p>
            <input
              type="text"
              value={addValue}
              autoFocus
              onChange={(e) => { setAddValue(e.target.value); setAddError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') closeAdd(); }}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]"
              placeholder="Session name"
              aria-label="New session name"
            />
            {addError && <div className="text-xs text-red-600 mt-2" role="alert">{addError}</div>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeAdd} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={submitAdd} disabled={addBusy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A8E8] hover:bg-[#0090c7] text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
                {addBusy ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SAVED SETUP / RACE EVENT CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={deleteTarget.isBaseSetup ? 'Delete Base Setup' : 'Delete Race Event'}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-2">{deleteTarget.isBaseSetup ? 'Delete this base setup?' : 'Delete this race event?'}</h4>
            <p className="text-sm text-[#6B7280] mb-1 font-medium text-[#1A1B23]">{deleteTarget.title || 'Untitled'}</p>
            <p className="text-sm text-[#6B7280]">
              {deleteTarget.isBaseSetup
                ? 'Delete this base setup? This cannot be undone.'
                : `Delete this entire race event and all ${deleteTarget.setups.length} session${deleteTarget.setups.length === 1 ? '' : 's'} inside it? This cannot be undone.`}
            </p>
            {deleteError && <div className="text-xs text-red-600 mt-3" role="alert">{deleteError}</div>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeDelete} disabled={deleteBusy} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteBusy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SavedSetups;
