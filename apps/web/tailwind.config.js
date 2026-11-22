const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: c('bg'), card: c('card'), line: c('line'), ink: c('ink'), mute: c('mute'),
        brand: c('brand'), good: c('good'), soft: c('soft'), goodsoft: c('goodsoft'),
        warn: c('warn'), warnsoft: c('warnsoft'), bad: c('bad'), badsoft: c('badsoft'),
      },
      fontFamily: { sans: ['Outfit', 'Zain', 'system-ui', 'sans-serif'], display: ['Outfit', 'Zain', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(15 23 42 / .06), 0 4px 14px rgb(15 23 42 / .05)' },
    },
  },
  plugins: [],
};
