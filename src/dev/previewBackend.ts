// Imported only by the standalone review build. No production client or keys.
import { CAR_CLASSES } from '../lib/classConfigs.ts';
import { EXPANDED_CLASS_CONFIGS } from '../lib/setupLibrary.ts';

type Row = Record<string, any>;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'onlyfast_review_backend_v1';
export const PREVIEW_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const supabaseUrl = '/__onlyfast_preview';
export const supabaseKey = 'local-preview-only';

export function createPreviewBackend(storage: Store) {
  const fresh = () => ({
    user: { id: PREVIEW_USER_ID, email: 'review@example.invalid', aud: 'authenticated',
      created_at: new Date().toISOString(), app_metadata: {},
      user_metadata: { membership_tier: 'rookie', onboarding_completed: false } } as Row,
    signedIn: true,
    tables: { user_subscriptions: [{ user_id: PREVIEW_USER_ID, plan: 'free', status: 'inactive',
      active_race_class: null, active_racing_discipline: null, last_class_change_at: null,
      onboarding_step: 'tutorial', onboarding_discipline: null, onboarding_race_class: null }] } as Record<string, Row[]>,
  });
  let db = fresh();
  try { db = JSON.parse(storage.getItem(KEY) || 'null') || db; } catch { /* first visit */ }
  const persist = () => storage.setItem(KEY, JSON.stringify(db));
  const listeners = new Set<(event: string, session: Row | null) => void>();
  const session = () => db.signedIn ? { user: structuredClone(db.user), access_token: 'local-preview-only' } : null;
  const emit = (event: string) => listeners.forEach(listener => listener(event, session()));
  const ok = (data: any, count?: number) => ({ data: structuredClone(data), error: null, ...(count === undefined ? {} : { count }) });
  const fail = (message: string) => ({ data: null, error: { message } });
  const subscription = () => db.tables.user_subscriptions[0];
  const category = (car: string) => EXPANDED_CLASS_CONFIGS[car]?.category || 'dirt_oval';
  const unlimited = () => subscription().plan === 'teams';
  const state = () => {
    const s = subscription();
    const next = s.last_class_change_at ? new Date(Date.parse(s.last_class_change_at) + 30 * 86400000).toISOString() : null;
    return { active_class: s.active_race_class, active_discipline: s.active_racing_discipline,
      tier: s.plan === 'teams' ? 'team' : s.plan === 'pro' ? 'pro' : 'rookie', unlimited: unlimited(),
      last_class_change_at: s.last_class_change_at, next_eligible_at: next,
      can_change: unlimited() || !next || Date.parse(next) <= Date.now(),
      onboarding_step: s.onboarding_step, onboarding_discipline: s.onboarding_discipline,
      onboarding_race_class: s.onboarding_race_class };
  };
  const validClass = (car: string) => CAR_CLASSES.includes(car) || Boolean(EXPANDED_CLASS_CONFIGS[car]);

  class Query implements PromiseLike<ReturnType<typeof ok> | ReturnType<typeof fail>> {
    private filters: ((row: Row) => boolean)[] = [];
    private orders: { key: string; ascending: boolean }[] = [];
    private max = Infinity;
    private one = false;
    private head = false;
    private action = 'select';
    private payload: Row[] = [];
    private conflict = 'id';
    private table: string;
    constructor(table: string) { this.table = table; }
    select(_columns?: string, options?: Row) { this.head = options?.head || false; return this; }
    eq(key: string, value: any) { this.filters.push(row => row[key] === value); return this; }
    neq(key: string, value: any) { this.filters.push(row => row[key] !== value); return this; }
    in(key: string, values: any[]) { this.filters.push(row => values.includes(row[key])); return this; }
    is(key: string, value: any) { this.filters.push(row => value === null ? row[key] == null : row[key] === value); return this; }
    not(key: string, operator: string, value: any) { this.filters.push(row => operator === 'is' && value === null ? row[key] != null : row[key] !== value); return this; }
    ilike(key: string, pattern: string) {
      const regex = new RegExp('^' + pattern.split('%').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
      this.filters.push(row => regex.test(String(row[key] || ''))); return this;
    }
    gte(key: string, value: any) { this.filters.push(row => row[key] >= value); return this; }
    lte(key: string, value: any) { this.filters.push(row => row[key] <= value); return this; }
    gt(key: string, value: any) { this.filters.push(row => row[key] > value); return this; }
    lt(key: string, value: any) { this.filters.push(row => row[key] < value); return this; }
    order(key: string, options?: Row) { this.orders.push({ key, ascending: options?.ascending !== false }); return this; }
    limit(value: number) { this.max = value; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    insert(value: Row | Row[]) { this.action = 'insert'; this.payload = structuredClone(Array.isArray(value) ? value : [value]); return this; }
    upsert(value: Row | Row[], options?: Row) { this.insert(value); this.action = 'upsert'; this.conflict = options?.onConflict || 'id'; return this; }
    update(value: Row) { this.action = 'update'; this.payload = [structuredClone(value)]; return this; }
    delete() { this.action = 'delete'; return this; }
    execute() {
      if (!db.signedIn) return fail('Sign in to the local preview account.');
      const rows = db.tables[this.table] ||= [];
      const matches = (row: Row) => (!row.user_id || row.user_id === db.user.id) && this.filters.every(filter => filter(row));
      let result = rows.filter(matches);
      if (this.action === 'insert' || this.action === 'upsert') {
        if (this.table === 'race_setups' && this.payload.some(row => !validClass(row.race_class) || (!unlimited() && row.race_class !== subscription().active_race_class))) return fail('CLASS_LOCKED');
        result = this.payload.map(value => {
          const existing = this.action === 'upsert' ? rows.find(row => this.conflict.split(',').every(key => row[key] === value[key])) : undefined;
          if (existing) { Object.assign(existing, value, { updated_at: new Date().toISOString() }); return existing; }
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...value };
          rows.push(row); return row;
        });
      } else if (this.action === 'update') {
        result.forEach(row => Object.assign(row, this.payload[0], { updated_at: new Date().toISOString() }));
      } else if (this.action === 'delete') {
        db.tables[this.table] = rows.filter(row => !matches(row));
      }
      for (const order of [...this.orders].reverse()) result.sort((a, b) => String(a[order.key] ?? '').localeCompare(String(b[order.key] ?? '')) * (order.ascending ? 1 : -1));
      persist();
      const count = result.length;
      result = result.slice(0, this.max);
      return ok(this.head ? null : this.one ? result[0] || null : result, count);
    }
    then<TResult1 = ReturnType<typeof ok> | ReturnType<typeof fail>, TResult2 = never>(onfulfilled?: ((value: ReturnType<typeof ok> | ReturnType<typeof fail>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
    }
  }
  const rpc = async (name: string, args: Row = {}) => {
    if (!db.signedIn) return fail('CLASS_AUTH_REQUIRED');
    const s = subscription();
    if (name === 'get_active_race_class_state') return ok(state());
    if (name === 'save_racing_onboarding_progress') {
      if (args.p_class && (!validClass(args.p_class) || category(args.p_class) !== args.p_discipline)) return fail('CLASS_INVALID');
      Object.assign(s, { onboarding_step: args.p_step, onboarding_discipline: args.p_discipline || null, onboarding_race_class: args.p_class || null }); persist(); return ok(state());
    }
    if (name === 'complete_racing_onboarding' || name === 'initialize_active_race_class' || name === 'change_active_race_class') {
      const car = name === 'change_active_race_class' ? args.p_new_class : args.p_class || s.onboarding_race_class;
      if (!validClass(car)) return fail('CLASS_INVALID');
      if (name === 'change_active_race_class' && !state().can_change) return fail('CLASS_CHANGE_COOLDOWN:' + state().next_eligible_at);
      if (name === 'change_active_race_class' && s.active_race_class !== car) s.last_class_change_at = new Date().toISOString();
      Object.assign(s, { active_race_class: car, active_racing_discipline: category(car), onboarding_step: 'complete' }); persist(); return ok(state());
    }
    if (name === 'list_user_setup_summaries') return ok((db.tables.race_setups || []).filter(row => row.user_id === db.user.id));
    if (name === 'get_setup_class_lock_state') {
      const row = (db.tables.race_setups || []).find(row => row.id === args.p_setup_id);
      return ok({ locked: !row || (!unlimited() && row.race_class !== s.active_race_class) });
    }
    return fail('This service requires the live backend and is not available in the isolated test preview.');
  };
  const updateUser = async (value: Row) => { db.user.user_metadata = { ...db.user.user_metadata, ...value.data }; persist(); emit('USER_UPDATED'); return ok({ user: db.user }); };
  const channel = { on: (..._args: any[]) => channel, subscribe: () => channel };
  const supabase = {
    from: (table: string) => new Query(table), rpc,
    channel: () => channel, removeChannel: async () => 'ok',
    auth: {
      getSession: async () => ok({ session: session() }), getUser: async () => ok({ user: db.signedIn ? db.user : null }),
      refreshSession: async () => ok({ session: session() }), updateUser,
      onAuthStateChange: (listener: (event: string, session: Row | null) => void) => { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }; },
      signOut: async () => { db.signedIn = false; persist(); emit('SIGNED_OUT'); return ok(null); },
      signInWithPassword: async () => { db.signedIn = true; persist(); emit('SIGNED_IN'); return ok({ user: db.user, session: session() }); },
      signUp: async () => { db.signedIn = true; persist(); emit('SIGNED_IN'); return ok({ user: db.user, session: session() }); },
      resetPasswordForEmail: async () => fail('Password/email services are unavailable in this preview.'),
      signInWithOAuth: async () => fail('Use the included local test account in this preview.'),
    },
    functions: { invoke: async () => fail('Live AI, OCR, payments, email, sharing and account services are unavailable in this isolated preview.') },
    storage: { from: () => ({ upload: async () => fail('Uploads require the live backend.'), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  };
  return { supabase, reset: () => { db = fresh(); persist(); }, updateUser, rpc,
    getPlan: () => subscription().plan as 'free' | 'pro' | 'teams',
    setPlan: (plan: 'free' | 'pro' | 'teams') => { Object.assign(subscription(), { plan, status: plan === 'free' ? 'inactive' : 'active' }); db.user.user_metadata.membership_tier = plan === 'teams' ? 'team' : plan === 'pro' ? 'pro' : 'rookie'; persist(); emit('USER_UPDATED'); } };
}

const memory = new Map<string, string>();
export const previewBackend = createPreviewBackend(typeof window === 'undefined' ? { getItem: key => memory.get(key) || null, setItem: (key, value) => { memory.set(key, value); } } : window.localStorage);
export const supabase = previewBackend.supabase;
