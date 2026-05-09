/**
 * Miroir TS de prototype/tests/test_split.py.
 * Couvre : 6 splits canoniques, select_split, muscle_belongs_to_slot,
 * place_days_in_week, check_48h_rule.
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
  selectSplit,
  placeDaysInWeek,
  check48hRule,
  muscleBelongsToSlot,
} from '@/engine/split';
import {
  Level,
  makeWeeklyTemplate,
  type DayTemplate,
} from '@/engine/models';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function gapDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function dayTemplate(
  day_index: number,
  label: string,
  target_muscles_focus: string[],
): DayTemplate {
  return { day_index, label, target_muscles_focus, exercises: [] };
}

// =============================================================================
// 1. Constantes : les 6 splits existent avec le bon nombre de sessions
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

  it('ALL_SPLITS index complet', () => {
    expect(ALL_SPLITS).toContain(SPLIT_FB_2X);
    expect(ALL_SPLITS).toContain(SPLIT_PPL_6X);
    expect(ALL_SPLITS.length).toBe(6);
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
// 2. selectSplit : règles par sessions_per_week
// =============================================================================

describe('selectSplit', () => {
  it('2 séances → FB 2×', () => {
    expect(selectSplit(2, {}, Level.INTERMEDIAIRE)).toBe(SPLIT_FB_2X);
  });

  it('3 séances par défaut → FB 3× (Schoenfeld 2019)', () => {
    expect(selectSplit(3, {}, Level.DEBUTANT)).toBe(SPLIT_FB_3X);
  });

  it('4 séances → U/L 4× (gold standard)', () => {
    expect(selectSplit(4, {}, Level.INTERMEDIAIRE)).toBe(SPLIT_UL_4X);
  });

  it('5 séances → U/L 5× + spec', () => {
    expect(selectSplit(5, {}, Level.INTERMEDIAIRE)).toBe(SPLIT_UL_5X_SPEC);
  });

  it('6 séances avancé → PPL 6×', () => {
    expect(selectSplit(6, {}, Level.AVANCE)).toBe(SPLIT_PPL_6X);
  });

  it('6 séances débutant → fallback U/L 4×', () => {
    expect(selectSplit(6, {}, Level.DEBUTANT)).toBe(SPLIT_UL_4X);
  });

  it('1 séance → erreur', () => {
    expect(() => selectSplit(1, {}, Level.INTERMEDIAIRE)).toThrow();
  });

  it('7 séances → erreur', () => {
    expect(() => selectSplit(7, {}, Level.INTERMEDIAIRE)).toThrow();
  });
});

// =============================================================================
// 3. muscleBelongsToSlot
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
});

// =============================================================================
// 4. placeDaysInWeek — défauts éprouvés
// =============================================================================

describe('placeDaysInWeek', () => {
  it('2 séances : ≥2 jours d\'écart', () => {
    const days = placeDaysInWeek(SPLIT_FB_2X);
    expect(days.length).toBe(2);
    expect(gapDays(days[0]!, days[1]!)).toBeGreaterThanOrEqual(2);
  });

  it('3 séances : écarts entre 1 et 3 jours', () => {
    const days = placeDaysInWeek(SPLIT_FB_3X);
    expect(days.length).toBe(3);
    for (let i = 0; i < days.length - 1; i += 1) {
      const gap = gapDays(days[i]!, days[i + 1]!);
      expect(gap).toBeGreaterThanOrEqual(1);
      expect(gap).toBeLessThanOrEqual(3);
    }
  });

  it('4 séances : 4 jours retournés', () => {
    expect(placeDaysInWeek(SPLIT_UL_4X).length).toBe(4);
  });

  it('préférences user respectées', () => {
    const pref = [
      new Date(Date.UTC(2026, 0, 6)),
      new Date(Date.UTC(2026, 0, 8)),
      new Date(Date.UTC(2026, 0, 10)),
    ];
    const days = placeDaysInWeek(SPLIT_FB_3X, pref);
    expect(days.map((d) => d.getTime())).toEqual(pref.map((d) => d.getTime()));
  });

  it('préférences mauvaise longueur → erreur', () => {
    const pref = [new Date(Date.UTC(2026, 0, 6)), new Date(Date.UTC(2026, 0, 8))];
    expect(() => placeDaysInWeek(SPLIT_FB_3X, pref)).toThrow();
  });
});

// =============================================================================
// 5. check48hRule
// =============================================================================

describe('check48hRule', () => {
  it('aucune violation si jours espacés', () => {
    const wt = makeWeeklyTemplate({
      cycle_index: 1,
      rationale: 'U/L 4×',
      days: [
        dayTemplate(0, 'Upper A', ['pectoraux']),
        dayTemplate(1, 'Lower A', ['quadriceps']),
        dayTemplate(2, 'Upper B', ['pectoraux']),
        dayTemplate(3, 'Lower B', ['quadriceps']),
      ],
    });
    const dates = [
      new Date(Date.UTC(2026, 0, 5)),
      new Date(Date.UTC(2026, 0, 6)),
      new Date(Date.UTC(2026, 0, 8)),
      new Date(Date.UTC(2026, 0, 9)),
    ];
    expect(check48hRule(wt, dates)).toEqual([]);
  });

  it('violation si même muscle à 1 jour d\'écart', () => {
    const wt = makeWeeklyTemplate({
      cycle_index: 1,
      rationale: 'test',
      days: [
        dayTemplate(0, 'Push A', ['pectoraux']),
        dayTemplate(1, 'Push B', ['pectoraux']),
      ],
    });
    const dates = [new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 6))];
    const v = check48hRule(wt, dates);
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v.some((x) => x.sharedMuscles.includes('pectoraux'))).toBe(true);
  });

  it('aucune violation si muscles différents', () => {
    const wt = makeWeeklyTemplate({
      cycle_index: 1,
      rationale: 'test',
      days: [
        dayTemplate(0, 'Upper', ['pectoraux']),
        dayTemplate(1, 'Lower', ['quadriceps']),
      ],
    });
    const dates = [new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 6))];
    expect(check48hRule(wt, dates)).toEqual([]);
  });
});
