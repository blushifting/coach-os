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
