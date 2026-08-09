/**
 * C-1 (#75) — les exos custom survivent à une restauration (fichier importé ou
 * sauvegarde cloud), et ne survivent PAS à une réinitialisation.
 *
 * Le bug ne portait ni sur l'export (l'export les contenait bien) ni sur
 * l'écriture en base (`importPayload` remplissait bien `userAddedExercises`),
 * mais sur le `Catalog` en mémoire : il n'était rebâti qu'au démarrage de
 * l'app. Après une restauration, les exos custom restaient donc invisibles
 * jusqu'au prochain lancement — et après un « Réinitialiser », ceux du compte
 * effacé restaient visibles.
 */

import { describe, it, expect } from 'vitest';
import {
  addCustomExercise,
  bootstrap,
  importDataFromPayload,
  resetApp,
  startUser,
} from '@/hooks/useEngine';
import { buildExportPayload } from '@/io/export';
import { useCoachOsStore } from '@/store';
import { EMPTY_DRAFT, buildExerciseDict } from '@/lib/custom-exercise';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';

const CUSTOM_NAME = 'Élévations latérales élastique';

function customDict() {
  return buildExerciseDict(
    {
      ...EMPTY_DRAFT,
      nom_fr: CUSTOM_NAME,
      muscles: { deltos_lateraux: 1 },
    },
    new Set<string>(),
  );
}

describe('e2e — exos custom face à la restauration (#75 C-1)', () => {
  it('restauration : l’exo custom est de retour dans le catalogue, sans redémarrer l’app', async () => {
    await bootstrap();
    await startUser({ profile: makeTestProfile(), muscleGoals: makeTestMuscleGoals() });

    const dict = customDict();
    await addCustomExercise(dict);
    expect(useCoachOsStore.getState().catalog!.has(dict.id)).toBe(true);
    expect(useCoachOsStore.getState().customExerciseIds.has(dict.id)).toBe(true);

    // La sauvegarde (fichier ou cloud) porte bien l'exo custom.
    const payload = await buildExportPayload();
    expect(payload.data.userAddedExercises.map((r) => r.exercise_id)).toContain(dict.id);

    // Appareil vidé (déconnexion / téléphone prêté) : le catalogue en mémoire
    // ne doit plus porter l'exo custom du compte effacé.
    await resetApp();
    expect(useCoachOsStore.getState().catalog!.has(dict.id)).toBe(false);
    expect(useCoachOsStore.getState().customExerciseIds.size).toBe(0);

    // Restauration : même chemin que la sauvegarde cloud (payload désérialisé).
    await importDataFromPayload(payload);
    const store = useCoachOsStore.getState();
    expect(store.catalog!.has(dict.id)).toBe(true);
    expect(store.catalog!.get(dict.id).nom_fr).toBe(CUSTOM_NAME);
    expect(store.customExerciseIds.has(dict.id)).toBe(true);
  });
});
