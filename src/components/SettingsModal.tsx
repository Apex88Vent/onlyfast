import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  AccountStatus,
  deriveAccountStatus,
  fetchUserSubscription,
} from '@/lib/subscription';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user }) => {
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Subscription state (read-only display, sourced from user_subscriptions).
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const meta: any = user.user_metadata || {};
      const localOverride = (() => {
        try { return localStorage.getItem(`nickname_override_${user.id}`) || ''; } catch { return ''; }
      })();
      setNickname(localOverride || meta.nickname || (user.email?.split('@')[0] || ''));
      setMessage('');
      setSubError('');

      // Load subscription status from public.user_subscriptions.
      setSubLoading(true);
      fetchUserSubscription(user.id)
        .then((row) => setAccount(deriveAccountStatus(row, meta)))
        .catch(() => setAccount(deriveAccountStatus(null, meta)))
        .finally(() => setSubLoading(false));
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

    let localSaved = false;
    try {
      localStorage.setItem(`nickname_override_${user.id}`, trimmed);
      localSaved = true;
    } catch { /* ignore */ }

    try {
      window.dispatchEvent(new CustomEvent('nickname-updated', {
        detail: { userId: user.id, nickname: trimmed },
      }));
    } catch {/* non-fatal */}

    let remoteOk = false;
    let remoteErrMsg = '';
    try {
      const updatePromise = supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), nickname: trimmed },
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Gateway timeout (10s)') }), 10000)
      );
      const result: any = await Promise.race([updatePromise, timeoutPromise]);
      if (result?.error) {
        remoteErrMsg = result.error.message || 'Update failed';
      } else {
        remoteOk = true;
      }
    } catch (err: any) {
      remoteErrMsg = err?.message || 'Update failed';
    }

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

  // Open the Stripe Billing Portal so the user can manage / cancel.
  const handleManageBilling = async () => {
    setSubError('');
    setPortalLoading(true);
    try {
      // Require a logged-in session and pass the access token explicitly.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('You must be logged in to manage billing.');
      }

      const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) {
        throw new Error((data as any)?.error || 'Could not open the billing portal.');
      }
      window.location.href = url;
    } catch (err: any) {
      setSubError(err?.message || 'Unable to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };


  const planBadge = (() => {
    if (!account) return null;
    const styles: Record<string, string> = {
      Admin: 'bg-purple-100 text-purple-700 border-purple-200',
      Pro: 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30',
      Teams: 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30',
      Free: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${styles[account.label]}`}>
        {account.label}
      </span>
    );
  })();

  const hasStripeCustomer = Boolean(account?.row?.stripe_customer_id);

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
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Subscription</h3>

            <div className="rounded-xl border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
              {subLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <span className="h-4 w-4 rounded-full border-2 border-[#00A8E8]/30 border-t-[#00A8E8] animate-spin" aria-hidden="true" />
                  Loading subscription…
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">Current plan</span>
                    {planBadge}
                  </div>

                  <p className="text-xs text-[#9CA3AF] mt-2">
                    {account?.label === 'Admin'
                      ? 'Admin full access — all features unlocked.'
                      : account?.label === 'Free'
                      ? 'You are on the free Rookie plan.'
                      : `Your ${account?.label} membership is active.`}
                  </p>

                  {subError && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
                      {subError}
                    </div>
                  )}

                  {hasStripeCustomer ? (
                    <button
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="mt-4 w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      {portalLoading ? 'Opening…' : 'Manage / Cancel Subscription'}
                    </button>
                  ) : account?.label === 'Free' ? (
                    <a
                      href="/pricing"
                      className="mt-4 block text-center w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Upgrade
                    </a>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
