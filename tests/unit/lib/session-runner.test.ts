/**
 * Tests purs sur `src/lib/session-runner.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSessionFeedback,
  computeSessionSummary,
  computeSessionVolume,
  countDoneSets,
  countPlannedSets,
  initEntries,
  listDayCandidates,
  updateSetEntry,
} from '@/lib/session-runner';
import type { SessionFeedback, SessionPlan } from '@/engine/models';
import type { FeedbackRow } from '@/db/schema';
import type { RecordFeedbackResult } from '@/engine/engine';

// =============================================================================
// Fixtures
// =============================================================================

function makePlan(): SessionPlan {
  return {
    seance_date: '2026-05-13',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 8,
    label: 'Push',
    items: [
      {
        exercise_id: 'bench_press',
        sets: [
          { exercise_id: 'bench_press', reps: 5, load_kg: 80, rpe_target: 8, rest_s: 180 },
          { exercise_id: 'bench_press', reps: 5, load_kg: 80, rpe_target: 8, rest_s: 180 },
        ],
      },
      {
        exercise_id: 'shoulder_press',
        sets: [
          { exercise_id: 'shoulder_press', reps: 8, load_kg: 40, rpe_target: 8, rest_s: 120 },
        ],
      },
    ],
  };
}

function makeFeedbackRow(
  label: string,
  cycleIndex: number,
  weekInCycle: number,
  sets: Array<{ exercise_id: string; reps_done: number; load_kg: number }>,
): FeedbackRow {
  return {
    seance_date: '2026-05-01',
    cycle_index: cycleIndex,
    week_in_cycle: weekInCycle,
    session_id: null,
    feedback: {
      seance_date: '2026-05-01',
      week_in_cycle: weekInCycle,
      cycle_index: cycleIndex,
      rpe_target: 8,
      label,
      sets: sets.map((s) => ({ ...s, rpe_perceived: 8 })),
    },
    created_at: '2026-05-01',
  };
}

// =============================================================================
// État local
// =============================================================================

describe('initEntries', () => {
  it('reflète les consignes du plan', () => {
    const entries = initEntries(makePlan());
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveLength(2);
    expect(entries[1]).toHaveLength(1);
    expect(entries[0]![0]).toEqual({ reps: 5, load_kg: 80, rpe: 8, done: false });
  });
});

describe('updateSetEntry', () => {
  it('mute uniquement la case ciblée, retourne une nouvelle matrice', () => {
    const e0 = initEntries(makePlan());
    const e1 = updateSetEntry(e0, 0, 1, { reps: 6, done: true });
    expect(e1[0]![1]).toEqual({ reps: 6, load_kg: 80, rpe: 8, done: true });
    expect(e1[0]![0]).toEqual(e0[0]![0]);
    expect(e1[1]).toEqual(e0[1]);
    expect(e1).not.toBe(e0);
  });
});

describe('countDoneSets / countPlannedSets', () => {
  it('compte correctement', () => {
    const e0 = initEntries(makePlan());
    expect(countPlannedSets(e0)).toBe(3);
    expect(countDoneSets(e0)).toBe(0);
    let e = updateSetEntry(e0, 0, 0, { done: true });
    e = updateSetEntry(e, 1, 0, { done: true });
    expect(countDoneSets(e)).toBe(2);
  });
});

// =============================================================================
// buildSessionFeedback
// =============================================================================

describe('buildSessionFeedback', () => {
  it('null si aucun set marqué done', () => {
    const e = initEntries(makePlan());
    expect(buildSessionFeedback(makePlan(), e)).toBeNull();
  });

  it('retient uniquement les sets done avec reps > 0', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true });
    e = updateSetEntry(e, 0, 1, { done: true, reps: 0 }); // skip (reps=0)
    e = updateSetEntry(e, 1, 0, { done: true, reps: 8, load_kg: 42, rpe: 9 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(2);
    expect(fb!.sets[0]).toMatchObject({ exercise_id: 'bench_press', reps_done: 5, load_kg: 80 });
    expect(fb!.sets[1]).toMatchObject({ exercise_id: 'shoulder_press', reps_done: 8, load_kg: 42, rpe_perceived: 9 });
  });

  it('reporte les métadonnées du plan', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true });
    const fb = buildSessionFeedback(makePlan(), e)!;
    expect(fb.seance_date).toBe('2026-05-13');
    expect(fb.cycle_index).toBe(1);
    expect(fb.week_in_cycle).toBe(1);
    expect(fb.label).toBe('Push');
    expect(fb.rpe_target).toBe(8);
  });
});

// =============================================================================
// computeSessionVolume / computeSessionSummary
// =============================================================================

describe('computeSessionVolume', () => {
  it('Σ reps × load', () => {
    const fb: SessionFeedback = {
      seance_date: '2026-05-13',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 8,
      label: 'Push',
      sets: [
        { exercise_id: 'a', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
        { exercise_id: 'a', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
        { exercise_id: 'b', reps_done: 8, load_kg: 40, rpe_perceived: 8 },
      ],
    };
    expect(computeSessionVolume(fb)).toBe(5 * 80 + 5 * 80 + 8 * 40); // 1120
  });
});

describe('computeSessionSummary', () => {
  const fb: SessionFeedback = {
    seance_date: '2026-05-13',
    week_in_cycle: 2,
    cycle_index: 1,
    rpe_target: 8,
    label: 'Push',
    sets: [{ exercise_id: 'bench_press', reps_done: 5, load_kg: 80, rpe_perceived: 8 }],
  };

  it('volume du jour, pas de comparaison si pas d\'historique', () => {
    const summary: RecordFeedbackResult = {};
    const r = computeSessionSummary(fb, summary, []);
    expect(r.volumeKgToday).toBe(400);
    expect(r.volumeKgLastSameLabel).toBeNull();
    expect(r.volumeDeltaPct).toBeNull();
  });

  it('compare au plus récent même label, calcule delta %', () => {
    const prev = makeFeedbackRow('Push', 1, 1, [
      { exercise_id: 'bench_press', reps_done: 5, load_kg: 70 },
    ]);
    const r = computeSessionSummary(fb, {}, [prev]);
    expect(r.volumeKgLastSameLabel).toBe(350);
    expect(r.volumeDeltaPct).toBeCloseTo(((400 - 350) / 350) * 100, 1);
  });

  it('ignore les feedbacks de label différent ou de semaine ≥', () => {
    const sameWeek = makeFeedbackRow('Push', 1, 2, [
      { exercise_id: 'b', reps_done: 1, load_kg: 1 },
    ]);
    const otherLabel = makeFeedbackRow('Pull', 1, 1, [
      { exercise_id: 'b', reps_done: 10, load_kg: 100 },
    ]);
    const r = computeSessionSummary(fb, {}, [sameWeek, otherLabel]);
    expect(r.volumeKgLastSameLabel).toBeNull();
  });

  it('PR : exos avec delta e1RM > 0.05 kg', () => {
    const summary: RecordFeedbackResult = {
      bench_press: [80, 81.5] as const,
      shoulder_press: [40, 40] as const, // pas de PR
      curl: [15, 14.5] as const, // régression
    };
    const r = computeSessionSummary(fb, summary, []);
    expect(r.prs).toHaveLength(1);
    expect(r.prs[0]!.exerciseId).toBe('bench_press');
    expect(r.prs[0]!.deltaKg).toBeCloseTo(1.5, 2);
  });
});

// =============================================================================
// listDayCandidates
// =============================================================================

describe('listDayCandidates', () => {
  it('compte par label sur la semaine en cours du cycle en cours', () => {
    const plan = { days: [{ label: 'Push' }, { label: 'Pull' }, { label: 'Legs' }] };
    const fbs = [
      makeFeedbackRow('Push', 1, 2, []),
      makeFeedbackRow('Pull', 1, 2, []),
      makeFeedbackRow('Push', 1, 1, []), // autre sem, exclu
      makeFeedbackRow('Push', 2, 2, []), // autre cycle, exclu
    ];
    const out = listDayCandidates(plan, fbs, 1, 2);
    expect(out).toEqual([
      { dayIndex: 0, label: 'Push', doneCountThisWeek: 1 },
      { dayIndex: 1, label: 'Pull', doneCountThisWeek: 1 },
      { dayIndex: 2, label: 'Legs', doneCountThisWeek: 0 },
    ]);
  });
});
