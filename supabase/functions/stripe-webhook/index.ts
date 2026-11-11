// Required secrets:
// - STRIPE_WEBHOOK_SECRET
// - STRIPE_SECRET_KEY
// - PROJECT_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STRIPE_PRO_PRICE_ID
// - STRIPE_TEAMS_PRICE_ID
//
// Recommended Supabase setting:
// - Verify JWT: OFF. Stripe calls this endpoint without a Supabase user JWT.
// - Security comes from Stripe signature verification using STRIPE_WEBHOOK_SECRET.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Stripe remains authoritative for rows it owns. Future RevenueCat handling
// should not downgrade active/trialing rows with subscription_source='stripe'.
const SUBSCRIPTION_SOURCE_STRIPE = 'stripe';
const STRIPE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

async function verifyStripeSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const expected = await hmacSha256(secret, `${timestamp}.${rawBody}`);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

async function stripeGet(path: string, stripeSecretKey: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message || `Stripe GET ${path} failed with ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function normalizePlan(input: unknown): 'pro' | 'teams' | 'free' {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'team' || value === 'teams') return 'teams';
  if (value === 'pro') return 'pro';
  return 'free';
}

function planFromPrice(priceId: string | null): 'pro' | 'teams' {
  if (!priceId) throw new Error('Stripe subscription item did not include a price id.');
  const proPrice = Deno.env.get('STRIPE_PRO_PRICE_ID');
  const teamsPrice = Deno.env.get('STRIPE_TEAMS_PRICE_ID');
  if (!proPrice || !teamsPrice) {
    throw new Error('Stripe price id mapping is not configured.');
  }

  if (teamsPrice && priceId === teamsPrice) return 'teams';
  if (proPrice && priceId === proPrice) return 'pro';
  throw new Error('Stripe price id does not match the configured Pro or Team price.');
}

async function resolveSubscriptionDetails(stripeSecretKey: string, subscriptionId: string | null) {
  if (!subscriptionId) {
    return {
      status: null,
      priceId: null,
      customerId: null,
      metadataPlan: 'free' as const,
      metadataUserId: null,
      periodEnd: null,
    };
  }

  const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecretKey);
  if (!STRIPE_SUBSCRIPTION_STATUSES.has(subscription?.status)) throw new Error('Stripe subscription status is unavailable.');
  const item = subscription?.items?.data?.[0];
  const priceId = item?.price?.id || subscription?.plan?.id || null;

  return {
    status: subscription?.status || null,
    priceId,
    customerId: typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || null,
    metadataPlan: normalizePlan(subscription?.metadata?.plan),
    metadataUserId: subscription?.metadata?.user_id || subscription?.metadata?.supabase_user_id || null,
    periodEnd: stripePeriodEnd(subscription),
  };
}

async function handleCheckoutSessionCompleted(event: any, admin: any, stripeSecretKey: string) {
  const session = event?.data?.object || {};
  const userId = session.client_reference_id || session.metadata?.user_id || session.metadata?.supabase_user_id || null;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const details = await resolveSubscriptionDetails(stripeSecretKey, subscriptionId);
  const pricePlan = planFromPrice(details.priceId);
  const metadataPlan = normalizePlan(session.metadata?.plan || details.metadataPlan);
  const plan = pricePlan || metadataPlan;
  const finalUserId = userId || details.metadataUserId;

  if (!finalUserId) {
    throw new Error('checkout.session.completed did not include client_reference_id or user metadata.');
  }

  const { error } = await admin.from('user_subscriptions').upsert({
    user_id: finalUserId,
    plan,
    status: details.status || session.subscription_status || 'active',
    subscription_source: SUBSCRIPTION_SOURCE_STRIPE,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : details.customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: details.priceId,
    stripe_checkout_session_id: session.id,
    current_period_end: details.periodEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

type StripeSubscription = {
  id?: string; customer?: string | { id?: string }; status?: string;
  current_period_end?: number | null; plan?: { id?: string };
  metadata?: { plan?: string; user_id?: string; supabase_user_id?: string };
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number | null }> };
};

async function upsertSubscriptionFromStripeSubscription(subscription: StripeSubscription, admin: ReturnType<typeof createClient>) {
  if (!subscription.status || !STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)) throw new Error('Stripe subscription status is unavailable.');
  const subscriptionId = subscription.id || null;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
  const item = subscription?.items?.data?.[0];
  const priceId = item?.price?.id || subscription?.plan?.id || null;
  const pricePlan = planFromPrice(priceId);
  const metadataPlan = normalizePlan(subscription?.metadata?.plan);
  const plan = pricePlan || metadataPlan;

  let userId =
    subscription?.metadata?.user_id ||
    subscription?.metadata?.supabase_user_id ||
    null;

  if (!userId && subscriptionId) {
    const { data } = await admin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    userId = data?.user_id || null;
  }

  if (!userId && customerId) {
    const { data } = await admin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = data?.user_id || null;
  }

  if (!userId) {
    throw new Error('Subscription event could not be matched to a Supabase user.');
  }

  const { error } = await admin.from('user_subscriptions').upsert({
    user_id: userId,
    plan,
    status: subscription.status || null,
    subscription_source: SUBSCRIPTION_SOURCE_STRIPE,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    // Stripe Basil+ moved billing periods onto subscription items. Keep older
    // API payloads supported without using a stale database date to revoke access.
    current_period_end: stripePeriodEnd(subscription),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

function stripePeriodEnd(subscription: StripeSubscription): string | null {
  const seconds = subscription?.items?.data?.[0]?.current_period_end ?? subscription?.current_period_end;
  return typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 8_640_000_000_000
    ? new Date(seconds * 1000).toISOString() : null;
}

async function handleSubscriptionChanged(event: { data?: { object?: { id?: unknown } } }, admin: ReturnType<typeof createClient>, stripeSecretKey: string) {
  const id = event?.data?.object?.id;
  if (typeof id !== 'string' || !id.startsWith('sub_')) throw new Error('Subscription event missing its subscription ID.');
  // Signed webhook deliveries can arrive out of order. Reconcile the current
  // provider state instead of restoring an old active/trialing event snapshot.
  const current = await stripeGet(`subscriptions/${encodeURIComponent(id)}`, stripeSecretKey);
  if (current?.id !== id) throw new Error('Stripe returned a different subscription.');
  await upsertSubscriptionFromStripeSubscription(current, admin);
}

async function handleInvoicePaymentEvent(event: any, admin: any, stripeSecretKey: string) {
  const invoice = event?.data?.object || {};
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;

  if (!subscriptionId) {
    throw new Error('Invoice event did not include a subscription id.');
  }

  const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecretKey);
  // A delayed failure notification must not revoke a subscription that Stripe
  // now reports renewed/active. Billing status comes from the fetched subscription.
  await upsertSubscriptionFromStripeSubscription(subscription, admin);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const projectUrl = Deno.env.get('PROJECT_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
  const teamsPriceId = Deno.env.get('STRIPE_TEAMS_PRICE_ID');

  if (!webhookSecret || !stripeSecretKey || !projectUrl || !serviceRoleKey || !proPriceId || !teamsPriceId) {
    return json({ error: 'Server is missing required Stripe webhook configuration.' }, 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  const verified = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!verified) return json({ error: 'Invalid Stripe signature.' }, 401);

  const event = JSON.parse(rawBody);
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event, admin, stripeSecretKey);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChanged(event, admin, stripeSecretKey);
        break;
      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentEvent(event, admin, stripeSecretKey);
        break;
      default:
        break;
    }

    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-webhook]', event?.type, message);
    return json({ error: message }, 500);
  }
});
