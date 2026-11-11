/**
 * Dump 2.4, étape 1 — la semaine d'une séance est celle de sa date.
 *
 * N° 2 : les séances programmées d'avance gardaient la semaine du jour où on
 * les programmait ; le compteur et le bilan de séance les rangeaient dans la
 * mauvaise semaine. Une séance programmée pour la semaine de récupération avant
 * la décision reçoit le nombre de séries d'une semaine normale, puis est ajustée
 * dès que la récupération est acceptée.
 */

import { describe, it, expect } from 'vitest';
import {
  bootstrap,
  generateInitialCyclePlan,
  planSessionForDay,
  refreshHistory,
  setDeloadDecision,
  startUser,
} from '@/hooks/useEngine';
import { getDb } from '@/db';
import { txSaveSessionPlan } from '@/db/transactions';
import { useCoachOsStore } from '@/store';
import { addDays, dateKey } from '@/lib/dashboard';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';

/** Démarre un utilisateur dont le cycle a commencé il y a `daysAgo` jours. */
async function userWithCycleStartedDaysAgo(daysAgo: number): Promise<string> {
  await bootstrap();
  await startUser({ profile: makeTestProfile(), muscleGoals: makeTestMuscleGoals() });
  await generateInitialCyclePlan();
  const start = dateKey(addDays(new Date(), -daysAgo));
  const state = useCoachOsStore.getState().userState!;
  await getDb().cycles.update(state.cycle_index, { start_date: start });
  await refreshHistory();
  return start;
}

function totalSets(plan: { items: ReadonlyArray<{ sets: readonly unknown[] }> }): number {
  return plan.items.reduce((n, it) => n + it.sets.length, 0);
}

describe('e2e — semaine par dates (dump 2.4, étape 1)', () => {
  it("une séance programmée d'avance prend la semaine de sa date", async () => {
    const start = await userWithCycleStartedDaysAgo(0);
    const inTenDays = dateKey(addDays(new Date(start + 'T00:00:00'), 10));
    const { plan } = await planSessionForDay({ dayIndex: 0, seanceDate: inTenDays });
    expect(plan.week_in_cycle).toBe(2);
  });

  it('un ancien numéro enregistré est recalé sur la date à la lecture', async () => {
    const start = await userWithCycleStartedDaysAgo(0);
    const state = useCoachOsStore.getState().userState!;
    const inNineDays = dateKey(addDays(new Date(start + 'T00:00:00'), 9));
    // Ligne écrite comme avant le correctif : semaine du jour de programmation.
    await txSaveSessionPlan(
      {
        seance_date: inNineDays,
        week_in_cycle: 1,
        cycle_index: state.cycle_index,
        rpe_target: 8,
        items: [],
        label: 'Séance libre',
      },
      state,
    );
    await refreshHistory();
    const row = useCoachOsStore
      .getState()
      .history.sessions.find((s) => s.seance_date === inNineDays)!;
    expect(row.week_in_cycle).toBe(2);
    expect(row.plan.week_in_cycle).toBe(2);
  });

  it('la récupération acceptée ajuste les séances déjà programmées dans sa semaine', async () => {
    // Cycle commencé il y a 22 jours : on est en semaine 4.
    const start = await userWithCycleStartedDaysAgo(22);
    const week5Day = dateKey(addDays(new Date(start + 'T00:00:00'), 30));
    const { plan: before } = await planSessionForDay({ dayIndex: 0, seanceDate: week5Day });
    expect(before.week_in_cycle).toBe(5);

    await setDeloadDecision('accepted');
    const after = useCoachOsStore
      .getState()
      .history.sessions.find((s) => s.seance_date === week5Day)!;
    expect(after.plan.week_in_cycle).toBe(5);
    expect(totalSets(after.plan)).toBeLessThan(totalSets(before));
  });
});
