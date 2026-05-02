import React, { useId, useCallback } from 'react';
import { getClassConfig, FieldDef, rideHeightOptions, toeOptions, crossWeightTurnsOptions } from '@/lib/classConfigs';

interface SetupData {
  [key: string]: string;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number';
}

interface ChassisSetupFormProps {
  data: SetupData;
  customFields: CustomField[];
  onChange: (field: string, value: string) => void;
  raceClass?: string;
  activeTab?: 'base' | 'heat' | 'main';
  baseSetup?: SetupData | null; // For highlighting diffs vs the prior tab
  baseLabel?: string;           // Label for the "compared to" banner (e.g. "Hot Laps" or "Heat")
}

const inputClass = "w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm placeholder-[#9CA3AF]";
const changedInputClass = "w-full px-3 py-2.5 border-2 border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-amber-900 bg-amber-50 text-sm placeholder-amber-400 font-semibold";
const labelClass = "block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1";
const changedLabelClass = "block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1";

const ChangedBadge = () => (
  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
    CHANGED
  </span>
);

const isChanged = (baseSetup: SetupData | null | undefined, key: string, value: string): boolean => {
  if (!baseSetup) return false;
  const baseVal = (baseSetup[key] || '').trim();
  const curVal = (value || '').trim();
  if (!baseVal && !curVal) return false;
  return baseVal !== curVal;
};

// CornerCard defined OUTSIDE the main component to prevent re-mounting on each render
const CornerCard = React.memo(({ title, cornerPrefix, color, fields, legendId, data, onChange, prefix, showCwTurns, baseSetup }: {
  title: string; cornerPrefix: string; color: string; fields: FieldDef[]; legendId: string;
  data: SetupData; onChange: (field: string, value: string) => void; prefix: string; showCwTurns?: boolean;
  baseSetup?: SetupData | null;
}) => {
  return (
    <fieldset className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-4 hover:border-[#00A8E8]/30 transition-colors">
      <legend id={legendId} className="text-sm font-bold uppercase tracking-wider px-1" style={{ color }}>{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => {
          const fieldKey = `${cornerPrefix}_${field.key}`;
          const fieldId = `${prefix}-${fieldKey}`;
          const value = data[fieldKey] || '';
          const changed = isChanged(baseSetup, fieldKey, value);

          if (field.type === 'select' && field.options) {
            return (
              <div key={fieldKey}>
                <label htmlFor={fieldId} className={changed ? changedLabelClass : labelClass}>
                  {field.label}{changed && <ChangedBadge />}
                </label>
                <select id={fieldId} value={value} onChange={(e) => onChange(fieldKey, e.target.value)} className={changed ? changedInputClass : inputClass}>
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={fieldKey}>
              <label htmlFor={fieldId} className={changed ? changedLabelClass : labelClass}>
                {field.label}{changed && <ChangedBadge />}
              </label>
              <input
                id={fieldId}
                type="text"
                inputMode={field.type === 'number' ? 'decimal' : 'text'}
                value={value}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                className={changed ? changedInputClass : inputClass}
                placeholder={field.placeholder || '--'}
              />
            </div>
          );
        })}
        {showCwTurns && (
          <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <label htmlFor={`${prefix}-${cornerPrefix}_cw_turns`} className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
              Crossweight Change (Turns)
            </label>
            <select
              id={`${prefix}-${cornerPrefix}_cw_turns`}
              value={data[`${cornerPrefix}_cw_turns`] || ''}
              onChange={(e) => onChange(`${cornerPrefix}_cw_turns`, e.target.value)}
              className="w-full px-2 py-1.5 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none text-amber-900 bg-white text-xs"
            >
              {crossWeightTurnsOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </fieldset>
  );
});

CornerCard.displayName = 'CornerCard';


const ChassisSetupForm: React.FC<ChassisSetupFormProps> = ({ data, customFields, onChange, raceClass, activeTab = 'base', baseSetup = null, baseLabel = 'Hot Laps' }) => {

  const prefix = useId();
  const config = getClassConfig(raceClass || '');

  const sectionHeaderClass = "text-base font-bold text-[#1A1B23] mb-3 flex items-center gap-2";

  const renderField = useCallback((field: FieldDef, fieldPrefix: string = '') => {
    const fieldKey = fieldPrefix ? `${fieldPrefix}_${field.key}` : field.key;
    const fieldId = `${prefix}-${fieldKey}`;
    const value = data[fieldKey] || '';
    const changed = isChanged(baseSetup, fieldKey, value);
    const curLabelClass = changed ? changedLabelClass : labelClass;
    const curInputClass = changed ? changedInputClass : inputClass;

    // Toe field - positive values with In/Out selector
    // Compact single-column layout; selected value rendered with larger, bold text
    // so the chosen fraction is clearly readable once picked.
    if (field.key === 'toe' && field.type === 'select') {
      const dirChanged = isChanged(baseSetup, 'toe_direction', data['toe_direction'] || '');
      const anyChanged = changed || dirChanged;
      const toeSelectBase = "px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-base font-semibold text-[#1A1B23] bg-[#F9FAFB]";
      const toeSelectChanged = "px-3 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-base font-bold text-amber-900 bg-amber-50 border-amber-400";
      const dirSelectBase = "px-2 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-sm font-semibold text-[#1A1B23] bg-[#F9FAFB] border-[#E5E7EB]";
      const dirSelectChanged = "px-2 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm font-bold text-amber-900 bg-amber-50 border-amber-400";
      return (
        <div key={fieldKey}>
          <label className={anyChanged ? changedLabelClass : labelClass}>
            {field.label}{anyChanged && <ChangedBadge />}
          </label>
          <div className="flex gap-1.5">
            <select
              id={fieldId}
              value={value}
              onChange={(e) => onChange(fieldKey, e.target.value)}
              className={`${changed ? toeSelectChanged : toeSelectBase} flex-1 min-w-0`}
              aria-label="Toe amount"
            >
              {toeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              id={`${fieldId}-direction`}
              value={data['toe_direction'] || ''}
              onChange={(e) => onChange('toe_direction', e.target.value)}
              className={`${dirChanged ? dirSelectChanged : dirSelectBase} w-14 flex-shrink-0`}
              aria-label="Toe direction"
            >
              <option value="">--</option>
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </div>
        </div>
      );
    }


    // Ride height fields - fraction selector
    if ((field.key === 'front_ride_height' || field.key === 'rear_ride_height') && field.type === 'select') {
      return (
        <div key={fieldKey}>
          <label htmlFor={fieldId} className={curLabelClass}>{field.label}{changed && <ChangedBadge />}</label>
          <select id={fieldId} value={value} onChange={(e) => onChange(fieldKey, e.target.value)} className={curInputClass}>
            {rideHeightOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={fieldKey}>
          <label htmlFor={fieldId} className={curLabelClass}>{field.label}{changed && <ChangedBadge />}</label>
          <select id={fieldId} value={value} onChange={(e) => onChange(fieldKey, e.target.value)} className={curInputClass}>
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={fieldKey}>
        <label htmlFor={fieldId} className={curLabelClass}>{field.label}{changed && <ChangedBadge />}</label>
        <input
          id={fieldId}
          type="text"
          inputMode={field.type === 'number' ? 'decimal' : 'text'}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={curInputClass}
          placeholder={field.placeholder || '--'}
        />
      </div>
    );
  }, [data, onChange, prefix, baseSetup]);

  const sectionIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );

  const showCwTurns = activeTab === 'heat' || activeTab === 'main';

  return (
    <div className="space-y-6">
      {baseSetup && (activeTab === 'heat' || activeTab === 'main') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-amber-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span><strong>Changes from {baseLabel}</strong> are highlighted in amber.</span>
        </div>
      )}



      {/* General Chassis */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="general-chassis-heading">
        <h3 id="general-chassis-heading" className={sectionHeaderClass}>
          {sectionIcon}
          General Chassis
        </h3>
        <fieldset>
          <legend className="sr-only">General chassis settings</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {config.generalFields.map(f => renderField(f))}
          </div>
        </fieldset>
      </section>

      {/* Four Corners - LF on LEFT, RF on RIGHT */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="four-corners-heading">
        <h3 id="four-corners-heading" className={sectionHeaderClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><circle cx="15.5" cy="8.5" r="1.5" /><circle cx="8.5" cy="15.5" r="1.5" /><circle cx="15.5" cy="15.5" r="1.5" />
          </svg>
          Four Corners
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CornerCard title="Left Front (LF)" cornerPrefix="lf" color="#00A8E8" legendId="lf-legend"
            fields={config.frontCornerFields} data={data} onChange={onChange} prefix={prefix}
            showCwTurns={showCwTurns} baseSetup={baseSetup} />
          <CornerCard title="Right Front (RF)" cornerPrefix="rf" color="#00A8E8" legendId="rf-legend"
            fields={config.frontCornerFields} data={data} onChange={onChange} prefix={prefix}
            showCwTurns={showCwTurns} baseSetup={baseSetup} />
          <CornerCard title="Left Rear (LR)" cornerPrefix="lr" color="#6B7280" legendId="lr-legend"
            fields={config.rearCornerFields} data={data} onChange={onChange} prefix={prefix}
            showCwTurns={showCwTurns} baseSetup={baseSetup} />
          <CornerCard title="Right Rear (RR)" cornerPrefix="rr" color="#6B7280" legendId="rr-legend"
            fields={config.rearCornerFields} data={data} onChange={onChange} prefix={prefix}
            showCwTurns={showCwTurns} baseSetup={baseSetup} />
        </div>
      </section>

      {/* Suspension & Drivetrain */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="suspension-heading">
        <h3 id="suspension-heading" className={sectionHeaderClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Suspension & Drivetrain
        </h3>
        <fieldset>
          <legend className="sr-only">Suspension and drivetrain settings</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {config.suspensionFields.map(f => renderField(f))}
          </div>
        </fieldset>
      </section>

      {/* Extra Class-Specific Sections */}
      {config.extraSections.map(section => (
        <section key={section.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby={`${section.id}-heading`}>
          <h3 id={`${section.id}-heading`} className={sectionHeaderClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {section.icon === 'weight' ? (
                <><path d="M12 3v18" /><path d="M5 8l7-5 7 5" /><path d="M3 17h4l1-3h8l1 3h4" /></>
              ) : section.icon === 'wing' ? (
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              ) : section.icon === 'gear' ? (
                <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>
              ) : (
                <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></>
              )}
            </svg>
            {section.title}
          </h3>
          <fieldset>
            <legend className="sr-only">{section.title} settings</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {section.fields.map(f => renderField(f))}
            </div>
          </fieldset>
        </section>
      ))}

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="custom-fields-heading">
          <h3 id="custom-fields-heading" className={sectionHeaderClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Custom Fields
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {customFields.map(field => {
              const fieldId = `${prefix}-custom-${field.id}`;
              const fkey = `custom_${field.id}`;
              const val = data[fkey] || '';
              const changed = isChanged(baseSetup, fkey, val);
              return (
                <div key={field.id}>
                  <label htmlFor={fieldId} className={changed ? changedLabelClass : labelClass}>
                    {field.name}{changed && <ChangedBadge />}
                  </label>
                  <input
                    id={fieldId}
                    type="text"
                    inputMode={field.type === 'number' ? 'decimal' : 'text'}
                    value={val}
                    onChange={(e) => onChange(fkey, e.target.value)}
                    className={changed ? changedInputClass : inputClass}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="notes-heading">
        <h3 id="notes-heading" className={sectionHeaderClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Notes
        </h3>
        <label htmlFor={`${prefix}-notes`} className="sr-only">Setup notes</label>
        <textarea
          id={`${prefix}-notes`}
          value={data.notes || ''}
          onChange={(e) => onChange('notes', e.target.value)}
          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm resize-none placeholder-[#9CA3AF]"
          rows={3}
          placeholder="Add any notes about this setup, track conditions, or observations..."
        />
      </section>
    </div>
  );
};

export default ChassisSetupForm;
