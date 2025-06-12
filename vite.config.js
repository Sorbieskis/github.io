// vite.config.js

import { defineConfig } from 'vite';

export default defineConfig({
  // We are adding this server section to help with the connection
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  build: {
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        }
      }
    }
  },
  plugins: [],
});