/**
 * Tests de `addedVolumeOvershoot` (Conv #30, dump 2.4 étape 3) — mise en garde
 * « volume élevé » quand un exo ajouté porte un muscle au-delà de la zone haute
 * (20 séries pondérées par semaine), pour tous les muscles.
 */

import { describe, expect, it } from 'vitest';
import { addedVolumeOvershoot } from '@/lib/progress';

describe('addedVolumeOvershoot', () => {
  it('signale le muscle quand la projection dépasse 20 séries', () => {
    const out = addedVolumeOvershoot({ pectoraux: 1.0 }, 2, { pectoraux: 19 });
    expect(out).toEqual([{ muscle: 'pectoraux', projected: 21 }]);
  });

  it('ne signale rien si la projection reste à 20 ou moins', () => {
    expect(addedVolumeOvershoot({ pectoraux: 1.0 }, 2, { pectoraux: 15 })).toEqual([]);
    // Epsilon : pile 20 n'est pas « au-delà ».
    expect(addedVolumeOvershoot({ pectoraux: 1.0 }, 0, { pectoraux: 20 })).toEqual([]);
  });

  it('vaut pour tous les muscles, avec ou sans objectif', () => {
    const out = addedVolumeOvershoot({ biceps: 1.0 }, 5, { biceps: 18 });
    expect(out).toEqual([{ muscle: 'biceps', projected: 23 }]);
  });

  it('pondère par le coefficient musculaire (synergiste à 0,5)', () => {
    // triceps déjà à 19,5 ; +2 séries × 0,5 = +1 → 20,5 (dépasse).
    // pectoraux part de 0 → 2 (ne dépasse pas).
    const out = addedVolumeOvershoot({ pectoraux: 1.0, triceps: 0.5 }, 2, { triceps: 19.5 });
    expect(out).toEqual([{ muscle: 'triceps', projected: 20.5 }]);
  });

  it('trie du muscle le plus chargé au moins chargé', () => {
    const out = addedVolumeOvershoot(
      { pectoraux: 1.0, triceps: 1.0 },
      2,
      { pectoraux: 19, triceps: 22 },
    );
    expect(out.map((o) => o.muscle)).toEqual(['triceps', 'pectoraux']);
  });
});
