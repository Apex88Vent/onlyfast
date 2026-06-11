import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { openSetupPdf } from '@/lib/setupPdf';

interface ShareSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  setup: any;
  user: User | null;
}

const ShareSetupModal: React.FC<ShareSetupModalProps> = ({ isOpen, onClose, setup, user }) => {
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
      generateShareCode();
    } else {
      setShareCode('');
      setCopied(false);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const generateShareCode = async () => {
    if (!user || !setup?.id) return;
    setLoading(true);
    setError('');

    try {
      // Check if already shared
      const { data: existing } = await supabase
        .from('shared_setups')
        .select('share_code')
        .eq('setup_id', setup.id)
        .eq('shared_by', user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setShareCode(existing[0].share_code);
        setLoading(false);
        return;
      }

      // Generate new share code
      const code = generateCode();
      const { error: insertError } = await supabase
        .from('shared_setups')
        .insert({
          setup_id: setup.id,
          shared_by: user.id,
          shared_by_email: user.email,
          share_code: code,
          is_public: true,
        });

      if (insertError) throw insertError;
      setShareCode(code);
    } catch (err: any) {
      setError('Failed to generate share code. Please try again.');
    }
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const input = document.createElement('input');
      input.value = shareCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Save as PDF — uses the shared chassis-diagram setup sheet builder.
  const handleSaveAsPdf = () => {
    if (!setup) return;
    const ok = openSetupPdf(setup, { shareCode });
    if (!ok) alert('Pop-up blocked. Please allow pop-ups for this site to save as PDF.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="share-modal-title" className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Setup
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1A1B23] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            aria-label="Close share modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Setup Info */}
        <div className="bg-[#F9FAFB] rounded-xl p-4 mb-4 border border-[#E5E7EB]">
          <p className="font-semibold text-sm text-[#1A1B23]">{setup?.setup_name || setup?.track_name || 'Untitled Setup'}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
            <span className={`font-medium px-1.5 py-0.5 rounded ${
              setup?.setup_type === 'main' ? 'bg-[#00A8E8]/10 text-[#00A8E8]' :
              setup?.setup_type === 'heat' ? 'bg-amber-100 text-amber-700' :
              'bg-[#F0F0F2] text-[#6B7280]'
            }`}>
              {setup?.setup_type === 'main' ? 'Main Event' : setup?.setup_type === 'heat' ? 'Heat' : 'Base'}
            </span>
            <span>{setup?.race_class}</span>
            <span>{setup?.race_date}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6" role="status">
            <svg className="animate-spin h-6 w-6 mx-auto text-[#00A8E8]" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#6B7280] mt-2">Generating share code...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={generateShareCode} className="mt-2 text-sm text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1">
              Try Again
            </button>
          </div>
        ) : shareCode ? (
          <div className="space-y-4">
            {/* Share Code */}
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">Share Code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-4 py-3 font-mono text-lg font-bold text-[#1A1B23] text-center tracking-widest">
                  {shareCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                    copied ? 'bg-green-500 text-white' : 'bg-[#00A8E8]/10 hover:bg-[#00A8E8]/20 text-[#00A8E8]'
                  }`}
                  aria-label="Copy share code"
                >
                  {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF] text-center">
              Anyone with this code can view your setup. Share expires in 30 days.
            </p>
          </div>
        ) : null}

        {/* Save as PDF — always available, doesn't require a share code */}
        <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
          <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-2">
            Export
          </label>
          <button
            onClick={handleSaveAsPdf}
            className="w-full bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#1A1B23] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            title="Opens a print-friendly setup sheet. Choose 'Save as PDF' as the destination in the print dialog."
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
            Save / Share as PDF
          </button>
          <p className="text-[10px] text-[#9CA3AF] text-center mt-1.5">
            Opens your browser's print dialog. Choose <strong>Save as PDF</strong> as the destination.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareSetupModal;
