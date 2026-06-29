// Required secrets:
// - OPENAI_API_KEY
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
//
// Recommended Supabase setting:
// - Verify JWT: ON after the frontend is confirmed to send user JWTs correctly.
// - Current legacy docs used Verify JWT: OFF for easier deployment, but this
//   function consumes paid OpenAI resources and should not stay public long-term.
//
// docs/edge-functions/scan-timing-screen.ts
//
// Supabase Edge Function: scan-timing-screen
// Version: scan-v3-testmode
//
// IMPORTANT: This file is the SOURCE OF TRUTH for the edge function. The
// frontend AI assistant cannot deploy this for you — you must deploy it
// yourself, either via the Supabase Dashboard or the Supabase CLI.
//
// ──────────────────────────────────────────────────────────────────────────
// DEPLOY VIA DASHBOARD (easiest)
// ──────────────────────────────────────────────────────────────────────────
//   1. Open: https://supabase.com/dashboard/project/thpyjvwtfvfxiufchrxn/functions
//   2. Find the function named exactly:  scan-timing-screen
//      (If it does not exist, click "Create a new function" and name it
//       exactly "scan-timing-screen". Turn "Verify JWT" OFF.)
//   3. Open the function and DELETE everything in the editor.
//   4. Paste THIS ENTIRE FILE into the editor.
//   5. Click "Deploy function".
//   6. Make sure the secret OPENAI_API_KEY is set under
//      Project Settings → Edge Functions → Secrets.
//
// ──────────────────────────────────────────────────────────────────────────
// DEPLOY VIA CLI
// ──────────────────────────────────────────────────────────────────────────
//   supabase login
//   supabase link --project-ref thpyjvwtfvfxiufchrxn
//   mkdir -p supabase/functions/scan-timing-screen
//   cp docs/edge-functions/scan-timing-screen.ts supabase/functions/scan-timing-screen/index.ts
//   supabase secrets set OPENAI_API_KEY=sk-...    # only if not already set
//   supabase functions deploy scan-timing-screen --no-verify-jwt
//
// ──────────────────────────────────────────────────────────────────────────
// VERIFY DEPLOYMENT
// ──────────────────────────────────────────────────────────────────────────
// After deploying, hit the function with testMode and confirm you see
//   "function_version": "scan-v3-testmode"
// in the response. If you don't see that string, you are still on an old
// deployment — repeat the dashboard steps above.
//
//   curl -X POST \
//     https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/scan-timing-screen \
//     -H "Content-Type: application/json" \
//     -H "apikey: sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
//     -H "Authorization: Bearer sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
//     -d '{"testMode": true}'
//
// Expected: status 200, JSON with "function_version":"scan-v3-testmode",
// "stage":"test-mode", and a fully-populated parsed_data object.
//
// ──────────────────────────────────────────────────────────────────────────

// @ts-ignore - Deno-style import, valid inside the Supabase edge runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FUNCTION_VERSION = 'scan-v3-testmode';
const OPENAI_TIMEOUT_MS = 30_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
};

function json(body: Record<string, unknown>, status = 200): Response {
  // Always include function_version so the frontend can confirm deployment.
  const withVersion = { function_version: FUNCTION_VERSION, ...body };
  return new Response(JSON.stringify(withVersion), {
    status,
    headers: JSON_HEADERS,
  });
}

async function requireUser(req: Request): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ success: false, stage: 'auth-config', error: 'Server auth configuration is missing.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ success: false, stage: 'auth', error: 'Sign in to use timing scan.' }, 401);

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    return json({ success: false, stage: 'auth', error: 'Your session is invalid. Please sign in again.' }, 401);
  }
  return null;
}

// Hardcoded test-mode payload. Returned verbatim when body.testMode === true.
const TEST_MODE_RESPONSE = {
  success: true,
  stage: 'test-mode',
  parsed_data: {
    track_name: 'TEST TRACK',
    event_name: 'TEST EVENT',
    date: '2026-05-14',
    class_name: 'Dwarf Cars',
    session_name: 'TEST SESSION',
    driver_name: 'TEST DRIVER',
    car_number: '88M',
    starting_position: 10,
    finish_position: 5,
    positions_gained_lost: 5,
    total_laps: 1,
    best_lap: 15.123,
    fastest_lap_time: 15.123,
    fastest_lap_on_lap: 1,
    slowest_lap_time: 15.123,
    average_lap_time: 15.123,
    lap_times: [{ lap_number: 1, lap_time: 15.123 }],
  },
  _debug: {
    testMode: true,
    bypassedOpenAI: true,
  },
};

serve(async (req: Request): Promise<Response> => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(
      {
        success: false,
        stage: 'method',
        error: `Method ${req.method} not allowed`,
      },
      405,
    );
  }

  const authError = await requireUser(req);
  if (authError) return authError;

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json(
      {
        success: false,
        stage: 'body-parse',
        error: 'Request body must be valid JSON',
      },
      400,
    );
  }

  // ── TEST MODE: must run BEFORE any image / OpenAI logic ────────────────
  console.log('TEST MODE RECEIVED', body?.testMode);
  if (body?.testMode === true) {
    return json(TEST_MODE_RESPONSE, 200);
  }

  // ── Input validation (real scan) ────────────────────────────────────────
  const imageBase64: string | undefined = body?.imageBase64;
  const mimeType: string = body?.mimeType || 'image/jpeg';
  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return json(
      {
        success: false,
        stage: 'input-validation',
        error:
          'imageBase64 is required (base64 string, no data URL prefix). ' +
          'Pass testMode:true to bypass image validation for debugging.',
      },
      400,
    );
  }

  // ── Config ──────────────────────────────────────────────────────────────
  // @ts-ignore - Deno global
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return json(
      {
        success: false,
        stage: 'config',
        error:
          'OPENAI_API_KEY secret is not set on this project. Add it under ' +
          'Project Settings → Edge Functions → Secrets.',
      },
      500,
    );
  }

  // ── Build OpenAI vision request ────────────────────────────────────────
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
  const systemPrompt =
    "You are an OCR assistant for dirt-oval racing timing/results screenshots " +
    "(MyRacePass etc.). Extract structured race data. Return ONLY valid JSON, " +
    "no prose, no markdown fences.";

  const userPrompt = `Extract these fields from the screenshot and return JSON with EXACTLY this shape:
{
  "track_name": string|null,
  "event_name": string|null,
  "date": string|null,                // ISO YYYY-MM-DD if visible
  "class_name": string|null,
  "session_name": string|null,        // "practice"|"qualifying"|"heat"|"b_main"|"a_main" or raw label
  "driver_name": string|null,
  "car_number": string|null,
  "starting_position": number|null,
  "finish_position": number|null,
  "positions_gained_lost": number|null,   // start - finish (positive = gained)
  "total_laps": number|null,
  "fastest_lap_time": number|null,        // seconds
  "fastest_lap_on_lap": number|null,      // which lap # was fastest
  "slowest_lap_time": number|null,        // seconds
  "average_lap_time": number|null,        // seconds
  "lap_times": [ { "lap_number": number, "lap_time": number } ],
  "confidence": number,                    // 0..1
  "fields_missing": string[],
  "raw_text": string                       // verbatim text you read off the image
}
If a field is not visible, return null (or [] / "" for arrays/strings) and list its name in fields_missing.`;

  // ── Call OpenAI with a hard AbortController timeout ────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let openaiRes: Response;
  let openaiText = '';
  try {
    console.log('OpenAI vision call starting');
    openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 1500,
      }),
    });
    openaiText = await openaiRes.text();
    console.log('OpenAI vision call finished');
  } catch (err: any) {
    console.log('OpenAI vision call failed or timed out', err?.name, err?.message);
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError';
    return json(
      {
        success: false,
        stage: isAbort ? 'ai-timeout' : 'ai-call',
        detail: isAbort
          ? 'OpenAI vision request timed out before Supabase killed the function'
          : `OpenAI fetch failed: ${err?.message || String(err)}`,
      },
      isAbort ? 504 : 502,
    );
  }
  clearTimeout(timeoutId);

  if (!openaiRes.ok) {
    return json(
      {
        success: false,
        stage: 'ai-call',
        error: `OpenAI returned HTTP ${openaiRes.status}`,
        detail: openaiText.slice(0, 500),
      },
      502,
    );
  }

  // ── Parse OpenAI response ──────────────────────────────────────────────
  let openaiJson: any;
  try {
    openaiJson = JSON.parse(openaiText);
  } catch (_e) {
    return json(
      {
        success: false,
        stage: 'ai-empty',
        error: 'OpenAI response was not valid JSON',
        detail: openaiText.slice(0, 500),
      },
      502,
    );
  }
  const content: string = openaiJson?.choices?.[0]?.message?.content || '';
  if (!content) {
    return json(
      {
        success: false,
        stage: 'ai-empty',
        error: 'OpenAI returned no message content',
      },
      502,
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (_e) {
    return json(
      {
        success: false,
        stage: 'json-parse',
        error: 'Could not parse JSON from OpenAI message content',
        detail: content.slice(0, 500),
      },
      502,
    );
  }

  // ── Derive missing convenience fields ──────────────────────────────────
  const laps: Array<{ lap_number: number; lap_time: number }> = Array.isArray(
    parsed?.lap_times,
  )
    ? parsed.lap_times
        .map((l: any) => ({
          lap_number: Number(l?.lap_number ?? l?.lap),
          lap_time: Number(l?.lap_time ?? l?.time ?? l?.seconds),
        }))
        .filter(
          (l: any) => Number.isFinite(l.lap_number) && Number.isFinite(l.lap_time),
        )
    : [];

  if (laps.length > 0) {
    const fastest = laps.reduce((a, b) => (b.lap_time < a.lap_time ? b : a));
    const slowest = laps.reduce((a, b) => (b.lap_time > a.lap_time ? b : a));
    const avg = laps.reduce((s, l) => s + l.lap_time, 0) / laps.length;
    if (parsed.fastest_lap_time == null) parsed.fastest_lap_time = fastest.lap_time;
    if (parsed.fastest_lap_on_lap == null) parsed.fastest_lap_on_lap = fastest.lap_number;
    if (parsed.slowest_lap_time == null) parsed.slowest_lap_time = slowest.lap_time;
    if (parsed.average_lap_time == null)
      parsed.average_lap_time = Math.round(avg * 1000) / 1000;
    if (parsed.total_laps == null) parsed.total_laps = laps.length;
    parsed.lap_times = laps;
  }

  if (
    parsed.positions_gained_lost == null &&
    typeof parsed.starting_position === 'number' &&
    typeof parsed.finish_position === 'number'
  ) {
    parsed.positions_gained_lost =
      parsed.starting_position - parsed.finish_position;
  }

  return json(
    {
      success: true,
      stage: 'ok',
      parsed_data: parsed,
      // mirror common keys at the top level for older frontend code
      ...parsed,
      model_used: 'gpt-4o-mini',
      provider: 'openai',
    },
    200,
  );
});
