# Deploy the AI "get-suggestions" Edge Function

Setup Assist (the AI feature) needs one Supabase Edge Function deployed to **your**
project: `thpyjvwtfvfxiufchrxn`. Until it's deployed, the app will show:

> Setup Assist can't reach the AI service because the get-suggestions edge
> function does not appear to be deployed to your database project yet.

This file walks you through the **fastest** path. **No CLI required.**

> The weather/GPS feature does **not** need any edge function — it now calls
> Open-Meteo directly from the browser.

---

## Where is the source code?

The function code lives in this repo at:

```
docs/edge-functions/get-suggestions.ts
```

You can open that file in any code editor (VS Code, GitHub web UI, etc.) and
copy its full contents. It's also pasted in full at the **bottom of this file**
so you don't have to hunt for it — see "Full source to paste" below.

---

## Step-by-step (Supabase Dashboard, ~2 minutes)

1. Open the Edge Functions page for your project:
   **https://supabase.com/dashboard/project/thpyjvwtfvfxiufchrxn/functions**

2. Click **Deploy a new function** (or **Create a new function**).

3. Fill in:
   - **Name:** `get-suggestions` (must be exact — no caps, no spaces)
   - **Verify JWT:** **OFF** (toggle it off — the app calls this without a
     logged-in user during onboarding)

4. **Delete** any starter code in the editor, then **paste** the full source
   from the bottom of this file (or from `docs/edge-functions/get-suggestions.ts`).

5. Click **Deploy function**. Wait for the green "Deployed" badge.

6. Add your OpenAI key as a secret:
   - Go to **Project Settings → Edge Functions → Secrets**
     (direct link: https://supabase.com/dashboard/project/thpyjvwtfvfxiufchrxn/settings/functions)
   - Click **Add new secret**
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-...` (your real OpenAI API key from
     https://platform.openai.com/api-keys)
   - Save. **No redeploy needed** — the next call picks it up.

7. Reload the app and click **Get Setup Suggestions**. It should now work.

---

## How to verify it's deployed

Run this in any terminal (or use Postman/Insomnia):

```bash
curl -i -X POST \
  https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/get-suggestions \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -H "Authorization: Bearer sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -d '{"entry_handling":"tight","mid_handling":"perfect","exit_handling":"loose","raceClass":"Dwarf Cars","currentSetup":{"cross_weight":52}}'
```

Expected outcomes:

| Result | Meaning | Fix |
|---|---|---|
| `200` + JSON `{"suggestion":"..."}` | ✅ Works | Done. |
| `404` / "Function not found" | Not deployed (or wrong name) | Redo step 3. Name must be exactly `get-suggestions`. |
| `401` / "Invalid JWT" | Verify JWT was left ON | Edit the function, toggle Verify JWT **OFF**, save. |
| `500` mentioning `OPENAI_API_KEY` | Secret not set | Redo step 6. |
| `502` with OpenAI error text | OpenAI rejected the request (bad key, no quota, etc.) | Check your OpenAI account / billing / key. |

---

## Full source to paste

Copy everything between the lines below into the Supabase function editor.
This is identical to `docs/edge-functions/get-suggestions.ts`.

```ts
// Supabase Edge Function: get-suggestions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SetupShape { [key: string]: unknown }

function buildSetupDetails(currentSetup: SetupShape | null | undefined, raceClass: string): string {
  if (!currentSetup) return '';
  const v = (k: string) => (currentSetup[k] ?? 'N/A') as string | number;

  const base = `
Current Setup:
- Race Class: ${raceClass || 'N/A'}
- Cross Weight: ${v('cross_weight')}%
- Toe: ${v('toe')}
- Front Ride Height: ${v('front_ride_height')}
- Rear Ride Height: ${v('rear_ride_height')}
- RF Caster: ${v('rf_caster')}°, Camber: ${v('rf_camber')}°, Pressure: ${v('rf_pressure')} psi, Spring: ${v('rf_spring')} lbs, Shock: ${v('rf_shock')}
- LF Caster: ${v('lf_caster')}°, Camber: ${v('lf_camber')}°, Pressure: ${v('lf_pressure')} psi, Spring: ${v('lf_spring')} lbs, Shock: ${v('lf_shock')}
- LR Tire: ${v('lr_tire_size')}, Pressure: ${v('lr_pressure')} psi, Spring: ${v('lr_spring')} lbs, Shock: ${v('lr_shock')}
- RR Tire: ${v('rr_tire_size')}, Pressure: ${v('rr_pressure')} psi, Spring: ${v('rr_spring')} lbs, Shock: ${v('rr_shock')}
- Stagger: ${v('stagger')}"
- LR Trailing Arm: ${v('lr_trailing_arm')}°
- RR Trailing Arm: ${v('rr_trailing_arm')}°
- Third Link: ${v('third_link')}
- Panhard Bar: ${v('panhard_bar')}
- Gear Ratio: ${v('gear_ratio')}
- Track Condition: ${v('trackCondition')}
- Temperature: ${v('temperature')}°F
- Humidity: ${v('humidity')}%`;

  if (raceClass === 'Lightning Sprints') {
    return base + `
- Top Wing Angle: ${v('top_wing_angle')}°
- Top Wing Offset: ${v('top_wing_offset')}
- Nose Wing Angle: ${v('nose_wing_angle')}°
- Side Boards: ${v('side_boards')}
- Nerf Bar Height: ${v('nerf_bar_height')}
- Front Sprocket: ${v('front_sprocket')}T
- Rear Sprocket: ${v('rear_sprocket')}T
- Front Axle: ${v('front_axle')}
- Fuel Mixture: ${v('fuel_mixture')}
- Total Weight: ${v('total_weight')} lbs
- Left Side %: ${v('left_side_pct')}%
- Rear Weight %: ${v('rear_weight_pct')}%`;
  }
  return base;
}

function buildCommunityContext(communityData: any[] | undefined, raceClass: string): string {
  if (!communityData || communityData.length === 0) return '';
  const perfect = communityData.filter(
    (s) => s.entry_handling === 'perfect' && s.mid_handling === 'perfect' && s.exit_handling === 'perfect',
  );
  let ctx = `\n\nCommunity data from ${communityData.length} setups in the "${raceClass}" class shows these trends:\n`;
  if (perfect.length > 0) {
    const avgCross = perfect.reduce((s, x) => s + (Number(x.cross_weight) || 0), 0) / perfect.length;
    const avgStagger = perfect.reduce((s, x) => s + (Number(x.stagger) || 0), 0) / perfect.length;
    ctx += `- Average cross weight in perfect setups: ${avgCross.toFixed(1)}%\n`;
    ctx += `- Average stagger in perfect setups: ${avgStagger.toFixed(2)}"\n`;
    ctx += `- Number of perfect setups found: ${perfect.length}\n`;
  }
  return ctx;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error:
            'OPENAI_API_KEY is not configured. Add it in Project Settings → Edge Functions → Secrets.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      entry_handling,
      mid_handling,
      exit_handling,
      currentSetup,
      raceClass,
      communityData,
      whatIfQuestion,
    } = body || {};

    const setupDetails = buildSetupDetails(currentSetup, raceClass || '');
    const communityContext = buildCommunityContext(communityData, raceClass || '');

    const classNote =
      raceClass === 'Lightning Sprints'
        ? ' and lightning sprint cars (open-wheel, winged, motorcycle-engine powered sprint cars)'
        : raceClass === 'Dwarf Cars'
        ? ' and dwarf cars (5/8 scale vintage-bodied cars with motorcycle engines)'
        : '';

    const prompt = whatIfQuestion
      ? `You are an expert dirt track oval racing chassis setup consultant specializing in ${raceClass || 'dirt track'} cars. A racer wants to know what would happen if they made a specific change to their setup.

${setupDetails}

Current Handling Feedback:
- Corner Entry: ${entry_handling || 'not specified'}
- Mid Corner: ${mid_handling || 'not specified'}
- Corner Exit: ${exit_handling || 'not specified'}
${communityContext}

The racer asks: "${whatIfQuestion}"

Based on their current setup and handling, explain:
1. What effect this change would have on the car's handling
2. How it would affect corner entry, mid-corner, and exit behavior
3. Whether this change would likely improve or worsen their current handling issues
4. Any secondary effects or interactions with other setup components
5. Your recommendation on whether to make this change

Be specific, practical, and relate your answer to dirt track oval racing dynamics. Keep the response focused and actionable.`
      : `You are an expert dirt track oval racing chassis setup consultant specializing in ${raceClass || 'dirt track'} cars. A racer needs help with their setup.

${setupDetails}

Handling Feedback:
- Corner Entry: ${entry_handling || 'not specified'}
- Mid Corner: ${mid_handling || 'not specified'}
- Corner Exit: ${exit_handling || 'not specified'}
${communityContext}

Based on this information, provide specific, actionable setup change suggestions. For each corner phase that is NOT "perfect", explain:
1. What's happening mechanically
2. Specific adjustments to make (with approximate values)
3. Priority of changes (what to try first)

Keep suggestions practical and specific to dirt track oval racing${classNote}. Format with clear headers for each phase. If a phase is "perfect", acknowledge it briefly and move on. Be concise but thorough.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert dirt track oval racing chassis setup consultant. Give practical, specific, mechanically-grounded advice.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({
          error: `OpenAI request failed (${aiResponse.status})`,
          details: errText.slice(0, 500),
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const data = await aiResponse.json();
    const suggestion =
      data?.choices?.[0]?.message?.content?.trim() || 'Unable to generate suggestions at this time.';

    return new Response(JSON.stringify({ suggestion }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
```

---

## Why can't the app deploy this for me?

Edge functions run on Supabase's servers, not in this codebase. Deploying
them requires being logged in as the owner of project `thpyjvwtfvfxiufchrxn`
— that's you, not the app builder. The app can only ship the code; you have
to push the "Deploy" button.

Once deployed, no further attention is needed. The function stays live and
the in-app error will go away.
