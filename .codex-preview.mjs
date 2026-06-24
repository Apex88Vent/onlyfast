import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve('src') },
  },
  server: {
    host: '127.0.0.1',
    port: 8080,
  },
});

await server.listen();
server.printUrls();
