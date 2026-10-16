import { EXPANDED_CLASS_CONFIGS, isDevelopmentClass } from './setupLibrary.ts';
import { calculatePavementWeights, normalizePavementToe } from './pavementSetupValues.ts';
import { ROAD_TRACK_KEYS, readRoadHandling } from './roadTrackFeedback.ts';

export const SETUP_LIBRARY_KEY = 'onlyfast_setup_library_v1';
interface LibrarySnapshot { version: 1; race_class: string; values: Record<string, string> }

export function readLibrarySnapshot(value: unknown, raceClass: string): LibrarySnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Partial<LibrarySnapshot>;
  if (snapshot.version !== 1 || snapshot.race_class !== raceClass || !snapshot.values || typeof snapshot.values !== 'object' || Array.isArray(snapshot.values)) return null;
  if (Object.values(snapshot.values).some(v => typeof v !== 'string')) return null;
  return { version: 1, race_class: raceClass, values: { ...snapshot.values } };
}

export function libraryFieldsFromRow(row: { race_class?: string; custom_fields?: Record<string, unknown> }): Record<string, string> {
  if (!isDevelopmentClass(row.race_class)) return {};
  const snapshot = readLibrarySnapshot(row.custom_fields?.[SETUP_LIBRARY_KEY], row.race_class!);
  if (!snapshot) return {};
  // Carry the whole snapshot as well as the visible fields so future unknown
  // fields survive an older client's edit/copy. Reserved IDs cannot shadow
  // row identity, session information or custom-sheet data.
  const visibleKeys = new Set(EXPANDED_CLASS_CONFIGS[row.race_class!]?.extraSections.flatMap(s => s.fields.map(f => f.key)) || []);
  if (EXPANDED_CLASS_CONFIGS[row.race_class!]?.category === 'road_course') ROAD_TRACK_KEYS.forEach(key => visibleKeys.add(key));
  const fields = Object.fromEntries(Object.entries(snapshot.values).filter(([key]) => visibleKeys.has(key)));
  if (EXPANDED_CLASS_CONFIGS[row.race_class!]?.category === 'road_course') ROAD_TRACK_KEYS.forEach(key => { fields[key] = readRoadHandling(key, fields[key]); });
  if (EXPANDED_CLASS_CONFIGS[row.race_class!]?.category === 'pavement_oval') Object.assign(fields, normalizePavementToe(fields));
  return { ...fields, [SETUP_LIBRARY_KEY]: JSON.stringify(snapshot) };
}

export function buildLibraryCustomFields(raceClass: string, state: Record<string, string>, customFields: Record<string, string> = {}): Record<string, unknown> {
  const config = EXPANDED_CLASS_CONFIGS[raceClass];
  if (!config) throw new Error('Unknown development setup class.');
  let prior: LibrarySnapshot | null = null;
  if (state[SETUP_LIBRARY_KEY]) {
    try { prior = readLibrarySnapshot(JSON.parse(state[SETUP_LIBRARY_KEY]), raceClass); } catch { /* old drafts have no snapshot */ }
  }
  const values = { ...(prior?.values || {}) };
  for (const section of config.extraSections) for (const field of section.fields) values[field.key] = state[field.key] ?? '';
  if (config.category === 'road_course') ROAD_TRACK_KEYS.forEach(key => { values[key] = readRoadHandling(key, state[key]); });
  if (config.category === 'pavement_oval') {
    Object.assign(values, normalizePavementToe(state));
    const calculated = calculatePavementWeights(state);
    for (const section of config.extraSections) for (const field of section.fields) {
      if (calculated[field.key] !== undefined) values[field.key] = calculated[field.key];
    }
  }
  return { ...customFields, [SETUP_LIBRARY_KEY]: { version: 1, race_class: raceClass, values } satisfies LibrarySnapshot };
}

export function rowWithLibraryFields<T extends { race_class?: string; custom_fields?: Record<string, unknown> }>(row: T): T & Record<string, unknown> {
  return { ...row, ...libraryFieldsFromRow(row) };
}
