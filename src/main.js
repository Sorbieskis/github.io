import './style.css';
import './input.css';
import { init as initGalaxyAnimation } from './js/galaxy-animation.js';

document.addEventListener('DOMContentLoaded', () => {
  initGalaxyAnimation();
  // Set copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});
