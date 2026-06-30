import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  AccountStatus,
  deriveAccountStatus,
  fetchUserSubscription,
} from '@/lib/subscription';
import { hideExternalPayments, nativeBillingMessage } from '@/lib/paymentVisibility';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const SUPPORT_EMAIL = 'admin@onlyfast.app';

const clearDeletedAccountLocalState = (userId: string) => {
  const shouldRemoveKey = (key: string) => (
    key.startsWith('onlyfast_') ||
    key.startsWith('nickname_override_') ||
    key.startsWith('car_number_override_') ||
    (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
    key === 'pending_plan_redirect' ||
    key.includes(userId)
  );

  const clearStorage = (storage: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    keys.forEach((key) => {
      if (shouldRemoveKey(key)) storage.removeItem(key);
    });
  };

  try { clearStorage(localStorage); } catch { /* ignore */ }
  try { clearStorage(sessionStorage); } catch { /* ignore */ }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user }) => {
  const [nickname, setNickname] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Subscription state (read-only display, sourced from user_subscriptions).
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  // Smaller "Cancel Subscription" secondary action → confirm before acting.
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);


  useEffect(() => {
    if (isOpen && user) {
      const meta: any = user.user_metadata || {};
      const localOverride = (() => {
        try { return localStorage.getItem(`nickname_override_${user.id}`) || ''; } catch { return ''; }
      })();
      const localCarNumber = (() => {
        try { return localStorage.getItem(`car_number_override_${user.id}`); } catch { return null; }
      })();
      setNickname(localOverride || meta.nickname || (user.email?.split('@')[0] || ''));
      setCarNumber(localCarNumber !== null ? localCarNumber : (meta.car_number || ''));
      setMessage('');
      setSubError('');
      setDeleteError('');
      setDeleteConfirmText('');
      setDeleteConfirmOpen(false);

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

  const handleSaveProfile = async () => {
    const trimmed = nickname.trim();
    const trimmedCarNumber = carNumber.trim();
    if (!trimmed) { setMessage('Nickname cannot be empty'); return; }
    if (trimmed.length < 2) { setMessage('Nickname must be at least 2 characters'); return; }
    if (trimmedCarNumber.length > 12) { setMessage('Car number must be 12 characters or less'); return; }

    setSaving(true);
    setMessage('');

    let localSaved = false;
    try {
      localStorage.setItem(`nickname_override_${user.id}`, trimmed);
      localStorage.setItem(`car_number_override_${user.id}`, trimmedCarNumber);
      localSaved = true;
    } catch { /* ignore */ }

    try {
      window.dispatchEvent(new CustomEvent('nickname-updated', {
        detail: { userId: user.id, nickname: trimmed },
      }));
    } catch {/* non-fatal */}

    try {
      window.dispatchEvent(new CustomEvent('car-number-updated', {
        detail: { userId: user.id, carNumber: trimmedCarNumber },
      }));
    } catch {/* non-fatal */}

    let remoteOk = false;
    let remoteErrMsg = '';
    try {
      const updatePromise = supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), nickname: trimmed, car_number: trimmedCarNumber },
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
      setMessage('Profile saved');
      setTimeout(() => setMessage(''), 2500);
    } else if (localSaved) {
      setMessage('Profile saved locally (sync pending - will retry)');
      setTimeout(() => setMessage(''), 3500);
    } else {
      setMessage('Error: ' + remoteErrMsg);
    }

    setSaving(false);
  };

  const readFunctionError = async (error: any, fallback: string): Promise<string> => {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return text;
        } catch {/* ignore */}
      }
    }
    return error?.message || fallback;
  };

  // Open the Stripe Billing Portal so the user can manage / cancel.
  const handleManageBilling = async () => {
    setSubError('');
    if (hideExternalPayments) {
      setSubError(nativeBillingMessage);
      return;
    }

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
      if (error) {
        throw new Error(await readFunctionError(error, 'Unable to open billing portal. Please try again.'));
      }
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('You must be logged in to delete your account.');
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        throw new Error(await readFunctionError(error, 'Unable to delete your account. Please try again.'));
      }
      if (!(data as any)?.ok) {
        throw new Error((data as any)?.error || 'Unable to delete your account. Please try again.');
      }

      try { await supabase.auth.signOut(); } catch { /* auth user may already be deleted */ }
      clearDeletedAccountLocalState(user.id);
      setDeleteConfirmOpen(false);
      setMessage('Account deleted. Returning to OnlyFast...');
      setTimeout(() => { window.location.assign('/'); }, 300);
    } catch (err: any) {
      setDeleteError(err?.message || `Unable to delete your account. Please contact ${SUPPORT_EMAIL}.`);
      setDeleteLoading(false);
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

          {/* Profile */}
          <section>
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Profile</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_auto]">
              <div>
                <label htmlFor="settings-nickname" className="block text-xs font-semibold text-[#6B7280] mb-1">Nickname</label>
                <input
                  id="settings-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none bg-[#F9FAFB] text-sm"
                  placeholder="Your nickname"
                />
              </div>
              <div>
                <label htmlFor="settings-car-number" className="block text-xs font-semibold text-[#6B7280] mb-1">Car Number</label>
                <input
                  id="settings-car-number"
                  type="text"
                  value={carNumber}
                  onChange={(e) => setCarNumber(e.target.value)}
                  maxLength={12}
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none bg-[#F9FAFB] text-sm"
                  placeholder="#88M"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="self-end bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
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
                      : account?.label === 'Teams'
                      ? 'Your Team membership is active.'
                      : account?.label === 'Pro'
                      ? 'Your Pro membership is active.'
                      : 'You are on the free Rookie plan.'}
                  </p>

                  {/* Plan feature summary (display only). */}
                  {account?.label === 'Teams' && (
                    <ul className="text-xs text-[#6B7280] mt-2 space-y-1 list-disc pl-4">
                      <li>Everything in Pro</li>
                      <li>Unlimited cars &amp; classes for your team</li>
                      <li>Shared team setups &amp; comparisons</li>
                    </ul>
                  )}
                  {account?.label === 'Pro' && (
                    <ul className="text-xs text-[#6B7280] mt-2 space-y-1 list-disc pl-4">
                      <li>Save unlimited race-day setups</li>
                      <li>AI handling feedback &amp; suggestions</li>
                      <li>Ad-free experience</li>
                    </ul>
                  )}

                  {subError && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
                      {subError}
                    </div>
                  )}

                  {/* Admin keeps full access and is never shown upgrade/cancel. */}
                  {account?.label !== 'Admin' && (
                    hideExternalPayments ? (
                      <div className="mt-4 rounded-lg border border-[#D7EEF8] bg-[#F3FBFE] px-3 py-2 text-xs font-semibold text-[#1A1B23]">
                        {nativeBillingMessage}
                      </div>
                    ) : (
                    <>
                      {/* PRIMARY: Upgrade Subscription → Rookie / Pro / Team selection page. */}
                      <a
                        href="/pricing"
                        className="mt-4 block text-center w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Upgrade Subscription
                      </a>

                      {/* SECONDARY (smaller link): Cancel Subscription — shown for
                          ALL paid members (Pro AND Teams). Previously this was gated
                          on a Stripe customer id, which hid the link for Teams users
                          whose plan wasn't tied to a Stripe customer record. Confirms,
                          then routes through the existing Stripe billing portal where
                          the cancellation is processed. Once Stripe reports the
                          subscription inactive, the app falls back to Rookie
                          automatically (deriveAccountStatus). */}
                      {(account?.label === 'Pro' || account?.label === 'Teams' || hasStripeCustomer) && (
                        <button
                          onClick={() => { setSubError(''); setCancelConfirmOpen(true); }}
                          disabled={portalLoading}
                          className="mt-2 mx-auto block text-xs text-[#9CA3AF] hover:text-red-600 underline underline-offset-2 transition-colors disabled:opacity-50"
                        >
                          {portalLoading ? 'Opening…' : 'Cancel Subscription'}
                        </button>
                      )}
                    </>
                    )
                  )}
                </>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Support</h3>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="block rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm font-semibold text-[#00A8E8] hover:border-[#00A8E8]/40 hover:bg-[#00A8E8]/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            >
              Contact Support
            </a>
            <p className="text-xs text-[#9CA3AF] mt-2">
              For account, billing, privacy, or data requests.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-[#1A1B23] mb-2">Account deletion</h3>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs text-red-800">
                Permanently delete your OnlyFast account and app data. This does not cancel any
                active Stripe subscription, so manage billing first or contact support.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setDeleteConfirmText('');
                  setDeleteConfirmOpen(true);
                }}
                className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete Account
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Delete account">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-2">Delete your account?</h4>
            <p className="text-sm text-[#374151]">
              This permanently deletes your OnlyFast account, saved setups, schedule, parts,
              shared setup links, and usage records.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Deleting your account does not cancel an active Stripe subscription. Manage or
              cancel billing first, or contact {SUPPORT_EMAIL}.
            </p>
            <label htmlFor="delete-account-confirm" className="mt-4 block text-xs font-semibold text-[#6B7280]">
              Type DELETE to confirm
            </label>
            <input
              id="delete-account-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                if (deleteError) setDeleteError('');
              }}
              disabled={deleteLoading}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500 disabled:opacity-60"
              autoComplete="off"
            />
            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  if (deleteLoading) return;
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] disabled:opacity-50"
              >
                Keep Account
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.trim() !== 'DELETE'}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SUBSCRIPTION CONFIRMATION */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Cancel subscription">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-2">Cancel your subscription?</h4>
            <p className="text-sm text-[#374151]">
              You'll be taken to the secure billing portal to confirm cancellation.
              After it's cancelled, your account returns to the free Rookie plan.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setCancelConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => { setCancelConfirmOpen(false); handleManageBilling(); }}
                disabled={portalLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default SettingsModal;
