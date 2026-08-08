/**
 * Bloc G (Conv #32) — tests purs de la séance custom assistée
 * (`src/lib/custom-session.ts`).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import type { Level, SessionFeedback, SessionPlan, UserState } from '@/engine/models';
import {
  ChargeType,
  ExType,
  Pattern,
  Sex,
  exerciseFromDict,
} from '@/engine/models';
import {
  PER_MUSCLE_SESSION_CAP,
  buildCustomSessionSlots,
  defaultProgressionForDay,
  favoritesFirst,
  musclesTrainedOn,
  presetById,
} from '@/lib/custom-session';
import type { DayTemplate } from '@/engine/models';

function makeExercise(id: string, muscles: Record<string, number>) {
  return exerciseFromDict({
    id,
    nom_fr: `Exo ${id}`,
    pattern: Pattern.PUSH_H,
    type: ExType.COMPOUND,
    charge: ChargeType.BARBELL,
    equip: [],
    uni: false,
    muscles,
    subst: id,
    inc_kg: 2.5,
    reps_hyp: [8, 12],
    reps_force: [3, 5],
    repos_s: 120,
    dif: 'mod',
    tags: [],
    note: '',
    synonymes: [],
  });
}

function makeState(favorites: string[] = []): UserState {
  return {
    profile: {
      sex: Sex.HOMME,
      age: 30,
      level: 'intermediaire' as Level,
      objective: 'hypertrophie',
      sessions_per_week: 4,
      bodyweight_kg: 75,
      available_equip: new Set<string>(),
    } as UserState['profile'],
    favorite_exercise_ids: favorites,
    muscle_goals: {},
    last_used_for_muscle: {},
  } as unknown as UserState;
}

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

describe('SESSION_PRESETS', () => {
  it('contient un preset « Vide » sans muscle', () => {
    const vide = presetById('vide');
    expect(vide).not.toBeNull();
    expect(vide!.muscles).toHaveLength(0);
  });
});

describe('buildCustomSessionSlots', () => {
  const catalog = new Catalog([
    makeExercise('bp1', { pectoraux: 1.0 }),
    makeExercise('bp2', { pectoraux: 1.0 }),
    makeExercise('bp3', { pectoraux: 1.0 }),
  ]);

  it('preset vide → aucun slot', () => {
    expect(buildCustomSessionSlots(presetById('vide')!, makeState(), catalog)).toEqual([]);
  });

  it('cible le muscle du preset et plafonne le volume par muscle', () => {
    const slots = buildCustomSessionSlots(presetById('pecs')!, makeState(), catalog);
    expect(slots.length).toBeGreaterThan(0);
    // Tous les slots sont des exos pectoraux du catalogue.
    for (const s of slots) expect(['bp1', 'bp2', 'bp3']).toContain(s.exerciseId);
    // Volume total sur le muscle ≤ plafond séance.
    const total = slots.reduce((a, s) => a + s.nSets, 0);
    expect(total).toBeLessThanOrEqual(PER_MUSCLE_SESSION_CAP);
  });

  it('favoris d’abord : le favori est retenu dans la base', () => {
    const slots = buildCustomSessionSlots(presetById('pecs')!, makeState(['bp2']), catalog);
    expect(slots.map((s) => s.exerciseId)).toContain('bp2');
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
