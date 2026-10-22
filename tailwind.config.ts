import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        onyx: '#050505',
        coal: '#0d0c0b',
        graphite: '#171513',
        gold: { 50: '#fbf5e4', 100: '#f3e3b3', 200: '#ecd187', 300: '#e2bc5f', 400: '#d4a647', 500: '#b98a32', 600: '#8f6a25', 700: '#654a1b' },
        ivory: '#f5efe2',
        smoke: '#a9a196',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Montserrat Variable"', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { brand: '0.28em' },
      boxShadow: {
        glass: '0 20px 60px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(255,255,255,.04)',
        gold: '0 0 0 1px rgba(226,188,95,.35), 0 12px 40px -12px rgba(226,188,95,.45)',
      },
      keyframes: {
        sheen: { '0%': { transform: 'translateX(-120%)' }, '100%': { transform: 'translateX(220%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: { sheen: 'sheen 2.6s ease-in-out infinite', floaty: 'floaty 5s ease-in-out infinite', marquee: 'marquee 40s linear infinite' },
    },
  },
  plugins: [],
};

export default config;
