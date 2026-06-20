/**
 * Tests des splits canoniques + catalogue + muscleBelongsToSlot.
 *
 * NB : selectSplit / placeDaysInWeek / check48hRule ont été supprimés
 * (Conv #39 — voie legacy + placement calendaire mort) ; leurs tests aussi.
 * La sélection de structure est désormais testée via skeleton_builder
 * (selectBestSplit) et split-selection-v3.test.ts.
 */

import { describe, expect, it } from 'vitest';

import {
  SlotKind,
  SPLIT_FB_2X,
  SPLIT_FB_3X,
  SPLIT_PPL_3X,
  SPLIT_UL_4X,
  SPLIT_UL_5X_SPEC,
  SPLIT_PPL_6X,
  ALL_SPLITS,
  muscleBelongsToSlot,
} from '@/engine/split';

// =============================================================================
// 1. Constantes : les 6 splits canoniques existent avec le bon nb de sessions
// =============================================================================

describe('constantes splits', () => {
  it('FB 2× a 2 sessions', () => {
    expect(SPLIT_FB_2X.sessions_per_week).toBe(2);
    expect(SPLIT_FB_2X.slots.length).toBe(2);
  });

  it('FB 3× a 3 sessions', () => {
    expect(SPLIT_FB_3X.sessions_per_week).toBe(3);
    expect(SPLIT_FB_3X.slots.length).toBe(3);
  });

  it('PPL 3× a 3 sessions', () => {
    expect(SPLIT_PPL_3X.sessions_per_week).toBe(3);
    expect(SPLIT_PPL_3X.slots.length).toBe(3);
  });

  it('U/L 4× a 4 sessions', () => {
    expect(SPLIT_UL_4X.sessions_per_week).toBe(4);
    expect(SPLIT_UL_4X.slots.length).toBe(4);
  });

  it('U/L 5× + spec a 5 sessions', () => {
    expect(SPLIT_UL_5X_SPEC.sessions_per_week).toBe(5);
    expect(SPLIT_UL_5X_SPEC.slots.length).toBe(5);
  });

  it('PPL 6× a 6 sessions', () => {
    expect(SPLIT_PPL_6X.sessions_per_week).toBe(6);
    expect(SPLIT_PPL_6X.slots.length).toBe(6);
  });

  it('ALL_SPLITS index complet (6 canoniques + 9 additionnelles Conv #39)', () => {
    expect(ALL_SPLITS).toContain(SPLIT_FB_2X);
    expect(ALL_SPLITS).toContain(SPLIT_PPL_6X);
    // 6 canoniques + Push/Pull 2/4/6× + ULF 3× + PPL+UL 5× + U/L 6× + FB 4/5/6×.
    expect(ALL_SPLITS.length).toBe(15);
  });

  it('FB 3× n\'a que des slots full body', () => {
    for (const slot of SPLIT_FB_3X.slots) expect(slot.kind).toBe(SlotKind.FULL);
  });

  it('U/L 4× alterne U L U L', () => {
    expect(SPLIT_UL_4X.slots.map((s) => s.kind)).toEqual([
      SlotKind.UPPER,
      SlotKind.LOWER,
      SlotKind.UPPER,
      SlotKind.LOWER,
    ]);
  });

  it('PPL 6× = 2 push + 2 pull + 2 legs', () => {
    const kinds = SPLIT_PPL_6X.slots.map((s) => s.kind);
    expect(kinds.filter((k) => k === SlotKind.PUSH).length).toBe(2);
    expect(kinds.filter((k) => k === SlotKind.PULL).length).toBe(2);
    expect(kinds.filter((k) => k === SlotKind.LEGS).length).toBe(2);
  });
});

// =============================================================================
// 2. muscleBelongsToSlot
// =============================================================================

describe('muscleBelongsToSlot', () => {
  it('pec dans UPPER, PUSH, FULL', () => {
    expect(muscleBelongsToSlot('pectoraux', SlotKind.UPPER)).toBe(true);
    expect(muscleBelongsToSlot('pectoraux', SlotKind.PUSH)).toBe(true);
    expect(muscleBelongsToSlot('pectoraux', SlotKind.FULL)).toBe(true);
  });

  it('pec pas dans LOWER, PULL, LEGS', () => {
    expect(muscleBelongsToSlot('pectoraux', SlotKind.LOWER)).toBe(false);
    expect(muscleBelongsToSlot('pectoraux', SlotKind.PULL)).toBe(false);
    expect(muscleBelongsToSlot('pectoraux', SlotKind.LEGS)).toBe(false);
  });

  it('quadri dans LOWER, LEGS, FULL', () => {
    expect(muscleBelongsToSlot('quadriceps', SlotKind.LOWER)).toBe(true);
    expect(muscleBelongsToSlot('quadriceps', SlotKind.LEGS)).toBe(true);
    expect(muscleBelongsToSlot('quadriceps', SlotKind.FULL)).toBe(true);
  });

  it('dos_largeur dans UPPER, PULL mais pas PUSH', () => {
    expect(muscleBelongsToSlot('dos_largeur', SlotKind.UPPER)).toBe(true);
    expect(muscleBelongsToSlot('dos_largeur', SlotKind.PULL)).toBe(true);
    expect(muscleBelongsToSlot('dos_largeur', SlotKind.PUSH)).toBe(false);
  });

  it('abdos partout (FULL et au moins un Upper/Lower)', () => {
    expect(muscleBelongsToSlot('abdos', SlotKind.FULL)).toBe(true);
    expect(
      muscleBelongsToSlot('abdos', SlotKind.UPPER) ||
        muscleBelongsToSlot('abdos', SlotKind.LOWER),
    ).toBe(true);
  });

  // Conv #17c — chaque muscle canonique (MUSCLES) doit pouvoir être placé
  // sur **au moins un slot** de chaque split canonique, sinon il serait
  // silencieusement ignoré. Garde-fou contre la régression du bug obliques
  // (ignoré sur UL/PPL) et trapezes_hauts (ignoré sur PPL).
  it('obliques éligible sur UL et PPL (pas seulement FULL)', () => {
    expect(muscleBelongsToSlot('obliques', SlotKind.UPPER)).toBe(true);
    expect(muscleBelongsToSlot('obliques', SlotKind.LOWER)).toBe(true);
    expect(muscleBelongsToSlot('obliques', SlotKind.PUSH)).toBe(true);
    expect(muscleBelongsToSlot('obliques', SlotKind.PULL)).toBe(true);
    expect(muscleBelongsToSlot('obliques', SlotKind.LEGS)).toBe(true);
  });

  it('trapezes_hauts éligible sur PULL en plus de UPPER', () => {
    expect(muscleBelongsToSlot('trapezes_hauts', SlotKind.UPPER)).toBe(true);
    expect(muscleBelongsToSlot('trapezes_hauts', SlotKind.PULL)).toBe(true);
  });

  it('garde-fou : tout muscle canonique a au moins un slot par split', () => {
    const MUSCLES_LIST = [
      'pectoraux',
      'dos_largeur',
      'dos_epaisseur',
      'trapezes_hauts',
      'quadriceps',
      'ischios',
      'fessiers',
      'mollets',
      'deltos_lateraux',
      'deltos_posterieurs',
      'biceps',
      'triceps',
      'abdos',
      'obliques',
      'lombaires',
    ] as const;
    const splits: ReadonlyArray<{ name: string; slots: SlotKind[] }> = [
      { name: 'FB', slots: [SlotKind.FULL] },
      { name: 'UL', slots: [SlotKind.UPPER, SlotKind.LOWER] },
      { name: 'PPL', slots: [SlotKind.PUSH, SlotKind.PULL, SlotKind.LEGS] },
    ];
    for (const m of MUSCLES_LIST) {
      for (const split of splits) {
        const ok = split.slots.some((s) => muscleBelongsToSlot(m, s));
        expect(ok, `${m} doit être placé sur ${split.name}`).toBe(true);
      }
    }
  });
});
