import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  server: { port: 5173, fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true },
});
