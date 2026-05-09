/**
 * Setup global Vitest — injecte `fake-indexeddb` dans globalThis et expose
 * un hook `beforeEach` qui efface la DB Coach OS entre chaque test.
 *
 * Référencé via `setupFiles` dans `vitest.config.ts`.
 */

import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { resetDbInstance } from '@/db/schema';
import { useCoachOsStore } from '@/store';

beforeEach(async () => {
  // Ferme l'instance Dexie courante puis efface complètement la DB IndexedDB
  // sous-jacente pour repartir d'une ardoise vierge à chaque test.
  resetDbInstance();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('coach-os');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
  // Reset Zustand
  useCoachOsStore.getState().resetAll();
});
