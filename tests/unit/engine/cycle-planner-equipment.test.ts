/**
 * Tests de `enforceEquipmentPreference` (Conv #30) — passe finale qui corrige
 * les fuites de charge dans le plan (ex. haltère malgré « machines uniquement »,
 * y compris celles ré-injectées par les post-passes comme le lengthened bias).
 */

import { describe, expect, it } from 'vitest';
import { enforceEquipmentPreference } from '@/engine/cycle_planner';
import { Catalog } from '@/engine/catalog';
import {
  ChargeType,
  E1RMApp,
  EquipmentPreference,
  ExType,
  Pattern,
  exerciseFromDict,
  makePlannedExercise,
  makeWeeklyTemplate,
  type Exercise,
  type UserState,
  type WeeklyTemplate,
} from '@/engine/models';

function makeExo(
  id: string,
  muscles: Record<string, number>,
  charge: ChargeType,
  pattern: Pattern = Pattern.PUSH_H,
): Exercise {
  return exerciseFromDict({
    id,
    nom_fr: `Exo ${id}`,
    pattern,
    type: ExType.COMPOUND,
    charge,
    equip: [],
    uni: false,
    muscles,
    subst: id,
    inc_kg: 2.5,
    reps_hyp: [8, 12],
    reps_force: [3, 5],
    repos_s: 120,
    dif: 'mod',
    e1RM_app: E1RMApp.FULL,
    tags: [],
    note: '',
    synonymes: [],
  });
}

function weekly(...exoIds: string[]): WeeklyTemplate {
  return makeWeeklyTemplate({
    cycle_index: 1,
    rationale: '',
    days: [
      {
        day_index: 0,
        label: 'J',
        target_muscles_focus: [],
        exercises: exoIds.map((id) =>
          makePlannedExercise({ exercise_id: id, base_sets: 3, progression: [0, 0, 0, 0] }),
        ),
      },
    ],
    warnings: [],
  });
}

function state(pref: EquipmentPreference | undefined): UserState {
  return { profile: { equipment_preference: pref } } as unknown as UserState;
}

const ids = (w: WeeklyTemplate): string[] =>
  w.days[0]!.exercises.map((e) => e.exercise_id);

describe('enforceEquipmentPreference — MACHINES', () => {
  it('remplace un haltère par une machine du même pattern', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('db_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['machine_press']);
  });

  it('trouve une variante câble même dans un autre pattern (recherche élargie)', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('cable_fly', { pectoraux: 1.0 }, ChargeType.CABLE, Pattern.ISOLATION),
    ]);
    const w = weekly('db_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['cable_fly']);
  });

  it('privilégie le même pattern quand plusieurs variantes existent', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('cable_fly', { pectoraux: 1.0 }, ChargeType.CABLE, Pattern.ISOLATION),
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('db_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['machine_press']);
  });

  it('garde l’exo si aucune variante machine/câble n’existe pour le muscle', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
    ]);
    const w = weekly('db_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['db_press']);
  });

  it('ne touche pas un exo déjà conforme', () => {
    const cat = new Catalog([
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('machine_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['machine_press']);
  });

  it('évite les doublons : 2 haltères mais 1 seule machine → le 2e garde son exo', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('db_incline', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('db_press', 'db_incline');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['machine_press', 'db_incline']);
  });
});

describe('enforceEquipmentPreference — autres préférences', () => {
  it('FREE_WEIGHTS : remplace une machine par un poids libre', () => {
    const cat = new Catalog([
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
      makeExo('bb_bench', { pectoraux: 1.0 }, ChargeType.BARBELL, Pattern.PUSH_H),
    ]);
    const w = weekly('machine_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.FREE_WEIGHTS), cat);
    expect(ids(w)).toEqual(['bb_bench']);
  });

  it('NO_PREFERENCE : no-op (garde l’haltère)', () => {
    const cat = new Catalog([
      makeExo('db_press', { pectoraux: 1.0 }, ChargeType.DUMBBELL, Pattern.PUSH_H),
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('db_press');
    enforceEquipmentPreference(w, state(EquipmentPreference.NO_PREFERENCE), cat);
    expect(ids(w)).toEqual(['db_press']);
  });

  it('ignore un exo inconnu du catalogue', () => {
    const cat = new Catalog([
      makeExo('machine_press', { pectoraux: 1.0 }, ChargeType.MACHINE_STACK, Pattern.PUSH_H),
    ]);
    const w = weekly('exo_fantome');
    enforceEquipmentPreference(w, state(EquipmentPreference.MACHINES), cat);
    expect(ids(w)).toEqual(['exo_fantome']);
  });
});
