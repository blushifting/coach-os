/**
 * Miroir TS de prototype/tests/test_prescription.py + test_prescription_muscle_goals.py.
 * Couvre :
 *   - Epley pur, Epley étendu (RIR > 0).
 *   - Inversion (target_load round-trip).
 *   - Domaine de validité des mesures (n_équiv ≤ 15).
 *   - Arrondi (incrément, plancher, bascule 5kg ≥ 150 kg).
 *   - effective_increment (la prescription elle-même : progression.test.ts).
 */

import { describe, expect, it } from 'vitest';

import {
  EPLEY_K,
  e1rmObserved,
  effectiveIncrement,
  measurementIsReliable,
  nEquiv,
  roundToIncrement,
  targetLoad,
} from '@/engine/prescription';
import { Catalog } from '@/engine/catalog';
import { makeEquipmentOverride, makeUserState } from '@/engine/models';

import { profile } from './_helpers';

void EPLEY_K;
const catalog = new Catalog();

// =============================================================================
// 1. Epley pur (RPE 10 = échec)
// =============================================================================

describe('Epley pur (RPE 10)', () => {
  it("100kg × 5 reps à l'échec → e1RM ≈ 116.65 kg", () => {
    expect(e1rmObserved(100, 5, 10)).toBeCloseTo(116.65, 2);
  });
  it("100kg × 1 rep à l'échec → e1RM ≈ 103.33 kg", () => {
    expect(e1rmObserved(100, 1, 10)).toBeCloseTo(103.33, 2);
  });
  it("100kg × 10 reps à l'échec → e1RM ≈ 133.30 kg", () => {
    expect(e1rmObserved(100, 10, 10)).toBeCloseTo(133.3, 2);
  });
});

// =============================================================================
// 2. Epley étendu (RIR > 0)
// =============================================================================

describe('Epley étendu (RIR > 0)', () => {
  it('100 kg × 5 à RPE 8 (n_eq = 7) → e1RM ≈ 123.31 kg', () => {
    expect(e1rmObserved(100, 5, 8)).toBeCloseTo(123.31, 2);
  });
  it('100 kg × 3 à RPE 9 (n_eq = 4) → e1RM ≈ 113.32 kg', () => {
    expect(e1rmObserved(100, 3, 9)).toBeCloseTo(113.32, 2);
  });
  it('n_equiv', () => {
    expect(nEquiv(5, 8)).toBe(7);
    expect(nEquiv(8, 7)).toBe(11);
    expect(nEquiv(1, 10)).toBe(1);
  });
});

// =============================================================================
// 3. Inversion : charge cible
// =============================================================================

describe('targetLoad — inverse de e1rmObserved', () => {
  it('round-trip exact pour différents (reps, rpe)', () => {
    const e1rm = 120;
    for (const reps of [3, 5, 8, 10]) {
      for (const rpe of [7, 8, 9, 10]) {
        const load = targetLoad(e1rm, reps, rpe);
        expect(e1rmObserved(load, reps, rpe)).toBeCloseTo(e1rm, 2);
      }
    }
  });
  it('1 rep à RPE 10 ≈ 96.78 % du e1RM', () => {
    expect(targetLoad(100, 1, 10)).toBeCloseTo(96.78, 1);
  });
});

// =============================================================================
// 4. Domaine de validité des mesures
// =============================================================================

describe('measurementIsReliable', () => {
  it('fiable si n_eq ≤ 15', () => {
    expect(measurementIsReliable(10, 8)).toBe(true); // n_eq = 12
    expect(measurementIsReliable(5, 10)).toBe(true); // n_eq = 5
    expect(measurementIsReliable(12, 7)).toBe(true); // n_eq = 15
  });
  it('non fiable si n_eq > 15', () => {
    expect(measurementIsReliable(15, 7)).toBe(false); // n_eq = 18
  });
});

// =============================================================================
// 5. Arrondi
// =============================================================================

describe('roundToIncrement', () => {
  it.each([
    [82.7, 2.5, 82.5],
    [83.8, 2.5, 85.0],
    [60.4, 1.25, 60.0],
    [60.7, 1.25, 61.25],
    [12.0, 5.0, 10.0],
    [13.0, 5.0, 15.0],
  ])('round(%f, %f) = %f', (load, inc, expected) => {
    expect(roundToIncrement(load, inc)).toBeCloseTo(expected, 5);
  });

  it('au-dessus de 150 kg, on bascule sur 5 kg même si l’incrément est plus petit', () => {
    expect(roundToIncrement(152.3, 2.5)).toBe(150);
    expect(roundToIncrement(157.0, 2.5)).toBe(155);
  });

  it('plancher à 0', () => {
    expect(roundToIncrement(-5, 2.5)).toBe(0);
  });
});

// =============================================================================
// 6. RPE visé (dump 2.4 : une seule valeur, déload mis à part)
// =============================================================================

// =============================================================================
// 7. Plage RPE valide
// =============================================================================

describe('e1rmObserved — plage RPE', () => {
  it('rpe > 10 → throw', () => {
    expect(() => e1rmObserved(100, 5, 11)).toThrow();
  });
  it('rpe = 0 → throw', () => {
    expect(() => e1rmObserved(100, 5, 0)).toThrow();
  });
});

// =============================================================================
// 8. Reps visées — table unique (dump 2.4, D3)
// =============================================================================

// =============================================================================
// 11. effectiveIncrement — override équipement par exo
// =============================================================================

describe('effectiveIncrement', () => {
  it('pas d’override → catalogue', () => {
    const state = makeUserState(profile());
    const bench = catalog.get('bench_bb');
    expect(effectiveIncrement(state, bench)).toBe(bench.inc_kg);
  });

  it('override avec inc_kg → utilisé', () => {
    const state = makeUserState(profile());
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({ inc_kg: 5 });
    expect(effectiveIncrement(state, catalog.get('bench_bb'))).toBe(5);
  });

  it('override avec inc_kg=null → fallback catalogue', () => {
    const state = makeUserState(profile());
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({
      inc_kg: null,
      max_load_kg: 200,
    });
    const bench = catalog.get('bench_bb');
    expect(effectiveIncrement(state, bench)).toBe(bench.inc_kg);
  });
});

// =============================================================================
// 12. buildPrescription — rétrocompat + extension muscle_goals
// =============================================================================

// =============================================================================
// 13. Point 5 — muscle travaillé mais NON couvert → Maintien (pas l'objectif global)
// =============================================================================

// =============================================================================
// 14. Point 4 — garde-fou : plancher jamais prescrit au-dessus du Plafond mesuré
// =============================================================================

