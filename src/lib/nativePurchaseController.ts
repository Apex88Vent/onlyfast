// API verified against Median's official revenueCat plugin/types and demo.
export type NativeResult = { success: boolean; error?: { code?: string; message?: string } };
export interface RevenueCatBridge {
  configure(params: { apiKey: string; appUserID: string }): Promise<NativeResult>;
  isInitialized(): Promise<{ initialized: boolean; apiKey?: string }>;
  login(params: { appUserID: string }): Promise<NativeResult>;
  logout(): Promise<NativeResult>;
  getOfferings(): Promise<NativeResult & { identifiers?: string[] }>;
  presentPaywall(params?: { onCancelPurchase?: () => void }): Promise<NativeResult>;
  restorePurchases(): Promise<NativeResult>;
}

export class NativePurchaseError extends Error {
  cancelled: boolean;
  constructor(message: string, cancelled = false) { super(message); this.cancelled = cancelled; }
}

function checked(result: NativeResult): void {
  if (result?.success === true && !result.error) return;
  const code = String(result?.error?.code || '').toLowerCase();
  const cancelled = code === '1' || /cancel/.test(code);
  throw new NativePurchaseError(cancelled ? 'Purchase cancelled.' :
    (result?.error?.message || 'The store could not complete this request. Please try again.'), cancelled);
}

export class NativePurchaseController {
  private desiredUser: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private poisoned = false;
  private purchasing = false;
  private bridge: () => Promise<RevenueCatBridge>;
  private apiKey: () => string;
  constructor(bridge: () => Promise<RevenueCatBridge>, apiKey: () => string) {
    this.bridge = bridge; this.apiKey = apiKey;
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

  private async identify(userId: string): Promise<RevenueCatBridge> {
    if (this.poisoned) throw new Error('Please close and reopen the app before trying again.');
    if (this.desiredUser !== userId) throw new Error('Your account changed. Please try again.');
    const bridge = await this.bridge();
    const key = this.apiKey();
    if (!key) throw new Error('Subscriptions are being set up. Please try again later.');
    const state = await this.call(bridge.isInitialized());
    if (!state.initialized) checked(await this.call(bridge.configure({ apiKey: key, appUserID: userId })));
    else {
      if (state.apiKey !== key) throw new Error('Store configuration changed. Please close and reopen the app.');
      checked(await this.call(bridge.login({ appUserID: userId })));
    }
    if (this.desiredUser !== userId) throw new Error('Your account changed. Please try again.');
    return bridge;
  }

  setUser(userId: string | null): Promise<void> {
    this.desiredUser = userId; // Invalidate in-flight results synchronously.
    return this.enqueue(async () => {
      if (this.poisoned || this.desiredUser !== userId) return;
      if (userId) { await this.identify(userId); return; }
      const bridge = await this.bridge();
      const state = await this.call(bridge.isInitialized());
      if (state.initialized) checked(await this.call(bridge.logout()));
    });
  }

  async run(userId: string, action: 'purchase' | 'restore'): Promise<void> {
    if (this.purchasing) throw new Error('A store request is already open.');
    this.purchasing = true;
    try {
      await this.enqueue(async () => {
        const bridge = await this.identify(userId);
        let result: NativeResult;
        if (action === 'purchase') {
          const offerings = await this.call(bridge.getOfferings());
          checked(offerings);
          if (!offerings.identifiers?.length) throw new Error('No store plans are available yet. Please try again later.');
          if (this.desiredUser !== userId) throw new Error('Your account changed. Please try again.');
          let cancelled = false;
          result = await this.call(bridge.presentPaywall({ onCancelPurchase: () => { cancelled = true; } }), 300_000);
          if (cancelled && !result?.success) throw new NativePurchaseError('Purchase cancelled.', true);
        } else result = await this.call(bridge.restorePurchases(), 120_000);
        if (this.desiredUser !== userId) throw new Error('Your account changed. Sign in to the purchasing account to see its subscription.');
        checked(result);
      });
    } finally { this.purchasing = false; }
  }
}
