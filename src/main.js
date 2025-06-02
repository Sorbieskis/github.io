import './style.css';
import './input.css';
import { init as initGalaxyAnimation } from './js/galaxy-animation.js';

document.addEventListener('DOMContentLoaded', () => {
  initGalaxyAnimation();
  
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  const mainHeader = document.getElementById('main-header');
  const heroMainContent = document.getElementById('hero-main-content');
  const scrollIndicator = document.getElementById('scroll-indicator');

  let headerVisible = false;
  let heroContentVisible = false;
  let scrollIndicatorHidden = false;

  function updateUIBasedOnScroll() {
    const easedScroll = window._easedScroll !== undefined ? window._easedScroll : (window.scrollY / (document.body.scrollHeight - window.innerHeight || 1));

    // Scroll Indicator
    if (easedScroll > 0.05 && !scrollIndicatorHidden) {
      scrollIndicator.classList.add('opacity-0');
      scrollIndicatorHidden = true;
    } else if (easedScroll <= 0.05 && scrollIndicatorHidden) {
      scrollIndicator.classList.remove('opacity-0');
      scrollIndicatorHidden = false;
    }

    // Header and Hero Content
    const fadeInStart = 0.1; // Start fading in
    const fadeInEnd = 0.25;   // Fully faded in

    if (easedScroll >= fadeInStart) {
      if (!headerVisible) {
        mainHeader.classList.remove('opacity-0');
        mainHeader.classList.add('opacity-100'); // Ensure it animates to full
        headerVisible = true;
      }
      if (!heroContentVisible) {
        heroMainContent.classList.remove('opacity-0');
        heroMainContent.classList.add('opacity-100'); // Ensure it animates to full
        heroContentVisible = true;
      }
    } else { // If scrolling back up before fadeInStart
      if (headerVisible) {
        mainHeader.classList.add('opacity-0');
        mainHeader.classList.remove('opacity-100');
        headerVisible = false;
      }
      if (heroContentVisible) {
        heroMainContent.classList.add('opacity-0');
        heroMainContent.classList.remove('opacity-100');
        heroContentVisible = false;
      }
    }
    requestAnimationFrame(updateUIBasedOnScroll);
  }

  // Initial call to set states and start the loop
  if (mainHeader && heroMainContent && scrollIndicator) {
    requestAnimationFrame(updateUIBasedOnScroll);
  } else {
    console.error('Required elements for scroll animation not found.');
  }
});
