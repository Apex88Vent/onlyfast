import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import { billing2027Handler } from '../_shared/billing2027-handlers.ts';
// Approved non-secret deployment profile for this authenticated testing claim
// route only. The shared guard still requires the exact testing Supabase URL.
// Provider handlers remain disabled until their sandbox configuration exists.
const testingClaimEnvironment = (name: string) => name === 'ONLYFAST_2027_BILLING_ENABLED' ? 'true'
  : name === 'BILLING_2027_ENVIRONMENT' ? 'sandbox' : Deno.env.get(name);
Deno.serve(billing2027Handler('claim',testingClaimEnvironment,createClient));
