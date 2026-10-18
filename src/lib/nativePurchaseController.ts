// API verified against Median's official revenueCat plugin/types and demo.
// Public hold is independent of environment flags. Release requires the approved
// current offering and published paywall; RevenueCatUI owns products and prices.
export const NATIVE_PURCHASES_READY = false;
export type NativeResult = { success: boolean; error?: { code?: string | number; message?: string } };
export interface RevenueCatBridge {
  configure(params: { apiKey: string; appUserID: string }): Promise<NativeResult>;
  isInitialized(): Promise<{ initialized: boolean; apiKey?: string }>;
  login(params: { appUserID: string }): Promise<NativeResult>;
  logout(): Promise<NativeResult>;
  presentPaywall(): Promise<NativeResult>;
  restorePurchases(): Promise<NativeResult>;
}

export class NativePurchaseError extends Error {
  cancelled: boolean;
  pending: boolean;
  constructor(message: string, cancelled = false, pending = false) { super(message); this.cancelled = cancelled; this.pending = pending; }
}

function checked(result: NativeResult): void {
  if (result?.success === true && !result.error) return;
  const code = String(result?.error?.code || '').toLowerCase();
  // Median Android's paywall dismissal returns only error.message: 'User cancelled'.
  const cancelled = code === '1' || /cancel/.test(code) || /\b(?:user|purchase) cancel(?:led|ed)\b/i.test(result?.error?.message || '');
  const pending = code === '20' || /payment.?pending/.test(code);
  throw new NativePurchaseError(cancelled ? 'Purchase cancelled.' : pending ?
    'Payment is pending store approval. Do not purchase again. Use Refresh subscription after approval; access requires server confirmation.' :
    (result?.error?.message || 'The store could not complete this request. Please try again.'), cancelled, pending);
}

export class NativePurchaseController {
  private desiredUser: string | null = null;
  private identityRevision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private poisoned = false;
  private purchasing = false;
  private bridge: () => Promise<RevenueCatBridge>;
  private apiKey: () => string;
  private enabled: () => boolean;
  constructor(bridge: () => Promise<RevenueCatBridge>, apiKey: () => string, enabled: () => boolean = () => true) {
    this.bridge = bridge; this.apiKey = apiKey; this.enabled = enabled;
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(action);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async call<T>(action: Promise<T>, timeout = 15_000): Promise<T> {
    if (this.poisoned) throw new Error('Please close and reopen the app before trying again.');
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([action, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // Native calls cannot be aborted. Never let a late identity response
          // race a subsequent purchase after a timeout.
          this.poisoned = true;
          reject(new Error('The store did not respond. Please close and reopen the app.'));
        }, timeout);
      })]);
    } catch (error) {
      // Median's addCommandCallback rejects the complete native response when
      // it has an error field. Handle both rejected and resolved responses.
      if (error && typeof error === 'object' && 'error' in error) checked(error as NativeResult);
      throw error;
    } finally { clearTimeout(timer!); }
  }

  private assertIdentity(userId: string, revision: number): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('A signed-in OnlyFast account is required.');
    if (this.desiredUser !== userId || this.identityRevision !== revision) throw new Error('Your account changed. Please try again.');
  }

  private async identify(userId: string, revision: number): Promise<RevenueCatBridge> {
    if (this.poisoned) throw new Error('Please close and reopen the app before trying again.');
    this.assertIdentity(userId, revision);
    const bridge = await this.bridge();
    this.assertIdentity(userId, revision);
    const key = this.apiKey();
    if (!key) throw new Error('Subscriptions are being set up. Please try again later.');
    const state = await this.call(bridge.isInitialized());
    this.assertIdentity(userId, revision);
    if (!state.initialized) checked(await this.call(bridge.configure({ apiKey: key, appUserID: userId })));
    else {
      if (state.apiKey !== key) throw new Error('Store configuration changed. Please close and reopen the app.');
      checked(await this.call(bridge.login({ appUserID: userId })));
    }
    this.assertIdentity(userId, revision);
    return bridge;
  }

  setUser(userId: string | null): Promise<void> {
    if (this.desiredUser !== userId) this.identityRevision++;
    this.desiredUser = userId; // Invalidate in-flight results synchronously.
    const revision = this.identityRevision;
    return this.enqueue(async () => {
      if (this.poisoned || this.identityRevision !== revision) return;
      if (userId !== null) { await this.identify(userId, revision); return; }
      const bridge = await this.bridge();
      if (this.identityRevision !== revision) return;
      const state = await this.call(bridge.isInitialized());
      if (this.identityRevision !== revision) return;
      if (state.initialized) checked(await this.call(bridge.logout()));
    });
  }

  async run(userId: string, action: 'purchase' | 'restore'): Promise<void> {
    if (!this.enabled()) throw new Error('In-app subscriptions are coming soon.');
    if (this.purchasing) throw new Error('A store request is already open.');
    this.purchasing = true;
    const revision = this.identityRevision;
    try {
      await this.enqueue(async () => {
        if (!this.enabled()) throw new Error('In-app subscriptions are coming soon.');
        const bridge = await this.identify(userId, revision);
        let result: NativeResult;
        if (action === 'purchase') {
          // The stock paywall loads the current offering and performs the selected
          // purchase itself. Do not fetch/rebuild its catalog or purchase twice.
          result = await this.call(bridge.presentPaywall(), 300_000);
        } else result = await this.call(bridge.restorePurchases(), 120_000);
        this.assertIdentity(userId, revision);
        checked(result);
      });
    } finally { this.purchasing = false; }
  }
}
