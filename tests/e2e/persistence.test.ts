/**
 * Critère de fin Conv #3 (cf. plan §3) :
 * "test e2e — créer user → générer session → feedback → relancer app →
 *  état restauré".
 *
 * On simule "relancer l'app" en :
 *   1. fermant l'instance Dexie + reset du store Zustand,
 *   2. ré-appelant `bootstrap()` qui doit recharger le state depuis
 *      IndexedDB (qui survit, contrairement au store).
 */

import { describe, it, expect } from 'vitest';
import {
  bootstrap,
  startUser,
  generateAndStoreSession,
  recordFeedbackAndCommit,
  endOfWeek,
} from '@/hooks/useEngine';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
import { useCoachOsStore } from '@/store';
import { resetDbInstance } from '@/db/schema';
import { dateKey } from '@/lib/dashboard';
import {
  makeTestMuscleGoals,
  makeTestProfile,
} from '@/test-utils/fixtures';
import { Catalog } from '@/engine/catalog';
import type { SessionFeedback } from '@/engine/models';

describe('e2e — persistance complète (critère de fin Conv #3)', () => {
  it('créer user → générer session → feedback → relancer app → état restauré', async () => {
    // --- 1. App boot vierge ---
    await bootstrap();
    expect(useCoachOsStore.getState().bootstrapped).toBe(true);
    expect(useCoachOsStore.getState().userState).toBeNull();

    // --- 2. Onboarding : startUser (programme custom) ---
    const profile = makeTestProfile();
    const muscleGoals = makeTestMuscleGoals();
    const userState = await startUser({
      profile,
      muscleGoals,
    });
    expect(userState.profile.bodyweight_kg).toBe(80);

    // Pour générer une session, on a besoin d'un current_cycle_plan : on le
    // pose via le moteur custom + on re-persiste par mutation directe du store.
    const catalog = new Catalog();
    const stateAvecPlan = useCoachOsStore.getState().userState!;
    stateAvecPlan.current_cycle_plan = autoGenerateCyclePlanV3(stateAvecPlan, catalog);
    stateAvecPlan.muscle_goals = muscleGoals;
    // Sauve via endOfWeek qui passe par la transaction (sans changer d'index
    // car on ne déclenche aucun plateau ni hit Vmax).
    useCoachOsStore.setState({ userState: stateAvecPlan });

    // --- 3. Génère une séance et commit un feedback ---
    // Conv #30 — la séance est datée du JOUR : le 1er feedback d'un cycle
    // ré-ancre `cycle.start_date` sur cette date (calendrier glissant). Une date
    // backdatée ferait avancer `current_week_in_cycle` au re-bootstrap (tick),
    // ce qui est le comportement voulu mais casserait l'invariant de ce test.
    const { plan, sessionId } = await generateAndStoreSession({
      dayIndex: 0,
      seanceDate: dateKey(new Date()),
    });
    expect(sessionId).toBeGreaterThan(0);
    expect(plan.items.length).toBeGreaterThan(0);

    const feedback: SessionFeedback = {
      seance_date: plan.seance_date,
      week_in_cycle: plan.week_in_cycle,
      cycle_index: plan.cycle_index,
      rpe_target: plan.rpe_target,
      label: plan.label,
      sets: plan.items.flatMap((it) =>
        it.sets.map((s) => ({
          exercise_id: it.exercise_id,
          reps_done: s.reps,
          load_kg: s.load_kg,
          rpe_perceived: s.rpe_target,
        })),
      ),
    };
    await recordFeedbackAndCommit(feedback);

    // Snapshot des invariants à vérifier après reload
    const stateBefore = useCoachOsStore.getState().userState!;
    const e1rmBefore = { ...stateBefore.e1rm };
    const historyLenBefore = stateBefore.history.length;
    const cycleIndexBefore = stateBefore.cycle_index;
    const weekBefore = stateBefore.current_week_in_cycle;
    const sessionsCountBefore = useCoachOsStore.getState().history.sessions.length;
    const feedbacksCountBefore = useCoachOsStore.getState().history.feedbacks.length;
    const snapshotsCountBefore = useCoachOsStore.getState().history.e1rmSnapshots.length;

    expect(historyLenBefore).toBe(1);
    expect(sessionsCountBefore).toBe(1);
    expect(feedbacksCountBefore).toBe(1);
    expect(snapshotsCountBefore).toBeGreaterThan(0);

    // --- 4. Relancer l'app : on ferme la connexion Dexie + reset le store ---
    resetDbInstance();
    useCoachOsStore.getState().resetAll();
    expect(useCoachOsStore.getState().userState).toBeNull();
    expect(useCoachOsStore.getState().bootstrapped).toBe(false);

    // --- 5. Re-bootstrap : doit relire IndexedDB et restaurer le state ---
    await bootstrap();
    const restored = useCoachOsStore.getState();

    expect(restored.bootstrapped).toBe(true);
    expect(restored.userState).not.toBeNull();
    expect(restored.userState?.profile.bodyweight_kg).toBe(80);
    expect(restored.userState?.profile.available_equip.has('bb_oly')).toBe(true);
    expect(restored.userState?.cycle_index).toBe(cycleIndexBefore);
    expect(restored.userState?.current_week_in_cycle).toBe(weekBefore);
    expect(restored.userState?.history.length).toBe(historyLenBefore);
    expect(restored.userState?.e1rm).toEqual(e1rmBefore);
    expect(restored.userState?.muscle_goals['pectoraux']?.priority_rank).toBe(1);
    // Bloc O — un éventuel id guidé persisté est neutralisé au deserialize.
    expect(restored.userState?.active_guided_program_id).toBeNull();

    // Tables dérivées rechargées
    expect(restored.history.sessions).toHaveLength(sessionsCountBefore);
    expect(restored.history.feedbacks).toHaveLength(feedbacksCountBefore);
    expect(restored.history.e1rmSnapshots).toHaveLength(snapshotsCountBefore);
    expect(restored.history.cycles).toHaveLength(1);

    // --- 6. Vérification : on peut continuer à utiliser le moteur ---
    const result = await endOfWeek();
    expect(result.cycle_index).toBeGreaterThanOrEqual(1);
  });
});
