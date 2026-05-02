import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import SettingsModal from './SettingsModal';

interface HeaderProps {
  user: User | null;
  onSignInClick: () => void;
  selectedCar: string;
  onBackToCarSelect?: () => void;
}

const getNickname = (user: User | null, override?: string): string => {
  if (!user) return '';
  if (override) return override;
  // Check localStorage override first — this is the most recent value the user
  // saved in Settings, and it may be ahead of what's in user_metadata if the
  // gateway write lagged.
  try {
    const local = localStorage.getItem(`nickname_override_${user.id}`);
    if (local && local.trim()) return local;
  } catch {/* ignore */}
  const meta: any = user.user_metadata || {};
  return meta.nickname || (user.email?.split('@')[0] || 'Racer');
};

const Header: React.FC<HeaderProps> = ({ user, onSignInClick, selectedCar, onBackToCarSelect }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nicknameOverride, setNicknameOverride] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowDropdown(false);
  };

  // Listen for nickname updates fired by SettingsModal so the header re-renders
  // instantly without waiting for an auth state change event.
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

  const nickname = getNickname(user, nicknameOverride);
  const meta: any = user?.user_metadata || {};
  const subscription = meta.subscription === 'premium' ? 'premium' : 'basic';


  return (
    <>
      <header role="banner" className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Main navigation" className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
                alt="OnlyFast Setup Assist - Home"
                className="h-[50px] w-auto"
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
                      className="flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#EBEBED] rounded-full px-3 py-1.5 transition-colors border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#00A8E8] flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
                        {nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-[#4B5563] hidden sm:block max-w-[140px] truncate font-medium">
                        {nickname}
                      </span>
                      {subscription === 'premium' && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1" className="hidden sm:block" aria-label="Premium">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      )}
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

                  {/* Settings gear button */}
                  <button
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Open settings"
                    className="w-10 h-10 rounded-full bg-[#F5F5F7] hover:bg-[#00A8E8]/10 border border-[#E5E7EB] hover:border-[#00A8E8]/30 flex items-center justify-center text-[#6B7280] hover:text-[#00A8E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onSignInClick}
                    className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={onSignInClick}
                    aria-label="Settings (sign in required)"
                    className="w-10 h-10 rounded-full bg-[#F5F5F7] hover:bg-[#00A8E8]/10 border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#00A8E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {user && <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} user={user} />}
    </>
  );
};

export default Header;
