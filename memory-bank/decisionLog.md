# Decision Log
[2025-06-11 16:49:44] - Removed unused configuration and asset files
- Deleted postcss.config.js (unused CSS processor config)
- Deleted tailwind.config.js (unused Tailwind CSS config)
- Deleted src/counter.js (unused legacy counter script)
- Deleted src/input.css (unused CSS file)
- Rationale: Project cleanup to remove unused dependencies

[2025-06-05 16:12:30] - Implemented deferred loading for galaxy animation
- Modified main.js to use setTimeout(100ms) before dynamic import
- Removed IntersectionObserver-based lazy loading from index.html
- Rationale: Improves main thread performance by deferring heavy animation initialization
[2025-06-11 16:52:15] - Removed TailwindCSS from project. Decision based on minimal usage in existing CSS and lack of configuration files. Project will continue with custom CSS approach which is already well-established.
### Dependency Update (2025-06-12)
- Updated all dependencies to latest stable versions
- Packages updated:
  - postcss: 8.5.3 → 8.5.5
  - rollup-plugin-visualizer: 6.0.1 → 6.0.3
  - terser: 5.40.0 → 5.42.0
  - three: 0.176.0 → 0.177.0
- Build verified successfully
[2025-06-12 08:04:20] - Added explicit WebSocket HMR configuration to vite.config.js
- Configured host: 'localhost'
- Set port: 5173 
- Protocol: 'ws'
- Rationale: Resolves Firefox connection issues by explicitly defining WebSocket parameters

[2025-06-12 08:11:03] - Added explicit server port configuration to vite.config.js
- Set server.port: 5173 to match HMR port
- Ensured both HTTP and WebSocket connections use same port
- Rationale: Resolves port mismatch causing WebSocket connection failures
[2025-06-12 08:22:08] - Enhanced WebSocket configuration in vite.config.js
- Added strictPort: true to prevent port fallback
- Set host: '0.0.0.0' for network accessibility 
- Added clientPort: 5173 to ensure consistent WebSocket port
- Rationale: Further hardening WebSocket connection reliability
## [2025-06-12] Restored Tailwind CSS Configuration

- Installed Tailwind CSS, PostCSS, and Autoprefixer
- Created postcss.config.js and tailwind.config.js
- Updated src/style.css to include Tailwind directives