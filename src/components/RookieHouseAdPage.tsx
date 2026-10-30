import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { shouldShowAds } from '@/lib/ads';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import { HOUSE_BOUNDARIES, measureHouseBoundary } from '@/lib/houseAdMidpoint';
import RookieAdSlot, { type RookieAdPlacement } from './RookieAdSlot';

/** One existing house ad, in normal document flow at a measured safe boundary. */
export default function RookieHouseAdPage({ user, view, children }: {
  user: User | null; view: string; children: React.ReactNode;
}) {
  useMembershipRevision();
  const eligible = shouldShowAds(user);
  const root = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const placement: RookieAdPlacement = view === 'home' ? 'home_middle' : view === 'schedule' ? 'schedule_bottom' :
    view === 'parts' ? 'parts_reference_bottom' : view === 'todo' ? 'todo_bottom' : 'setup_session_bottom';

  useLayoutEffect(() => {
    const page = root.current;
    if (!eligible || !page) { setTarget(null); return; }
    let host: HTMLElement | null = null;
    let frame: number | null = null;
    let stopped = false;
    const observed = new Set<Element>();
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
    const measure = () => {
      frame = null;
      if (stopped) return;
      const boundary = measureHouseBoundary(page, host);
      const parent = boundary?.parentElement ?? page;
      const tag = /^(UL|OL)$/.test(parent.tagName) ? 'li' : /^(TBODY|THEAD|TFOOT)$/.test(parent.tagName) ? 'tr' : 'div';
      if (!host || host.tagName.toLowerCase() !== tag) {
        host?.remove();
        host = page.ownerDocument.createElement(tag);
        host.setAttribute('data-house-ad-host', '');
        host.style.margin = '0';
        host.style.gridColumn = '1 / -1';
        let content = host;
        if (tag === 'tr') { content = page.ownerDocument.createElement('td'); host.appendChild(content); }
        content.style.paddingBlock = '1rem';
        setTarget(content);
      }
      if (tag === 'tr') {
        const table = parent.closest('table');
        const span = table?.rows[0] ? Array.from(table.rows[0].cells).reduce((sum, cell) => sum + cell.colSpan, 0) : 1;
        const cell = host.firstElementChild as HTMLTableCellElement;
        if (cell.colSpan !== span) cell.colSpan = span;
      }
      if (boundary) {
        if (boundary.nextSibling !== host) parent.insertBefore(host, boundary.nextSibling);
      } else if (host.parentElement !== page) page.appendChild(host);
      const current = new Set<Element>([page, ...page.querySelectorAll(HOUSE_BOUNDARIES)]);
      for (const old of observed) if (!current.has(old)) { resize?.unobserve(old); observed.delete(old); }
      for (const element of current) if (!observed.has(element) && !element.closest('[data-house-ad-host]')) {
        resize?.observe(element); observed.add(element);
      }
    };
    const schedule = () => { if (!stopped && frame === null) frame = requestAnimationFrame(measure); };
    const mutation = new MutationObserver(schedule);
    mutation.observe(page, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    page.addEventListener('load', schedule, true);
    measure();
    return () => {
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      mutation.disconnect(); resize?.disconnect();
      window.removeEventListener('resize', schedule);
      page.removeEventListener('load', schedule, true);
      host?.remove();
      setTarget(null);
    };
  }, [eligible, user?.id, view]);

  return <div ref={root} data-house-ad-page={view}>
    {children}
    {eligible && target && createPortal(<RookieAdSlot placement={placement} user={user} />, target)}
  </div>;
}
