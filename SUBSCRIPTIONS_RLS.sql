-- ---------------------------------------------------------------------------
-- public.user_subscriptions — table + RLS for the OnlyFast subscription system
-- ---------------------------------------------------------------------------
-- This is SAFE to run multiple times (idempotent). It does NOT modify any other
-- tables. Run it in the Supabase SQL editor for the OnlyFast project.
--
-- The Stripe webhook (running with the service role key) upserts rows here.
-- The frontend only needs to READ its own row, so we add a SELECT policy
-- scoped to the logged-in user. We intentionally do NOT add insert/update/delete
-- policies for end users — only Stripe (via the service role) may write.
-- ---------------------------------------------------------------------------

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_checkout_session_id text,
  plan text,                       -- 'pro' | 'teams' (or null/'free')
  status text,                     -- 'active' | 'trialing' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' ...
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Make sure the columns the app reads exist even if the table predates this script.
alter table public.user_subscriptions add column if not exists stripe_customer_id text;
alter table public.user_subscriptions add column if not exists stripe_subscription_id text;
alter table public.user_subscriptions add column if not exists stripe_price_id text;
alter table public.user_subscriptions add column if not exists stripe_checkout_session_id text;
alter table public.user_subscriptions add column if not exists plan text;
alter table public.user_subscriptions add column if not exists status text;
alter table public.user_subscriptions add column if not exists created_at timestamptz default now();
alter table public.user_subscriptions add column if not exists updated_at timestamptz default now();

-- Enable Row Level Security.
alter table public.user_subscriptions enable row level security;

-- Users may SELECT only their own subscription row.
drop policy if exists "Users can view their own subscription" on public.user_subscriptions;
create policy "Users can view their own subscription"
  on public.user_subscriptions
  for select
  using (auth.uid() = user_id);

-- (No user-facing insert/update/delete policies. The Stripe webhook writes
--  using the service role key, which bypasses RLS.)
