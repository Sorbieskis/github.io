import { defineConfig } from 'vite';
// import { visualizer } from 'rollup-plugin-visualizer'; // Option A: Uncomment if you install it and want to use it
// import viteCompression from 'vite-plugin-compression'; // Remove for Netlify

export default defineConfig({
  base: '/', // Ensure base is '/' for standard Netlify deployment
  build: {
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      plugins: [
        // visualizer({ open: true }) // Option A: Uncomment if using. Option B: Keep commented if not.
      ],
      output: {
        manualChunks: {
          three: ['three'],
          // Note: glob patterns for manualChunks need careful handling and might require a plugin
          // For simplicity, ensure paths are explicit or consider if this level of chunking is critical now.
          // Let's assume for now 'galaxy' might be a specific entry point or a large module.
          // If './src/js/galaxy/**/*.js' is meant to bundle many files,
          // ensure Vite's default chunking or more specific manual chunks are what you need.
          // Example for a single entry for the galaxy logic:
          // galaxy: ['./src/js/galaxy/main.js'], // or your primary galaxy entry file
        }
      }
    }
  },
  plugins: [
    // viteCompression removed as Netlify handles compression
    // viteCompression({
    //   algorithm: 'brotliCompress',
    //   ext: '.br',
    //   threshold: 10240
    // }),
    // viteCompression({
    //   algorithm: 'gzip',
    //   ext: '.gz',
    //   threshold: 10240
    // }),
    {
      // This custom middleware for Cache-Control is more for local dev.
      // Netlify has its own mechanisms for setting headers (e.g., _headers file or netlify.toml).
      // For now, we leave it, but it might not apply as expected on Netlify.
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
