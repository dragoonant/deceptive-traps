import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so dist/ can be hosted from any folder
  build: { chunkSizeWarningLimit: 800 },
});
