import { createClient } from '@supabase/supabase-js';
import { QAError } from './config.mjs';

// Normal Auth, public key, isolated memory storage. Never imports the app singleton.
export class QAAuthentication {
  constructor(config, factory = createClient) {
    this.config = config;
    this.disposed = false;
    this.verified = false;
    this.storage = new Map();
    this.client = factory(config.url, config.publicKey, {
      auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false,
        storage: { getItem: key => this.storage.get(key) ?? null, setItem: (key,value) => this.storage.set(key,value), removeItem: key => this.storage.delete(key) } },
      global: { fetch: (input, init) => {
        const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        if (target.origin !== config.url) throw new QAError('QA_REQUEST_PROJECT_MISMATCH');
        return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      } },
    });
  }
  async login() {
    if (this.disposed) throw new QAError('QA_SESSION_DISPOSED');
    const result = this.config.refreshToken
      ? await this.client.auth.refreshSession({ refresh_token: this.config.refreshToken })
      : await this.client.auth.signInWithPassword({ email: this.config.email, password: this.config.password });
    if (result.error || !result.data?.session) throw new QAError('QA_LOGIN_FAILED');
    await this.verify();
    return this;
  }
  async verify() {
    if (this.disposed) throw new QAError('QA_SESSION_DISPOSED');
    const session = await this.client.auth.getSession();
    if (session.error || !session.data?.session) throw new QAError('QA_SESSION_REQUIRED');
    if ((session.data.session.expires_at || 0) <= Date.now()/1000 + 30) {
      const renewed = await this.client.auth.refreshSession();
      if (renewed.error || !renewed.data?.session) throw new QAError('QA_REAUTHENTICATION_REQUIRED');
    }
    // A cached session/user ID is never authorization proof.
    const result = await this.client.auth.getUser();
    if (result.error || result.data?.user?.id !== this.config.userId || result.data.user.email?.toLowerCase() !== this.config.email) {
      this.verified = false;
      throw new QAError('QA_IDENTITY_MISMATCH');
    }
    const { data, error } = await this.client.from('beta_tester_accounts')
      .select('user_id,is_test_account,beta_features_enabled,tester_kind').eq('user_id', result.data.user.id).maybeSingle();
    if (error || data?.user_id !== this.config.userId || !data.is_test_account || !data.beta_features_enabled || data.tester_kind !== 'experimental') {
      throw new QAError('QA_TESTER_PERMISSION_REQUIRED');
    }
    this.verified = true;
    return result.data.user;
  }
  async refresh() {
    const result = await this.client.auth.refreshSession();
    if (result.error || !result.data?.session) throw new QAError('QA_REAUTHENTICATION_REQUIRED');
    return this.verify();
  }
  async beforeMutation() {
    await this.verify();
    if (!this.config.mutationsApproved) throw new QAError('QA_PRODUCTION_MUTATIONS_NOT_APPROVED');
  }
  async dispose() {
    if (this.disposed) return;
    try {
      const result = await this.client.auth.signOut({ scope: 'local' });
      if (result.error) throw new QAError('QA_LOGOUT_FAILED');
    } finally {
      this.client.auth.stopAutoRefresh();
      this.storage.clear();
      this.verified = false;
      this.disposed = true;
      this.config = null;
    }
  }
}
