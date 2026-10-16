import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import { fetchRevenueCatSnapshot, revenueCatConfig } from '../_shared/revenuecat.ts';

const headers = {
  'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in required' }, 401);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error: authError } = await admin.auth.getUser(token);
    if (authError || !data.user) return json({ error: 'Invalid session' }, 401);
    // No user ID, plan, product, or receipt from the request body is trusted.
    const snapshot = await fetchRevenueCatSnapshot(data.user.id, revenueCatConfig(Deno.env.get));
    const { error } = await admin.rpc('onlyfast_apply_revenuecat', {
      p_user_id: data.user.id, p_snapshot: snapshot,
    });
    if (error) throw error;
    const { data: row, error: readError } = await admin.from('user_subscriptions')
      .select('plan, status, subscription_source').eq('user_id', data.user.id).single();
    if (readError) throw readError;
    return json({ subscription: row });
  } catch {
    return json({ error: 'Could not confirm your subscription. Please try again.' }, 502);
  }
});
