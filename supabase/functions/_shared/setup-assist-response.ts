export const DIRT_HANDLING_TERMINOLOGY = 'On dirt track, Tight means the car does NOT want to turn: it pushes, understeers, or resists rotation. Loose means the rear steps out: it oversteers or is free. Never interpret tight as the front turning too well.';

export const SETUP_ASSIST_FORMAT_INSTRUCTIONS = 'Return the specified JSON structure for both setup suggestions and What If answers. Use plain text within each field, no headings, Markdown, numbering, or embedded lists. Summary briefly describes the handling/problem; recommended_changes lists prioritized actions; why_reasoning explains their mechanical basis; expected_effect describes likely effects; notes_cautions includes interactions, uncertainty and missing information. Keep advice practical, concise and specific to the supplied car and discipline; do not assume unavailable adjustments or invent setup values. If telemetry instructions require a Telemetry evidence: line, put that exact prefixed line in notes_cautions.';

export const ROAD_HANDLING_INSTRUCTIONS = 'For road racing, each named handling zone is an independent driver report. Keep Low Speed Turn Entry, Low Speed Turn Exit, High Speed Turn Entry, and High Speed Turn Exit separate; never substitute one speed or phase for another or collapse them into generic corner feedback. Prefix each recommended change, reasoning item, and expected effect with the exact affected zone label and its reported condition. Correlate the adjustment with that specific input and the supplied setup, explaining why it is relevant at that speed and phase. Distinguish braking/turn-in at entry from acceleration/unwinding at exit. Understeer means the front pushes or resists turning; oversteer means the rear steps out. Treat perfect as a zone to preserve, not an issue to fix. Treat not specified as unknown, never as an assumed problem. If an adjustment affects other zones, identify those zones and explain the trade-offs, particularly for zones reported perfect. High Speed S Turns is one combined zone. Straightaway feedback concerns gearing, not corner balance. Apply the same zone-specific correlation to What If answers.';

const listSchema = { type: 'array', items: { type: 'string' } };
export const SETUP_ASSIST_RESPONSE_FORMAT = {
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
export function formatSetupAssistResponse(content: unknown): string | null {
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

export function setupAssistDiscipline(value: unknown): string {
  return value === 'road_course' ? 'road course racing' : value === 'pavement_oval' ? 'pavement oval racing' : 'dirt track oval racing';
}

export function roadHandlingPrompt(setup: Record<string, unknown> | null | undefined): string {
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
