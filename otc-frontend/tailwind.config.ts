import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a0a',
          surface: '#111111',
          border: '#1e1e1e',
          muted: '#2a2a2a',
          text: '#e0e0e0',
          dim: '#666666',
          accent: '#00FFD1',
          green: '#39FF14',
          red: '#FF3B3B',
          amber: '#FFB800',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
        sans: ['"General Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
