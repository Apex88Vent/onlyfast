import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const phase2027 = mode === 'onlyfast-2027' || process.env.VERCEL_GIT_COMMIT_REF === 'develop/onlyfast-2027';
  if (phase2027 && process.env.VERCEL_ENV === 'production') throw new Error('OnlyFast 2027 is preview-only. Production builds are prohibited.');
  const testingApp = phase2027 && process.env.VITE_ONLYFAST_2027_APP === 'true';
  if (testingApp && (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'develop/onlyfast-2027')) {
    throw new Error('OnlyFast 2027 activation requires the exact isolated Preview branch.');
  }
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
    'import.meta.env.ONLYFAST_2027_APP': JSON.stringify(testingApp),
    'import.meta.env.ONLYFAST_DEPLOYMENT_BRANCH': JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF || ''),
    'import.meta.env.ONLYFAST_DEPLOYMENT_TARGET': JSON.stringify(process.env.VERCEL_ENV || 'local'),
    ...(phase2027 ? {
      'import.meta.env.VITE_REVENUECAT_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_REVENUECAT_ANDROID_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_REVENUECAT_IOS_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_REVENUECAT_IOS_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_MEDIAN_ADMOB_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_HIDE_EXTERNAL_PAYMENTS': JSON.stringify('true'),
    } : {}),
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
