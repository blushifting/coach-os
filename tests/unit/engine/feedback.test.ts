/**
 * Couvre : coefficient α de l'EMA, mise à jour e1RM (modèle unifié Bloc R :
 * définitif vs provisoire, Epley étendu), adoption décisive de charge (Bloc L).
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import { computeAlpha, updateE1rmForExercise } from '@/engine/feedback';
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
    [10, 8], // n_eq=12 → bracket >10 → 0.10
  ])('reps=%i rpe=%f → alpha dans [0.05, 0.35]', (reps, rpe) => {
    const a = computeAlpha(reps, rpe);
    expect(a).toBeGreaterThanOrEqual(0.05);
    expect(a).toBeLessThanOrEqual(0.35);
  });

  it('Bloc R — n_eq > 15 → alpha plancher 0,1 (la mesure compte encore, en douceur)', () => {
    expect(computeAlpha(15, 7)).toBe(0.1); // n_eq=18
    expect(computeAlpha(20, 10)).toBe(0.1); // n_eq=20
  });

  it('série courte (3×10) > série longue (10×8)', () => {
    expect(computeAlpha(3, 10)).toBeGreaterThan(computeAlpha(10, 8));
  });
});

// =============================================================================
// updateE1rmForExercise — modèle de mesure unifié
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
    expect(res!.old).toBe(100);
    expect(res!.next).toBeGreaterThan(100);
    expect(res!.next).toBeLessThan(113.99);
    expect(res!.definitive).toBe(true);
  });

  it('Bloc R — un ex-`non` (calf) reçoit désormais un e1RM (mesure unifiée)', () => {
    const state = startUserStub(profileIntermediaireH());
    const ex = catalog.get('calf_standing_machine');
    const fbs: SetFeedback[] = [
      { exercise_id: 'calf_standing_machine', reps_done: 15, load_kg: 80, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res).not.toBeNull();
    expect(res!.definitive).toBe(true);
    expect(res!.next).toBeGreaterThan(0);
  });

  it('Bloc R — une série informative haute-rep (n_eq > 15) met à jour en douceur', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 50 kg × 20 RPE 7 → n_eq = 23 (avant : ignoré). e1rm_obs ≈ 88, EMA α=0,1.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 20, load_kg: 50, rpe_perceived: 7 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res).not.toBeNull();
    expect(res!.definitive).toBe(true);
    expect(res!.next).toBeLessThan(100); // tire légèrement vers le bas
    expect(res!.next).toBeGreaterThan(95); // sans s'effondrer
  });

  // Conv #16 — skipEma : la 1re séance d'un exo remplace le bootstrap
  // heuristique par l'agrégation directe (pas de mélange via EMA).
  it('skipEma=true : remplace le plafond par e1rmAgg sans filtre EMA', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 75; // bootstrap sous-estimé
    const ex = catalog.get('bench_bb');
    // 100 kg × 5 RPE 8 → e1rm_obs ≈ 123.3 kg.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 100, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs, undefined, { skipEma: true });
    expect(res).not.toBeNull();
    expect(res!.old).toBe(75);
    expect(res!.next).toBeGreaterThan(120);
    expect(res!.next).toBeLessThan(126);
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
    expect(res!.next).toBeGreaterThan(80);
    expect(res!.next).toBeLessThan(110);
  });

  it('Bloc R — séance tout-4+ (RPE 6) : MAJ PROVISOIRE (ratchet haut, non définitive)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 90 kg × 5 à RPE 6 → e1rm_obs ≈ 117 > 100.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 90, rpe_perceived: 6 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res!.old).toBe(100);
    expect(res!.next).toBeGreaterThan(110); // max(old, agg), pas d'EMA
    expect(res!.definitive).toBe(false); // pas de snapshot → reste en calibration
  });

  it('Bloc R — une séance tout-4+ ne baisse jamais le plafond (ratchet)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 130;
    const ex = catalog.get('bench_bb');
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 90, rpe_perceived: 6 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res!.next).toBe(130);
    expect(res!.definitive).toBe(false);
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
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 8, load_kg: 90, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs, undefined, {
      prescribed: { load_kg: 80, target_reps: 10 },
    });
    expect(res!.old).toBe(100);
    expect(res!.next).toBeGreaterThan(115); // décisif, pas l'EMA amorti
  });

  it('plus lourd mais reps trop basses (>2 sous la cible) → EMA amorti', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 90 kg mais seulement 6 reps vs cible 10 (4 sous la cible) → pas décisif.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 6, load_kg: 90, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs, undefined, {
      prescribed: { load_kg: 80, target_reps: 10 },
    });
    expect(res!.next).toBeLessThan(108); // EMA, loin de l'e1RM observé
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
    })!.next;
    const s2 = startUserStub(profileIntermediaireH());
    s2.e1rm['bench_bb'] = 130;
    const without = updateE1rmForExercise(s2, ex, fbs)!.next;
    expect(withPresc).toBe(without);
    expect(withPresc).toBeLessThan(130); // EMA a amorti, pas de max(old, …)
  });
});
