import React, { useEffect, useState } from 'react';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';
import {
  appendMedianPickerTrace,
  clearMedianPickerTrace,
  enableMedianPickerTrace,
  getMedianPickerActiveAuthSubscriptionCount,
  getMedianPickerDocumentInstanceId,
  getMedianPickerTraceRecords,
  getMedianPickerTraceText,
  getMedianPickerTraceUpdatedEvent,
} from '@/lib/medianPickerTrace';

const requestedByUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('medianTrace') === '1';
  } catch {
    return false;
  }
};

const MedianPickerTracePanel: React.FC = () => {
  const { testerKind } = useBetaFeatures();
  const enabledForTester = import.meta.env.DEV || testerKind === 'experimental' || requestedByUrl();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    if (!enabledForTester) return;
    enableMedianPickerTrace();
    appendMedianPickerTrace('trace_panel_available', {
      activeSubscriptions: getMedianPickerActiveAuthSubscriptionCount(),
      clientInstances: 1,
    });
    const updateCount = () => setEventCount(getMedianPickerTraceRecords().length);
    updateCount();
    const eventName = getMedianPickerTraceUpdatedEvent();
    window.addEventListener(eventName, updateCount);
    return () => window.removeEventListener(eventName, updateCount);
  }, [enabledForTester]);

  if (!enabledForTester) return null;

  const copyTrace = async () => {
    const text = getMedianPickerTraceText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    appendMedianPickerTrace('trace_copied');
    setCopied(true);
  };

  const clearTrace = () => {
    clearMedianPickerTrace();
    appendMedianPickerTrace('trace_cleared', {
      currentDocumentInstanceId: getMedianPickerDocumentInstanceId(),
      activeSubscriptions: getMedianPickerActiveAuthSubscriptionCount(),
      clientInstances: 1,
    });
    setCopied(false);
    setEventCount(getMedianPickerTraceRecords().length);
  };

  return (
    <div className="fixed right-3 bottom-3 z-[100]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-[#00A8E8] bg-white px-3 py-2 text-xs font-semibold text-[#007CAD] shadow-lg"
        >
          Median Picker Trace ({eventCount})
        </button>
      ) : (
        <section
          role="dialog"
          aria-label="Median Picker Trace"
          className="w-[min(92vw,360px)] rounded-xl border border-[#CBD5E1] bg-white p-4 text-[#1A1B23] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Median Picker Trace</h2>
              <p className="mt-1 text-[11px] text-[#6B7280]">
                Session-only technical events. No images, account/setup/session IDs, tokens, or account details.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-[#6B7280]">
              Close
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
            <dt className="font-semibold">Events</dt>
            <dd>{eventCount}</dd>
            <dt className="font-semibold">Document</dt>
            <dd className="truncate font-mono">{getMedianPickerDocumentInstanceId()}</dd>
          </dl>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={copyTrace}
              className="flex-1 rounded-lg bg-[#00A8E8] px-3 py-2 text-xs font-semibold text-white"
            >
              {copied ? 'Copied' : 'Copy Trace'}
            </button>
            <button
              type="button"
              onClick={clearTrace}
              className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#475569]"
            >
              Clear Trace
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default MedianPickerTracePanel;
