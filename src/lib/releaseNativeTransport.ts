// Preserved custom transport; not imported by the production application.
// See native/README.md and the superseding stock Median paywall release plan.
import type { BillingReply, BillingRequest, ReleaseBillingBridge } from './releaseNativeBilling';
type Channel = { postMessage(value: string): void; onmessage?: ((event: { data: string }) => void) | null };

/** Dedicated main-frame channel installed by the source-built OnlyFast extension. */
export function createAndroidBillingTransport(channel: Channel, timeoutMs = 30_000): ReleaseBillingBridge {
  let poisoned = false;
  const pending = new Map<string, { resolve(value: BillingReply): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  channel.onmessage = event => {
    let envelope: { requestId: string; result: BillingReply };
    try { envelope = JSON.parse(event.data); } catch { return; }
    if (!envelope || typeof envelope.requestId !== 'string' || !envelope.result) return;
    const operation = pending.get(envelope.requestId);
    if (!operation) return;
    clearTimeout(operation.timer); pending.delete(envelope.requestId); operation.resolve(envelope.result);
  };
  return { request(request: BillingRequest) {
    if (poisoned) return Promise.reject(new Error('Native billing timed out. Close and reopen OnlyFast.'));
    const requestId = crypto.randomUUID();
    return new Promise<BillingReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        // A native transaction cannot be cancelled by a JS timeout. Do not retry.
        poisoned = true;
        for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Native billing timed out. Close and reopen OnlyFast; do not purchase again.')); }
        pending.clear();
      }, request.operation === 'purchase' || request.operation === 'restore' ? 300_000 : timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      try { channel.postMessage(JSON.stringify({ ...request, requestId })); }
      catch { clearTimeout(timer); pending.delete(requestId); reject(new Error('Native billing channel is unavailable.')); }
    });
  } };
}

let transport: ReleaseBillingBridge | undefined;
export async function getReleaseBillingBridge(): Promise<ReleaseBillingBridge> {
  if (transport) return transport;
  const host = window as unknown as { onlyFastBilling?: Channel };
  // No fallback to Median getOfferings/presentPaywall or the debug onlyFastCatalog.
  if (!host.onlyFastBilling?.postMessage) throw new Error('This binary needs the OnlyFast release billing extension. Purchases remain unavailable.');
  transport = createAndroidBillingTransport(host.onlyFastBilling);
  return transport;
}
