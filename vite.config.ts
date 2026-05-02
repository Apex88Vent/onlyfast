import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
}));
