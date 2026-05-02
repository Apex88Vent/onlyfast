import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import ShareSetupModal from './ShareSetupModal';

interface SavedSetupsProps {
  user: User | null;
  onLoad: (setup: any) => void;
  refreshTrigger: number;
}

const SavedSetups: React.FC<SavedSetupsProps> = ({ user, onLoad, refreshTrigger }) => {
  const [setups, setSetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [shareSetup, setShareSetup] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingRename, setSavingRename] = useState(false);

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



  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete the setup "${name || 'Untitled'}"?`)) return;
    await supabase.from('race_setups').delete().eq('id', id);
    setSetups(prev => prev.filter(s => s.id !== id));
  };

  const startRename = (setup: any) => {
    setEditingId(setup.id);
    setEditName(setup.setup_name || setup.track_name || '');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const commitRename = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      cancelRename();
      return;
    }
    setSavingRename(true);
    try {
      const { error } = await supabase
        .from('race_setups')
        .update({ setup_name: name })
        .eq('id', id);
      if (error) {
        // Fallback: update track_name as setup_name proxy
        await supabase.from('race_setups').update({ track_name: name }).eq('id', id);
        setSetups(prev => prev.map(s => s.id === id ? { ...s, track_name: name } : s));
      } else {
        setSetups(prev => prev.map(s => s.id === id ? { ...s, setup_name: name } : s));
      }
    } catch {}
    setSavingRename(false);
    setEditingId(null);
  };

  const getSetupTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      base: 'bg-[#F0F0F2] text-[#4B5563]',
      heat: 'bg-amber-100 text-amber-700',
      main: 'bg-[#00A8E8]/10 text-[#00A8E8]',
    };
    return colors[type] || colors.base;
  };

  const getSetupTypeLabel = (type: string) =>
    type === 'main' ? 'Main Event' : type === 'heat' ? 'Heat' : 'Hot Laps';

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
                  <div className="text-red-600 text-xs mt-2">
                    This usually means the server is temporarily unreachable. Your local work is safe — try again in a moment.
                  </div>
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

            <ul className="space-y-2 max-h-[500px] overflow-y-auto" aria-label="Saved setups list">
              {setups.map(setup => {
                const displayName = setup.setup_name || setup.track_name || 'Untitled';
                const isEditing = editingId === setup.id;
                return (
                  <li key={setup.id} className="flex items-center justify-between bg-[#F9FAFB] rounded-xl px-4 py-3 hover:bg-[#F0F0F2] transition-colors border border-[#E5E7EB] gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            autoFocus
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(setup.id);
                              if (e.key === 'Escape') cancelRename();
                            }}
                            className="flex-1 min-w-[140px] px-2 py-1 border border-[#00A8E8] rounded-md text-sm font-semibold text-[#1A1B23] bg-white focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                            aria-label="Rename setup"
                          />
                        ) : (
                          <span className="font-semibold text-sm text-[#1A1B23] truncate">
                            {displayName}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSetupTypeBadge(setup.setup_type)}`}>
                          {getSetupTypeLabel(setup.setup_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#9CA3AF] flex-wrap">
                        {setup.setup_name && setup.track_name && setup.track_name !== setup.setup_name && (
                          <span className="truncate">{setup.track_name}</span>
                        )}
                        <span>{setup.race_class || 'No class'}</span>
                        <span>{setup.race_date || 'No date'}</span>
                        {setup.track_condition && <span>{setup.track_condition}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => commitRename(setup.id)}
                            disabled={savingRename}
                            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelRename}
                            className="text-[#6B7280] hover:text-[#1A1B23] px-2 py-1.5 rounded text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startRename(setup)}
                            className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1.5 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                            aria-label={`Rename setup: ${displayName}`}
                            title="Rename"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setShareSetup(setup)}
                            className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1.5 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                            aria-label={`Share setup: ${displayName}`}
                            title="Share"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onLoad(setup)}
                            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                            aria-label={`Load setup: ${displayName}`}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDelete(setup.id, displayName)}
                            className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Delete setup: ${displayName}`}
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <ShareSetupModal
        isOpen={shareSetup !== null}
        onClose={() => setShareSetup(null)}
        setup={shareSetup}
        user={user}
      />
    </>
  );
};

export default SavedSetups;
