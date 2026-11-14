import { useEffect, useRef, useState } from 'react';
import { getTrackTraceGpsFix } from './gpsAvailability';

export default function GpsReadiness() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function check() {
    const request = ++generation.current;
    setBusy(true); setStatus('Requesting one precise GPS fix…');
    try {
      const fix = await getTrackTraceGpsFix();
      if (generation.current === request) setStatus(fix.accuracy === null ? 'GPS responded without an accuracy estimate.' : `GPS accuracy estimate: ±${Math.round(fix.accuracy)} m. This check does not validate lap timing.`);
    } catch (cause) {
      if (generation.current === request) setStatus(cause instanceof Error ? cause.message : 'GPS is unavailable.');
    } finally { if (generation.current === request) setBusy(false); }
  }
  return <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
    <h3 className="font-semibold">GPS availability</h3>
    <p className="mt-1 text-sm text-[#6B7280]">This checks one location fix. It does not arm a session, record GPS, or create lap times. Live recording still requires circuit-engine integration and device validation.</p>
    <button type="button" onClick={() => void check()} disabled={busy} className="mt-3 rounded-lg border border-[#00A8E8] px-3 py-2 text-sm font-semibold text-[#007DAE] disabled:opacity-50">{busy ? 'Checking GPS…' : 'Check GPS availability'}</button>
    {status && <p role="status" className="mt-2 text-sm text-[#6B7280]">{status}</p>}
  </section>;
}
