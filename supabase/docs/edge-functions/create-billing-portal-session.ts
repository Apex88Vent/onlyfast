// Supabase Edge Function: create-billing-portal-session
//
// Opens a Stripe Billing Portal session for the logged-in user so they can
// manage or cancel their subscription. Cancellation itself happens inside the
// Stripe Billing Portal; the existing stripe-webhook function then updates
// public.user_subscriptions when Stripe fires customer.subscription.updated /
// customer.subscription.deleted.
//
// Deploy to YOUR Supabase project by either:
//   A) Dashboard -> Edge Functions -> Create a new function
//        Name: create-billing-portal-session   |   Verify JWT: ON (recommended)
//        Paste the contents below, click Deploy.
//   B) Via CLI:
//        mkdir -p supabase/functions/create-billing-portal-session
//        cp docs/edge-functions/create-billing-portal-session.ts supabase/functions/create-billing-portal-session/index.ts
//        supabase functions deploy create-billing-portal-session
//
// Required secrets (Project Settings -> Edge Functions -> Secrets).
// NOTE: custom secret names may NOT start with SUPABASE_, so we use:
//   STRIPE_SECRET_KEY = sk_live_...   (server-side Stripe key — never exposed to the client)
//   PROJECT_URL       = https://YOUR-PROJECT-REF.supabase.co
//   SERVICE_ROLE_KEY  = your service role key (server-side only — never exposed to the client)
//   SITE_URL          = https://onlyfast.app
//
// Returns: { url: string } on success, or { error: string } with a non-200 status.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function getStripeCustomerFromSubscription(
  stripeSecretKey: string,
  subscriptionId: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    },
  );
  const subscription = await res.json();
  if (!res.ok) return null;

  const customer = subscription?.customer;
  return typeof customer === 'string' ? customer : customer?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const PROJECT_URL = Deno.env.get('PROJECT_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://onlyfast.app';

    if (!STRIPE_SECRET_KEY || !PROJECT_URL || !SERVICE_ROLE_KEY) {
      return json(
        { error: 'Server is missing required configuration. Please contact support.' },
        500,
      );
    }

    // ----- 1. Authenticate the caller -----
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'You must be signed in to manage billing.' }, 401);
    }

    const admin = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'Your session is invalid. Please sign in again.' }, 401);
    }
    const userId = userData.user.id;

    // ----- 2. Look up the Stripe customer id -----
    const { data: sub, error: subErr } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) {
      return json({ error: 'Could not load your subscription. Please try again.' }, 500);
    }

    let customerId = sub?.stripe_customer_id || null;
    const subscriptionId = sub?.stripe_subscription_id || null;
    if (!customerId && subscriptionId) {
      customerId = await getStripeCustomerFromSubscription(STRIPE_SECRET_KEY, subscriptionId);
      if (customerId) {
        await admin
          .from('user_subscriptions')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    }

    if (!customerId) {
      return json(
        { error: 'No Stripe billing account was found for your account. Please contact support to cancel this subscription.' },
        404,
      );
    }

    // ----- 3. Create the Stripe Billing Portal session -----
    const params = new URLSearchParams();
    params.set('customer', customerId);
    params.set('return_url', `${SITE_URL.replace(/\/$/, '')}/account`);

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const portal = await stripeRes.json();
    if (!stripeRes.ok) {
      const msg = portal?.error?.message || 'Stripe could not open the billing portal.';
      return json({ error: msg }, 502);
    }

    return json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
