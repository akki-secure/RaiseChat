import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#1e2235',
          hover: 'rgba(255,255,255,0.05)',
          active: 'rgba(255,255,255,0.09)',
        },
        accent: {
          DEFAULT: '#ff5f57',
          hover: '#ff7a72',
        },
      },
    },
  },
  plugins: [],
};

export default config;
