import { createRoot } from 'react-dom/client';
import { testingConnectionInput, verifyTestingConnection } from './lib/testingEnvironment';
import { logStartupFailure, startupRead, watchStartupResume } from './lib/startupRecovery';

export function mountTestingApp(element: HTMLElement) {
  const root = createRoot(element);
  let pending = false;
  let stopResume: (() => void) | undefined;
  const start = async () => {
    if (pending) return;
    pending = true;
    stopResume?.();
    root.render(<p role="status" className="p-6">Verifying OnlyFast testing environment…</p>);
    let verified = false;
    try {
      await startupRead('testing-environment', signal => verifyTestingConnection(testingConnectionInput(import.meta.env), fetch, signal));
      verified = true;
      const { default: App } = await import('./App');
      root.render(<>
        <div role="note" className="bg-amber-200 px-4 py-2 text-center text-sm font-bold text-slate-900">
          ONLYFAST 2027 · TESTING · Synthetic data only · Purchases disabled
        </div>
        <App />
      </>);
    } catch (error) {
      if (verified) logStartupFailure('app-entry', error);
      root.render(<main className="p-8 text-center">
        <h1 className="text-xl font-bold">Testing environment unavailable</h1>
        <p role="alert" className="my-4">OnlyFast could not open its isolated testing app.</p>
        <button className="rounded bg-sky-600 px-5 py-3 text-white" onClick={() => void start()}>Try again</button>
      </main>);
      stopResume = watchStartupResume(() => { void start(); });
    } finally {
      pending = false;
    }
  };
  void start();
}
