import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('[main] Root element #root not found in index.html');
} else {
  createRoot(rootEl).render(<App />);
}
