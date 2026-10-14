import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: { target: 'chrome120', assetsInlineLimit: () => true },
});
