import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Explicitly selected review build only; vite.config.ts/production are unchanged.
export default defineConfig({
  plugins: [react(), {
    name: 'onlyfast-review-html',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.split('?')[0] === '/road-map-preview.html') return next();
        if (req.headers.accept?.includes('text/html')) req.url = '/review-preview.html' + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
        next();
      });
    },
  }],
  resolve: { alias: [
    { find: '@/lib/supabase', replacement: path.resolve(__dirname, 'src/dev/previewBackend.ts') },
    { find: '@', replacement: path.resolve(__dirname, 'src') },
  ] },
  build: { outDir: 'review-dist', emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'review-preview.html') } },
});
