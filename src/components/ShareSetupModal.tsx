import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

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
      setError('Failed to generate share link. Please try again.');
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

  const shareUrl = shareCode ? `${window.location.origin}?share=${shareCode}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}
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
          <p className="font-semibold text-sm text-[#1A1B23]">{setup?.track_name || 'Untitled Setup'}</p>
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
            <p className="text-sm text-[#6B7280] mt-2">Generating share link...</p>
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
                  className="bg-[#00A8E8]/10 hover:bg-[#00A8E8]/20 text-[#00A8E8] p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  aria-label="Copy share code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1">Share Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] bg-[#F9FAFB] truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-[#00A8E8] hover:bg-[#0090c7] text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF] text-center">
              Anyone with this link or code can view your setup. Share expires in 30 days.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ShareSetupModal;
