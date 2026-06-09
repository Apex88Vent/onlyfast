// Offline save queue — persists pending save payloads in localStorage so they
// can be drained when the network comes back.

export type PendingOp = 'insert' | 'update';

export interface PendingSave {
  id: string;              // local queue id
  op: PendingOp;
  rowId?: string;          // DB row id for updates
  setupType: 'base' | 'heat' | 'main';
  setupName: string;
  payload: any;
  queuedAt: number;
}

const QUEUE_KEY = 'onlyfast_pending_saves_v1';

export function readQueue(): PendingSave[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(queue: PendingSave[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function enqueue(item: Omit<PendingSave, 'id' | 'queuedAt'>): PendingSave {
  const q = readQueue();
  // De-dupe: if there is already a pending op for the same (setupType, rowId or name),
  // replace it with the newer one so we don't save stale intermediate states.
  const key = (p: PendingSave) =>
    `${p.setupType}|${p.rowId || ''}|${p.setupName || ''}`;
  const newItem: PendingSave = {
    ...item,
    id: `pq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  };
  const filtered = q.filter((p) => key(p) !== key(newItem as PendingSave));
  filtered.push(newItem);
  writeQueue(filtered);
  return newItem;
}

export function removeFromQueue(id: string): void {
  writeQueue(readQueue().filter((p) => p.id !== id));
}

export function clearQueue(): void {
  writeQueue([]);
}

export function queueSize(): number {
  return readQueue().length;
}

// Detect likely "server unreachable" errors (504/502/timeouts/network)
export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('networkerror')) return true;
  if (msg.includes('network request failed')) return true;
  if (msg.includes('load failed')) return true;
  if (msg.includes('timeout')) return true;
  if (msg.includes('timed out')) return true;
  if (msg.includes('504')) return true;
  if (msg.includes('502')) return true;
  if (msg.includes('503')) return true;
  if (msg.includes('gateway')) return true;
  if (err.status === 504 || err.status === 502 || err.status === 503) return true;
  return false;
}
