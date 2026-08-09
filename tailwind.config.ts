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
        // Conv #14a-4 — passage à Inter Tight (variable, non condensée mais
        // serrée). Remplace Oswald (jugé trop brutaliste) tout en gardant un
        // ton resserré qui se distingue d'Inter en body.
        display: [
          'Inter Tight Variable',
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
        // 1.16 — la validation d'une série est VERTE (« c'est fait », grille
        // sémantique : vert = succès). 1.16.2 — vert assombri (green-600 =
        // rgb(22,163,74)) pour moins jurer avec le rouge sang.
        'tick-pop': {
          '0%': { transform: 'scale(0.85)', boxShadow: '0 0 0 0 rgba(22,163,74,0.6)' },
          '50%': { transform: 'scale(1.15)', boxShadow: '0 0 16px 4px rgba(22,163,74,0.5)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 16px -2px rgba(22,163,74,0.32)' },
        },
        // Halo sang pulsant qui parcourt le row une fois (transition douce
        // mais perceptible). Conservé pour le spotlight « regarde ici » de la
        // visite démo (DemoMode), où ce n'est pas une validation.
        'row-flash': {
          '0%': { backgroundColor: 'rgba(122,26,37,0.15)' },
          '40%': { backgroundColor: 'rgba(122,26,37,0.40)' },
          '100%': { backgroundColor: 'rgba(122,26,37,0.10)' },
        },
        // 1.16 — flash VERT au moment où une série est validée (remplace
        // row-flash sur le SetInput). 1.16.2 — pic assombri (green-600).
        'validate-flash': {
          '0%': { backgroundColor: 'rgba(22,101,52,0.15)' },
          '40%': { backgroundColor: 'rgba(22,163,74,0.26)' },
          '100%': { backgroundColor: 'rgba(22,101,52,0.10)' },
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
        // Conv #20.5 — fade-in opacité pure pour les points de la courbe Force.
        // Pas de translation (le point doit apparaître en place au moment où la
        // ligne le traverse, pas surgir d'en bas comme reveal-up le faisait).
        'point-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Bloc C 1.16 — mouvement & transitions (cf. skill esthetique-finition).
        // Volet / bottom sheet : entre en slide depuis le bas (pas d'apparition
        // brutale) + backdrop qui se fond.
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'backdrop-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // 1.17 — symétriques de fermeture : le volet redescend + le backdrop
        // se dissout avant le démontage (état « closing » dans Sheet.tsx).
        'sheet-down': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'backdrop-fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        // Transition de page (changement d'onglet/route) : fondu + léger
        // glissement vers le haut, cohérent dans toute l'app.
        'page-fade': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Conv #66 — bilan de séance : le repère V_min s'illumine au moment
        // précis où la barre de volume le franchit. Vert (grille sémantique :
        // vert = cible atteinte, comme la validation de série). Le trait
        // s'étire verticalement plutôt que de grossir : il reste un repère
        // posé sur la barre, il ne devient pas un objet.
        'vmin-hit': {
          '0%': { transform: 'scaleY(1)', boxShadow: '0 0 0 0 rgba(22,163,74,0)' },
          '40%': {
            transform: 'scaleY(2.4)',
            boxShadow: '0 0 10px 2px rgba(22,163,74,0.6)',
          },
          '100%': { transform: 'scaleY(1)', boxShadow: '0 0 0 0 rgba(22,163,74,0)' },
        },
        // Conv #66 — symétrique de `tick-pop` au DÉcochage : la coche se
        // rétracte au lieu de simplement s'éteindre. Pas de halo (on retire un
        // acquis, ce n'est pas un événement à célébrer) et plus court que le pop.
        'tick-unpop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(0.88)' },
          '100%': { transform: 'scale(1)' },
        },
        // Conv #66 — onde qui s'échappe du dernier point de la courbe Force, une
        // fois le tracé arrivé. Anime `r` (propriété CSS des formes SVG) plutôt
        // qu'un `transform: scale`, qui prendrait pour origine le coin du SVG et
        // non le centre du point. Si `r` n'est pas animable, l'opacité seule joue
        // encore : dégradation acceptable.
        'last-point-ping': {
          '0%': { r: '2.5', opacity: '0.85' },
          '100%': { r: '10', opacity: '0' },
        },
        // Conv #66 — changement d'onglet PRINCIPAL : la page entre du côté d'où
        // elle vient. 16 px = le niveau haut de la hiérarchie de mouvement (les
        // sous-onglets se contentent de 6 px, cf. `subtab-in-*`).
        'page-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'page-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Conv #66 — bascule entre sous-onglets (Progrès). Amplitude VOLONTAIREMENT
        // faible (6 px) face aux 16 px des onglets principaux : le sous-niveau doit
        // se lire comme un glissement discret, pas comme un changement d'écran.
        'subtab-in-right': {
          '0%': { opacity: '0', transform: 'translateX(6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'subtab-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Conv #66 — la dernière série vient d'être cochée : le bouton de fin
        // s'annonce une fois. Halo sang (action principale), pas vert : on ne
        // valide rien, on signale où aller.
        'finish-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(182,42,58,0)' },
          '45%': { boxShadow: '0 0 18px 3px rgba(182,42,58,0.55)' },
          '100%': { boxShadow: '0 0 0 0 rgba(182,42,58,0)' },
        },
        // Conv #66 — une charge vient d'être recalculée par la calibration.
        // Ambre = « regarde, ça a changé », sans jugement (ni succès ni erreur).
        // Se termine en transparent : la ligne retrouve son fond de classe.
        // E-1 (#75) — le flash s'est replié de la ligne de série entière sur la
        // seule case charge : c'est elle qui a changé, la ligne ne bougeait pas.
        // Les éléments de la case sont opaques (`bg-anthracite-800`) : ils
        // masqueraient un fond animé posé sur leur conteneur, donc chacun porte
        // l'animation, et l'image finale est leur couleur de classe — sans quoi
        // la case se creuserait d'un cran avant de revenir.
        'recalibrate-field': {
          '0%': { backgroundColor: 'rgba(217,119,6,0.45)' },
          '100%': { backgroundColor: '#1c1f24' },
        },
      },
      animation: {
        'tick-pop': 'tick-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'row-flash': 'row-flash 600ms ease-out',
        'validate-flash': 'validate-flash 600ms ease-out',
        'reveal-up': 'reveal-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'draw-line': 'draw-line 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'point-fade-in': 'point-fade-in 160ms ease-out both',
        'sheet-up': 'sheet-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'backdrop-fade': 'backdrop-fade 200ms ease-out',
        // `forwards` : reste à l'état final (volet hors écran / backdrop nul)
        // jusqu'au démontage, pas de snap-back en fin d'animation.
        'sheet-down': 'sheet-down 240ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'backdrop-fade-out': 'backdrop-fade-out 240ms ease-in forwards',
        'page-fade': 'page-fade 200ms ease-out',
        'page-in-right': 'page-in-right 220ms ease-out',
        'page-in-left': 'page-in-left 220ms ease-out',
        'vmin-hit': 'vmin-hit 520ms ease-out',
        'tick-unpop': 'tick-unpop 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'finish-pulse': 'finish-pulse 800ms ease-out',
        'last-point-ping': 'last-point-ping 900ms ease-out both',
        'subtab-in-right': 'subtab-in-right 180ms ease-out',
        'subtab-in-left': 'subtab-in-left 180ms ease-out',
        'recalibrate-field': 'recalibrate-field 600ms ease-out',
      },
      boxShadow: {
        // Conv #11c — halo rouge diffus pour les éléments primaires hover/focus.
        'glow-sang': '0 0 16px -2px rgba(182,42,58,0.35), 0 0 32px -4px rgba(182,42,58,0.25)',
        // Halo rouge plus prononcé (étape active de StepIndicator, etc.).
        'glow-sang-lg':
          '0 0 8px 0 rgba(204,74,89,0.55), 0 0 24px -2px rgba(182,42,58,0.45)',
        // 1.16 — halo VERT pour l'état « validé » (coche de série faite).
        // 1.16.2 — green-600 = rgb(22,163,74), un peu moins lumineux pour
        // s'accorder au rouge sang.
        'glow-green':
          '0 0 8px 0 rgba(22,163,74,0.4), 0 0 24px -4px rgba(22,163,74,0.26)',
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
