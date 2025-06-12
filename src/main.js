import './style.css';

import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  // Show loading indicator
  const loader = document.createElement('div');
  loader.id = 'galaxy-loader';
  loader.style.cssText = `/* Loading styles */`;
  document.body.appendChild(loader);

  setTimeout(async () => {
    try {
      const { initGalaxy } = await import('./js/galaxy/main');
      if (typeof initGalaxy === 'function') initGalaxy();
      document.body.removeChild(loader);
    } catch (error) {
      console.error('Failed to initialize galaxy animation:', error);
      document.body.removeChild(loader);
    }
  }, 100);
});
