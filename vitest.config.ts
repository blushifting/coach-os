import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  define: {
    // Conv #14a — miroir du define de vite.config.ts pour que les tests
    // qui importent du code utilisant __APP_VERSION__ ne plantent pas.
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'node',
    // Chantier F-1 — la couche cloud doit rester INERTE en test. Vitest hérite
    // du chargement des fichiers `.env` de Vite : sans cette neutralisation, un
    // poste de dev configuré pour le smoke test Supabase ferait tourner la
    // suite contre le vrai projet. Vérifié par `tests/unit/lib/backup.test.ts`.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Conv #11d — `isolate: false` : on désactive le fork par fichier de test.
    // `tests/setup.ts` reset Dexie + Zustand entre chaque test, donc
    // l'isolation par test reste garantie. Évite ~25 forks Node (~29s
    // d'overhead). Si un test rouge apparaît à cause d'un état module-level
    // non reset, revenir à `isolate: true` et investiguer.
    isolate: false,
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
