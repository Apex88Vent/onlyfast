// database Edge Function: get-suggestions
//
// Deploy to YOUR database project (thpyjvwtfvfxiufchrxn) by either:
//   A) Dashboard -> Edge Functions -> Create a new function
//        Name: get-suggestions   |   Verify JWT: OFF
//        Paste the contents below, click Deploy.
//        Then add the secret: Project Settings -> Edge Functions -> Secrets
//          OPENAI_API_KEY = sk-your-real-openai-key
//   B) Via CLI:
//        mkdir -p database/functions/get-suggestions
//        cp docs/edge-functions/get-suggestions.ts database/functions/get-suggestions/index.ts
//        database link --project-ref thpyjvwtfvfxiufchrxn
//        database secrets set OPENAI_API_KEY=sk-your-real-openai-key
//        database functions deploy get-suggestions --no-verify-jwt
//
// Accepts:
//   {
//     entry_handling, mid_handling, exit_handling,  // 'tight' | 'loose' | 'perfect' | etc.
//     currentSetup,                                  // full setup object from the form
//     raceClass,                                     // e.g. 'Lightning Sprints', 'Dwarf Cars'
//     communityData,                                 // optional array of comparable setups
//     whatIfQuestion                                 // optional free-text "what if I change X?"
//   }
// Returns: { suggestion: string }

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
            'OPENAI_API_KEY is not configured on this database project. Add it with: database secrets set OPENAI_API_KEY=sk-...',
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
