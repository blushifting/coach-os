import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Palette Coach OS — anthracite + rouge sombre (cf. recherche/08_ux_decisions.md)
        // Affinée en Conv #8.
        anthracite: {
          950: '#0e0f12',
          900: '#14161a',
          800: '#1c1f24',
          700: '#262a30',
          600: '#33383f',
          500: '#454a52',
        },
        sang: {
          900: '#3a0e12',
          800: '#5a141c',
          700: '#7a1a25',
          600: '#9a202e',
          500: '#b62a3a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
