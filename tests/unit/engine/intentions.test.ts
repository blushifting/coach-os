/**
 * Dump 2.4, étape 2 — migration à la lecture des anciens réglages par muscle
 * (objectif + statut) vers les intentions (développer / entretenir).
 */

import { describe, expect, it } from 'vitest';
import {
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
  });

  it('liste du bilan de cycle : même migration', () => {
    const list = migrateMuscleGoalList(Object.values(LEGACY));
    expect(list.map((g) => g.muscle).sort()).toEqual(Object.keys(LEGACY).sort());
  });
});

