/**
 * Couvre : lissage du Plafond, mise à jour e1RM (modèle unifié Bloc R :
 * définitif vs provisoire, Epley étendu), pente par type d'exercice (dump 2.4, étape 5).
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import { PLAFOND_SMOOTHING, updateE1rmForExercise } from '@/engine/feedback';
import type { SetFeedback } from '@/engine/models';
import { e1rmObserved, EPLEY_K, ISOLATION_K, slopeFor } from '@/engine/prescription';

import { profileIntermediaireH, startUserStub } from './_helpers';

const catalog = new Catalog();

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
    // 50 kg × 20 RPE 7 → n_eq = 23 (avant : ignoré). e1rm_obs ≈ 88, lissé à PLAFOND_SMOOTHING.
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
    const res = updateE1rmForExercise(state, ex, fbs, { skipEma: true });
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
// Dump 2.4, étape 5 — plus d'adoption sans lissage, pente par type
// =============================================================================

describe('updateE1rmForExercise — lissage et pente (étape 5)', () => {
  it('une charge plus lourde que d’habitude reste lissée (ancien Bloc L retiré)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 90 kg × 8 RPE 8 → observé ≈ 120 ; l'EMA n'en prend qu'une fraction.
    const fbs: SetFeedback[] = [
      { exercise_id: 'bench_bb', reps_done: 8, load_kg: 90, rpe_perceived: 8 },
    ];
    const res = updateE1rmForExercise(state, ex, fbs);
    expect(res!.next).toBeGreaterThan(100);
    expect(res!.next).toBeLessThan(106);
  });

  it('isolation : la pente propre réduit l’écart entre deux charges de la même semaine', () => {
    // Cas mesuré chez Azur (élévation latérale poulie) : 9 kg × 12 et 11 kg × 9,
    // Réserve 0,5, sur les mêmes semaines.
    const ex = catalog.get('cable_lateral_raise');
    expect(slopeFor(ex)).toBe(ISOLATION_K);
    expect(slopeFor(catalog.get('bench_bb'))).toBe(EPLEY_K);
    const ecart = (k: number) => e1rmObserved(11, 9, 9.5, k) / e1rmObserved(9, 12, 9.5, k) - 1;
    expect(ecart(EPLEY_K)).toBeGreaterThan(0.13);
    expect(ecart(slopeFor(ex))).toBeLessThan(0.1);
  });
});

describe('updateE1rmForExercise — fraction de lissage', () => {
  it('le Plafond parcourt PLAFOND_SMOOTHING de l’écart avec la mesure', () => {
    const state = startUserStub(profileIntermediaireH());
    state.e1rm['bench_bb'] = 100;
    const ex = catalog.get('bench_bb');
    // 100 kg × 5 RPE 10 → mesure = 100 × (1 + 0,0333 × 5) = 116,65.
    const res = updateE1rmForExercise(state, ex, [
      { exercise_id: 'bench_bb', reps_done: 5, load_kg: 100, rpe_perceived: 10 },
    ]);
    expect(res!.next).toBeCloseTo(100 + PLAFOND_SMOOTHING * 16.65, 5);
  });
});
