/**
 * Dump 2.4, étape 5 — une base mesurée avec l'ancien calcul des Plafonds est
 * recalculée une fois au démarrage, depuis ses séries, puis marquée à jour.
 */

import { describe, expect, it } from 'vitest';
import { bootstrap, recordFeedbackAndCommit, startUser } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { getDb, resetDbInstance } from '@/db/schema';
import { txSaveUserStateOnly } from '@/db/transactions';
import { PLAFOND_MODEL_VERSION, type SessionFeedback } from '@/engine/models';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';
import { dateKey } from '@/lib/dashboard';

function benchSession(reps: number): SessionFeedback {
  return {
    seance_date: dateKey(new Date()),
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 8,
    label: 'A',
    sets: [{ exercise_id: 'bench_bb', load_kg: 80, reps_done: reps, rpe_perceived: 9 }],
  };
}

describe('e2e — recalcul des Plafonds d’une ancienne base', () => {
  it('remplace les Plafonds de l’ancien calcul et ne recommence pas au démarrage suivant', async () => {
    await bootstrap();
    await startUser({ profile: makeTestProfile(), muscleGoals: makeTestMuscleGoals() });
    expect(useCoachOsStore.getState().userState!.plafond_model).toBe(PLAFOND_MODEL_VERSION);
    await recordFeedbackAndCommit(benchSession(8));
    await recordFeedbackAndCommit(benchSession(10));
    const expected = useCoachOsStore.getState().history.e1rmSnapshots.map((s) => s.e1rm);
    const expectedE1rm = useCoachOsStore.getState().userState!.e1rm['bench_bb'];
    expect(expected).toHaveLength(2);

    // Base « d'avant la 2.3.4 » : ancien calcul (valeurs faussées), pas de version.
    const old = useCoachOsStore.getState().userState!;
    await txSaveUserStateOnly({ ...old, e1rm: { ...old.e1rm, bench_bb: 1 }, plafond_model: 1 });
    await getDb()
      .e1rmSnapshots.toCollection()
      .modify((s) => {
        s.e1rm = s.e1rm * 2;
      });

    resetDbInstance();
    useCoachOsStore.getState().resetAll();
    await bootstrap();

    const after = useCoachOsStore.getState();
    expect(after.userState!.plafond_model).toBe(PLAFOND_MODEL_VERSION);
    expect(after.userState!.e1rm['bench_bb']).toBeCloseTo(expectedE1rm!, 9);
    expect(after.history.e1rmSnapshots.map((s) => s.e1rm)).toEqual(expected);

    // Démarrage suivant : rien n'est recalculé (une valeur posée reste posée).
    await getDb()
      .e1rmSnapshots.toCollection()
      .modify((s) => {
        s.e1rm = 7;
      });
    resetDbInstance();
    useCoachOsStore.getState().resetAll();
    await bootstrap();
    expect(useCoachOsStore.getState().history.e1rmSnapshots.map((s) => s.e1rm)).toEqual([7, 7]);
  });
});
