/** @type {import('tailwindcss').Config} */
module.exports = {
  // This "content" array is the critical part that fixes the issue.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'orbitron': ['Orbitron', 'sans-serif'],
      },
      colors: {
        'brand-deep-blue': '#0A192F',
        'brand-medium-blue': '#1E293B',
        'brand-text-primary': '#E2E8F0',
        'brand-text-secondary': '#94A3B8',
        'brand-cyan-accent': '#64FFDA',
        'brand-light-blue-highlight': '#7DD3FC',
      },
    },
  },
  plugins: [],
};