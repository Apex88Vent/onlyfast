import { NativePurchaseController, type NativeResult, type RevenueCatBridge } from '../lib/nativePurchaseController';
import { hideExternalPayments as nativePaymentVisibility } from '../lib/paymentVisibility';
import { checkoutPreviewEnabled, previewBackend, type PreviewPaidPlan } from './previewBackend';

export { syncNativeSubscription, watchNativePurchases } from '../lib/nativePurchases';
export { isMedianIOSApp, nativeBillingMessage, nativeUpgradeMessage } from '../lib/paymentVisibility';

export const nativePurchasesEnabled = checkoutPreviewEnabled;
export const hideExternalPayments = nativePurchasesEnabled || nativePaymentVisibility;

const listeners = new Set<() => void>();
let pendingPaywall: ((result: NativeResult) => void) | null = null;
let configuredKey: string | undefined;

export function subscribeToPreviewPaywall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const isPreviewPaywallOpen = () => pendingPaywall !== null;

export function completePreviewPaywall(plan: PreviewPaidPlan | null) {
  const resolve = pendingPaywall;
  if (!resolve) return;
  pendingPaywall = null;
  if (plan) previewBackend.stageStoreVerification(plan);
  resolve(plan ? { success: true } : { success: false, error: { message: 'User cancelled' } });
  listeners.forEach(listener => listener());
}

const previewBridge: RevenueCatBridge = {
  configure: async ({ apiKey }) => { configuredKey = apiKey; return { success: true }; },
  isInitialized: async () => ({ initialized: !!configuredKey, apiKey: configuredKey }),
  login: async () => ({ success: true }),
  logout: async () => ({ success: true }),
  presentPaywall: () => new Promise(resolve => {
    pendingPaywall = resolve;
    listeners.forEach(listener => listener());
  }),
  restorePurchases: async () => {
    previewBackend.stageStoreVerification(null);
    return { success: true };
  },
};

export const nativePurchases = new NativePurchaseController(
  async () => previewBridge, () => 'local-preview-only', () => nativePurchasesEnabled,
);
