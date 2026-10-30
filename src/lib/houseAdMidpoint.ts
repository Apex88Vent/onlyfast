export const HOUSE_BOUNDARIES = 'section, fieldset, ul > li, ol > li, tbody > tr, [data-house-ad-boundary]';

export function nearestHouseBoundary(height: number, offsets: readonly number[]): number {
  if (!offsets.length || !Number.isFinite(height) || height <= 0) return -1;
  return offsets.reduce((best, offset, index) =>
    Number.isFinite(offset) && Math.abs(offset - height / 2) < Math.abs(offsets[best] - height / 2) ? index : best, 0);
}

/** Measure complete records/sections, including content inside nested scrollers. */
export function measureHouseBoundary(root: HTMLElement, adHost: HTMLElement | null): Element | null {
  const view = root.ownerDocument.defaultView;
  if (!view) return null;
  const rootTop = root.getBoundingClientRect().top;
  const visible = (element: Element) => element.getClientRects().length > 0 &&
    !element.closest('[hidden], [aria-hidden="true"], [inert], [role="dialog"], [aria-modal="true"], .fixed.inset-0, [data-house-ad-no-insert]');
  const scrollers = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(element =>
    !element.closest('[data-house-ad-host]') && visible(element) && element.scrollHeight > element.clientHeight + 1 &&
    /auto|scroll/.test(view.getComputedStyle(element).overflowY));
  const extraHeight = scrollers.reduce((sum, element) => sum + element.scrollHeight - element.clientHeight, 0);
  const adHeight = adHost?.getBoundingClientRect().height ?? 0;
  const total = Math.max(root.scrollHeight, root.getBoundingClientRect().height) + extraHeight - adHeight;
  const candidates = Array.from(root.querySelectorAll(HOUSE_BOUNDARIES)).filter(element => {
    if (!visible(element) || element.closest('[data-house-ad-host]')) return false;
    // Keep the complete related form section together (e.g. all four corners),
    // rather than inserting between its individual input fieldsets.
    if (element.tagName === 'FIELDSET' && element.parentElement?.closest('section, fieldset')) return false;
    // Never create an incomplete row of selectable cards in a responsive grid.
    const next = element.nextElementSibling;
    return !next || next === adHost || view.getComputedStyle(element.parentElement!).display !== 'grid' ||
      Math.abs(next.getBoundingClientRect().top - element.getBoundingClientRect().top) > 2;
  });
  const offsets = candidates.map(element => {
    let offset = element.getBoundingClientRect().bottom - rootTop + root.scrollTop;
    for (const scroller of scrollers) {
      if (scroller.contains(element)) offset += scroller.scrollTop;
      else if (element.contains(scroller) || scroller.compareDocumentPosition(element) & 4) offset += scroller.scrollHeight - scroller.clientHeight;
    }
    if (adHost && (element.contains(adHost) || adHost.compareDocumentPosition(element) & 4)) offset -= adHeight;
    return offset;
  });
  return candidates[nearestHouseBoundary(total, offsets)] ?? null;
}
