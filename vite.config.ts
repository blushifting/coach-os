import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig({
  base: '/coach-os/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // Conv #11d — passage à 'prompt' : on capture la dispo d'une nouvelle
      // version via `useRegisterSW` (cf. components/UpdatePrompt.tsx) et on
      // demande confirmation à l'utilisateur avant le reload. Rassure sur iOS
      // où Safari peut tarder à activer la nouvelle version ; le prompt rend
      // la MAJ visible et explicite.
      registerType: 'prompt',
      includeAssets: [
        'favicon-32.png',
        'apple-touch-icon.png',
        'icon.svg',
      ],
      manifest: {
        id: '/coach-os/',
        scope: '/coach-os/',
        start_url: '/coach-os/',
        name: 'Kotsh',
        short_name: 'Kotsh',
        description:
          "Coach de musculation autorégulée par RPE — 100 % local, hors-ligne.",
        lang: 'fr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0f12',
        theme_color: '#0e0f12',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,json}'],
        // Le JSON du catalogue est bundlé via import — pas besoin de cacher
        // un endpoint runtime. Tout le moteur tourne offline dès install.
        navigateFallback: '/coach-os/index.html',
        navigateFallbackDenylist: [/^\/coach-os\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
