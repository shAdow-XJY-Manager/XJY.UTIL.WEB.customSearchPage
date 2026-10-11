import { defineConfig } from 'vite';
export default defineConfig({
  root: 'native',
  base: './',
  publicDir: false,
  server: { host: '127.0.0.1' },
  build: { outDir: '../build/web', emptyOutDir: true, sourcemap: false },
});
