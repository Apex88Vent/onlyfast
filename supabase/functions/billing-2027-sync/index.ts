import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import { billing2027Handler } from '../_shared/billing2027-handlers.ts';
Deno.serve(billing2027Handler('sync',Deno.env.get,createClient));
