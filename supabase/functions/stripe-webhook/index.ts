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
    };
  }

  const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecretKey);
  const item = subscription?.items?.data?.[0];
  const priceId = item?.price?.id || subscription?.plan?.id || null;

  return {
    status: subscription?.status || null,
    priceId,
    customerId: typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || null,
    metadataPlan: normalizePlan(subscription?.metadata?.plan),
    metadataUserId: subscription?.metadata?.user_id || subscription?.metadata?.supabase_user_id || null,
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

  await admin.from('user_subscriptions').upsert({
    user_id: finalUserId,
    plan,
    status: details.status || session.subscription_status || 'active',
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : details.customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: details.priceId,
    stripe_checkout_session_id: session.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function upsertSubscriptionFromStripeSubscription(subscription: any, admin: any, statusOverride?: string | null) {
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

  await admin.from('user_subscriptions').upsert({
    user_id: userId,
    plan,
    status: statusOverride || subscription.status || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function handleSubscriptionChanged(event: any, admin: any) {
  await upsertSubscriptionFromStripeSubscription(event?.data?.object || {}, admin);
}

async function handleInvoicePaymentEvent(event: any, admin: any, stripeSecretKey: string) {
  const invoice = event?.data?.object || {};
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;

  if (!subscriptionId) {
    throw new Error('Invoice event did not include a subscription id.');
  }

  const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecretKey);
  const statusOverride =
    event.type === 'invoice.payment_failed'
      ? 'past_due'
      : subscription?.status || 'active';

  await upsertSubscriptionFromStripeSubscription(subscription, admin, statusOverride);
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
        await handleSubscriptionChanged(event, admin);
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
