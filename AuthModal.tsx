import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (e.key === 'Tab' && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>('button, input');
        firstFocusable?.focus();
      });

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'signup') {
        if (!waiverAccepted) {
          setError('You must accept the liability waiver to create an account.');
          setLoading(false);
          return;
        }
        if (!nickname.trim()) {
          setError('Please enter a nickname.');
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              plan: 'full_access',
              nickname: nickname.trim(),
              subscription: 'basic',
            },
          },
        });
        if (error) throw error;

        // If a session was returned immediately (email confirmation disabled), the
        // signUp options.data is already on the user. But if the auto-confirm setting
        // is on and we land with a live session, defensively write nickname into
        // user_metadata via updateUser so it's guaranteed to persist even if the
        // initial signUp metadata write was dropped by a slow/unreachable backend.
        if (data?.session && data.user) {
          try {
            await supabase.auth.updateUser({
              data: {
                ...(data.user.user_metadata || {}),
                nickname: nickname.trim(),
                plan: 'full_access',
                subscription: (data.user.user_metadata as any)?.subscription || 'basic',
              },
            });
          } catch {
            // non-fatal — user_metadata was also set via signUp options.data
          }
        }

        setSuccess('Account created! Check your email to confirm.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === 'reset') {
        if (!email.trim()) {
          setError('Please enter your email address.');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess(
          `If an account exists for ${email}, we've sent a password reset link. Check your inbox.`
        );
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const emailId = 'auth-email';
  const passwordId = 'auth-password';
  const errorId = 'auth-error';
  const successId = 'auth-success';

  const title =
    mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password';
  const subtitle =
    mode === 'login'
      ? 'Sign in to save and share your setups'
      : mode === 'signup'
      ? 'All features included with your account'
      : "Enter your email and we'll send you a reset link";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby={error ? errorId : undefined}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-[#E5E7EB] max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-[#F5F5F7] px-6 py-6 text-center border-b border-[#E5E7EB]">
          <img
            src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
            alt="OnlyFast Setup Assist"
            className="h-[50px] mx-auto mb-3"
          />
          <h2 id="auth-modal-title" className="text-lg font-bold text-[#1A1B23] mb-1">{title}</h2>
          <p className="text-[#6B7280] text-sm">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {error && (
            <div id={errorId} role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div id={successId} role="status" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {success}
            </div>
          )}

          {mode === 'signup' && (
            <div className="flex items-center justify-center gap-2 bg-[#00A8E8]/5 rounded-lg px-4 py-2.5 border border-[#00A8E8]/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm font-semibold text-[#00A8E8]">Full Access - All Features Included</span>
            </div>
          )}

          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-[#4B5563] mb-1">Email</label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] placeholder-[#9CA3AF]"
              placeholder="racer@example.com"
              required
              autoComplete="email"
              aria-required="true"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-nickname" className="block text-sm font-medium text-[#4B5563] mb-1">Nickname</label>
              <input
                id="auth-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] placeholder-[#9CA3AF]"
                placeholder="Your racing nickname"
                required
                maxLength={30}
              />
              <p className="text-xs text-[#9CA3AF] mt-1">This is what we'll call you in the app</p>
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label htmlFor={passwordId} className="block text-sm font-medium text-[#4B5563] mb-1">Password</label>
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] placeholder-[#9CA3AF]"
                placeholder="Min 6 characters"
                minLength={6}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-required="true"
                aria-describedby="password-hint"
              />
              <p id="password-hint" className="text-xs text-[#9CA3AF] mt-1">Must be at least 6 characters</p>
              {mode === 'login' && (
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); setSuccess(''); setPassword(''); }}
                    className="text-xs text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-1"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <fieldset className="bg-red-50 border border-red-200 rounded-lg p-4">
              <legend className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2 px-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Liability Waiver & Disclaimer
              </legend>
              <div className="text-xs text-red-700 space-y-2 max-h-32 overflow-y-auto mb-3 pr-2" tabIndex={0} role="document" aria-label="Liability waiver text">
                <p><strong>WARNING: Motorsport racing is inherently dangerous and can result in serious injury or death.</strong></p>
                <p>By creating an account and using OnlyFast, you acknowledge and agree to the following:</p>
                <p>1. Racing on dirt tracks and any other racing surfaces involves significant risks, including but not limited to serious bodily injury, permanent disability, paralysis, and death.</p>
                <p>2. OnlyFast is a setup tracking and suggestion tool ONLY. The information, suggestions, and AI-generated recommendations provided by OnlyFast are for informational and reference purposes only.</p>
                <p>3. OnlyFast, its owners, developers, employees, and affiliates assume NO responsibility or liability for any injuries, damages, or death that may occur as a result of racing activities, regardless of whether the user followed suggestions provided by this application.</p>
                <p>4. The use of this tool in NO WAY guarantees driver safety, vehicle performance, or racing outcomes. All chassis setup decisions are made at the sole risk and discretion of the user.</p>
                <p>5. You assume all risks associated with motorsport racing and agree to hold OnlyFast harmless from any and all claims, damages, losses, or expenses arising from your participation in racing activities.</p>
                <p>6. You confirm that you are of legal age and have the authority to accept this waiver on your own behalf.</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waiverAccepted}
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  aria-required="true"
                />
                <span className="text-xs font-semibold text-red-800">
                  I have read, understand, and accept the liability waiver. I acknowledge that racing is dangerous and may result in serious injury or death, and that OnlyFast assumes no responsibility for my safety.
                </span>
              </label>
            </fieldset>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !waiverAccepted)}
            className="w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            aria-busy={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send reset link'}
          </button>

          <div className="text-center space-y-1">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                className="text-sm text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1 block w-full"
              >
                Don't have an account? Sign up
              </button>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setWaiverAccepted(false); }}
                className="text-sm text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1 block w-full"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="text-sm text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-2 py-1 block w-full"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>

        <div className="px-6 pb-4">
          <button
            onClick={onClose}
            className="w-full text-[#6B7280] hover:text-[#4B5563] text-sm py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
