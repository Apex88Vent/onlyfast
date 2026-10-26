import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import { isMedianUserAgent } from '@/lib/nativeEnvironment';
import { assertLocalSandboxConfiguration, authorizeSandboxTester, inspectMedianBridge, type MedianBridgeDiagnostic } from '@/lib/nativeSandboxPolicy';
import { debugCatalogRequest, initializeLocalCatalog } from '@/lib/nativeCatalogDiagnostic';

function testerSource() {
  return {
    user: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    account: async (id: string) => {
      const { data, error } = await supabase.from('beta_tester_accounts')
        .select('is_test_account,beta_features_enabled,tester_kind').eq('user_id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    flags: async (id: string) => {
      const { data, error } = await supabase.from('user_feature_flags').select('feature_key,enabled').eq('user_id', id);
      if (error) throw error;
      return data ?? [];
    },
  };
}

export default function NativeSubscriptionTest() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Sign in locally, then check your tester authorization and native bridge.');
  const [report, setReport] = useState<(MedianBridgeDiagnostic & { bridge: string; userAgent: string; initialization?: unknown; namedCatalog?: unknown }) | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    const generation = revision;
    const { data } = supabase.auth.onAuthStateChange(() => {
      generation.current++;
      setBusy(false);
      setReport(null);
      setMessage('Session changed. Check tester authorization again.');
    });
    return () => { generation.current++; data.subscription.unsubscribe(); };
  }, []);

  const check = async () => {
    if (busy) return;
    const attempt = ++revision.current;
    setBusy(true);
    setReport(null);
    try {
      assertLocalSandboxConfiguration(import.meta.env.MODE, supabaseUrl, supabaseKey);
      if (!isMedianUserAgent(navigator.userAgent)) throw new Error('Open this local test build inside the Median app.');
      const source = testerSource();
      const userId = await authorizeSandboxTester(source);
      const host = window as unknown as { median?: { revenueCat?: unknown }; gonative?: { revenueCat?: unknown } };
      const revalidate = async () => {
        if (attempt !== revision.current || await authorizeSandboxTester(source) !== userId) throw new Error('Your account changed or tester authorization ended.');
        if (attempt !== revision.current) throw new Error('Your session changed. Check again.');
      };
      const result = await inspectMedianBridge(host.median?.revenueCat ?? host.gonative?.revenueCat, revalidate);
      if (await authorizeSandboxTester(source) !== userId) throw new Error('Your account changed.');
      if (attempt === revision.current) {
        setReport({ ...result, bridge: host.median?.revenueCat ? 'median.revenueCat' : 'gonative.revenueCat', userAgent: navigator.userAgent });
        setMessage('Read-only checks finished. Review each returned response or error below. Purchases and restore remain disabled.');
      }
    } catch (error) {
      if (attempt === revision.current) setMessage(error instanceof Error ? error.message : 'Bridge check failed.');
    } finally { if (attempt === revision.current) setBusy(false); }
  };

  const initialize = async () => {
    if (busy) return;
    const attempt = ++revision.current;
    setBusy(true); setReport(null);
    setMessage('Verifying local tester and SDK identity, then reading native catalogs…');
    const assertCurrent = () => { if (attempt !== revision.current) throw new Error('Your session changed.'); };
    try {
      if (!isMedianUserAgent(navigator.userAgent)) throw new Error('Open this local test build inside the Median app.');
      const host = window as unknown as {
        median?: { revenueCat?: unknown }; gonative?: { revenueCat?: unknown };
        onlyFastCatalog?: Parameters<typeof debugCatalogRequest>[0];
      };
      const source = testerSource();
      const result = await initializeLocalCatalog({
        mode: import.meta.env.MODE, url: supabaseUrl, anonKey: supabaseKey, pageUrl: window.location.href,
        source, bridge: host.median?.revenueCat ?? host.gonative?.revenueCat, assertCurrent,
        read: async operation => {
          assertCurrent();
          // Session storage supplies only the token. The native reader validates
          // it with LOCAL Auth and RLS before using the SDK or returning data.
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) throw new Error('Local sign-in is required.');
          return debugCatalogRequest(host.onlyFastCatalog, operation, data.session.access_token, supabaseKey);
        },
      });
      assertCurrent();
      setReport({ ...result, bridge: host.median?.revenueCat ? 'median.revenueCat' : 'gonative.revenueCat', userAgent: navigator.userAgent });
      setMessage('Initialization and catalog checks finished. Review actual responses below. Purchases and restore remain disabled.');
    } catch (error) {
      if (attempt === revision.current) setMessage(error instanceof Error ? error.message : 'Initialization diagnostic failed.');
    } finally { if (attempt === revision.current) setBusy(false); }
  };

  return <main className="mx-auto max-w-3xl space-y-5 p-6">
    <h1 className="text-xl font-bold">Native subscription test readiness</h1>
    <p>Local synthetic accounts only. Purchases and restore are disabled. Rookie remains free.</p>
    <p>Explicit initialization uses your verified local UUID. The debug-only reader checks the named offering; prices and trial terms are shown only when returned by the store.</p>
    <p>Calls: <code>isInitialized()</code> and <code>getOfferings()</code>, with no arguments. This check does not initialize the SDK; an uninitialized SDK may return an error for offerings.</p>
    <button type="button" disabled={busy} onClick={() => void check()}
      className="rounded-lg bg-[#00A8E8] px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? 'Reading native responses…' : 'Read initialization and offerings'}
    </button>
    <button type="button" disabled={busy} onClick={() => void initialize()}
      className="rounded-lg bg-[#006688] px-4 py-3 font-semibold text-white disabled:opacity-50">
      Initialize RevenueCat
    </button>
    <p role="status" aria-live="polite">{message}</p>
    {report && <section className="space-y-4" aria-label="Native bridge diagnostic results">
      <h2 className="text-lg font-bold">Device responses</h2>
      <p>Bridge: {report.bridge}. SDK initialized: {report.initialized === null ? 'unknown' : report.initialized ? 'yes' : 'no'}.</p>
      <p>Available methods: {report.methods.join(', ') || 'none'}.</p>
      {report.initialization !== undefined && <section className="space-y-2">
        <h3 className="font-semibold">Initialization and verified local identity</h3>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(report.initialization, null, 2)}</pre>
      </section>}
      {report.namedCatalog !== undefined && <section className="space-y-2">
        <h3 className="font-semibold">Debug native SDK named offering</h3>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(report.namedCatalog, null, 2)}</pre>
      </section>}
      {report.calls.map(call => <section key={call.method} className="space-y-2">
        <h3 className="font-semibold">{call.method}() — {call.status} ({call.durationMs} ms)</h3>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(call, null, 2)}</pre>
      </section>)}
      <h2 className="text-lg font-bold">Returned catalog fields</h2>
      <p>Fields below are observations, not a normalized store catalog. Generic identifiers may be package IDs rather than offering IDs. No prices or trial terms are inferred.</p>
      {([
        ['Identifier / offering fields', report.catalog.identifiers], ['Packages', report.catalog.packages],
        ['Products', report.catalog.products], ['Prices, currency and trial terms', report.catalog.pricesAndTerms],
      ] as const).map(([label, entries]) => <section key={label} className="space-y-2">
        <h3 className="font-semibold">{label}</h3>
        {entries.length ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(entries, null, 2)}</pre> : <p>No matching fields returned.</p>}
      </section>)}
      <h2 className="text-lg font-bold">Requested offering: {report.requestedOffering}</h2>
      <p>{report.catalog.requestedIdentifierLocations.length ?
        `Exact identifier observed at: ${report.catalog.requestedIdentifierLocations.join(', ')}. This does not prove it can be selected.` :
        'The exact identifier was not observed in the returned catalog. This does not prove the offering is absent from RevenueCat.'}</p>
      <p>Named-offering selection is not exposed by the documented bridge. No selection argument or undocumented method was attempted.</p>
      <details><summary className="cursor-pointer underline">Complete diagnostic report for device handoff</summary>
        <p>Credential and identity fields are redacted. Include this report with the Android build/version and screenshots.</p>
        <pre className="max-h-96 select-text overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(report, null, 2)}</pre>
      </details>
    </section>}
    <Link to="/" className="inline-block underline">Back to local OnlyFast</Link>
  </main>;
}
