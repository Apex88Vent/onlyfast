import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface BaseTemplatePickerProps {
  user: User | null;
  refreshKey?: number;
  onApply: (template: any) => void;
}

const BaseTemplatePicker: React.FC<BaseTemplatePickerProps> = ({ user, refreshKey, onApply }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Pull base_template first, then fall back to names tagged [BASE TEMPLATE] in case of schema constraint
      const { data: primary } = await supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id)
        .eq('setup_type', 'base_template')
        .order('created_at', { ascending: false });

      let list = primary || [];
      if (list.length === 0) {
        const { data: fallback } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .ilike('setup_name', '[BASE TEMPLATE]%')
          .order('created_at', { ascending: false });
        list = fallback || [];
      }
      setTemplates(list);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates, refreshKey]);

  if (!user) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#00A8E8]/20 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex w-8 h-8 rounded-lg bg-[#00A8E8]/10 items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#1A1B23]">Use Base Setup</h3>
            <p className="text-xs text-[#6B7280] truncate">
              {templates.length === 0
                ? 'No saved base templates yet. Create one in the "Create Base Setup" tab.'
                : `Apply a saved chassis baseline to this Hot Laps setup (${templates.length} available).`}
            </p>
          </div>
        </div>
        {templates.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border focus:outline-none focus:ring-2 focus:ring-[#00A8E8] flex-shrink-0 ${
              open
                ? 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30'
                : 'bg-[#00A8E8] text-white border-[#00A8E8] hover:bg-[#0090c7]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
            {open ? 'Hide' : 'Choose Template'}
          </button>
        )}
      </div>

      {open && templates.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">
          {templates.map(t => (
            <li key={t.id}>
              <button
                onClick={() => { onApply(t); setOpen(false); }}
                className="w-full flex items-center justify-between bg-[#F9FAFB] rounded-lg px-4 py-2.5 hover:bg-[#00A8E8]/5 hover:border-[#00A8E8]/30 transition-colors text-left border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[#1A1B23] truncate">
                    {(t.setup_name || 'Untitled').replace(/^\[BASE TEMPLATE\]\s*/, '')}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5">
                    <span className="bg-[#00A8E8]/10 text-[#00A8E8] font-medium px-1.5 py-0.5 rounded">Base Template</span>
                    <span>{t.race_class || '—'}</span>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 ml-2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="text-xs text-[#9CA3AF] mt-2">Loading templates…</p>}
    </section>
  );
};

export default BaseTemplatePicker;
