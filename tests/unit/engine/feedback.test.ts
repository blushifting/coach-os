/**
 * Couvre : coefficient α de l'EMA, mise à jour e1RM, adoption décisive de
 * charge (Bloc L), double progression.
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import { computeAlpha, maybeProgressReps, updateE1rmForExercise } from '@/engine/feedback';
import type { SetFeedback } from '@/engine/models';

import { profileIntermediaireH, startUserStub } from './_helpers';

const catalog = new Catalog();

// =============================================================================
// Coefficient alpha de l'EMA
// =============================================================================

describe('computeAlpha', () => {
  it.each([
    [3, 10], // n_eq=3, plus fiable
    [5, 10], // n_eq=5, fiable
    [8, 9], // n_eq=9, modéré
    [10, 8], // n_eq=12 → bracket 11..15 → 0.10
  ])('reps=%i rpe=%f → alpha dans [0.05, 0.35]', (reps, rpe) => {
    const a = computeAlpha(reps, rpe);
    expect(a).toBeGreaterThanOrEqual(0.05);
    expect(a).toBeLessThanOrEqual(0.35);
  });

  it('n_eq > 15 → alpha = 0 (mesure ignorée)', () => {
    expect(computeAlpha(15, 7)).toBe(0); // n_eq=18
    expect(computeAlpha(20, 10)).toBe(0); // n_eq=20
  });

  it('série courte (3×10) > série longue (10×8)', () => {
    expect(computeAlpha(3, 10)).toBeGreaterThan(computeAlpha(10, 8));
  });
});

// =============================================================================
// updateE1rmForExercise
// =============================================================================

describe('updateE1rmForExercise', () => {
  it('augmente quand la performance est meilleure (sans saut brutal grâce à l’EMA)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 95kg × 5 RPE 9 → e1rm_obs ≈ 113.99
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 95, rpe_perceived: 9 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res).not.toBeNull();
    const [old, next] = res!;
    expect(old).toBe(100);
    expect(next).toBeGreaterThan(100);
    expect(next).toBeLessThan(113.99);
  });

  it("retourne null pour les exos avec e1RM_app === 'non' (calf machine)", () => {
    const state = startUserStub(profileIntermediaireH());
    const ex = catalog.get('calf_standing_machine');
    const fbs: SetFeedback[] = [
      { exercise_id: 'calf_standing_machine', reps_done: 15, load_kg: 80, rpe_perceived: 8 },
    ];
    expect(updateE1rmForExercise(state, ex, fbs)).toBeNull();
  });

  it('ignore les séries trop longues (n_eq > 15)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 20 reps RPE 7 → n_eq = 23, ignoré
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 20, load_kg: 50, rpe_perceived: 7 },
    ];
    expect(updateE1rmForExercise(state, ex, fbs)).toBeNull();
  });

  // Conv #16 — skipEma : la 1re séance d'un exo remplace le bootstrap
  // heuristique par l'agrégation directe (pas de mélange via EMA).
  it('skipEma=true : remplace le plafond par e1rmAgg sans filtre EMA', () => {
    const state = startUserStub(profileIntermediaireH());
    // Bootstrap heuristique posé à 75 (sous-estimé).
    state.e1rm['bench_bb'] = 75;
    const ex = catalog.get('bench_bb');
    // Une série révélatrice : 100 kg × 5 RPE 8 → e1rm_obs ≈ 123.3 kg.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 100, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs, undefined, { skipEma: true });
    expect(res).not.toBeNull();
    const [old, next] = res!;
    expect(old).toBe(75);
    // Sans EMA → next ≈ e1rm_obs (pas un mélange 0.3×123 + 0.7×75 = 89.4).
    expect(next).toBeGreaterThan(120);
    expect(next).toBeLessThan(126);
  });

  it('skipEma=false (défaut) : mélange via EMA (comportement séance ≥ 2)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 75;
    const ex = catalog.get('bench_bb');
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 100, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res).not.toBeNull();
    const [, next] = res!;
    // Mélange EMA visible : next entre old (75) et e1rmAgg (~123).
    expect(next).toBeGreaterThan(80);
    expect(next).toBeLessThan(110);
  });

  it('1.17 — séance trop facile (tout RPE 6 / réserve 4+) : plafond monte sans damping', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 90 kg × 5 à RPE 6 → e1rm_obs ≈ 90 × (1 + 0,0333×9) ≈ 117 > 100.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 90, rpe_perceived: 6 },
    ];
    const [old, next] = updateE1rmForExercise(state, ex, fbs)!;
    expect(old).toBe(100);
    // Sans damping EMA (qui aurait donné ~101,7) : on saute vers l'e1RM observé.
    expect(next).toBeGreaterThan(110);
  });

  it('1.17 — une séance facile ne baisse jamais le plafond', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 130;
    const ex = catalog.get('bench_bb');
    // e1rm observé (~117) < plafond actuel (130) → on garde 130, pas de baisse.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 90, rpe_perceived: 6 },
    ];
    const [, next] = updateE1rmForExercise(state, ex, fbs)!;
    expect(next).toBe(130);
  });
});

// =============================================================================
// Bloc L — charge volontairement > préconisée (anti-rétrogradation)
// =============================================================================

describe('updateE1rmForExercise — charge > préconisée (Bloc L)', () => {
  it('plus lourd que préco + reps dans la tolérance (≤2 sous cible) → adoption décisive', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // Préco 80 kg × 10 ; l'user met 90 kg × 8 RPE 8 (2 reps sous la cible).
    // e1rm_obs ≈ 90 × (1 + 0,0333×10) ≈ 120 ; EMA amorti aurait donné ~104.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 8, load_kg: 90, rpe_perceived: 8 },
    ];
    const [old, next] = updateE1rmForExercise(state, ex, fbs, undefined, {
      prescribed: { load_kg: 80, target_reps: 10 },
    })!;
    expect(old).toBe(100);
    expect(next).toBeGreaterThan(115); // décisif, pas l'EMA amorti
  });

  it('plus lourd mais reps trop basses (>2 sous la cible) → EMA amorti', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 90 kg mais seulement 6 reps vs cible 10 (4 sous la cible) → pas décisif.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 6, load_kg: 90, rpe_perceived: 8 },
    ];
    const [, next] = updateE1rmForExercise(state, ex, fbs, undefined, {
      prescribed: { load_kg: 80, target_reps: 10 },
    })!;
    expect(next).toBeLessThan(108); // EMA, loin de l'e1RM observé (~114)
  });

  it('charge ≤ préconisée → EMA standard, identique à l’absence de prescribed', () => {
    const ex = catalog.get('bench_bb');
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 8, load_kg: 80, rpe_perceived: 8 },
    ];
    // Préco 100 kg : l'user met 80 (plus léger) → override ne se déclenche pas.
    const s1 = startUserStub(profileIntermediaireH());
    s1.e1rm['bench_bb'] = 130;
    const withPresc = updateE1rmForExercise(s1, ex, fbs, undefined, {
      prescribed: { load_kg: 100, target_reps: 10 },
    })![1];
    const s2 = startUserStub(profileIntermediaireH());
    s2.e1rm['bench_bb'] = 130;
    const without = updateE1rmForExercise(s2, ex, fbs)![1];
    expect(withPresc).toBe(without);
    expect(withPresc).toBeLessThan(130); // EMA a amorti, pas de max(old, …)
  });
});

// =============================================================================
// Double progression
// =============================================================================

describe('maybeProgressReps', () => {
  it('toutes les séries au plafond → PR enregistré', () => {
    const state = startUserStub(profileIntermediaireH());
    const ex = catalog.get('calf_standing_machine');
    const fbs: SetFeedback[] = Array.from({ length: 3 }, () => ({
      exercise_id: 'calf_standing_machine',
      reps_done: 20,
      load_kg: 80,
      rpe_perceived: 8,
    }));
    expect(maybeProgressReps(state, ex, fbs)).toBe(true);
    expect(state.reps_pr['calf_standing_machine']).toBe(20);
  });

  it('une série en-dessous du plafond → pas de PR', () => {
    const state = startUserStub(profileIntermediaireH());
    const ex = catalog.get('calf_standing_machine');
    const fbs: SetFeedback[] = [
      { exercise_id: 'calf_standing_machine', reps_done: 20, load_kg: 80, rpe_perceived: 8 },
      { exercise_id: 'calf_standing_machine', reps_done: 18, load_kg: 80, rpe_perceived: 8 },
    ];
    expect(maybeProgressReps(state, ex, fbs)).toBe(false);
  });
});
