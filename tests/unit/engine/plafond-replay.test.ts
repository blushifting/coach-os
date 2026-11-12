/**
 * Dump 2.4, étape 5 — recalcul de l'historique des Plafonds depuis les séries.
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import { recordFeedback } from '@/engine/engine';
import type { SessionFeedback, SetFeedback } from '@/engine/models';
import {
  replayPlafonds,
  type ReplayCycle,
  type ReplayFeedbackRow,
  type ReplaySnapshot,
} from '@/engine/plafond-replay';

import { profileIntermediaireH, startUserStub } from './_helpers';

const catalog = new Catalog();

function row(
  date: string,
  sets: SetFeedback[],
  cycle_index = 1,
  week_in_cycle = 1,
): ReplayFeedbackRow {
  const feedback: SessionFeedback = {
    seance_date: date,
    week_in_cycle,
    cycle_index,
    rpe_target: 8,
    label: 'A',
    sets,
  };
  return { seance_date: date, cycle_index, week_in_cycle, feedback };
}

const bench = (load: number, reps: number, rpe = 9): SetFeedback => ({
  exercise_id: 'bench_bb',
  load_kg: load,
  reps_done: reps,
  rpe_perceived: rpe,
});

const OPEN_CYCLE: ReplayCycle = { cycle_index: 1, review: null };

describe('replayPlafonds', () => {
  it('rejoue les séances comme leur enregistrement (même Plafond, mêmes instantanés)', () => {
    const rows = [
      row('2026-05-01', [bench(80, 10)]),
      row('2026-05-04', [bench(82.5, 9)]),
      row('2026-05-08', [bench(85, 8, 9.5)]),
    ];
    // Référence : l'enregistrement séance par séance.
    const live = startUserStub(profileIntermediaireH());
    const calibrated = new Set<string>();
    const expected: number[] = [];
    for (const r of rows) {
      const res = recordFeedback(live, catalog, r.feedback, { calibratedExoIds: calibrated });
      if (res['bench_bb']?.definitive) {
        calibrated.add('bench_bb');
        expected.push(live.e1rm['bench_bb']!);
      }
    }

    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 999; // ancien calcul : remplacé
    const out = replayPlafonds({ state, catalog, feedbacks: rows, snapshots: [], cycles: [OPEN_CYCLE] });
    expect(out.snapshots.map((s) => s.e1rm)).toEqual(expected);
    expect(out.e1rm['bench_bb']).toBe(live.e1rm['bench_bb']);
  });

  it('garde un Plafond saisi à la main comme point d’ancrage à sa date', () => {
    const manual: ReplaySnapshot = {
      date: '2026-04-20',
      exercise_id: 'bench_bb',
      e1rm: 110,
      cycle_index: 1,
      week_in_cycle: 1,
    };
    const state = startUserStub(profileIntermediaireH());
    const out = replayPlafonds({
      state,
      catalog,
      feedbacks: [row('2026-05-01', [bench(80, 10)])],
      snapshots: [manual],
      cycles: [OPEN_CYCLE],
    });
    expect(out.snapshots[0]).toEqual(manual);
    // La séance suivante est lissée depuis l'ancre, pas adoptée telle quelle.
    expect(out.snapshots[1]!.e1rm).toBeLessThan(110);
    expect(out.snapshots[1]!.e1rm).toBeGreaterThan(105);
  });

  it('laisse intact un exercice absent du catalogue (exercice personnel supprimé)', () => {
    const gone: ReplaySnapshot = {
      date: '2026-05-01',
      exercise_id: 'exo_disparu',
      e1rm: 42,
      cycle_index: 1,
      week_in_cycle: 1,
    };
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['exo_disparu'] = 42;
    const out = replayPlafonds({
      state,
      catalog,
      feedbacks: [
        row('2026-05-01', [{ exercise_id: 'exo_disparu', load_kg: 30, reps_done: 10, rpe_perceived: 9 }]),
      ],
      snapshots: [gone],
      cycles: [OPEN_CYCLE],
    });
    expect(out.snapshots).toEqual([gone]);
    expect(out.e1rm['exo_disparu']).toBe(42);
  });

  it('semaine de récupération d’un cycle clos : le Plafond ne peut que monter', () => {
    const state = startUserStub(profileIntermediaireH());
    const cycles: ReplayCycle[] = [
      { cycle_index: 1, review: { recovery_taken: true, plafonds_progression: {} } },
      { cycle_index: 2, review: null },
    ];
    const out = replayPlafonds({
      state,
      catalog,
      feedbacks: [row('2026-05-01', [bench(80, 10)]), row('2026-05-29', [bench(60, 8, 7)], 1, 5)],
      snapshots: [],
      cycles,
    });
    // Séance allégée : aucun instantané, Plafond inchangé.
    expect(out.snapshots).toHaveLength(1);
    expect(out.e1rm['bench_bb']).toBe(out.snapshots[0]!.e1rm);
  });

  it('recalcule l’écart de Plafond des bilans de cycle archivés', () => {
    const state = startUserStub(profileIntermediaireH());
    const cycles: ReplayCycle[] = [
      { cycle_index: 1, review: { recovery_taken: false, plafonds_progression: { bench_bb: 50 } } },
      { cycle_index: 2, review: null },
    ];
    const out = replayPlafonds({
      state,
      catalog,
      feedbacks: [row('2026-05-01', [bench(80, 10)]), row('2026-05-08', [bench(85, 10)])],
      snapshots: [],
      cycles,
    });
    const first = 80 * (1 + 0.0333 * 11);
    expect(out.plafondsProgression[1]!['bench_bb']).toBeCloseTo(out.e1rm['bench_bb']! - first, 6);
  });
});
