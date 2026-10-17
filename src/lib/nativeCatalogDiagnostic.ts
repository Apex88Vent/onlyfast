// Imported exclusively by the native-sandbox route. No purchase operations.
import { assertLocalSandboxConfiguration, authorizeSandboxTester, diagnosticValue,
  inspectMedianBridge, type SandboxAuthorizationSource } from './nativeSandboxPolicy.ts';

export const DIAGNOSTIC_ANDROID_KEY = 'goog_xbUbrojeeBtzAsVKDewoXbclzAS'; // Public client key supplied by the operator.
type Channel = { postMessage(message: string): void; onmessage?: ((event: { data: string }) => void) | null };

export function debugCatalogRequest(channel: Channel | undefined, operation: 'status' | 'readCatalog', accessToken: string, anonKey: string): Promise<Record<string, unknown>> {
  if (!channel?.postMessage) return Promise.reject(new Error('The debug-only native catalog reader is absent. Install the diagnostic debug APK and reopen this page.'));
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const previous = channel.onmessage;
    const finish = () => { clearTimeout(timer); channel.onmessage = previous; };
    const timer = setTimeout(() => { finish(); reject(new Error('Debug catalog reader did not respond.')); }, 45_000);
    channel.onmessage = event => {
      try {
        const reply = JSON.parse(event.data);
        if (reply.requestId !== requestId) return;
        finish(); resolve(reply.result);
      } catch { finish(); reject(new Error('Malformed debug catalog response.')); }
    };
    try { channel.postMessage(JSON.stringify({ requestId, operation, accessToken, anonKey })); }
    catch (error) { finish(); reject(error); }
  });
}

export async function initializeLocalCatalog(input: {
  mode: string; url: string; anonKey: string; pageUrl: string; source: SandboxAuthorizationSource;
  bridge: unknown;
  read: (operation: 'status' | 'readCatalog') => Promise<Record<string, unknown>>;
  assertCurrent: () => void;
}) {
  assertLocalSandboxConfiguration(input.mode, input.url, input.anonKey);
  const page = new URL(input.pageUrl);
  if (page.origin !== 'http://127.0.0.1:8086' || page.pathname !== '/native-subscription-test') throw new Error('Initialization requires the approved local diagnostic origin and route.');
  const uuid = await authorizeSandboxTester(input.source);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid)) throw new Error('A verified local user UUID is required.');
  const beforeCall = async () => {
    input.assertCurrent();
    if (await authorizeSandboxTester(input.source) !== uuid) throw new Error('Your account changed. Restart the debug app before configuring a different identity.');
    input.assertCurrent();
  };
  await beforeCall();
  const before = await input.read('status'); // Native side independently verifies the local token and tester rows.
  await beforeCall();
  if (before.error) throw new Error(String(before.error));
  if (typeof before.sdkConfigured !== 'boolean') throw new Error('Native SDK status was not verified.');
  if (before.sdkConfigured && before.identityMatchesAuthenticatedUser !== true) throw new Error('SDK belongs to a different identity. Stop and restart the debug app; automatic account switching is disabled.');
  const bridge = input.bridge as { configure?: (params: { apiKey: string; appUserID: string }) => unknown } | undefined;
  if (!bridge?.configure) throw new Error('Median RevenueCat configure is absent.');
  let configuration: unknown = { status: 'already_configured_for_this_user' };
  if (!before.sdkConfigured) {
    await beforeCall();
    let timer: ReturnType<typeof setTimeout>;
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => bridge.configure!({ apiKey: DIAGNOSTIC_ANDROID_KEY, appUserID: uuid })),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Configure did not respond; restart the debug app before retrying.')), 15_000); }),
      ]);
      configuration = { status: 'returned', response: diagnosticValue(response) };
    } catch (error) { configuration = { status: 'rejected_or_timed_out', error: diagnosticValue(error) }; }
    finally { clearTimeout(timer!); }
  }
  await beforeCall();
  const after = await input.read('status');
  await beforeCall();
  if (after.error || after.sdkConfigured !== true || after.identityMatchesAuthenticatedUser !== true || after.anonymous !== false) throw new Error('Native SDK identity verification failed after configuration. Stop and restart the debug app.');
  const original = await inspectMedianBridge(input.bridge, beforeCall);
  await beforeCall();
  let namedCatalog: unknown;
  try { namedCatalog = await input.read('readCatalog'); }
  catch (error) { namedCatalog = { error: diagnosticValue(error) }; }
  await beforeCall();
  return { ...original, capturedAt: new Date().toISOString(), initialization: { configuration, before, after }, namedCatalog: diagnosticValue(namedCatalog) };
}
