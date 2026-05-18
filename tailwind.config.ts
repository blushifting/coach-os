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
        // Conv #11c — police display Oswald (condensée, avec vraies
        // minuscules contrairement à Anton). Effet "outil de salle de sport"
        // tout en restant lisible en bas/haut de casse.
        display: [
          'Oswald',
          'Inter',
          'ui-sans-serif',
          'system-ui',
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
        // Conv #11c — palette "graphite chaleureux" : anthracite avec une
        // infusion subtile de brun-rouge. Utilisée pour le fond global et les
        // surfaces hero. Les composants (Card, inputs) restent en anthracite
        // froid → contraste subtil entre fond et surfaces, plus organique.
        graphite: {
          950: '#16110f', // fond body — gris très foncé chaud
          900: '#1c1714', // section hero, header
          850: '#221c19', // alternative card hero
          800: '#2a2320', // surface élevée
          700: '#3a2f2a', // bordure chaude discrète
        },
      },
      backgroundImage: {
        // Grain SVG très subtil. Casse l'aspect plat des aplats sans être
        // perceptible consciemment (opacité 0.05, frequency 0.9).
        grain:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.05'/></svg>\")",
        // Conv #11c — texture "brushed metal" : fines stries horizontales en
        // turbulence anisotrope. Plus visible que le grain (opacité 0.07), ne
        // ressemble pas à du bruit mais à un métal brossé. Posée en sur-couche
        // sur le grain. Note : baseFrequency 0.04 0.9 = très horizontal.
        brushed:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='b'><feTurbulence type='turbulence' baseFrequency='0.04 0.9' numOctaves='1' seed='5'/><feColorMatrix values='0 0 0 0 0.9  0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23b)' opacity='0.07'/></svg>\")",
      },
      keyframes: {
        // Conv #11i — flash sang one-shot quand on coche une série. Le ✓
        // grossit brièvement et halo plus intense, puis retour normal.
        'tick-pop': {
          '0%': { transform: 'scale(0.85)', boxShadow: '0 0 0 0 rgba(182,42,58,0.6)' },
          '50%': { transform: 'scale(1.15)', boxShadow: '0 0 16px 4px rgba(182,42,58,0.55)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 16px -2px rgba(182,42,58,0.35)' },
        },
        // Halo sang pulsant qui parcourt le row une fois (transition douce
        // mais perceptible). Plus discret que tick-pop.
        'row-flash': {
          '0%': { backgroundColor: 'rgba(122,26,37,0.15)' },
          '40%': { backgroundColor: 'rgba(122,26,37,0.40)' },
          '100%': { backgroundColor: 'rgba(122,26,37,0.10)' },
        },
        // Conv #11i — bilan : numéros qui "count up" via opacity + slide.
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Tracé progressif d'un polyline SVG (stroke-dashoffset). Le composant
        // doit poser pathLength sur le polyline + stroke-dasharray=1.
        'draw-line': {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'tick-pop': 'tick-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'row-flash': 'row-flash 600ms ease-out',
        'reveal-up': 'reveal-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'draw-line': 'draw-line 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      boxShadow: {
        // Conv #11c — halo rouge diffus pour les éléments primaires hover/focus.
        'glow-sang': '0 0 16px -2px rgba(182,42,58,0.35), 0 0 32px -4px rgba(182,42,58,0.25)',
        // Halo rouge plus prononcé (étape active de StepIndicator, etc.).
        'glow-sang-lg':
          '0 0 8px 0 rgba(204,74,89,0.55), 0 0 24px -2px rgba(182,42,58,0.45)',
        // Conv #11c — ombre extérieure douce + inset clair haut + reflet rouge
        // discret en bas → profondeur "card" avec une signature sang permanente.
        'card-soft':
          'inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(204,74,89,0.10), 0 4px 16px -6px rgba(0,0,0,0.55), 0 1px 2px 0 rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
