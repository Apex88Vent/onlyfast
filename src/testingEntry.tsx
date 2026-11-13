import { createRoot } from 'react-dom/client';
import { testingConnectionInput, verifyTestingConnection } from './lib/testingEnvironment';

export async function mountTestingApp(element: HTMLElement) {
  const root = createRoot(element);
  root.render(<p role="status" className="p-6">Verifying OnlyFast testing environment…</p>);
  try {
    await verifyTestingConnection(testingConnectionInput(import.meta.env));
    const { default: App } = await import('./App');
    root.render(<>
      <div role="note" className="bg-amber-200 px-4 py-2 text-center text-sm font-bold text-slate-900">
        ONLYFAST 2027 · TESTING · Synthetic data only · Purchases disabled
      </div>
      <App />
    </>);
  } catch {
    root.render(<main className="p-8 text-center">
      <h1 className="text-xl font-bold">Testing environment unavailable</h1>
      <p role="alert" className="my-4">OnlyFast could not verify its isolated testing database. Reload to retry.</p>
      <button className="rounded bg-sky-600 px-5 py-3 text-white" onClick={() => location.reload()}>Reload</button>
    </main>);
  }
}
