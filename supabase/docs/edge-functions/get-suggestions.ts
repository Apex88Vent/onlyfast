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

const DIRT_HANDLING_TERMINOLOGY = 'On dirt track, Tight means the car does NOT want to turn: it pushes, understeers, or resists rotation. Loose means the rear steps out: it oversteers or is free. Never interpret tight as the front turning too well.';

const SETUP_ASSIST_FORMAT_INSTRUCTIONS = 'Return the specified JSON structure for both setup suggestions and What If answers. Use plain text within each field, no headings, Markdown, numbering, or embedded lists. Summary briefly describes the handling/problem; recommended_changes lists prioritized actions; why_reasoning explains their mechanical basis; expected_effect describes likely effects; notes_cautions includes interactions, uncertainty and missing information. Keep advice practical, concise and specific to the supplied car and discipline; do not assume unavailable adjustments or invent setup values. If telemetry instructions require a Telemetry evidence: line, put that exact prefixed line in notes_cautions.';

const ROAD_HANDLING_INSTRUCTIONS = 'For road racing, each named handling zone is an independent driver report. Keep Low Speed Turn Entry, Low Speed Turn Exit, High Speed Turn Entry, and High Speed Turn Exit separate; never substitute one speed or phase for another or collapse them into generic corner feedback. Prefix each recommended change, reasoning item, and expected effect with the exact affected zone label and its reported condition. Correlate the adjustment with that specific input and the supplied setup, explaining why it is relevant at that speed and phase. Distinguish braking/turn-in at entry from acceleration/unwinding at exit. Understeer means the front pushes or resists turning; oversteer means the rear steps out. Treat perfect as a zone to preserve, not an issue to fix. Treat not specified as unknown, never as an assumed problem. If an adjustment affects other zones, identify those zones and explain the trade-offs, particularly for zones reported perfect. High Speed S Turns is one combined zone. Straightaway feedback concerns gearing, not corner balance. Apply the same zone-specific correlation to What If answers.';

const listSchema = { type: 'array', items: { type: 'string' } };
const SETUP_ASSIST_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'setup_assist', strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        summary: { type: 'string' }, recommended_changes: listSchema,
        why_reasoning: listSchema, expected_effect: listSchema, notes_cautions: listSchema,
      },
      required: ['summary', 'recommended_changes', 'why_reasoning', 'expected_effect', 'notes_cautions'],
    },
  },
};

// Headings and lists are owned by the app, never by the model.
function formatSetupAssistResponse(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  let value: Record<string, unknown>;
  try { value = JSON.parse(content); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.summary !== 'string') return null;
  const sections = [
    ['recommended_changes', 'Recommended Changes'], ['why_reasoning', 'Why / Reasoning'],
    ['expected_effect', 'Expected Effect'], ['notes_cautions', 'Notes / Cautions'],
  ];
  if (sections.some(([key]) => !Array.isArray(value[key]) || (value[key] as unknown[]).some(item => typeof item !== 'string'))) return null;
  const clean = (text: string) => text.replace(/[\r\n]+/g, ' ').replace(/^\s*(?:#{1,6}\s+|[-*]\s+|\d+[.)]\s+)/, '').replace(/[#*`]/g, '').trim();
  if (!clean(value.summary)) return null;
  return [`## Summary\n${clean(value.summary)}`, ...sections.map(([key, heading]) => {
    const items = (value[key] as string[]).map(clean).filter(Boolean);
    const lines = items.length ? items.map(item => /^Telemetry evidence:/i.test(item) ? item : `- ${item}`) : ['- None specified.'];
    return `## ${heading}\n${lines.join('\n')}`;
  })].join('\n\n');
}

function setupAssistDiscipline(value: unknown): string {
  return value === 'road_course' ? 'road course racing' : value === 'pavement_oval' ? 'pavement oval racing' : 'dirt track oval racing';
}

function roadHandlingPrompt(setup: Record<string, unknown> | null | undefined): string {
  const zones = [
    ['road_low_speed_entry', 'Low Speed Turn Entry'], ['road_low_speed_exit', 'Low Speed Turn Exit'],
    ['road_high_speed_entry', 'High Speed Turn Entry'], ['road_high_speed_exit', 'High Speed Turn Exit'],
    ['road_high_speed_s_turns', 'High Speed S Turns (whole section)'], ['road_straightaway', 'Straightaway'],
  ];
  return zones.map(([key, label]) => {
    const options = key === 'road_straightaway' ? ['over_geared', 'under_geared', 'perfect'] : ['understeer', 'oversteer', 'perfect'];
    const value = setup?.[key];
    return `- ${label}: ${typeof value === 'string' && options.includes(value) ? value.replace(/_/g, ' ') : 'not specified'}`;
  }).join('\n');
}

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
      discipline,
      communityData,
      whatIfQuestion,
    } = body || {};

    const racingDiscipline = setupAssistDiscipline(discipline);
    const setupDetails = discipline === 'road_course' || discipline === 'pavement_oval'
      ? 'Current Setup (only supplied fields; preserve their stated units):\n' + JSON.stringify(currentSetup || {})
      : buildSetupDetails(currentSetup, raceClass || '');
    const handlingFeedback = discipline === 'road_course'
      ? roadHandlingPrompt(currentSetup)
      : `- Corner Entry: ${entry_handling || 'not specified'}\n- Mid Corner: ${mid_handling || 'not specified'}\n- Corner Exit: ${exit_handling || 'not specified'}`;
    const communityContext = buildCommunityContext(communityData, raceClass || '');

    const classNote =
      raceClass === 'Lightning Sprints'
        ? ' and lightning sprint cars (open-wheel, winged, motorcycle-engine powered sprint cars)'
        : raceClass === 'Dwarf Cars'
        ? ' and dwarf cars (5/8 scale vintage-bodied cars with motorcycle engines)'
        : '';

    const prompt = whatIfQuestion
      ? `You are an expert ${racingDiscipline} chassis setup consultant specializing in ${raceClass || 'dirt track'} cars. A racer wants to know what would happen if they made a specific change to their setup.

${setupDetails}

Current Handling Feedback:
${handlingFeedback}
${communityContext}

The racer asks: "${whatIfQuestion}"

Based on their current setup and handling, explain:
1. What effect this change would have on the car's handling
2. How it would affect the supplied handling zones and gearing where relevant
3. Whether this change would likely improve or worsen their current handling issues
4. Any secondary effects or interactions with other setup components
5. Your recommendation on whether to make this change

Be specific, practical, and relate your answer to ${racingDiscipline} dynamics. Keep the response focused and actionable.`
      : `You are an expert ${racingDiscipline} chassis setup consultant specializing in ${raceClass || 'dirt track'} cars. A racer needs help with their setup.

${setupDetails}

Handling Feedback:
${handlingFeedback}
${communityContext}

Based on this information, provide specific, actionable setup change suggestions. For each supplied handling zone that is NOT "perfect", explain:
1. What's happening mechanically
2. Specific adjustments to make (with approximate values)
3. Priority of changes (what to try first)

Keep suggestions practical and specific to ${racingDiscipline}${classNote}. Use the required structured response. If a phase is "perfect", acknowledge it briefly and move on. Be concise but thorough.`;

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
              `You are an expert ${racingDiscipline} chassis setup consultant. ${DIRT_HANDLING_TERMINOLOGY} ${SETUP_ASSIST_FORMAT_INSTRUCTIONS} ${discipline === 'road_course' ? ROAD_HANDLING_INSTRUCTIONS : ''} Give practical, specific, mechanically-grounded advice.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: SETUP_ASSIST_RESPONSE_FORMAT,
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
    const suggestion = formatSetupAssistResponse(data?.choices?.[0]?.message?.content);
    if (!suggestion) {
      return new Response(JSON.stringify({ error: 'Setup Assist returned an incomplete response. Please try again.' }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
