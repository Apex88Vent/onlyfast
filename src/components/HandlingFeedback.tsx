import React, { useState, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  getEffectiveTier,
  readMembership,
  checkSetupAssistPermission,
} from '@/lib/membership';

interface HandlingFeedbackProps {
  entryHandling: string;
  midHandling: string;
  exitHandling: string;
  setupData: Record<string, string>;
  raceClass: string;
  /** Current signed-in user (null when not signed in). */
  user?: User | null;
  /**
   * Stable per-race-weekend grouping key (the saved setup_name). Used as the
   * usage scope for the Rookie "1 Setup Assist per race weekend" limit. When
   * empty/undefined the race weekend hasn't been saved yet.
   */
  raceWeekendKey?: string;
}

const HandlingFeedback: React.FC<HandlingFeedbackProps> = ({
  entryHandling, midHandling, exitHandling, setupData, raceClass, user, raceWeekendKey
}) => {
  const [suggestions, setSuggestions] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfQuestion, setWhatIfQuestion] = useState('');
  const [whatIfResponse, setWhatIfResponse] = useState('');
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  // Inline notice surfaced when a Rookie hits the per-race-weekend assist limit
  // (or when they need to save the race weekend first to track the free assist).
  const [assistNotice, setAssistNotice] = useState('');
  const prefix = useId();

  const hasHandling = entryHandling || midHandling || exitHandling;

  const importantFields = [
    'cross_weight', 'toe', 'front_ride_height', 'rear_ride_height', 'stagger',
    'rf_caster', 'rf_camber', 'rf_pressure', 'rf_spring',
    'lf_caster', 'lf_camber', 'lf_pressure', 'lf_spring',
    'lr_pressure', 'lr_spring', 'rr_pressure', 'rr_spring',
    'lr_trailing_arm', 'rr_trailing_arm', 'panhard_bar',
  ];
  const filledCount = importantFields.filter(f => setupData[f] && setupData[f].trim() !== '').length;
  const totalFields = importantFields.length;
  const completionPct = Math.round((filledCount / totalFields) * 100);

  // ------------------------------------------------------------------
  // SETUP-ASSIST USAGE LIMIT (centralized via checkSetupAssistPermission)
  // ------------------------------------------------------------------
  // The effective tier resolves test@test.com / admin / promo to 'team' and
  // Pro to 'pro' — both are 'unlimited', so they bypass every check here.
  // Only Rookie (limit = 1 per race weekend) is ever gated.

  const effectiveTier = () => getEffectiveTier(readMembership(user?.user_metadata || {}));

  const scopeKey = () => (raceWeekendKey || '').trim();

  // Read how many assists this race weekend has already consumed for this user.
  const fetchAssistUsage = async (key: string): Promise<number> => {
    if (!user) return 0;
    try {
      const { data } = await supabase
        .from('setup_assist_usage')
        .select('used_count')
        .eq('user_id', user.id)
        .eq('race_weekend_key', key)
        .maybeSingle();
      return data?.used_count ?? 0;
    } catch {
      // If the lookup fails we DO NOT fabricate usage; default to 0 so a
      // transient error never wrongly blocks a paid feature.
      return 0;
    }
  };

  // Record ONE successful assist for this race weekend. Called ONLY after a
  // suggestion call succeeds, so failed/errored calls never consume the assist.
  const recordAssistUsage = async (key: string) => {
    if (!user) return;
    try {
      const current = await fetchAssistUsage(key);
      await supabase
        .from('setup_assist_usage')
        .upsert(
          {
            user_id: user.id,
            race_weekend_key: key,
            used_count: current + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,race_weekend_key' }
        );
    } catch {
      /* non-fatal — usage tracking best-effort */
    }
  };

  /**
   * Gate an assist request. Returns { allowed, key } where key is the usage
   * scope to record against on success. When blocked, sets an inline notice
   * and returns allowed=false (no AI call, nothing consumed).
   */
  const gateAssist = async (): Promise<{ allowed: boolean; key: string }> => {
    setAssistNotice('');
    const tier = effectiveTier();

    // Pro / Team / test / admin → unlimited; never gated, no scope needed.
    if (checkSetupAssistPermission(tier, 0).allowed && tier !== 'rookie') {
      return { allowed: true, key: scopeKey() };
    }

    // Non-signed-in users can't save race weekends and have no usage scope —
    // ask them to sign in so their single free assist can be tracked.
    if (!user) {
      setAssistNotice('Sign in to use your free OnlyFast Setup Assist.');
      return { allowed: false, key: '' };
    }

    // Rookie: needs a saved race weekend so the 1 free assist can be scoped.
    const key = scopeKey();
    if (!key) {
      setAssistNotice('Save your race weekend first to use your free Setup Assist for it.');
      return { allowed: false, key: '' };
    }

    const used = await fetchAssistUsage(key);
    const perm = checkSetupAssistPermission(tier, used);
    if (!perm.allowed) {
      setAssistNotice(perm.upgradeText);
      return { allowed: false, key };
    }
    return { allowed: true, key };
  };

  // Try to extract a useful, user-visible error message from a
  // supabase.functions.invoke() failure. The real backend message is buried
  // on `error.context` (a Response) — we await its body to surface it.
  // We ALSO recognise the generic client-side "Failed to send a request to
  // the Edge Function" message, which the supabase-js SDK throws whenever it
  // can't reach the function at all (overwhelmingly: function isn't deployed
  // to your project, hence a 404 on the OPTIONS preflight or POST).
  const describeInvokeError = async (
    error: any
  ): Promise<{ detail: string; likelyNotDeployed: boolean; status?: number }> => {
    let detail = error?.message || 'Unknown error';
    let status: number | undefined;
    try {
      const ctx = error?.context;
      if (ctx) {
        if (typeof ctx.status === 'number') status = ctx.status;
        if (typeof ctx.text === 'function') {
          const txt = await ctx.text();
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.error) detail = String(parsed.error);
            else if (txt) detail = txt.slice(0, 300);
          } catch {
            if (txt) detail = txt.slice(0, 300);
          }
        }
      }
    } catch { /* ignore */ }

    const msg = String(detail).toLowerCase();
    const likelyNotDeployed =
      status === 404 ||
      msg.includes('failed to send a request') ||
      msg.includes('failed to fetch') ||
      msg.includes('function not found') ||
      msg.includes('not found');

    return { detail, likelyNotDeployed, status };
  };

  const buildErrorMessage = (
    diag: { detail: string; likelyNotDeployed: boolean; status?: number }
  ) => {
    const head = diag.likelyNotDeployed
      ? 'Setup Assist can\'t reach the AI service because the get-suggestions edge function does not appear to be deployed to your database project yet.'
      : 'Setup Assist could not reach the AI service.';
    const lines = [
      head,
      '',
      `Details: ${diag.detail}${diag.status ? ` (HTTP ${diag.status})` : ''}`,
      '',
    ];
    if (diag.likelyNotDeployed) {
      lines.push(
        'To fix this — full step-by-step is in DEPLOY_AI_FUNCTION.md at the project root.',
        '',
        'Quick version:',
        '1. Open https://supabase.com/dashboard/project/thpyjvwtfvfxiufchrxn/functions',
        '2. Deploy a new function named exactly "get-suggestions" (Verify JWT: OFF)',
        '3. Paste the code from DEPLOY_AI_FUNCTION.md (or docs/edge-functions/get-suggestions.ts)',
        '4. Project Settings → Edge Functions → Secrets → add OPENAI_API_KEY',
        '',
        'Note: GPS / weather autofill no longer needs an edge function — it now calls Open-Meteo directly from the browser.'
      );

    } else {
      lines.push(
        'If this says "OPENAI_API_KEY is not configured", add the secret in your database project: Project Settings → Edge Functions → Secrets → OPENAI_API_KEY.',
        'If this says the OpenAI request failed, check that your OPENAI_API_KEY has credits and access to gpt-4o-mini.'
      );
    }
    return lines.join('\n');
  };

  const getSuggestions = async () => {
    // Enforce the per-race-weekend assist limit BEFORE doing anything else.
    const gate = await gateAssist();
    if (!gate.allowed) return;

    setLoading(true);
    setSuggestions('');
    try {
      const { data, error } = await supabase.functions.invoke('get-suggestions', {
        body: {
          entry_handling: entryHandling,
          mid_handling: midHandling,
          exit_handling: exitHandling,
          currentSetup: setupData,
          raceClass,
        }
      });
      if (data?.suggestion) {
        setSuggestions(data.suggestion);
        // Only consume the Rookie assist AFTER a successful response.
        if (gate.key) await recordAssistUsage(gate.key);
      } else if (error) {
        const diag = await describeInvokeError(error);
        // eslint-disable-next-line no-console
        console.error('[get-suggestions] invoke failed:', error, diag);
        setSuggestions(buildErrorMessage(diag));
      } else {
        setSuggestions('No response from the suggestion service. Please try again.');
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[get-suggestions] threw:', e);
      const diag = await describeInvokeError(e);
      setSuggestions(buildErrorMessage(diag));
    }
    setLoading(false);
  };

  const askWhatIf = async () => {
    if (!whatIfQuestion.trim()) return;

    // What-If is part of Setup Assist — gate it through the same limit/scope.
    const gate = await gateAssist();
    if (!gate.allowed) return;

    setWhatIfLoading(true);
    setWhatIfResponse('');
    try {
      const { data, error } = await supabase.functions.invoke('get-suggestions', {
        body: {
          entry_handling: entryHandling,
          mid_handling: midHandling,
          exit_handling: exitHandling,
          currentSetup: setupData,
          raceClass,
          whatIfQuestion: whatIfQuestion.trim(),
        }
      });
      if (data?.suggestion) {
        setWhatIfResponse(data.suggestion);
        // Only consume the Rookie assist AFTER a successful response.
        if (gate.key) await recordAssistUsage(gate.key);
      } else if (error) {
        const diag = await describeInvokeError(error);
        // eslint-disable-next-line no-console
        console.error('[get-suggestions what-if] invoke failed:', error, diag);
        setWhatIfResponse(buildErrorMessage(diag));
      } else {
        setWhatIfResponse('No response from the suggestion service. Please try again.');
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[get-suggestions what-if] threw:', e);
      const diag = await describeInvokeError(e);
      setWhatIfResponse(buildErrorMessage(diag));
    }
    setWhatIfLoading(false);
  };



  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('##')) {
        return <h4 key={i} className="text-sm font-bold text-[#00A8E8] mt-3 mb-1">{line.replace(/^#+\s*/, '')}</h4>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <p key={i} className="text-sm ml-3 mb-1 flex items-start gap-1"><span className="text-[#00A8E8] mt-0.5" aria-hidden="true">&#8226;</span> {line.replace(/^[-*]\s*/, '')}</p>;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm mb-1">{line}</p>;
    });
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="setup-assist-heading">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 id="setup-assist-heading" className="text-lg font-bold text-[#1A1B23] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          OnlyFast Setup Assist
        </h3>
      </div>

      {/* Completion Advisory */}
      <div
        className={`rounded-lg p-3 mb-4 border ${completionPct >= 80 ? 'bg-green-50 border-green-200' : completionPct >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}
        role="region"
        aria-label="Setup completion status"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={completionPct >= 80 ? '#16a34a' : completionPct >= 40 ? '#d97706' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={`text-xs font-semibold ${completionPct >= 80 ? 'text-green-700' : completionPct >= 40 ? 'text-amber-700' : 'text-red-700'}`}>
              Setup Sheet {completionPct}% Complete ({filledCount}/{totalFields} fields)
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              For the most complete and accurate assessment, all fields should be filled out on the setup sheet.
            </p>
          </div>
        </div>
        {/* Accessible progress bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5" role="progressbar" aria-valuenow={completionPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Setup completion: ${completionPct}%`}>
          <div
            className={`h-1.5 rounded-full transition-all ${completionPct >= 80 ? 'bg-green-500' : completionPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Handling Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4" role="group" aria-label="Current handling feedback">
        {[
          { label: 'Entry', value: entryHandling },
          { label: 'Mid', value: midHandling },
          { label: 'Exit', value: exitHandling },
        ].map(item => (
          <div key={item.label} className="bg-[#F9FAFB] rounded-lg p-3 text-center border border-[#E5E7EB]">
            <p className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">{item.label}</p>
            <p className={`text-sm font-bold ${
              item.value === 'loose' ? 'text-red-600' :
              item.value === 'tight' ? 'text-blue-600' :
              item.value === 'perfect' ? 'text-green-700' :
              'text-[#9CA3AF]'
            }`}>
              {item.value ? item.value.charAt(0).toUpperCase() + item.value.slice(1) : 'Not Set'}
              {/* Non-color cue */}
              {item.value && (
                <span className="ml-1 text-xs font-normal" aria-hidden="true">
                  {item.value === 'loose' ? '~' : item.value === 'tight' ? '|' : '+'}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Get Suggestions Button */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={getSuggestions}
          disabled={loading || !hasHandling}
          className="flex-1 bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          aria-busy={loading}
          aria-describedby={!hasHandling ? 'no-handling-hint' : undefined}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Get Setup Suggestions
            </>
          )}
        </button>
        <button
          onClick={() => setWhatIfMode(!whatIfMode)}
          aria-expanded={whatIfMode}
          aria-controls="what-if-panel"
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 ${
            whatIfMode 
              ? 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30' 
              : 'bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] hover:text-[#1A1B23] hover:border-[#00A8E8]/30'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          What If?
        </button>
      </div>

      {/* Assist limit / scope notice (Rookie). Clear upgrade prompt — no AI call ran. */}
      {assistNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 text-sm font-medium flex items-start gap-2 mb-4" role="status" aria-live="polite">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{assistNotice}</span>
        </div>
      )}

      {!hasHandling && (
        <p id="no-handling-hint" className="text-sm text-[#6B7280] text-center py-2">
          Set handling feedback on the track diagram above to get AI suggestions
        </p>
      )}

      {/* Suggestions */}
      {suggestions && (
        <div className="bg-[#00A8E8]/5 border border-[#00A8E8]/20 rounded-xl p-4 mb-4" role="region" aria-label="AI setup suggestions" aria-live="polite">
          <div className="prose prose-sm max-w-none text-[#4B5563]">
            {renderMarkdown(suggestions)}
          </div>
        </div>
      )}

      {/* What-If Mode */}
      {whatIfMode && (
        <div id="what-if-panel" className="border border-[#00A8E8]/20 rounded-xl p-4 bg-[#F9FAFB]">
          <h4 className="text-sm font-bold text-[#1A1B23] mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Ask "What If I Change..."
          </h4>
          <p className="text-xs text-[#6B7280] mb-3">
            Ask the AI what would happen to your car's handling if you changed a specific setting. 
            Example: "What if I add 2 degrees of caster to the right front?" or "What if I soften the right rear spring by 25 lbs?"
          </p>
          <div className="flex gap-2">
            <label htmlFor={`${prefix}-whatif`} className="sr-only">What-if question</label>
            <input
              id={`${prefix}-whatif`}
              type="text"
              value={whatIfQuestion}
              onChange={(e) => setWhatIfQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askWhatIf()}
              className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-white text-sm placeholder-[#9CA3AF]"
              placeholder="What if I changed the right rear spring to 200 lbs?"
            />
            <button
              onClick={askWhatIf}
              disabled={whatIfLoading || !whatIfQuestion.trim()}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              aria-busy={whatIfLoading}
            >
              {whatIfLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : 'Ask'}
            </button>
          </div>

          {whatIfResponse && (
            <div className="bg-white border border-[#00A8E8]/20 rounded-xl p-4 mt-3" role="region" aria-label="What-if analysis result" aria-live="polite">
              <div className="prose prose-sm max-w-none text-[#4B5563]">
                {renderMarkdown(whatIfResponse)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default HandlingFeedback;
