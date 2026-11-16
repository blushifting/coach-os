import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string };

/**
 * Atelier des visuels (`visuels.html`) : « Enregistrer » envoie ici les
 * fichiers de pose déjà rédigés par la page (`src/visuels/edition.ts`), que ce
 * greffon écrit dans `src/visuels/poses/`. Serveur de développement seulement ;
 * il refuse tout autre dossier et tout nom qui n'est pas `<identifiant>.ts`.
 */
function atelierVisuels(): Plugin {
  const dossier = path.resolve(__dirname, 'src/visuels/poses');
  return {
    name: 'kotsh-atelier-visuels',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, suite) => {
        if (req.method !== 'POST' || !req.url?.endsWith('/__atelier/enregistrer')) return suite();
        let corps = '';
        req.on('data', (morceau: Buffer) => { corps += morceau.toString('utf8'); });
        req.on('end', () => {
          const repondre = (code: number, message: string): void => {
            res.statusCode = code;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(message);
          };
          try {
            const { fichiers } = JSON.parse(corps) as { fichiers: { nom: unknown; contenu: unknown }[] };
            if (!Array.isArray(fichiers) || fichiers.length === 0) return repondre(400, 'Aucun fichier reçu.');
            for (const f of fichiers) {
              if (typeof f.nom !== 'string' || !/^[a-z0-9_]+\.ts$/.test(f.nom) || typeof f.contenu !== 'string') {
                return repondre(400, `Fichier refusé : ${String(f.nom)}`);
              }
            }
            for (const f of fichiers) writeFileSync(path.join(dossier, f.nom as string), f.contenu as string, 'utf8');
            repondre(200, fichiers.map((f) => f.nom).join(', '));
          } catch (e) {
            repondre(500, e instanceof Error ? e.message : String(e));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/coach-os/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Aperçu de développement sans compte : `KOTSH_HORS_LIGNE=1` neutralise la
    // couche en ligne même si `.env.local` la configure (la garde de compte est
    // alors inerte, cf. `RequireAccount`). Jamais posé par le build de production.
    ...(process.env.KOTSH_HORS_LIGNE === '1'
      ? {
          'import.meta.env.VITE_SUPABASE_URL': '""',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
        }
      : {}),
  },
  plugins: [
    react(),
    atelierVisuels(),
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
