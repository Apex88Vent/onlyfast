import React, { useState, useId } from 'react';

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number';
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  onAdd: (field: CustomField) => void;
  onRemove: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const CustomFieldManager: React.FC<CustomFieldManagerProps> = ({ fields, onAdd, onRemove, isOpen, onToggle }) => {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'number'>('text');
  const prefix = useId();

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({
      id: Date.now().toString(),
      name: newName.trim(),
      type: newType,
    });
    setNewName('');
    setNewType('text');
  };

  const panelId = `${prefix}-panel`;

  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm" aria-labelledby={`${prefix}-heading`}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        id={`${prefix}-heading`}
        className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00A8E8]"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="text-base font-bold text-[#1A1B23]">Custom Fields</span>
          <span className="bg-[#00A8E8]/10 text-[#00A8E8] text-xs font-semibold px-2 py-0.5 rounded-full" aria-label={`${fields.length} custom fields`}>
            {fields.length}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div id={panelId} className="px-4 pb-4 border-t border-[#E5E7EB] pt-4" role="region" aria-labelledby={`${prefix}-heading`}>
          {/* Add new field */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label htmlFor={`${prefix}-new-name`} className="sr-only">New field name</label>
              <input
                id={`${prefix}-new-name`}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Field name"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none text-sm text-[#1A1B23] bg-[#F9FAFB] placeholder-[#9CA3AF]"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label htmlFor={`${prefix}-new-type`} className="sr-only">Field type</label>
              <select
                id={`${prefix}-new-type`}
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'text' | 'number')}
                className="px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none text-sm text-[#1A1B23] bg-[#F9FAFB]"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              Add
            </button>
          </div>

          {/* Existing fields */}
          {fields.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-3">No custom fields yet. Add one above.</p>
          ) : (
            <ul className="space-y-2" aria-label="Custom fields list">
              {fields.map(field => (
                <li key={field.id} className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2 border border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1A1B23]">{field.name}</span>
                    <span className="text-xs text-[#9CA3AF] bg-[#F0F0F2] px-2 py-0.5 rounded">{field.type}</span>
                  </div>
                  <button
                    onClick={() => onRemove(field.id)}
                    className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove ${field.name} field`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default CustomFieldManager;
