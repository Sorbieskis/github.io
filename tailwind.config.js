/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}"
  ],
  theme: {
    extend: {
      colors: {
        // Galaxy UI Color Palette
        'brand': {
          'deep-blue': '#0A192F',       // Primary dark background
          'medium-blue': '#172A45',     // Secondary background
          'cyan-accent': '#64FFDA',     // Primary accent/CTA
          'light-blue-highlight': '#88DDFF', // Hover states
          'sky': {
            300: '#88DDFF',
            500: '#57CBFF',
            600: '#38B6FF',
            700: '#1E90FF',
          },
          'text': {
            primary: '#CCD6F6',         // Main text
            secondary: '#8892B0'        // Secondary text
          }
        }
      },
      animationDuration: {
        'fast': '300ms',
        'normal': '500ms',             // Standard transition
        'slow': '1000ms',              // Hero animations
        'slower': '1500ms'
      },
      spacing: {
        '4.5': '1.125rem',             // 18px
        '13': '3.25rem',               // 52px
        '15': '3.75rem',               // 60px
        '18': '4.5rem',                // 72px
        '22': '5.5rem',                // 88px
        '26': '6.5rem'                 // 104px
      },
      boxShadow: {
        'ethereal-glow-soft': '0 0 30px rgba(100, 255, 218, 0.3)',
        'card-professional-hover': '0 10px 25px -5px rgba(23, 42, 69, 0.4)'
      }
    },
  },
  plugins: [],
}
