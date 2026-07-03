import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import SettingsModal from './SettingsModal';
import AppMenu, { MenuAction } from './AppMenu';
import { fetchUserSubscription, deriveAccountStatus } from '@/lib/subscription';
// --- DEV/DEMO test-account reset (remove/disable before production) ---
import { isTestAccount, ENABLE_TEST_ACCOUNT_RESET, resetTestAccountData } from '@/lib/testAccount';

// Display label for the membership badge shown next to the user's name.
type PlanLabel = 'Rookie' | 'Pro' | 'Team' | 'Admin';


interface HeaderProps {
  user: User | null;
  onSignInClick: () => void;
  selectedCar: string;
  onBackToCarSelect?: () => void;
  onOpenHowOnlyFastWorks?: () => void;
}

const getNickname = (user: User | null, override?: string): string => {
  if (!user) return '';
  if (override) return override;
  try {
    const local = localStorage.getItem(`nickname_override_${user.id}`);
    if (local && local.trim()) return local;
  } catch {/* ignore */}
  const meta: any = user.user_metadata || {};
  return meta.nickname || (user.email?.split('@')[0] || 'Racer');
};

const Header: React.FC<HeaderProps> = ({ user, onSignInClick, selectedCar, onBackToCarSelect, onOpenHowOnlyFastWorks }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>('home');
  const [nicknameOverride, setNicknameOverride] = useState<string>('');
  const [planLabel, setPlanLabel] = useState<PlanLabel | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // DEV/DEMO: shows "Resetting test account…" while the test account is reset on logout.
  const [resettingTestAccount, setResettingTestAccount] = useState(false);

  // Resolve the membership label (Rookie/Pro/Team/Admin) from user_subscriptions.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setPlanLabel(null); return; }
      try {
        const row = await fetchUserSubscription(user.id);
        const status = deriveAccountStatus(row, user.user_metadata || {});
        const label: PlanLabel =
          status.label === 'Admin' ? 'Admin'
          : status.label === 'Teams' ? 'Team'
          : status.label === 'Pro' ? 'Pro'
          : 'Rookie';
        if (!cancelled) setPlanLabel(label);
      } catch {
        if (!cancelled) setPlanLabel('Rookie');
      }
    };
    load();
    const onUpdated = () => load();
    window.addEventListener('subscription-updated', onUpdated);
    return () => { cancelled = true; window.removeEventListener('subscription-updated', onUpdated); };
  }, [user]);


  const handleSignOut = async () => {
    setShowDropdown(false);

    // --- DEV/DEMO test-account reset on logout ---------------------------
    // If the dedicated test account is logging out, wipe its app data first so
    // the next login starts brand-new. This is gated behind ENABLE_TEST_ACCOUNT_RESET
    // (see src/lib/testAccount.ts) and is safe to remove before production.
    if (ENABLE_TEST_ACCOUNT_RESET && isTestAccount(user?.email)) {
      setResettingTestAccount(true);
      try {
        // Delegates to the secure Edge Function (verifies JWT + email server-side).
        // Returns false (and logs a developer warning) on failure — we still log out.
        await resetTestAccountData();
      } finally {
        setResettingTestAccount(false);
      }
    }
    // --------------------------------------------------------------------

    await supabase.auth.signOut();
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && user && detail.userId === user.id && detail.nickname) {
        setNicknameOverride(detail.nickname);
      }
    };
    window.addEventListener('nickname-updated', handler);
    return () => window.removeEventListener('nickname-updated', handler);
  }, [user]);

  // Listen for view changes from SetupDashboard so the menu shows the right active item
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.view) setActiveView(detail.view);
    };
    window.addEventListener('onlyfast-view-changed', handler);
    return () => window.removeEventListener('onlyfast-view-changed', handler);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown]);

  const handleMenuSelect = (action: MenuAction) => {
    if (action === 'how-it-works') {
      onOpenHowOnlyFastWorks?.();
      return;
    }

    // Dispatch a global event that SetupDashboard listens for
    window.dispatchEvent(new CustomEvent('onlyfast-menu', { detail: { action } }));
    // 'view-shared' opens a modal — it is NOT a view, so don't change the active
    // view highlight for it.
    if (action !== 'view-shared') setActiveView(action);
  };

  const nickname = getNickname(user, nicknameOverride);


  return (
    <>
      {/* DEV/DEMO: feedback overlay while the test account is being reset on logout */}
      {resettingTestAccount && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="bg-white rounded-xl shadow-2xl px-6 py-5 flex items-center gap-3 border border-[#E5E7EB]">
            <svg className="animate-spin text-[#00A8E8]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-sm font-semibold text-[#1A1B23]">Resetting test account…</span>
          </div>
        </div>
      )}
      <header role="banner" className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Main navigation" className="flex items-center justify-between h-16">
            {/* Left - Hamburger + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="w-10 h-10 rounded-lg hover:bg-[#F5F5F7] border border-transparent hover:border-[#E5E7EB] flex items-center justify-center text-[#1A1B23] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <img
                src="/onlyfast-logo.png"
                alt="OnlyFast Setup Assist - Home"
                className="h-[45px] w-auto"
              />

            </div>

            {/* Center - Car Type Badge */}
            {selectedCar && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="bg-[#00A8E8]/10 text-[#00A8E8] px-4 py-1.5 rounded-full text-sm font-semibold border border-[#00A8E8]/20" aria-label={`Selected car class: ${selectedCar}`}>
                  {selectedCar}
                </span>
                {onBackToCarSelect && (
                  <button
                    onClick={onBackToCarSelect}
                    className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    aria-label="Change car type"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Right - Auth + Settings */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <div className="relative">
                    <button
                      ref={triggerRef}
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-expanded={showDropdown}
                      aria-haspopup="true"
                      aria-label={`Account menu for ${nickname}`}
                      className="flex items-center gap-1.5 sm:gap-2 bg-[#F5F5F7] hover:bg-[#EBEBED] rounded-full px-2 sm:px-3 py-1 sm:py-1.5 transition-colors border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] max-w-[150px] sm:max-w-none"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#00A8E8] flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
                        {nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-[11px] leading-tight sm:text-sm text-[#4B5563] max-w-[76px] sm:max-w-[140px] truncate font-medium">
                          {nickname}
                        </span>
                        {planLabel && (
                          <span
                            className={`inline-flex items-center self-start sm:self-auto px-1.5 sm:px-2 py-0 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] leading-tight font-bold border ${
                              planLabel === 'Admin'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : planLabel === 'Team' || planLabel === 'Pro'
                                ? 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                            aria-label={`Account type: ${planLabel}`}
                          >
                            {planLabel}
                          </span>
                        )}
                      </span>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9CA3AF]" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {showDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} aria-hidden="true" />
                        <div
                          ref={dropdownRef}
                          role="menu"
                          aria-label="Account options"
                          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-[#E5E7EB] py-1 z-50"
                        >
                          <div className="px-4 py-2 border-b border-[#E5E7EB]" role="none">
                            <p className="text-xs text-[#9CA3AF]">Signed in as</p>
                            <p className="text-sm font-medium text-[#1A1B23] truncate">{nickname}</p>
                            <p className="text-[10px] text-[#9CA3AF] truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={() => { setShowDropdown(false); setSettingsOpen(true); }}
                            role="menuitem"
                            className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:bg-[#F5F5F7] flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Settings
                          </button>
                          <button
                            onClick={handleSignOut}
                            role="menuitem"
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:bg-red-50"
                          >
                            Sign Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Redundant standalone gear/settings icon removed —
                      Settings is reachable from the account dropdown above. */}
                </>
              ) : (
                <>
                  <button
                    onClick={onSignInClick}
                    className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                  >
                    Sign In
                  </button>
                  {/* Redundant standalone gear/settings icon removed for signed-out
                      users as well — the Sign In button is the entry point. */}
                </>
              )}
            </div>
          </nav>

        </div>
      </header>

      <AppMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={handleMenuSelect}
        activeView={activeView}
      />

      {user && <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} user={user} />}
    </>
  );
};

export default Header;
