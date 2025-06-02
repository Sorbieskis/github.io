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
    const easedScroll = window._easedScroll !== undefined ? window._easedScroll : (window.scrollY / (window.innerHeight || 1)); // Fallback based on first VH

    // Scroll Indicator
    // Fades out after scrolling 50% of the intro section
    if (easedScroll > 0.5 && !scrollIndicatorHidden) {
      scrollIndicator.classList.add('opacity-0');
      scrollIndicatorHidden = true;
    } else if (easedScroll <= 0.5 && scrollIndicatorHidden) {
      scrollIndicator.classList.remove('opacity-0');
      scrollIndicatorHidden = false;
    }

    // Header and Hero Content (from the *next* section)
    // Start fading in when 80% of the intro section is scrolled
    const fadeInTrigger = 0.8; 

    if (easedScroll >= fadeInTrigger) {
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
    } else { // If scrolling back up before the fadeInTrigger
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
  // Ensure elements are present before starting the loop
  if (mainHeader && heroMainContent && scrollIndicator) {
     // Set initial states explicitly based on current scroll (usually 0 on load)
    const initialEasedScroll = window._easedScroll !== undefined ? window._easedScroll : (window.scrollY / (window.innerHeight || 1));
    if (initialEasedScroll <= 0.5) {
        scrollIndicator.classList.remove('opacity-0');
        scrollIndicatorHidden = false;
    } else {
        scrollIndicator.classList.add('opacity-0');
        scrollIndicatorHidden = true;
    }
    // Header and hero content are already opacity-0 by class in HTML, so JS just needs to manage removing/adding it.
    // The visible flags will be set correctly on the first run of updateUIBasedOnScroll.

    requestAnimationFrame(updateUIBasedOnScroll);
  } else {
    console.error('Required elements for scroll animation not found.');
  }
});
