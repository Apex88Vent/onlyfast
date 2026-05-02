import React, { useState, useEffect, useCallback, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import ChassisSetupForm from './ChassisSetupForm';
import CustomFieldManager, { CustomField } from './CustomFieldManager';

interface CreateBaseSetupViewProps {
  user: User | null;
  selectedCar: string;
  onSignInClick: () => void;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onTemplatesChange?: () => void;
}

interface BaseTemplateState {
  [key: string]: string;
}

const emptyTemplate = (): BaseTemplateState => ({
  setup_name: '',
  raceClass: '',
  cross_weight: '',
  toe: '',
  toe_direction: '',
  front_ride_height: '',
  rear_ride_height: '',
  stagger: '',
  rf_caster: '', rf_camber: '', rf_pressure: '', rf_shock: '', rf_spring: '', rf_wheel_offset: '', rf_cw_turns: '',
  lf_caster: '', lf_camber: '', lf_pressure: '', lf_shock: '', lf_spring: '', lf_wheel_offset: '', lf_cw_turns: '',
  lr_tire_size: '', lr_pressure: '', lr_shock: '', lr_spring: '', lr_wheel_offset: '', lr_cw_turns: '',
  rr_tire_size: '', rr_pressure: '', rr_shock: '', rr_spring: '', rr_wheel_offset: '', rr_cw_turns: '',
  lr_trailing_arm: '', rr_trailing_arm: '',
  third_link: '', panhard_bar: '', gear_ratio: '',
  notes: '',
  top_wing_angle: '', top_wing_offset: '', nose_wing_angle: '',
  side_boards: '', nerf_bar_height: '',
  front_sprocket: '', rear_sprocket: '', chain_tension: '',
  front_axle: '', fuel_mixture: '', bumper_height: '',
  total_weight: '', left_side_pct: '', rear_weight_pct: '',
  lead_location: '', lead_weight: '',
  // Unused in this view but required by the form type
  trackName: '', raceDate: '', trackCondition: '',
  latitude: '', longitude: '', temperature: '', humidity: '', windSpeed: '', windDirection: '',
  entry_handling: '', mid_handling: '', exit_handling: '',
  session_fastest_lap: '', session_slowest_lap: '',
});

const STORAGE_KEY = 'onlyfast_base_template_draft_v1';

const CreateBaseSetupView: React.FC<CreateBaseSetupViewProps> = ({
  user, selectedCar, onSignInClick, customFields, onCustomFieldsChange, onTemplatesChange,
}) => {
  const prefix = useId();
  const [template, setTemplate] = useState<BaseTemplateState>(emptyTemplate());
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.template) setTemplate({ ...emptyTemplate(), ...parsed.template });
        if (parsed.editingId) setEditingId(parsed.editingId);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template, editingId }));
    } catch {}
  }, [template, editingId, loaded]);

  // Sync race class
  useEffect(() => {
    if (!loaded) return;
    if (selectedCar && !template.raceClass) {
      setTemplate(prev => ({ ...prev, raceClass: selectedCar }));
    }
  }, [selectedCar, loaded, template.raceClass]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id)
        .eq('setup_type', 'base_template')
        .order('created_at', { ascending: false });
      if (data) setTemplates(data);
    } catch {}
  }, [user]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleChange = useCallback((field: string, value: string) => {
    setTemplate(prev => ({ ...prev, [field]: value }));
  }, []);

  const buildPayload = (s: BaseTemplateState) => {
    const customFieldData: Record<string, string> = {};
    customFields.forEach(f => {
      const val = s[`custom_${f.id}`];
      if (val) customFieldData[f.name] = val;
    });
    return {
      user_id: user!.id,
      setup_type: 'base_template',
      setup_name: s.setup_name || 'Untitled Base Template',
      track_name: '',
      race_date: new Date().toISOString().split('T')[0],
      race_class: s.raceClass || selectedCar || '',
      cross_weight: s.cross_weight ? parseFloat(s.cross_weight) : null,
      toe: s.toe || null,
      toe_direction: s.toe_direction || null,
      front_ride_height: s.front_ride_height || null,
      rear_ride_height: s.rear_ride_height || null,
      stagger: s.stagger ? parseFloat(s.stagger) : null,
      rf_pressure: s.rf_pressure ? parseFloat(s.rf_pressure) : null,
      rf_shock: s.rf_shock || null,
      rf_spring: s.rf_spring || null,
      rf_caster: s.rf_caster ? parseFloat(s.rf_caster) : null,
      rf_camber: s.rf_camber ? parseFloat(s.rf_camber) : null,
      rf_wheel_offset: s.rf_wheel_offset || null,
      rf_cw_turns: s.rf_cw_turns || null,
      lf_pressure: s.lf_pressure ? parseFloat(s.lf_pressure) : null,
      lf_shock: s.lf_shock || null,
      lf_spring: s.lf_spring || null,
      lf_caster: s.lf_caster ? parseFloat(s.lf_caster) : null,
      lf_camber: s.lf_camber ? parseFloat(s.lf_camber) : null,
      lf_wheel_offset: s.lf_wheel_offset || null,
      lf_cw_turns: s.lf_cw_turns || null,
      lr_tire_size: s.lr_tire_size || null,
      lr_pressure: s.lr_pressure ? parseFloat(s.lr_pressure) : null,
      lr_shock: s.lr_shock || null,
      lr_spring: s.lr_spring || null,
      lr_wheel_offset: s.lr_wheel_offset || null,
      lr_cw_turns: s.lr_cw_turns || null,
      rr_tire_size: s.rr_tire_size || null,
      rr_pressure: s.rr_pressure ? parseFloat(s.rr_pressure) : null,
      rr_shock: s.rr_shock || null,
      rr_spring: s.rr_spring || null,
      rr_wheel_offset: s.rr_wheel_offset || null,
      rr_cw_turns: s.rr_cw_turns || null,
      lr_trailing_arm: s.lr_trailing_arm ? parseFloat(s.lr_trailing_arm) : null,
      rr_trailing_arm: s.rr_trailing_arm ? parseFloat(s.rr_trailing_arm) : null,
      third_link: s.third_link || null,
      panhard_bar: s.panhard_bar || null,
      gear_ratio: s.gear_ratio || null,
      custom_fields: Object.keys(customFieldData).length > 0 ? customFieldData : null,
      notes: s.notes || null,
    };
  };

  const dbWrite = async (payload: any, id: string | null) => {
    let p = { ...payload };
    if (id) delete p.user_id;
    for (let i = 0; i < 6; i++) {
      const q = id
        ? supabase.from('race_setups').update(p).eq('id', id).select().single()
        : supabase.from('race_setups').insert(p).select().single();
      const { data, error } = await q;
      if (!error) return data;
      const match = error.message?.match(/column\s+"?(\w+)"?/i);
      if (match && match[1] && p[match[1]] !== undefined) {
        const { [match[1]]: _, ...rest } = p;
        p = rest;
        continue;
      }
      // If setup_type check constraint rejects 'base_template', fall back to 'base'
      if (error.message?.toLowerCase().includes('check') && p.setup_type === 'base_template') {
        p.setup_type = 'base';
        p.setup_name = `[BASE TEMPLATE] ${p.setup_name}`;
        continue;
      }
      throw error;
    }
    throw new Error('Unable to save (schema mismatch).');
  };

  const handleSave = async () => {
    if (!user) { onSignInClick(); return; }
    if (!template.setup_name.trim()) {
      setMessage('Please give this base template a name.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = buildPayload(template);
      const result = await dbWrite(payload, editingId);
      setEditingId(result.id);
      setMessage(editingId ? `Updated "${template.setup_name}"` : `Saved "${template.setup_name}"`);
      setTimeout(() => setMessage(''), 3000);
      fetchTemplates();
      onTemplatesChange?.();
    } catch (err: any) {
      setMessage('Error: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const loadTemplateIntoState = (t: any): BaseTemplateState => ({
    ...emptyTemplate(),
    setup_name: (t.setup_name || '').replace(/^\[BASE TEMPLATE\]\s*/, ''),
    raceClass: t.race_class || '',
    cross_weight: t.cross_weight?.toString() || '',
    toe: t.toe || '',
    toe_direction: t.toe_direction || '',
    front_ride_height: t.front_ride_height?.toString() || '',
    rear_ride_height: t.rear_ride_height?.toString() || '',
    stagger: t.stagger?.toString() || '',
    rf_caster: t.rf_caster?.toString() || '',
    rf_camber: t.rf_camber?.toString() || '',
    rf_pressure: t.rf_pressure?.toString() || '',
    rf_shock: t.rf_shock || '',
    rf_spring: t.rf_spring?.toString() || '',
    rf_wheel_offset: t.rf_wheel_offset || '',
    rf_cw_turns: t.rf_cw_turns || '',
    lf_caster: t.lf_caster?.toString() || '',
    lf_camber: t.lf_camber?.toString() || '',
    lf_pressure: t.lf_pressure?.toString() || '',
    lf_shock: t.lf_shock || '',
    lf_spring: t.lf_spring?.toString() || '',
    lf_wheel_offset: t.lf_wheel_offset || '',
    lf_cw_turns: t.lf_cw_turns || '',
    lr_tire_size: t.lr_tire_size || '',
    lr_pressure: t.lr_pressure?.toString() || '',
    lr_shock: t.lr_shock || '',
    lr_spring: t.lr_spring?.toString() || '',
    lr_wheel_offset: t.lr_wheel_offset || '',
    lr_cw_turns: t.lr_cw_turns || '',
    rr_tire_size: t.rr_tire_size || '',
    rr_pressure: t.rr_pressure?.toString() || '',
    rr_shock: t.rr_shock || '',
    rr_spring: t.rr_spring?.toString() || '',
    rr_wheel_offset: t.rr_wheel_offset || '',
    rr_cw_turns: t.rr_cw_turns || '',
    lr_trailing_arm: t.lr_trailing_arm?.toString() || '',
    rr_trailing_arm: t.rr_trailing_arm?.toString() || '',
    third_link: t.third_link || '',
    panhard_bar: t.panhard_bar || '',
    gear_ratio: t.gear_ratio || '',
    notes: t.notes || '',
  });

  const handleEdit = (t: any) => {
    const loaded = loadTemplateIntoState(t);
    if (t.custom_fields) {
      Object.entries(t.custom_fields).forEach(([key, value]) => {
        const existing = customFields.find(f => f.name === key);
        if (existing) loaded[`custom_${existing.id}`] = value as string;
      });
    }
    setTemplate(loaded);
    setEditingId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this base template?')) return;
    try {
      await supabase.from('race_setups').delete().eq('id', id);
      if (editingId === id) {
        setEditingId(null);
        setTemplate(emptyTemplate());
      }
      fetchTemplates();
      onTemplatesChange?.();
    } catch {}
  };

  const handleNew = () => {
    if (editingId || Object.values(template).some(v => v && v !== selectedCar)) {
      if (!confirm('Start a new blank base template? Current draft will be cleared.')) return;
    }
    setEditingId(null);
    setTemplate({ ...emptyTemplate(), raceClass: selectedCar || '' });
  };

  if (!user) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
        <h2 className="text-xl font-bold text-[#1A1B23] mb-2">Create Base Setup</h2>
        <p className="text-[#6B7280] mb-4">Sign in to build reusable chassis-only base templates.</p>
        <button
          onClick={onSignInClick}
          className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1B23]">Create Base Setup</h2>
          <p className="text-[#6B7280] text-sm mt-1">
            Build a reusable chassis-only baseline. No track info, diagrams, or lap times — just the numbers.
          </p>
          {editingId && (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200 mt-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Editing existing template
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNew}
            className="bg-[#F9FAFB] hover:bg-[#F5F5F7] text-[#6B7280] hover:text-[#1A1B23] px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-[#E5E7EB]"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Existing templates list */}
      {templates.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1B23] mb-3">Your Base Templates ({templates.length})</h3>
          <ul className="space-y-2 max-h-[220px] overflow-y-auto">
            {templates.map(t => (
              <li key={t.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border ${editingId === t.id ? 'bg-amber-50 border-amber-200' : 'bg-[#F9FAFB] border-[#E5E7EB]'}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[#1A1B23] truncate">
                    {(t.setup_name || 'Untitled').replace(/^\[BASE TEMPLATE\]\s*/, '')}
                  </div>
                  <div className="text-xs text-[#9CA3AF]">{t.race_class || '—'}</div>
                </div>
                <button
                  onClick={() => handleEdit(t)}
                  className="text-[#00A8E8] hover:text-[#0090c7] text-xs font-semibold px-2 py-1 rounded hover:bg-[#00A8E8]/10 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Template name */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
        <label htmlFor={`${prefix}-name`} className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">
          Template Name
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          value={template.setup_name}
          onChange={(e) => handleChange('setup_name', e.target.value)}
          placeholder="e.g. Late Model Dry Slick Baseline"
          className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm font-medium"
        />
        <p className="text-xs text-[#9CA3AF] mt-1.5">Class: <span className="font-medium text-[#6B7280]">{template.raceClass || selectedCar || 'Not set'}</span></p>
      </section>

      {/* Chassis form */}
      <ChassisSetupForm
        data={template as any}
        customFields={customFields}
        onChange={handleChange}
        raceClass={selectedCar}
        activeTab="base"
      />

      <CustomFieldManager
        fields={customFields}
        onAdd={(f) => onCustomFieldsChange([...customFields, f])}
        onRemove={(id) => onCustomFieldsChange(customFields.filter(f => f.id !== id))}
        isOpen={customFieldsOpen}
        onToggle={() => setCustomFieldsOpen(!customFieldsOpen)}
      />

      {/* Notes */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
        <label htmlFor={`${prefix}-notes`} className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          id={`${prefix}-notes`}
          value={template.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          placeholder="Baseline philosophy, when to use this template, etc."
          className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm resize-y"
        />
      </section>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-3 flex items-center justify-between gap-3 flex-wrap">
        <div aria-live="polite" className="flex-1 min-w-0">
          {message && (
            <span className={`text-sm font-medium ${message.toLowerCase().includes('error') ? 'text-red-600' : 'text-green-700'}`}>
              {message}
            </span>
          )}
          {!message && (
            <span className="text-xs text-[#9CA3AF]">
              {editingId ? 'Saving will overwrite the existing template.' : 'Will save as a new base template.'}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          {saving ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
        </button>
      </div>
    </div>
  );
};

export default CreateBaseSetupView;
