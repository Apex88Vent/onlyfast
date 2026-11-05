// Durable, owner-bound offline saves. Legacy array data remains recoverable.
export type PendingOp = 'insert' | 'update';
export interface PendingSave {
  ownerId: string;
  version: 2;
  id: string;
  op: PendingOp;
  rowId?: string;
  setupType: 'base' | 'heat' | 'main' | 'extra1' | 'extra2' | 'extra3';
  setupName: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}
const QUEUE_KEY = 'onlyfast_pending_saves_v1';
const ITEM_PREFIX = QUEUE_KEY + ':v2:';

function readStoredQueue(): PendingSave[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Legacy pending saves require recovery');
  return parsed;
}

function own(item: PendingSave | null, ownerId: string): item is PendingSave {
  return !!item && item.version === 2 && item.ownerId === ownerId && item.payload?.user_id === ownerId;
}

function storedItems(): PendingSave[] {
  const entries: PendingSave[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(ITEM_PREFIX)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value) entries.push(value);
    } catch { /* Leave malformed storage intact for recovery. */ }
  }
  return entries;
}

export function readQueue(ownerId?: string | null): PendingSave[] {
  if (!ownerId) return [];
  let legacy: PendingSave[] = [];
  try { legacy = readStoredQueue(); } catch { /* Retain the raw legacy value. */ }
  return [...legacy, ...storedItems()].filter(item => own(item, ownerId))
    .sort((a,b) => a.queuedAt - b.queuedAt);
}

// Kept for explicit legacy recovery. New operations use separate keys so tabs
// cannot overwrite other queued operations through an array read/modify/write.
export function writeQueue(queue: PendingSave[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function itemKey(item: Pick<PendingSave, 'ownerId' | 'setupType' | 'rowId' | 'payload'>): string {
  const row = item.rowId || item.payload.id;
  if (typeof row !== 'string' || !row) throw new Error('Pending save requires a stable row ID');
  return ITEM_PREFIX + item.ownerId + ':' + item.setupType + ':' + row;
}

export function enqueue(item: Omit<PendingSave, 'id' | 'queuedAt' | 'version'>): PendingSave {
  if (!item.ownerId || item.payload.user_id !== item.ownerId) throw new Error('Pending save owner mismatch');
  const value: PendingSave = { ...item, version: 2, id: crypto.randomUUID(), queuedAt: Date.now() };
  localStorage.setItem(itemKey(value), JSON.stringify(value));
  return value;
}

export function removeFromQueue(id: string, ownerId: string): void {
  for (const item of storedItems().filter(item => own(item, ownerId) && item.id === id)) {
    const key = itemKey(item);
    // A newer edit of this same row may have replaced the in-flight snapshot.
    const current = JSON.parse(localStorage.getItem(key) || 'null');
    if (current?.id === id) localStorage.removeItem(key);
  }
  try {
    const legacy = readStoredQueue();
    const remaining = legacy.filter(item => !own(item, ownerId) || item.id !== id);
    if (remaining.length !== legacy.length) writeQueue(remaining);
  } catch { /* Unknown ownership and malformed legacy data are retained. */ }
}

export function clearQueue(ownerId: string): void {
  for (const item of readQueue(ownerId)) removeFromQueue(item.id, ownerId);
}
export function queueSize(ownerId: string): number { return readQueue(ownerId).length; }

const drains = new Map<string, Promise<void>>();
export function drainOwnedQueue(ownerId: string, replay: {
  currentUser(): Promise<string | null>;
  save(item: PendingSave): Promise<unknown>;
  changed(): void;
}): Promise<void> {
  const pending = drains.get(ownerId);
  if (pending) return pending;
  const run = async () => {
    for (const item of readQueue(ownerId)) {
      if (await replay.currentUser() !== ownerId) break;
      try {
        await replay.save(item);
        removeFromQueue(item.id, ownerId);
        if (await replay.currentUser() === ownerId) replay.changed();
      } catch {
        // Network, authentication and policy failures preserve the operation.
        break;
      }
    }
  };
  const task = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request(`onlyfast-save-queue:${ownerId}`, async () => { await run(); });
    } else { await run(); }
  })();
  const finished = task.finally(() => { drains.delete(ownerId); });
  drains.set(ownerId, finished);
  return finished;
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const error = err as { message?: string; status?: number };
  const message = String(error.message || err).toLowerCase();
  return ['failed to fetch','networkerror','network request failed','load failed','timeout','timed out','504','502','503','gateway']
    .some(text => message.includes(text)) || [504,502,503].includes(error.status || 0);
}
