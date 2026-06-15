/**
 * Tests de `addedVolumeOvershoot` (Conv #30) — mise en garde « volume élevé »
 * quand un exo ajouté en séance pousse un muscle au-dessus de son V_max hebdo.
 */

import { describe, expect, it } from 'vitest';
import { addedVolumeOvershoot } from '@/lib/progress';
import { MuscleObjective, MuscleStatus, type UserState } from '@/engine/models';

// Muscle PRIORITAIRE hypertrophie → facteur 1.0 → V_max = volume_max.
// pectoraux : V_max = 18 · triceps : V_max = 14.
function st(): Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'> {
  return {
    volume_min: { pectoraux: 10, triceps: 8 },
    volume_max: { pectoraux: 18, triceps: 14 },
    muscle_goals: {
      pectoraux: {
        muscle: 'pectoraux',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 1,
      },
      triceps: {
        muscle: 'triceps',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 2,
      },
    },
  };
}

describe('addedVolumeOvershoot', () => {
  it('signale le muscle quand la projection dépasse V_max', () => {
    const out = addedVolumeOvershoot({ pectoraux: 1.0 }, 2, { pectoraux: 17 }, st());
    expect(out).toEqual([{ muscle: 'pectoraux', projected: 19, vMax: 18 }]);
  });

  it('ne signale rien si la projection reste sous V_max', () => {
    const out = addedVolumeOvershoot({ pectoraux: 1.0 }, 2, { pectoraux: 15 }, st());
    expect(out).toEqual([]);
  });

  it('pondère par le coefficient musculaire (synergiste à 0,5)', () => {
    // triceps déjà à 13,5 ; +2 séries × 0,5 = +1 → 14,5 > 14 (dépasse).
    // pectoraux part de 0 → 0 + 2 = 2 < 18 (ne dépasse pas).
    const out = addedVolumeOvershoot(
      { pectoraux: 1.0, triceps: 0.5 },
      2,
      { triceps: 13.5 },
      st(),
    );
    expect(out).toEqual([{ muscle: 'triceps', projected: 14.5, vMax: 14 }]);
  });

  it('ignore un muscle hors scope (pas de plafond)', () => {
    const out = addedVolumeOvershoot({ biceps: 1.0 }, 5, { biceps: 100 }, st());
    expect(out).toEqual([]);
  });

  it('ne crie pas au dépassement sur un arrondi pile au cap (epsilon)', () => {
    const out = addedVolumeOvershoot({ pectoraux: 1.0 }, 0, { pectoraux: 18 }, st());
    expect(out).toEqual([]);
  });

  it('trie du dépassement le plus fort au plus faible', () => {
    // pectoraux : 18 + 2 = 20 (ratio 1,11) ; triceps : 13 + 2 = 15 (ratio 1,07).
    const out = addedVolumeOvershoot(
      { pectoraux: 1.0, triceps: 1.0 },
      2,
      { pectoraux: 18, triceps: 13 },
      st(),
    );
    expect(out.map((o) => o.muscle)).toEqual(['pectoraux', 'triceps']);
  });
});
