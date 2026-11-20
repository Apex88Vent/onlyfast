import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabase';

const LOGO_URL = '/onlyfast-logo.png';
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

const DeleteAccount: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Delete Account | OnlyFast';

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setAuthModalOpen(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null))
      .finally(() => setLoadingAuth(false));

    return () => subscription.unsubscribe();
  }, []);

  const readFunctionError = async (functionError: any, fallback: string): Promise<string> => {
    const context = functionError?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return text;
        } catch { /* ignore */ }
      }
    }
    return functionError?.message || fallback;
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (confirmText.trim() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('You must be logged in to delete your account.');
      }

      const { data, error: functionError } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (functionError) {
        throw new Error(await readFunctionError(functionError, 'Unable to delete your account. Please try again.'));
      }
      if (!(data as any)?.ok) {
        throw new Error((data as any)?.error || 'Unable to delete your account. Please try again.');
      }

      try { await supabase.auth.signOut(); } catch { /* auth user may already be deleted */ }
      clearDeletedAccountLocalState(user.id);
      setUser(null);
      setConfirmText('');
      setMessage('Account deleted. Returning to OnlyFast...');
      window.setTimeout(() => { window.location.assign('/'); }, 600);
    } catch (err: any) {
      setError(err?.message || `Unable to delete your account. Please contact ${SUPPORT_EMAIL}.`);
      setDeleteLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5F7] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 border-b border-[#E5E7EB] pb-5">
          <Link to="/" className="inline-flex items-center">
            <img src={LOGO_URL} alt="OnlyFast" className="h-12 w-auto" />
          </Link>
          <h1 className="mt-5 text-3xl font-bold text-[#1A1B23]">Delete Account</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
            You can permanently delete your OnlyFast account and app data from this page.
          </p>
        </header>

        <div className="space-y-5 text-sm leading-relaxed text-[#4B5563]">
          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">What gets deleted</h2>
            <p className="mt-2">
              Deleting your account removes your OnlyFast profile, saved setups, race schedule,
              parts reference data, shared setup links, subscription status records, and usage
              records associated with your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">Before you delete</h2>
            <p className="mt-2">
              Account deletion does not cancel an active Stripe, Apple, or Google subscription.
              Please manage or cancel billing first, or contact support at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-[#00A8E8] underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h2 className="text-base font-bold text-red-900">Permanent deletion</h2>
            <p className="mt-2 text-red-800">
              This action cannot be undone. If you are signed in and want to continue, type DELETE
              below and confirm deletion.
            </p>

            {loadingAuth ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-800">
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-700 animate-spin" aria-hidden="true" />
                Checking sign-in status...
              </div>
            ) : user ? (
              <>
                <p className="mt-4 text-xs font-semibold text-red-900">
                  Signed in as {user.email || 'your OnlyFast account'}
                </p>
                <label htmlFor="delete-account-confirm" className="mt-4 block text-xs font-semibold text-red-900">
                  Type DELETE to confirm
                </label>
                <input
                  id="delete-account-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(event) => {
                    setConfirmText(event.target.value);
                    if (error) setError('');
                  }}
                  disabled={deleteLoading}
                  className="mt-1 w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-[#1A1B23] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500 disabled:opacity-60"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || confirmText.trim() !== 'DELETE'}
                  className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Account'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-4 rounded-lg bg-[#00A8E8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                Sign in to delete account
              </button>
            )}

            {message && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {message}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 border-t border-[#E5E7EB] pt-5">
          <Link
            to="/"
            className="text-sm font-semibold text-[#00A8E8] underline-offset-2 hover:underline"
          >
            Back to OnlyFast
          </Link>
        </footer>
      </section>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </main>
  );
};

export default DeleteAccount;
