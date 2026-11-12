/**
 * Dump 2.4, étape 2 — migration à la lecture des anciens réglages par muscle
 * (objectif + statut) vers les intentions (développer / entretenir).
 */

import { describe, expect, it } from 'vitest';
import {
  exercisesWithChangedReps,
  hasLegacyMuscleGoals,
  migrateMuscleGoalList,
  migrateMuscleGoals,
  type StoredMuscleGoal,
} from '@/engine/intentions';
import { MuscleIntention } from '@/engine/models';

// Réglages d'Azur au 11/11/2026 (export), plus deux cas absents de son profil.
const LEGACY: Record<string, StoredMuscleGoal> = {
  deltos_lateraux: { muscle: 'deltos_lateraux', objective: 'hypertrophie', status: 'prioritaire', priority_rank: 1 },
  deltos_posterieurs: { muscle: 'deltos_posterieurs', objective: 'hypertrophie', status: 'prioritaire', priority_rank: 2 },
  pectoraux: { muscle: 'pectoraux', objective: 'hypertrophie', status: 'prioritaire', priority_rank: 3 },
  dos_largeur: { muscle: 'dos_largeur', objective: 'maintien', status: 'suggere', priority_rank: 99 },
  biceps: { muscle: 'biceps', objective: 'maintien', status: 'suggere', priority_rank: 99 },
};

describe('migrateMuscleGoals', () => {
  it('prioritaire → développer, rang conservé ; suggéré → entretenir', () => {
    const goals = migrateMuscleGoals(LEGACY);
    expect(goals.deltos_lateraux).toEqual({
      muscle: 'deltos_lateraux',
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: 1,
    });
    expect(goals.pectoraux!.priority_rank).toBe(3);
    expect(goals.dos_largeur!.intention).toBe(MuscleIntention.ENTRETENIR);
    expect(goals.biceps!.priority_rank).toBe(99);
  });

  it('prioritaire en maintien → entretenir, les rangs restants sont renumérotés', () => {
    const goals = migrateMuscleGoals({
      abdos: { muscle: 'abdos', objective: 'maintien', status: 'prioritaire', priority_rank: 1 },
      pectoraux: { muscle: 'pectoraux', objective: 'force', status: 'prioritaire', priority_rank: 2 },
      quadriceps: { muscle: 'quadriceps', objective: 'endurance', status: 'prioritaire', priority_rank: 3 },
    });
    expect(goals.abdos!.intention).toBe(MuscleIntention.ENTRETENIR);
    expect(goals.pectoraux).toEqual({
      muscle: 'pectoraux',
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: 1,
    });
    expect(goals.quadriceps!.priority_rank).toBe(2);
  });

  it('non couvert → plus d’entrée (suivi sans intention)', () => {
    const goals = migrateMuscleGoals({
      triceps: { muscle: 'triceps', objective: 'maintien', status: 'non_couvert', priority_rank: 99 },
    });
    expect(goals).toEqual({});
  });

  it('le nouveau format passe tel quel (migration idempotente)', () => {
    const once = migrateMuscleGoals(LEGACY);
    expect(migrateMuscleGoals(once)).toEqual(once);
    expect(hasLegacyMuscleGoals(once)).toBe(false);
    expect(hasLegacyMuscleGoals(LEGACY)).toBe(true);
  });

  it('liste du bilan de cycle : même migration', () => {
    const list = migrateMuscleGoalList(Object.values(LEGACY));
    expect(list.map((g) => g.muscle).sort()).toEqual(Object.keys(LEGACY).sort());
  });
});

describe('exercisesWithChangedReps — plancher de charge à re-semer', () => {
  const MUSCLES: Record<string, Record<string, number>> = {
    elevation_laterale: { deltos_lateraux: 1 },
    lat_pulldown: { dos_largeur: 1, biceps: 0.5 },
    leg_press: { quadriceps: 1, fessiers: 0.5 },
  };
  const musclesOf = (id: string) => MUSCLES[id] ?? null;

  it('exo dont le muscle primaire était en hypertrophie : inchangé (10 / 12)', () => {
    expect(exercisesWithChangedReps(['elevation_laterale'], LEGACY, 'hypertrophie', musclesOf)).toEqual([]);
  });

  it('exo d’un muscle en maintien ou hors objectifs : reps changées (8 → 10)', () => {
    expect(
      exercisesWithChangedReps(['lat_pulldown', 'leg_press'], LEGACY, 'hypertrophie', musclesOf),
    ).toEqual(['lat_pulldown', 'leg_press']);
  });

  it('exercice inconnu du catalogue livré : laissé tel quel', () => {
    expect(exercisesWithChangedReps(['exo_perso'], LEGACY, 'hypertrophie', musclesOf)).toEqual([]);
  });

  it('aucun réglage par muscle : l’objectif global du profil décidait', () => {
    expect(exercisesWithChangedReps(['leg_press'], {}, 'hypertrophie', musclesOf)).toEqual([]);
    expect(exercisesWithChangedReps(['leg_press'], {}, 'force', musclesOf)).toEqual(['leg_press']);
  });
});
