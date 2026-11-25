import type { RecordingTrack } from './circuit/recorder.ts';
import type { LapTelemetrySample } from './circuit/types.ts';

export interface RecordingDraft {
  owner: string; session: string; recorder: string; started: string; track: RecordingTrack | null;
  ended: string | null; acknowledged: number; interruptions: number[];
  mountOrientation?:import('./circuit/types.ts').PhoneMountOrientation;
}
const databaseName = 'onlyfast-track-trace-recording-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: ['owner', 'session'] });
      request.result.createObjectStore('samples', { keyPath: ['owner', 'session', 'index'] });
      request.result.createObjectStore('scans', { keyPath: 'owner' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local recording storage is unavailable.'));
  });
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local recording could not be retained.')); };
    try { run(tx, v => { value = v; }); } catch (error) { tx.abort(); reject(error); }
  });
}
export const putDraft = (draft: RecordingDraft) => transaction<void>(['drafts'], 'readwrite', tx => { tx.objectStore('drafts').put(draft); });
export const putSample = (draft: RecordingDraft, sample: LapTelemetrySample) => transaction<void>(['drafts','samples'], 'readwrite', tx => {
  tx.objectStore('drafts').put(draft);
  tx.objectStore('samples').put({ owner: draft.owner, session: draft.session, index: sample.sampleIndex, sample });
});
export const listDrafts = (owner: string) => transaction<RecordingDraft[]>(['drafts'], 'readonly', (tx, done) => {
  const request = tx.objectStore('drafts').getAll(IDBKeyRange.bound([owner, ''], [owner, '\uffff']));
  request.onsuccess = () => done(request.result);
});
export const loadSamples = (owner: string, session: string) => transaction<LapTelemetrySample[]>(['samples'], 'readonly', (tx, done) => {
  const request = tx.objectStore('samples').getAll(IDBKeyRange.bound([owner,session,0],[owner,session,Number.MAX_SAFE_INTEGER]));
  request.onsuccess = () => done(request.result.map(row => row.sample));
});
// Only called after the server confirms completion and its exact sample count.
export const removeDraft = (owner: string, session: string) => transaction<void>(['drafts','samples'], 'readwrite', tx => {
  tx.objectStore('drafts').delete([owner,session]);
  tx.objectStore('samples').delete(IDBKeyRange.bound([owner,session,0],[owner,session,Number.MAX_SAFE_INTEGER]));
});
export const saveScanDraft = <T>(owner: string, draft: T) => transaction<void>(['scans'], 'readwrite', tx => { tx.objectStore('scans').put({owner,draft}); });
export const loadScanDraft = <T>(owner: string) => transaction<T | null>(['scans'], 'readonly', (tx,done) => {
  const request=tx.objectStore('scans').get(owner); request.onsuccess=()=>done(request.result?.draft ?? null);
});
