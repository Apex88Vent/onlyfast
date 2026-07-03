import React, { useEffect, useRef } from 'react';

export type MenuAction = 'setup' | 'saved' | 'create-base' | 'todo' | 'compare' | 'parts' | 'schedule';

interface AppMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
  activeView?: string;
}

const items: { action: MenuAction; label: string; description: string; icon: React.ReactNode }[] = [
  {
    action: 'setup',
    label: 'Current Setup',
    description: 'Hot Laps · Heat · Main',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    action: 'create-base',
    label: 'Base Setups',
    description: 'Create & manage reusable templates',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 12l9 4 9-4" /><path d="M3 17l9 4 9-4" />
      </svg>
    ),
  },
  {
    action: 'saved',
    label: 'Saved Setups',
    description: 'View previously saved setups',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
      </svg>
    ),
  },
  {
    action: 'todo',
    label: 'To Do List',
    description: 'Upcoming race & task list',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    action: 'schedule',
    label: 'Schedule',
    description: 'Race schedule & results',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    action: 'parts',
    label: 'Parts Reference',
    description: 'Part numbers, suppliers & costs',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
];

const AppMenu: React.FC<AppMenuProps> = ({ isOpen, onClose, onSelect, activeView }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className="fixed top-0 left-0 bottom-0 z-[56] w-72 sm:w-80 bg-white shadow-2xl border-r border-[#E5E7EB] flex flex-col animate-[slideIn_0.2s_ease-out]"
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        <style>{`
          @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <img
              src="/onlyfast-logo.png"
              alt="OnlyFast"
              className="h-[28px] w-auto"
            />
            <span className="text-sm font-bold text-[#1A1B23]">Menu</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="App sections">
          {items.map(item => {
            const isActive = activeView === item.action ||
              (item.action === 'setup' && activeView === 'setup');
            return (
              <button
                key={item.action}
                onClick={() => { onSelect(item.action); onClose(); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors focus:outline-none focus:bg-[#F5F5F7] ${
                  isActive ? 'bg-[#00A8E8]/10 text-[#00A8E8]' : 'text-[#1A1B23] hover:bg-[#F5F5F7]'
                }`}
              >
                <span className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-[#00A8E8]' : 'text-[#6B7280]'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`block text-xs ${isActive ? 'text-[#00A8E8]/80' : 'text-[#9CA3AF]'}`}>
                    {item.description}
                  </span>
                </span>
                {isActive && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-1">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-[#E5E7EB] text-[10px] text-[#9CA3AF]">
          OnlyFast Setup Assist
        </div>
      </div>
    </>
  );
};

export default AppMenu;
