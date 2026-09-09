import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        severity: {
          watch:     '#16a34a',
          advisory:  '#2563eb',
          warning:   '#d97706',
          emergency: '#dc2626',
        },
        dmc: {
          dark: '#1a1f2e',
          primary: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;