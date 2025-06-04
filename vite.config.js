import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  build: {
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      plugins: [
        visualizer({ open: true }) // Analyze bundle size
      ]
    }
  },
  plugins: [
    {
      name: 'configure-response-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          next();
        });
      }
    }
  ]
});