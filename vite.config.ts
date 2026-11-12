import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const phase2027 = mode === 'onlyfast-2027' || process.env.VERCEL_GIT_COMMIT_REF === 'develop/onlyfast-2027';
  if (phase2027 && process.env.VERCEL_ENV === 'production') throw new Error('OnlyFast 2027 is preview-only. Production builds are prohibited.');
  return ({
  // Explicitly pin the project root and HTML entry so Rollup never gets
  // confused about where index.html lives or how to resolve "/src/main.tsx".
  // This avoids the intermittent Vercel build error:
  //   "[vite]: Rollup failed to resolve import '/src/main.tsx' from index.html"
  root: __dirname,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  define: {
    // Vite PROD alone is also true in preview builds. Never use it alone to
    // authorize live ads, and never trust a URL/localStorage mode override.
    'import.meta.env.ONLYFAST_2027_PREVIEW': JSON.stringify(phase2027),
    'import.meta.env.ONLYFAST_ADS_DEPLOYMENT': JSON.stringify(process.env.VERCEL_ENV || 'local'),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: mode === 'native-sandbox' ? 'dist-native-sandbox' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
});
