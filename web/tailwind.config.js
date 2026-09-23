/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', raised: 'var(--surface-raised)',
        border: 'var(--border)', 'border-strong': 'var(--border-strong)',
        ink: 'var(--text)', muted: 'var(--text-muted)', subtle: 'var(--text-subtle)',
        primary: 'var(--primary)', 'primary-hover': 'var(--primary-hover)', 'primary-soft': 'var(--primary-soft)',
        critical: 'var(--critical)', moderate: 'var(--moderate)', minor: 'var(--minor)',
        success: 'var(--success)', info: 'var(--info)',
      },
      borderRadius: { DEFAULT: 'var(--radius)', lg: 'var(--radius-lg)' },
      boxShadow: { s1: 'var(--shadow-1)', s2: 'var(--shadow-2)' },
      fontFamily: { sans: ['Noto Sans', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
