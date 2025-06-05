# Decision Log
[2025-06-05 16:12:30] - Implemented deferred loading for galaxy animation
- Modified main.js to use setTimeout(100ms) before dynamic import
- Removed IntersectionObserver-based lazy loading from index.html
- Rationale: Improves main thread performance by deferring heavy animation initialization