/**
 * Tests purs des outils de séance libre et d'édition de programme
 * (`src/lib/custom-session.ts`).
 */

import { describe, expect, it } from 'vitest';
import type { DayTemplate, SessionFeedback, SessionPlan } from '@/engine/models';
import {
  defaultProgressionForDay,
  favoritesFirst,
  musclesTrainedOn,
} from '@/lib/custom-session';

describe('favoritesFirst', () => {
  it('remonte les favoris en tête, ordre interne préservé', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(favoritesFirst(list, new Set(['c', 'b'])).map((x) => x.id)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('renvoie une copie inchangée sans favoris', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    const out = favoritesFirst(list, new Set());
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out).not.toBe(list);
  });
});

describe('defaultProgressionForDay', () => {
  it('5 semaines par défaut (déload léger en dernière), sans voisin', () => {
    expect(defaultProgressionForDay(undefined, 3)).toEqual([3, 3, 3, 3, 2]);
  });

  it('calque la longueur de progression d’un exo voisin du jour', () => {
    const day = {
      day_index: 0,
      label: 'A',
      target_muscles_focus: [],
      exercises: [
        {
          exercise_id: 'x',
          base_sets: 3,
          progression: [3, 3, 4, 4],
          role: null,
          intensity_scheme: null,
          progression_rule: null,
        },
      ],
    } as DayTemplate;
    const prog = defaultProgressionForDay(day, 3);
    expect(prog).toHaveLength(4);
    expect(prog[prog.length - 1]).toBe(2); // round(3 * 0.6) = 2
  });

  it('#73 A-2 — récup : jamais moins de 2 séries (2 → 2, pas 1)', () => {
    const prog = defaultProgressionForDay(undefined, 2);
    expect(prog[prog.length - 1]).toBe(2); // round(2 * 0.6) = 1, planché à 2
  });

  it('#73 A-2 — un exo à 1 série ne gagne pas de série en récup', () => {
    const prog = defaultProgressionForDay(undefined, 1);
    expect(prog[prog.length - 1]).toBe(1);
  });
});

describe('musclesTrainedOn', () => {
  const musclesOf = {
    ex1: { pectoraux: 1.0, triceps: 0.5 },
    ex2: { quadriceps: 1.0 },
  };
  const feedbacks = [
    {
      feedback: {
        seance_date: '2026-06-14',
        sets: [{ exercise_id: 'ex1', reps_done: 10, load_kg: 60, rpe_perceived: 8 }],
      } as unknown as SessionFeedback,
    },
  ];
  const planned = [
    {
      seance_date: '2026-06-14',
      status: 'planned',
      plan: { items: [{ exercise_id: 'ex2', sets: [] }] } as unknown as SessionPlan,
    },
  ];

  it('rassemble les muscles primaires (coef ≥ 1) faits + planifiés ce jour', () => {
    const m = musclesTrainedOn('2026-06-14', feedbacks, planned, musclesOf);
    expect(m.has('pectoraux')).toBe(true);
    expect(m.has('quadriceps')).toBe(true);
    expect(m.has('triceps')).toBe(false); // synergiste (coef 0.5) ignoré
  });

  it('ignore les autres jours', () => {
    expect(musclesTrainedOn('2026-06-15', feedbacks, planned, musclesOf).size).toBe(0);
  });
});
