import { useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HOUSE_AD_PLANS_PATH = '/pricing';

export function HouseBottomBanner() {
  return (
    <aside aria-label="OnlyFast upgrade banner" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-[#1A1B23] text-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex h-[calc(3rem-1px)] max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/onlyfast-logo.png" alt="OnlyFast" className="hidden h-6 w-auto shrink-0 rounded bg-white p-0.5 min-[360px]:block" />
          <span className="text-xs font-semibold leading-tight sm:text-sm">Go ad-free with Pro</span>
        </div>
        <Link to={HOUSE_AD_PLANS_PATH} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-[#7DDCFF] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7DDCFF] sm:text-sm">
          View plans <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

export function HouseInterstitialDialog({ title, description, onClose, fullScreen = false, brand, children }: {
  title: string;
  description?: string;
  onClose: () => void;
  fullScreen?: boolean;
  brand?: ReactNode;
  children: ReactNode;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70" />
        <Dialog.Content
          className={`fixed inset-0 z-[81] flex min-h-0 flex-col overflow-y-auto ${fullScreen ? 'house-design-dialog' : ''}`}
          style={{ padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))' }}
          {...(!description ? { 'aria-describedby': undefined } : {})}
          onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            const target = previousFocus.current;
            if (target?.isConnected) target.focus({ preventScroll: true });
            else document.getElementById('main-content')?.focus({ preventScroll: true });
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
          <div className={`sticky top-0 z-10 mx-auto flex w-full shrink-0 items-center ${fullScreen ? 'house-design-toolbar max-w-6xl' : 'max-w-xl justify-end'}`}>
            {brand}
            <Dialog.Close className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${fullScreen ? 'house-design-close ml-auto' : 'border border-white/30 bg-[#1A1B23] font-bold text-white shadow-lg hover:bg-[#303642] focus-visible:outline-[#7DDCFF]'}`}>
              <X size={17} aria-hidden="true" /> Close
            </Dialog.Close>
          </div>
          <div className={`flex w-full flex-1 flex-col items-center ${fullScreen ? 'house-design-body' : 'mx-auto max-w-xl justify-center py-2'}`}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
