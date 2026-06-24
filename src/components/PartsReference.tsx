import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import RookieAdSlot from './RookieAdSlot';

interface PartsReferenceProps {
  user: User | null;
  onSignInClick: () => void;
}

interface PartRow {
  id: string;
  part_type: string;
  part_number: string;
  ordered_from: string;
  cost: number | null;
  notes: string;
  created_at?: string;
}

const emptyDraft = () => ({
  part_type: '',
  part_number: '',
  ordered_from: '',
  cost: '',
  notes: '',
});

const PartsReference: React.FC<PartsReferenceProps> = ({ user, onSignInClick }) => {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft());

  const fetchRows = useCallback(async () => {
    if (!user) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('parts_reference')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load parts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleAdd = async () => {
    if (!user) { onSignInClick(); return; }
    if (!draft.part_type.trim() && !draft.part_number.trim()) {
      setError('Please enter at least a part type or part number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        user_id: user.id,
        part_type: draft.part_type.trim(),
        part_number: draft.part_number.trim(),
        ordered_from: draft.ordered_from.trim(),
        cost: draft.cost ? parseFloat(draft.cost) : null,
        notes: draft.notes.trim(),
      };
      const { data, error } = await supabase
        .from('parts_reference')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setRows(prev => [data, ...prev]);
      setDraft(emptyDraft());
    } catch (err: any) {
      setError(err.message || 'Failed to save part');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm('Remove this part?')) return;
    try {
      const { error } = await supabase
        .from('parts_reference')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const startEdit = (r: PartRow) => {
    setEditId(r.id);
    setEditDraft({
      part_type: r.part_type || '',
      part_number: r.part_number || '',
      ordered_from: r.ordered_from || '',
      cost: r.cost != null ? String(r.cost) : '',
      notes: r.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editId || !user) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        part_type: editDraft.part_type.trim(),
        part_number: editDraft.part_number.trim(),
        ordered_from: editDraft.ordered_from.trim(),
        cost: editDraft.cost ? parseFloat(editDraft.cost) : null,
        notes: editDraft.notes.trim(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('parts_reference')
        .update(payload)
        .eq('id', editId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setRows(prev => prev.map(r => (r.id === editId ? data : r)));
      setEditId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft(emptyDraft());
  };

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.part_type || '').toLowerCase().includes(q) ||
      (r.part_number || '').toLowerCase().includes(q) ||
      (r.ordered_from || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  });

  const totalCost = rows.reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1A1B23] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Parts Reference
        </h2>
        <p className="text-[#6B7280] text-sm mt-1">Track part numbers, suppliers, and costs.</p>
      </div>

      {!user && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm flex items-center justify-between flex-wrap gap-2">
          <span>Sign in to save and sync your parts reference list.</span>
          <button
            onClick={onSignInClick}
            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Add new */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1B23] mb-3">Add a Part</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Part Type</label>
            <input
              type="text"
              value={draft.part_type}
              onChange={e => setDraft({ ...draft, part_type: e.target.value })}
              placeholder="e.g. Shock, Spring"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Part Number</label>
            <input
              type="text"
              value={draft.part_number}
              onChange={e => setDraft({ ...draft, part_number: e.target.value })}
              placeholder="e.g. AFCO-1294"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Ordered From</label>
            <input
              type="text"
              value={draft.ordered_from}
              onChange={e => setDraft({ ...draft, ordered_from: e.target.value })}
              placeholder="Supplier / store"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Cost ($)</label>
            <input
              type="number"
              step="0.01"
              value={draft.cost}
              onChange={e => setDraft({ ...draft, cost: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Notes (optional)</label>
            <input
              type="text"
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="e.g. Rear right, 200lb"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-3" role="alert">{error}</p>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {saving ? 'Saving...' : 'Add Part'}
          </button>
        </div>
      </section>

      {/* List */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-sm font-bold text-[#1A1B23]">
            Your Parts ({rows.length}){rows.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[#6B7280]">
                Total: ${totalCost.toFixed(2)}
              </span>
            )}
          </h3>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search parts..."
              className="pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8] w-48"
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-[#9CA3AF]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-[#9CA3AF]">
            {rows.length === 0 ? 'No parts saved yet — add one above.' : 'No parts match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Part #</th>
                  <th className="py-2 pr-3">Ordered From</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-0 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isEditing = editId === r.id;
                  if (isEditing) {
                    return (
                      <tr key={r.id} className="border-b border-[#F0F0F2] bg-[#F9FAFB]">
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={editDraft.part_type}
                            onChange={e => setEditDraft({ ...editDraft, part_type: e.target.value })}
                            className="w-full px-2 py-1 border border-[#E5E7EB] rounded text-xs"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={editDraft.part_number}
                            onChange={e => setEditDraft({ ...editDraft, part_number: e.target.value })}
                            className="w-full px-2 py-1 border border-[#E5E7EB] rounded text-xs"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={editDraft.ordered_from}
                            onChange={e => setEditDraft({ ...editDraft, ordered_from: e.target.value })}
                            className="w-full px-2 py-1 border border-[#E5E7EB] rounded text-xs"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            step="0.01"
                            value={editDraft.cost}
                            onChange={e => setEditDraft({ ...editDraft, cost: e.target.value })}
                            className="w-full px-2 py-1 border border-[#E5E7EB] rounded text-xs text-right"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={editDraft.notes}
                            onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })}
                            className="w-full px-2 py-1 border border-[#E5E7EB] rounded text-xs"
                          />
                        </td>
                        <td className="py-2 pr-0">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="text-[#00A8E8] hover:bg-[#00A8E8]/10 p-1 rounded"
                              title="Save"
                              aria-label="Save edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-[#9CA3AF] hover:bg-[#F5F5F7] p-1 rounded"
                              title="Cancel"
                              aria-label="Cancel edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id} className="border-b border-[#F0F0F2] hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2 pr-3 font-medium text-[#1A1B23]">{r.part_type || '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-[#6B7280]">{r.part_number || '—'}</td>
                      <td className="py-2 pr-3 text-[#6B7280]">{r.ordered_from || '—'}</td>
                      <td className="py-2 pr-3 text-right text-[#1A1B23] font-medium">
                        {r.cost != null ? `$${Number(r.cost).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-[#6B7280] max-w-[200px] truncate">{r.notes || ''}</td>
                      <td className="py-2 pr-0">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(r)}
                            className="text-[#6B7280] hover:text-[#00A8E8] hover:bg-[#00A8E8]/10 p-1 rounded"
                            title="Edit"
                            aria-label="Edit part"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-[#6B7280] hover:text-red-500 hover:bg-red-50 p-1 rounded"
                            title="Delete"
                            aria-label="Delete part"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <RookieAdSlot placement="parts_reference_bottom" user={user} />
    </div>
  );
};

export default PartsReference;
