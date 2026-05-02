import React, { useEffect, useState } from 'react';

interface SaveSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
  currentSavedName?: string;
  saving?: boolean;
}

const SaveSetupModal: React.FC<SaveSetupModalProps> = ({
  isOpen, onClose, onSave, defaultName, currentSavedName, saving,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) setName(currentSavedName || defaultName || '');
  }, [isOpen, defaultName, currentSavedName]);

  if (!isOpen) return null;

  const isOverwrite = currentSavedName && name.trim() === currentSavedName.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || defaultName || 'Untitled Setup';
    onSave(finalName);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="save-modal-title" className="text-xl font-bold text-[#1A1B23]">
              {currentSavedName ? 'Update Setup' : 'Save Setup'}
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              {currentSavedName
                ? `Currently saved as "${currentSavedName}". Rename to save as new.`
                : 'Give your setup a name for easy retrieval.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#9CA3AF] hover:text-[#1A1B23] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="setup-name" className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">
            Setup Name
          </label>
          <input
            id="setup-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Eldora Hot Laps 4/14"
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm"
          />

          {currentSavedName && (
            <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${isOverwrite ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#00A8E8]/10 text-[#00A8E8] border border-[#00A8E8]/20'}`}>
              {isOverwrite
                ? `Will overwrite existing "${currentSavedName}".`
                : `Will save as new setup: "${name.trim() || '...'}"`}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              {saving ? 'Saving...' : isOverwrite ? 'Update Setup' : 'Save Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveSetupModal;
