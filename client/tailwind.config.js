/** @type {import('tailwindcss').Config} */
/**
 * Stitch (Hawalay) — design tokens via CSS variables in `src/theme/tokens.css`.
 * Pages use Tailwind utilities + `src/index.css` globals; dark mode uses `class` on `<html>`.
 */
const semanticColors = [
  'inverse-primary',
  'on-tertiary',
  'on-surface',
  'primary-container',
  'outline',
  'error-container',
  'tertiary-fixed',
  'primary-fixed-dim',
  'secondary-fixed',
  'on-primary',
  'surface-bright',
  'on-error',
  'surface',
  'background',
  'inverse-on-surface',
  'tertiary-fixed-dim',
  'surface-container-high',
  'surface-container-lowest',
  'surface-container-low',
  'on-background',
  'error',
  'on-secondary-fixed-variant',
  'outline-variant',
  'on-secondary-container',
  'primary',
  'on-tertiary-fixed',
  'inverse-surface',
  'secondary-container',
  'surface-container',
  'on-error-container',
  'on-tertiary-container',
  'on-secondary',
  'on-surface-variant',
  'surface-variant',
  'primary-fixed',
  'secondary-fixed-dim',
  'tertiary-container',
  'surface-container-highest',
  'on-secondary-fixed',
  'on-primary-fixed',
  'surface-tint',
  'tertiary',
  'surface-dim',
  'on-tertiary-fixed-variant',
  'on-primary-fixed-variant',
  'on-primary-container',
  'secondary',
  'accent',
  'danger',
  'success',
];

function colorTokens(names) {
  return Object.fromEntries(
    names.map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
  );
}

module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: colorTokens(semanticColors),
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
        card: '0.75rem',
        'card-inner': '0.5rem',
        pill: '9999px',
        message: '1rem',
      },
      spacing: {
        xl: '32px',
        md: '16px',
        'margin-mobile': '20px',
        base: '4px',
        sm: '12px',
        xs: '8px',
        lg: '24px',
        'gutter-mobile': '16px',
        safe: 'max(12px, env(safe-area-inset-bottom, 0px))',
      },
      height: {
        safe: 'max(12px, env(safe-area-inset-bottom, 0px))',
      },
      scale: {
        98: '0.98',
      },
      fontFamily: {
        brand: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'label-sm': ['Manrope', 'sans-serif'],
        caption: ['Manrope', 'sans-serif'],
        'body-md': ['Manrope', 'sans-serif'],
        h3: ['Manrope', 'sans-serif'],
        h2: ['Manrope', 'sans-serif'],
        'body-lg': ['Manrope', 'sans-serif'],
        h1: ['Manrope', 'sans-serif'],
      },
      fontSize: {
        'label-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        h3: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        h1: ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
      },
    },
  },
  plugins: [],
};
