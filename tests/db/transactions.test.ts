import { describe, it, expect } from 'vitest';
import { Catalog } from '@/engine/catalog';
import { startUser } from '@/engine/engine';
import { getDb } from '@/db';
import {
  txCommitSessionFeedback,
  txEndOfCycle,
  txEndOfWeek,
  txInitUser,
  txSaveSessionPlan,
} from '@/db/transactions';
import { loadUserState } from '@/db/repositories/userState.repo';
import { listAllCycles } from '@/db/repositories/cycles.repo';
import { listSessionsByCycle } from '@/db/repositories/sessions.repo';
import { listAllFeedbacks } from '@/db/repositories/feedbacks.repo';
import { listAllSnapshots } from '@/db/repositories/e1rmSnapshots.repo';
import { loadOverridesAsRecord } from '@/db/repositories/equipmentOverrides.repo';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';
import type { SessionFeedback, SessionPlan } from '@/engine/models';

describe('transactions.ts — atomicité blob ↔ tables dérivées', () => {
  it('txInitUser sauve userState + cycle 1 + overrides', async () => {
    const state = startUser(makeTestProfile(), new Catalog(), {
      muscleGoals: makeTestMuscleGoals(),
    });
    state.equipment_overrides['bench_barbell'] = {
      inc_kg: 1,
      min_load_kg: 20,
      max_load_kg: 200,
      pdc_only: null,
    };
    await txInitUser(state, 'starting_strength');

    expect(await loadUserState()).not.toBeNull();
    const cycles = await listAllCycles();
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.cycle_index).toBe(1);
    expect(cycles[0]?.programme_id).toBe('starting_strength');
    const ov = await loadOverridesAsRecord();
    expect(ov['bench_barbell']?.inc_kg).toBe(1);
  });

  it('txSaveSessionPlan insert session + sauve userState dans la même tx', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);

    const plan: SessionPlan = {
      seance_date: '2026-05-10',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 7,
      label: 'A',
      items: [],
    };
    state.last_used_for_muscle['pectoraux'] = 'bench_barbell';
    const id = await txSaveSessionPlan(plan, state);
    expect(id).toBeGreaterThan(0);

    const sessions = await listSessionsByCycle(1);
    expect(sessions[0]?.status).toBe('planned');

    const reloaded = await loadUserState();
    expect(reloaded?.last_used_for_muscle['pectoraux']).toBe('bench_barbell');
  });

  it('txCommitSessionFeedback insère feedback + snapshots + marque session completed', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);

    const plan: SessionPlan = {
      seance_date: '2026-05-10',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 7,
      label: 'A',
      items: [],
    };
    const sessionId = await txSaveSessionPlan(plan, state);

    state.e1rm['bench_barbell'] = 100;
    state.e1rm['squat_barbell'] = 140;
    const feedback: SessionFeedback = {
      seance_date: '2026-05-10',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 7,
      label: 'A',
      sets: [
        { exercise_id: 'bench_barbell', reps_done: 8, load_kg: 80, rpe_perceived: 8 },
      ],
    };
    await txCommitSessionFeedback({ feedback, state, sessionId });

    const fbs = await listAllFeedbacks();
    expect(fbs).toHaveLength(1);
    const sessions = await listSessionsByCycle(1);
    expect(sessions[0]?.status).toBe('completed');
    const snaps = await listAllSnapshots();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.exercise_id).toBe('bench_barbell');
    expect(snaps[0]?.e1rm).toBe(100);
  });

  it('txCommitSessionFeedback ré-ancre start_date sur la date du feedback si anchorStartDate', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);
    // start_date placeholder (onboarding) distinct de la 1re séance.
    await getDb().cycles.update(1, { start_date: '2026-05-01' });

    const feedback: SessionFeedback = {
      seance_date: '2026-05-06',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 7,
      label: 'A',
      sets: [],
    };
    await txCommitSessionFeedback({ feedback, state, sessionId: null, anchorStartDate: true });

    const cycles = await listAllCycles();
    expect(cycles[0]?.start_date).toBe('2026-05-06');
  });

  it('txCommitSessionFeedback ne touche pas start_date sans anchorStartDate', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);
    await getDb().cycles.update(1, { start_date: '2026-05-01' });

    const feedback: SessionFeedback = {
      seance_date: '2026-05-06',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 7,
      label: 'A',
      sets: [],
    };
    await txCommitSessionFeedback({ feedback, state, sessionId: null });

    const cycles = await listAllCycles();
    expect(cycles[0]?.start_date).toBe('2026-05-01');
  });

  it('txEndOfWeek met à jour uniquement userState', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);
    state.current_week_in_cycle = 2;
    await txEndOfWeek(state);
    expect((await loadUserState())?.current_week_in_cycle).toBe(2);
  });

  it('txEndOfCycle ferme le cycle courant et ouvre le suivant si avancé', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, 'starting_strength');

    // Simule l'avancement post-endOfCycle (cycle_index passe à 2)
    state.cycle_index = 2;
    state.current_week_in_cycle = 1;
    const review = {
      cycle_index: 1,
      plafonds_progression: {},
      muscles_progresses: [],
      muscles_plateau: [],
      muscles_undertrained: [],
      muscles_overshoot: [],
      adherence_pct: 100,
      volume_total_kg: 0,
      PRs: [] as Array<[string, number]>,
      suggested_action: 'continuer' as const as import('@/engine/models').SuggestedAction,
      warnings: [],
    };
    await txEndOfCycle({
      state,
      review,
      closedCycleIndex: 1,
      nextProgrammeId: 'greyskull',
    });

    const cycles = await listAllCycles();
    expect(cycles).toHaveLength(2);
    expect(cycles[0]?.end_date).not.toBeNull();
    expect(cycles[0]?.review).not.toBeNull();
    expect(cycles[1]?.cycle_index).toBe(2);
    expect(cycles[1]?.programme_id).toBe('greyskull');
    expect((await loadUserState())?.cycle_index).toBe(2);
  });

  it('rollback : si une étape échoue dans la transaction, rien n\'est commit', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    await txInitUser(state, null);

    const db = getDb();
    let threw = false;
    try {
      await db.transaction('rw', [db.userState, db.feedbacks], async () => {
        await db.feedbacks.add({
          session_id: null,
          seance_date: '2026-05-10',
          cycle_index: 1,
          week_in_cycle: 1,
          feedback: {
            seance_date: '2026-05-10',
            week_in_cycle: 1,
            cycle_index: 1,
            rpe_target: 7,
            label: '',
            sets: [],
          },
          created_at: new Date().toISOString(),
        });
        throw new Error('rollback test');
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(await listAllFeedbacks()).toHaveLength(0);
  });
});
