import { describe, it, expect } from 'vitest';
import {
  loadUserState,
  saveUserState,
  clearUserState,
} from '@/db/repositories/userState.repo';
import {
  insertSession,
  listSessionsByCycle,
  setSessionStatus,
} from '@/db/repositories/sessions.repo';
import {
  insertFeedback,
  listFeedbacksByCycle,
  getFeedbackForSession,
} from '@/db/repositories/feedbacks.repo';
import {
  insertE1rmSnapshots,
  listSnapshotsForExercise,
} from '@/db/repositories/e1rmSnapshots.repo';
import { upsertCycle, listAllCycles, setCycleEnd } from '@/db/repositories/cycles.repo';
import {
  upsertOverride,
  loadOverridesAsRecord,
} from '@/db/repositories/equipmentOverrides.repo';
import {
  addUserExercise,
  listUserExercises,
} from '@/db/repositories/userAddedExercises.repo';
import { startUser } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';
import { makeTestProfile } from '@/test-utils/fixtures';
import type { SessionPlan, SessionFeedback, ExerciseDict } from '@/engine/models';

function fakeSessionPlan(date: string, cycle = 1, week = 1): SessionPlan {
  return {
    seance_date: date,
    week_in_cycle: week,
    cycle_index: cycle,
    rpe_target: 7.5,
    label: 'Push',
    items: [],
  };
}

function fakeFeedback(date: string, cycle = 1, week = 1): SessionFeedback {
  return {
    seance_date: date,
    week_in_cycle: week,
    cycle_index: cycle,
    rpe_target: 7.5,
    label: 'Push',
    sets: [
      { exercise_id: 'bench_barbell', reps_done: 8, load_kg: 80, rpe_perceived: 8 },
    ],
  };
}

describe('userState.repo', () => {
  it('save puis load restaure le state', async () => {
    const state = startUser(makeTestProfile(), new Catalog());
    state.e1rm['bench_barbell'] = 100;
    await saveUserState(state);

    const loaded = await loadUserState();
    expect(loaded).not.toBeNull();
    expect(loaded?.e1rm['bench_barbell']).toBe(100);
    expect(loaded?.profile.available_equip.has('bb_oly')).toBe(true);
  });

  it('load retourne null si vide', async () => {
    expect(await loadUserState()).toBeNull();
  });

  it('clear supprime le state', async () => {
    await saveUserState(startUser(makeTestProfile(), new Catalog()));
    await clearUserState();
    expect(await loadUserState()).toBeNull();
  });
});

describe('sessions.repo', () => {
  it('insertSession + listSessionsByCycle trie par seance_date', async () => {
    await insertSession(fakeSessionPlan('2026-05-12', 1, 1));
    await insertSession(fakeSessionPlan('2026-05-10', 1, 1));
    await insertSession(fakeSessionPlan('2026-06-01', 2, 1));

    const cycle1 = await listSessionsByCycle(1);
    expect(cycle1).toHaveLength(2);
    expect(cycle1[0]?.seance_date).toBe('2026-05-10');
    expect(cycle1[1]?.seance_date).toBe('2026-05-12');
  });

  it('setSessionStatus update le statut', async () => {
    const id = await insertSession(fakeSessionPlan('2026-05-12'));
    await setSessionStatus(id, 'completed');
    const list = await listSessionsByCycle(1);
    expect(list[0]?.status).toBe('completed');
  });
});

describe('feedbacks.repo', () => {
  it('insertFeedback + listFeedbacksByCycle', async () => {
    await insertFeedback(fakeFeedback('2026-05-10', 1, 1));
    await insertFeedback(fakeFeedback('2026-05-12', 1, 2));
    await insertFeedback(fakeFeedback('2026-06-01', 2, 1));

    const c1 = await listFeedbacksByCycle(1);
    expect(c1).toHaveLength(2);
  });

  it('getFeedbackForSession retrouve via session_id', async () => {
    const id = await insertFeedback(fakeFeedback('2026-05-10'), 42);
    const found = await getFeedbackForSession(42);
    expect(found?.id).toBe(id);
  });
});

describe('e1rmSnapshots.repo', () => {
  it('insertE1rmSnapshots + listSnapshotsForExercise trie par date', async () => {
    await insertE1rmSnapshots([
      {
        date: '2026-05-12',
        exercise_id: 'bench_barbell',
        e1rm: 110,
        cycle_index: 1,
        week_in_cycle: 2,
      },
      {
        date: '2026-05-10',
        exercise_id: 'bench_barbell',
        e1rm: 100,
        cycle_index: 1,
        week_in_cycle: 1,
      },
      {
        date: '2026-05-10',
        exercise_id: 'squat_barbell',
        e1rm: 140,
        cycle_index: 1,
        week_in_cycle: 1,
      },
    ]);

    const bench = await listSnapshotsForExercise('bench_barbell');
    expect(bench).toHaveLength(2);
    expect(bench[0]?.e1rm).toBe(100);
    expect(bench[1]?.e1rm).toBe(110);
  });

  it('insertE1rmSnapshots noop si tableau vide', async () => {
    await insertE1rmSnapshots([]);
    expect(await listSnapshotsForExercise('any')).toHaveLength(0);
  });
});

describe('cycles.repo', () => {
  it('upsertCycle + listAllCycles + setCycleEnd', async () => {
    await upsertCycle({
      cycle_index: 1,
      start_date: '2026-05-01',
      end_date: null,
      programme_id: 'starting_strength',
      review: null,
    });
    await setCycleEnd(1, '2026-06-05');
    const all = await listAllCycles();
    expect(all).toHaveLength(1);
    expect(all[0]?.end_date).toBe('2026-06-05');
  });
});

describe('equipmentOverrides.repo', () => {
  it('upsertOverride + loadOverridesAsRecord', async () => {
    await upsertOverride('bench_barbell', {
      inc_kg: 1,
      min_load_kg: 20,
      max_load_kg: 200,
      pdc_only: null,
    });
    const rec = await loadOverridesAsRecord();
    expect(rec['bench_barbell']?.inc_kg).toBe(1);
  });
});

describe('userAddedExercises.repo', () => {
  it('addUserExercise + listUserExercises', async () => {
    const dict: ExerciseDict = {
      id: 'home_pushup_diamant',
      nom_fr: 'Pompes diamant',
      pattern: 'push_h',
      type: 'compound',
      charge: 'bodyweight',
      muscles: { triceps: 1.0, pectoraux: 0.5 },
      subst: 'pompes',
      inc_kg: 0,
      reps_hyp: [8, 12],
      repos_s: 90,
      dif: 'moyen',
    };
    await addUserExercise(dict);
    const list = await listUserExercises();
    expect(list).toHaveLength(1);
    expect(list[0]?.exercise_id).toBe('home_pushup_diamant');
  });
});
