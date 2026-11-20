import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/lib/paymentVisibility';
import { useEntrySession } from '@/hooks/useEntrySession';
import AuthModal from '@/components/AuthModal';
import Index from './Index';
import PublicHome from './PublicHome';

function BrowserEntry() {
  const { session, checking, error, recovery } = useEntrySession();
  const location = useLocation();
  const navigate = useNavigate();
  if (checking)
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" role="status">
        <span className="text-sm text-slate-600">Loading OnlyFast…</span>
      </div>
    );
  // Recovery links must reach the existing password form before any app redirect.
  if (recovery)
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  if (error)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Unable to check your session</h1>
        <p>Please check your connection and try again.</p>
        <button
          className="rounded-lg bg-sky-700 px-5 py-3 text-white"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  if (session) {
    if (location.pathname !== '/app')
      return <Navigate to={`/app${location.search}${location.hash}`} replace />;
    return <Index />;
  }
  if (location.pathname === '/') return <PublicHome />;
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
      <Link to="/" aria-label="OnlyFast homepage">
        <img src="/onlyfast-logo.png" alt="OnlyFast" className="w-52 mb-6" />
      </Link>
      <h1 className="text-2xl font-bold">Your next race starts here.</h1>
      <p className="mt-3 text-slate-600">Sign in to open your OnlyFast web app.</p>
      <AuthModal isOpen onClose={() => navigate('/', { replace: true })} />
    </div>
  );
}

export default function AppEntry() {
  // Native launch, onboarding, login and logout continue through AppLayout.
  // No session or subscription checks are skipped inside the existing app.
  return isNativeApp ? <Index /> : <BrowserEntry />;
}
