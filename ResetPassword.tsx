import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const navigate = useNavigate();

  // Supabase includes the access_token in the URL hash on email redirect.
  // The JS client automatically picks it up and creates a session via
  // detectSessionInUrl. We just verify we have an authenticated session.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Parse the hash manually as a safety net in case auto-detection is off.
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const type = params.get('type');

          if (access_token && refresh_token) {
            try {
              await supabase.auth.setSession({ access_token, refresh_token });
            } catch {
              // non-fatal — detectSessionInUrl may already have handled it
            }
          }

          if (type && type !== 'recovery') {
            // fine — just means user landed here for another reason; still allow
          }
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          setTokenReady(true);
        } else {
          setTokenError(
            'This password reset link is invalid or has expired. Please request a new one.'
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setTokenError(err.message || 'Unable to verify reset link.');
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess('Password updated! Redirecting to the app…');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E5E7EB] overflow-hidden">
        <div className="bg-[#F5F5F7] px-6 py-6 text-center border-b border-[#E5E7EB]">
          <h1 className="text-lg font-bold text-[#1A1B23] mb-1">Reset Your Password</h1>
          <p className="text-[#6B7280] text-sm">Choose a new password to finish signing in.</p>
        </div>

        <div className="p-6 space-y-4">
          {tokenError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {tokenError}
              <div className="mt-3">
                <button
                  onClick={() => navigate('/', { replace: true })}
                  className="text-[#00A8E8] text-sm font-semibold hover:underline"
                >
                  Return to app
                </button>
              </div>
            </div>
          )}

          {!tokenError && !tokenReady && (
            <div className="text-sm text-[#6B7280] py-4 text-center">
              Verifying reset link…
            </div>
          )}

          {tokenReady && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div role="status" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[#4B5563] mb-1">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none bg-[#F9FAFB]"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-[#4B5563] mb-1">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none bg-[#F9FAFB]"
                  placeholder="Re-enter new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
