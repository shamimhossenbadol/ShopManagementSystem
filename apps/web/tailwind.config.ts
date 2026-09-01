import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        shop: {
          primary: '#2563eb',
          'primary-light': '#dbeafe',
          success: '#059669',
          danger: '#dc2626',
          warning: '#d97706',
          info: '#0891b2',
          surface: '#ffffff',
          bg: '#f8fafc',
          text: '#0f172a',
          'text-muted': '#64748b',
          border: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
