import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        // Palette Coach OS — anthracite + sang (cf. recherche/08_ux_decisions.md).
        // Conv #8 : extension vers les tons clairs (50-400) pour aérer la
        // hiérarchie typographique (texte principal, légendes, valeurs neutres).
        // Les tons 500-950 sont conservés à l'identique — aucun composant
        // existant ne change de rendu.
        anthracite: {
          50: '#f5f6f8',
          100: '#e7e9ed',
          200: '#c9cdd4',
          300: '#9aa0aa',
          400: '#6c727c',
          500: '#454a52',
          600: '#33383f',
          700: '#262a30',
          800: '#1c1f24',
          900: '#14161a',
          950: '#0e0f12',
        },
        sang: {
          950: '#220609',
          900: '#3a0e12',
          800: '#5a141c',
          700: '#7a1a25',
          600: '#9a202e',
          500: '#b62a3a',
          400: '#cc4a59',
        },
      },
      backgroundImage: {
        // Grain SVG très subtil. Casse l'aspect plat des aplats anthracite
        // sans être perceptible consciemment (opacité 0.05, frequency 0.9).
        grain:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.05'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
