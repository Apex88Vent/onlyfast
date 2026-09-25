import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizationMatches, fetchRevenueCatSnapshot, revenueCatConfig, webhookUserIds } from '../_shared/revenuecat.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (!authorization) return json({ error: 'Webhook not configured' }, 503);
  if (!authorizationMatches(req.headers.get('Authorization') || '', authorization)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  let event: Record<string, unknown>;
  try {
    const body = await req.json();
    event = body.event;
    if (body.api_version !== '1.0' || !event || typeof event.id !== 'string' ||
        typeof event.type !== 'string' || !Number.isFinite(event.event_timestamp_ms)) throw new Error();
  } catch { return json({ error: 'Invalid webhook' }, 400); }
  if (event.type === 'TEST') return json({ received: true });
  try {
    const config = revenueCatConfig(Deno.env.get);
    const appIds = (Deno.env.get('REVENUECAT_APP_IDS') || '').split(',').map(id => id.trim()).filter(Boolean);
    if (!appIds.length) return json({ error: 'App allowlist not configured' }, 503);
    // Transfers can omit app/environment; their project-authenticated snapshots
    // still filter store and sandbox eligibility before any access is granted.
    const transfer = event.type === 'TRANSFER';
    if (!(transfer && !event.app_id) && !appIds.includes(String(event.app_id))) return json({ received: true, ignored: 'app' });
    if (!(transfer && !event.environment) && event.environment !== 'PRODUCTION' && !(config.allowSandbox && event.environment === 'SANDBOX')) {
      return json({ received: true, ignored: 'environment' });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ids = webhookUserIds(event);
    if (!ids.length) return json({ error: 'No Supabase UUID; resolve RevenueCat identity and retry' }, 422);
    for (const userId of ids) {
      const { data: duplicate, error: lookupError } = await admin.from('revenuecat_webhook_events')
        .select('event_id').eq('event_id', event.id).eq('user_id', userId).maybeSingle();
      if (lookupError) throw lookupError;
      if (duplicate) continue;
      const snapshot = await fetchRevenueCatSnapshot(userId, config);
      const { error } = await admin.rpc('onlyfast_apply_revenuecat', {
        p_user_id: userId, p_snapshot: snapshot, p_event_id: event.id,
        p_event_type: event.type, p_event_at: new Date(Number(event.event_timestamp_ms)).toISOString(),
      });
      if (error) throw error;
    }
    return json({ received: true });
  } catch (error) {
    console.error('[revenuecat-webhook]', event.id, error instanceof Error ? error.message : 'Database sync failed');
    return json({ error: 'Subscription sync failed; retry required' }, 500);
  }
});
