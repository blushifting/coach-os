/**
 * Tests heuristique périodicité (Conv #14b-4).
 */

import { describe, expect, it } from 'vitest';
import {
  detectPeriodicity,
  dayOfWeekLabel,
  suggestionForDay,
} from '@/lib/periodicity';
import type { FeedbackRow } from '@/db/schema';
import type { SessionFeedback } from '@/engine/models';

function fb(date: string, label: string): FeedbackRow {
  const feedback: SessionFeedback = {
    seance_date: date,
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 7,
    sets: [],
    label,
  };
  return {
    cycle_index: 1,
    week_in_cycle: 1,
    seance_date: date,
    session_id: null,
    feedback,
    created_at: new Date(date).toISOString(),
  };
}

describe('detectPeriodicity', () => {
  it('vide si pas de feedbacks', () => {
    expect(detectPeriodicity([], new Date(2026, 4, 20))).toEqual([]);
  });

  it('détecte un jour dominant si ≥2 occurrences et ≥50 %', () => {
    // Tous les mardis (2026-05-05, 2026-05-12, 2026-05-19) — 3/3 mardis.
    const feedbacks = [
      fb('2026-05-05', 'Upper A'),
      fb('2026-05-12', 'Upper A'),
      fb('2026-05-19', 'Upper A'),
    ];
    const out = detectPeriodicity(feedbacks, new Date(2026, 4, 20));
    expect(out).toHaveLength(1);
    expect(out[0]?.label).toBe('Upper A');
    expect(out[0]?.dayOfWeek).toBe(1); // mardi (lundi=0)
    expect(out[0]?.occurrences).toBe(3);
    expect(out[0]?.totalInWindow).toBe(3);
  });

  it('exige ≥2 occurrences sur un jour pour valider', () => {
    // 1 mardi + 1 jeudi → pas de jour ≥2 → pas de suggestion.
    const feedbacks = [
      fb('2026-05-05', 'Upper A'),
      fb('2026-05-07', 'Upper A'),
    ];
    expect(detectPeriodicity(feedbacks, new Date(2026, 4, 20))).toEqual([]);
  });

  it('exige ≥50 % de part pour valider', () => {
    // 2 mardis sur 5 séances → 40 % → en dessous du seuil.
    const feedbacks = [
      fb('2026-05-05', 'Upper A'), // mardi
      fb('2026-05-12', 'Upper A'), // mardi
      fb('2026-05-07', 'Upper A'), // jeudi
      fb('2026-05-14', 'Upper A'), // jeudi
      fb('2026-05-16', 'Upper A'), // samedi
    ];
    expect(detectPeriodicity(feedbacks, new Date(2026, 4, 20))).toEqual([]);
  });

  it('ignore les feedbacks hors fenêtre (> 6 semaines)', () => {
    // 2 mardis il y a 10 semaines : trop vieux, ne comptent pas.
    const feedbacks = [
      fb('2026-03-10', 'Upper A'),
      fb('2026-03-17', 'Upper A'),
    ];
    expect(detectPeriodicity(feedbacks, new Date(2026, 4, 20))).toEqual([]);
  });

  it('détecte plusieurs labels indépendamment', () => {
    const feedbacks = [
      // Upper A le mardi ×2
      fb('2026-05-05', 'Upper A'),
      fb('2026-05-12', 'Upper A'),
      // Lower A le jeudi ×2
      fb('2026-05-07', 'Lower A'),
      fb('2026-05-14', 'Lower A'),
    ];
    const out = detectPeriodicity(feedbacks, new Date(2026, 4, 20));
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.label)).toEqual(['Lower A', 'Upper A']);
    expect(out.find((s) => s.label === 'Upper A')?.dayOfWeek).toBe(1);
    expect(out.find((s) => s.label === 'Lower A')?.dayOfWeek).toBe(3);
  });
});

describe('suggestionForDay', () => {
  const suggestions = [
    { label: 'Upper A', dayOfWeek: 1 as const, occurrences: 3, totalInWindow: 3 },
  ];

  it('null si le jour n\'est pas free-future', () => {
    expect(
      suggestionForDay({ dayOfWeek: 1, status: 'completed' }, suggestions),
    ).toBeNull();
    expect(
      suggestionForDay({ dayOfWeek: 1, status: 'planned' }, suggestions),
    ).toBeNull();
  });

  it('null si aucun jour dominant ne matche', () => {
    expect(
      suggestionForDay({ dayOfWeek: 2, status: 'free-future' }, suggestions),
    ).toBeNull();
  });

  it('renvoie la suggestion si le jour matche', () => {
    const s = suggestionForDay(
      { dayOfWeek: 1, status: 'free-future' },
      suggestions,
    );
    expect(s?.label).toBe('Upper A');
  });
});

describe('dayOfWeekLabel', () => {
  it('formate en FR', () => {
    expect(dayOfWeekLabel(0)).toBe('lundi');
    expect(dayOfWeekLabel(1)).toBe('mardi');
    expect(dayOfWeekLabel(6)).toBe('dimanche');
  });
});
