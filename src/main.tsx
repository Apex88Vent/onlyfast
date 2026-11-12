import { createRoot } from 'react-dom/client';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('[main] Root element #root not found in index.html');
} else {
  // Do not mount production auth, billing, ads or data flows in the 2027 preview.
  const entry = import.meta.env.ONLYFAST_2027_PREVIEW
    ? import('./pages/Phase2027Preview') : import('./App');
  void entry.then(({ default: Entry }) => createRoot(rootEl).render(<Entry />));
}
