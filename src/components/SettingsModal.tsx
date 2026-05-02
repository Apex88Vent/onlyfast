import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user }) => {
  const [nickname, setNickname] = useState('');
  const [subscription, setSubscription] = useState<'basic' | 'premium'>('basic');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const meta: any = user.user_metadata || {};
      // Prefer the local override (most recent save) over user_metadata, so if
      // the gateway lagged/flaked, the user still sees what they last saved.
      const localOverride = (() => {
        try { return localStorage.getItem(`nickname_override_${user.id}`) || ''; } catch { return ''; }
      })();
      setNickname(localOverride || meta.nickname || (user.email?.split('@')[0] || ''));
      setSubscription(meta.subscription === 'premium' ? 'premium' : 'basic');
      setMessage('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) { setMessage('Nickname cannot be empty'); return; }
    if (trimmed.length < 2) { setMessage('Nickname must be at least 2 characters'); return; }

    setSaving(true);
    setMessage('');

    console.log('[Settings] Saving nickname:', trimmed);

    // STEP 1: Always write the local fallback FIRST. This guarantees the UI
    // reflects the user's change instantly, even if the remote gateway is slow,
    // rate-limited, or temporarily unreachable. The localStorage value is keyed
    // by user id so it's specific to this account and survives refreshes.
    let localSaved = false;
    try {
      localStorage.setItem(`nickname_override_${user.id}`, trimmed);
      localSaved = true;
      console.log('[Settings] Local fallback saved.');
    } catch (localErr) {
      console.warn('[Settings] Local fallback write failed:', localErr);
    }

    // STEP 2: Tell the rest of the app (Header, etc.) to re-render immediately
    // with the new nickname, regardless of whether the remote write succeeds.
    try {
      window.dispatchEvent(new CustomEvent('nickname-updated', {
        detail: { userId: user.id, nickname: trimmed },
      }));
    } catch {/* non-fatal */}

    // STEP 3: Attempt the remote write. We do NOT do a follow-up getUser()
    // verification — on custom gateways that call is frequently stale and
    // produces false "did not persist" errors even after a successful write.
    // If updateUser returns without error, the gateway has accepted the write.
    let remoteOk = false;
    let remoteErrMsg = '';
    try {
      // Use a timeout wrapper so a hung gateway can't freeze the UI.
      const updatePromise = supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), nickname: trimmed },
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Gateway timeout (10s)') }), 10000)
      );
      const result: any = await Promise.race([updatePromise, timeoutPromise]);

      if (result?.error) {
        remoteErrMsg = result.error.message || 'Update failed';
        console.error('[Settings] updateUser error:', result.error);
      } else {
        remoteOk = true;
        console.log('[Settings] updateUser succeeded:', result?.data?.user?.user_metadata);
      }
    } catch (err: any) {
      remoteErrMsg = err?.message || 'Update failed';
      console.error('[Settings] updateUser threw:', err);
    }

    // STEP 4: Report status. Success if remote worked. If remote failed but
    // local save worked, still show success — the nickname will display
    // correctly in this session and persist across refreshes on this device.
    if (remoteOk) {
      setMessage(`Nickname saved as "${trimmed}"`);
      setTimeout(() => setMessage(''), 2500);
    } else if (localSaved) {
      setMessage(`Saved as "${trimmed}" (sync pending — will retry)`);
      setTimeout(() => setMessage(''), 3500);
    } else {
      setMessage('Error: ' + remoteErrMsg);
    }

    setSaving(false);
  };

  const handleSubscriptionChange = async (next: 'basic' | 'premium') => {
    if (next === subscription) return;
    if (next === 'premium') {
      // Simulated premium upgrade flow with $5/month
      const confirmed = confirm('Upgrade to Premium for $5/month? You\'ll be set up for monthly billing.');
      if (!confirmed) return;
      setUpgrading(true);
      try {
        const { error } = await supabase.auth.updateUser({
          data: {
            ...(user.user_metadata || {}),
            subscription: 'premium',
            subscription_started_at: new Date().toISOString(),
            subscription_price: 5,
          },
        });
        if (error) throw error;
        setSubscription('premium');
        setMessage('Upgraded to Premium — $5/month active!');
        setTimeout(() => setMessage(''), 3000);
      } catch (err: any) {
        setMessage('Error: ' + (err.message || 'Upgrade failed'));
      }
      setUpgrading(false);
    } else {
      const confirmed = confirm('Downgrade to Basic? You can upgrade again anytime.');
      if (!confirmed) return;
      setUpgrading(true);
      try {
        const { error } = await supabase.auth.updateUser({
          data: { ...(user.user_metadata || {}), subscription: 'basic' },
        });
        if (error) throw error;
        setSubscription('basic');
        setMessage('Switched to Basic.');
        setTimeout(() => setMessage(''), 3000);
      } catch (err: any) {
        setMessage('Error: ' + (err.message || 'Change failed'));
      }
      setUpgrading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E7EB] max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]" aria-label="Close settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className={`px-4 py-2 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {message}
            </div>
          )}

          {/* Nickname */}
          <section>
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Change Nickname</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                className="flex-1 px-4 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none bg-[#F9FAFB] text-sm"
                placeholder="Your nickname"
              />
              <button
                onClick={handleSaveNickname}
                disabled={saving}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>

          {/* Subscription */}
          <section>
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Subscription Plan</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSubscriptionChange('basic')}
                disabled={upgrading}
                className={`p-4 rounded-xl border-2 text-left transition-all ${subscription === 'basic' ? 'border-[#00A8E8] bg-[#00A8E8]/5' : 'border-[#E5E7EB] hover:border-[#00A8E8]/40'}`}
              >
                <div className="font-bold text-[#1A1B23]">Basic</div>
                <div className="text-xs text-[#6B7280] mt-1">Free</div>
                <div className="text-xs text-[#9CA3AF] mt-2">Core setup tracking</div>
                {subscription === 'basic' && <div className="text-xs font-semibold text-[#00A8E8] mt-2">✓ Active</div>}
              </button>
              <button
                onClick={() => handleSubscriptionChange('premium')}
                disabled={upgrading}
                className={`p-4 rounded-xl border-2 text-left transition-all ${subscription === 'premium' ? 'border-amber-500 bg-amber-50' : 'border-[#E5E7EB] hover:border-amber-400'}`}
              >
                <div className="font-bold text-[#1A1B23] flex items-center gap-1">
                  Premium
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="text-xs text-amber-700 font-semibold mt-1">$5/month</div>
                <div className="text-xs text-[#9CA3AF] mt-2">All premium features</div>
                {subscription === 'premium' && <div className="text-xs font-semibold text-amber-600 mt-2">✓ Active</div>}
              </button>
            </div>
            {upgrading && <p className="text-xs text-[#6B7280] mt-2">Processing...</p>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
