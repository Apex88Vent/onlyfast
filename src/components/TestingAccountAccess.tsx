import { useEffect, useState } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import { getSelectableSetupClasses } from '@/lib/setupLibraryAccess';

export default function TestingAccountAccess() {
  const [access, setAccess] = useState<{ tier: string; selection_required: boolean; active_class: string } | null>(null);
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (supabaseUrl !== 'https://mfzajhnfonrfuiwxgvhe.supabase.co') return;
    let active = true; let revision = 0;
    const refresh = async () => {
      const generation = ++revision;
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { if (active) setAccess(null); return; }
      const result = await supabase.rpc('get_onlyfast_2027_account_access');
      const current = (await supabase.auth.getSession()).data.session;
      if (active && generation === revision && current?.user.id === session.user.id) {
        if (result.error) { setAccess(null); setError('Testing permissions are unavailable. Racing changes remain server-protected.'); }
        else { setAccess(result.data); setError(''); }
      }
    };
    const schedule = () => { void refresh(); };
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(schedule, 0); });
    window.addEventListener('membership-updated', schedule);
    window.addEventListener('focus', schedule);
    schedule(); const interval = setInterval(schedule, 30000);
    return () => { active = false; revision++; data.subscription.unsubscribe(); clearInterval(interval); window.removeEventListener('membership-updated', schedule); window.removeEventListener('focus', schedule); };
  }, []);
  const saveClass = async () => {
    if (!chosen || busy) return;
    setBusy(true); setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Please sign in again.');
      const response = await fetch(supabaseUrl + '/rest/v1/rpc/choose_onlyfast_2027_class', {
        method: 'POST', headers: { apikey: supabaseKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_class: chosen }),
      });
      const result = await response.json();
      if (!response.ok || result !== chosen) throw new Error(result?.message || 'Your class selection was not confirmed.');
      if ((await supabase.auth.getSession()).data.session?.user.id !== session.user.id) throw new Error('Your account changed. Please reopen the app.');
      location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not select your racing class.'); setBusy(false); }
  };
  if (supabaseUrl !== 'https://mfzajhnfonrfuiwxgvhe.supabase.co') return null;
  if (!access && !error) return null;
  return <aside className="mx-auto max-w-7xl px-4 py-3 text-sm text-slate-800" aria-label="Testing account permissions">
    {access?.tier === 'unsubscribed' && <p role="status" className="rounded-lg border bg-blue-50 p-3">Your account is read-only. Your saved setups, notes, results and schedules remain available. <a className="font-semibold underline" href="/pricing">View subscription options</a> to enable racing changes.</p>}
    {access?.selection_required && ['sportsman','pro'].includes(access.tier) && <div className="space-y-3 rounded-lg border bg-amber-50 p-4">
      <h2 className="font-bold">Choose your active racing class</h2>
      <p>Your new subscription includes one active class. All previous classes remain saved and viewable as read-only. Racing edits stay locked until you choose.</p>
      <label className="flex flex-wrap items-center gap-2">Active racing class
        <select aria-label="Active racing class" className="max-w-full rounded border p-2" value={chosen} onChange={e => setChosen(e.target.value)}>
          <option value="">Choose a class…</option>{getSelectableSetupClasses().map(c => <option value={c} key={c}>{c}</option>)}
        </select>
      </label>
      <button disabled={!chosen || busy} onClick={() => void saveClass()} className="rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Confirm active class'}</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
