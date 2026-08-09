/**
 * D-2 (#75) — le compteur qui déclenche la proposition « passer en favori »
 * (`exercise_pick_counts`, seuil 3) comptait les exos ajoutés depuis le
 * programme, mais ignorait entièrement les séances libres : un exo fait six
 * fois hors programme n'était jamais proposé en favori.
 */

import { describe, it, expect } from 'vitest';
import {
  bootstrap,
  planCustomSessionForDay,
  startCustomSession,
  startUser,
} from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { dateKey } from '@/lib/dashboard';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';

function counts(): Record<string, number> {
  return useCoachOsStore.getState().userState!.exercise_pick_counts ?? {};
}

describe('e2e — compteur favori et séances libres (#75 D-2)', () => {
  it('séance libre démarrée puis programmée : chaque exo compte une fois', async () => {
    await bootstrap();
    await startUser({ profile: makeTestProfile(), muscleGoals: makeTestMuscleGoals() });
    const [a, b] = useCoachOsStore
      .getState()
      .catalog!.all()
      .slice(0, 2)
      .map((ex) => ex.id) as [string, string];

    // Démarrage immédiat (« Démarrer maintenant »).
    await startCustomSession({
      seanceDate: dateKey(new Date()),
      slots: [
        { exerciseId: a, nSets: 3 },
        { exerciseId: b, nSets: 3 },
      ],
      displayName: 'Libre',
    });
    expect(counts()[a]).toBe(1);
    expect(counts()[b]).toBe(1);

    // Séance programmée pour un jour futur, avec un doublon : le même exo deux
    // fois dans la séance reste UN choix.
    await planCustomSessionForDay({
      seanceDate: dateKey(new Date(Date.now() + 86_400_000)),
      slots: [
        { exerciseId: a, nSets: 3 },
        { exerciseId: a, nSets: 2 },
      ],
      displayName: 'Libre',
    });
    expect(counts()[a]).toBe(2);
    expect(counts()[b]).toBe(1);
  });
});
