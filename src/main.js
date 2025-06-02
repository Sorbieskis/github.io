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
    // _easedScroll is now normalized from 0 (top of page) to 1 (top of #projects section)
    const easedScroll = window._easedScroll !== undefined ? window._easedScroll : 0; // Default to 0 if not yet available

    // Scroll Indicator: Fades out after ~10% of the scroll towards projects section
    const scrollIndicatorFadeOutTrigger = 0.1;
    if (easedScroll > scrollIndicatorFadeOutTrigger && !scrollIndicatorHidden) {
      scrollIndicator.classList.add('opacity-0');
      scrollIndicatorHidden = true;
    } else if (easedScroll <= scrollIndicatorFadeOutTrigger && scrollIndicatorHidden) {
      scrollIndicator.classList.remove('opacity-0');
      scrollIndicatorHidden = false;
    }

    // Header and Hero Content (#hero-main-content)
    // These appear after the 100vh spacer.
    // We need to estimate what _easedScroll value corresponds to scrolling past the first 100vh.
    // This depends on projectsSectionTop, which isn't directly known here.
    // Let's assume projectsSectionTop is at least 2-3x window.innerHeight.
    // So, after 100vh scroll, _easedScroll might be around 0.2 to 0.4.
    // Let's make them appear fairly early in the _easedScroll range, but after the initial pure galaxy view.
    // A simple approach: link to scrollY for these specific fades, as _easedScroll's scale has changed.
    
    const scrollY = window.scrollY;
    const firstViewportHeight = window.innerHeight;
    const headerHeroFadeInStartScrollY = firstViewportHeight * 0.7; // Start fading when 70% of first VH is scrolled

    if (scrollY >= headerHeroFadeInStartScrollY) {
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
    } else { // If scrolling back up before the trigger
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
    // Initial state for scroll indicator (visible)
    scrollIndicator.classList.remove('opacity-0');
    scrollIndicatorHidden = false;
    
    // Header and hero content are opacity-0 by HTML class initially.
    // Flags will be set correctly on the first run of updateUIBasedOnScroll.
    requestAnimationFrame(updateUIBasedOnScroll);
  } else {
    console.error('Required elements for scroll animation not found.');
  }
});
