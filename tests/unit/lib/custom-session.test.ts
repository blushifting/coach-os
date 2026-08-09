/**
 * Bloc G (Conv #32) — tests purs de la séance custom assistée
 * (`src/lib/custom-session.ts`).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import type { Level, SessionFeedback, SessionPlan, UserState } from '@/engine/models';
import {
  ChargeType,
  EquipmentPreference,
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

function makeExercise(
  id: string,
  muscles: Record<string, number>,
  charge: ChargeType = ChargeType.BARBELL,
  equip: string[] = [],
) {
  return exerciseFromDict({
    id,
    nom_fr: `Exo ${id}`,
    pattern: Pattern.PUSH_H,
    type: ExType.COMPOUND,
    charge,
    equip,
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

interface StateOptions {
  readonly equip?: string[];
  readonly preference?: EquipmentPreference;
}

function makeState(favorites: string[] = [], options: StateOptions = {}): UserState {
  return {
    profile: {
      sex: Sex.HOMME,
      age: 30,
      level: 'intermediaire' as Level,
      objective: 'hypertrophie',
      sessions_per_week: 4,
      bodyweight_kg: 75,
      available_equip: new Set<string>(options.equip ?? []),
      equipment_preference: options.preference,
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

describe('buildCustomSessionSlots — préférence d’équipement (#75 D-1)', () => {
  const EQUIP = ['machine', 'barre'];
  // Pectoraux : machine ET poids libres disponibles. Quadriceps : poids libres
  // seulement — c'est le muscle qui teste le repli.
  // Les poids libres sont en tête : sans préférence, ce sont eux que la
  // sélection retient — c'est exactement ce que voyait Azur.
  const catalog = new Catalog([
    makeExercise('pec_barre', { pectoraux: 1.0 }, ChargeType.BARBELL, ['barre']),
    makeExercise('pec_machine', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, ['machine']),
    makeExercise('pec_poulie', { pectoraux: 1.0 }, ChargeType.CABLE, ['machine']),
    makeExercise('pec_pdc', { pectoraux: 1.0 }, ChargeType.BODYWEIGHT, []),
    makeExercise('quad_barre', { quadriceps: 1.0 }, ChargeType.BARBELL, ['barre']),
  ]);

  it('« machines uniquement » ne propose plus de poids libres', () => {
    const state = makeState([], {
      equip: EQUIP,
      preference: EquipmentPreference.MACHINES,
    });
    const ids = buildCustomSessionSlots(presetById('pecs')!, state, catalog).map(
      (s) => s.exerciseId,
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(['pec_machine', 'pec_poulie']).toContain(id);
  });

  it('sans préférence, les poids libres restent proposés', () => {
    const state = makeState([], { equip: EQUIP });
    const ids = buildCustomSessionSlots(presetById('pecs')!, state, catalog).map(
      (s) => s.exerciseId,
    );
    expect(ids).toContain('pec_barre');
  });

  it('repli : un muscle sans machine garde ses poids libres plutôt que rien', () => {
    const state = makeState([], {
      equip: EQUIP,
      preference: EquipmentPreference.MACHINES,
    });
    const preset = { id: 'quads', label: 'Quadriceps', muscles: ['quadriceps'] };
    const ids = buildCustomSessionSlots(preset, state, catalog).map((s) => s.exerciseId);
    expect(ids).toEqual(['quad_barre']);
  });

  it('« poids du corps » est strict : pas de repli sur la barre', () => {
    const state = makeState([], {
      equip: EQUIP,
      preference: EquipmentPreference.BODYWEIGHT,
    });
    const preset = { id: 'quads', label: 'Quadriceps', muscles: ['quadriceps'] };
    expect(buildCustomSessionSlots(preset, state, catalog)).toEqual([]);
    // …mais un muscle qui a bien un exo au poids du corps le reçoit.
    const pecs = buildCustomSessionSlots(presetById('pecs')!, state, catalog);
    expect(pecs.map((s) => s.exerciseId)).toEqual(['pec_pdc']);
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
