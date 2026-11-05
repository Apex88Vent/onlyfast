// Shared fixture provenance only. It grants no application or membership access.
export const QA_CATALOG = 'onlyfast-qa-v1';
export const QA_MARKER = 'onlyfast_qa_v1';
export const QA_EMAIL = 'test@test.com';
export const QA_PRODUCTION_REF = 'thpyjvwtfvfxiufchrxn';
export const QA_PRODUCTION_USER = '4b9864ff-2195-4be0-83a4-39308446577e';
export const QA_RESET_CONFIRMATION = 'RESET-ONLYFAST-QA-FIXTURES';
export const QA_CLEANUP_CONFIRMATION = 'CLEANUP-ONLYFAST-QA-RUN';
export const QA_TABLE_OWNERS = { race_setups: 'user_id', race_schedule: 'user_id', shared_setups: 'shared_by' } as const;
export type QATable = keyof typeof QA_TABLE_OWNERS;
export interface QARecord { table: QATable; id: string; key: string }
export const QA_KEYS = [
  ...['dirt', 'pavement', 'road', 'shifter', 'clutch'].flatMap(kind =>
    ['base', 'hotlaps', 'heat', 'main'].map(session => `setup:${kind}:${session}`)),
  'schedule:past', 'schedule:current', 'schedule:next', 'share:valid',
];
export const isUUID = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);

export async function qaFixtureId(project: string, user: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${QA_CATALOG}|${project}|${user}|${key}`));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function qaMarker(key: string) { return { catalog: QA_CATALOG, key }; }
export function qaScheduleOrganization(key: string) { return `[OnlyFast QA ${QA_CATALOG}] ${key}`; }
export function tableForKey(key: string): QATable {
  if (key.startsWith('setup:')) return 'race_setups';
  if (key.startsWith('schedule:')) return 'race_schedule';
  return 'shared_setups';
}
export async function validateQARecords(records: unknown, project: string, user: string): Promise<QARecord[]> {
  if (!Array.isArray(records) || records.length < 1 || records.length > QA_KEYS.length) throw Error('QA_RECORD_ALLOWLIST_REQUIRED');
  const seen = new Set<string>();
  for (const value of records) {
    if (!value || typeof value !== 'object') throw Error('QA_RECORD_INVALID');
    const r = value as QARecord;
    if (!QA_KEYS.includes(r.key) || r.table !== tableForKey(r.key) || !isUUID(r.id) || seen.has(r.id) ||
        r.id !== await qaFixtureId(project, user, r.key)) throw Error('QA_RECORD_INVALID');
    seen.add(r.id);
  }
  return records as QARecord[];
}
export function validateQARunRecords(records: unknown, runId: unknown): QARecord[] {
  if (!isUUID(runId) || !Array.isArray(records) || !records.length || records.length > 24) throw Error('QA_RUN_ALLOWLIST_REQUIRED');
  const seen = new Set<string>();
  for (const r of records) {
    if (!r || r.table !== 'race_setups' || !isUUID(r.id) || !QA_KEYS.includes(r.key) || !r.key.startsWith('setup:') || seen.has(r.id)) throw Error('QA_RUN_ALLOWLIST_REQUIRED');
    seen.add(r.id);
  }
  return records;
}
export function assertQARecordOwnership(row: Record<string, unknown>, record: QARecord, user: string): void {
  if (row.id !== record.id || row[QA_TABLE_OWNERS[record.table]] !== user) throw Error('QA_RECORD_OWNER_REQUIRED');
  if (record.table === 'race_setups') {
    const custom = row.custom_fields as Record<string, unknown> | null;
    const marker = custom?.[QA_MARKER] as { catalog?: string; key?: string } | undefined;
    if (marker?.catalog !== QA_CATALOG || marker.key !== record.key) throw Error('QA_FIXTURE_MARKER_REQUIRED');
  }
  if (record.table === 'race_schedule' && row.organization !== qaScheduleOrganization(record.key)) throw Error('QA_FIXTURE_MARKER_REQUIRED');
}
