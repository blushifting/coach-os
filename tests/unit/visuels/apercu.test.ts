import { describe, expect, it } from 'vitest';
import { photosFor } from '@/data/exercise-photos';
import { apercuDisponible } from '@/pages/catalogue/apercu';
import { POSES } from '@/visuels/poses';

describe('aperçu du mouvement (bouton « œil »)', () => {
  it('un exercice qui a une pose validée a un aperçu, même sans photo', () => {
    for (const p of Object.values(POSES)) if (p.valide) expect(apercuDisponible(p.id)).toBe(true);
  });

  it('un exercice sans pose ni photo (créé par l’utilisateur) n’a pas d’aperçu', () => {
    expect(photosFor('exercice_cree_par_moi')).toBeNull();
    expect(apercuDisponible('exercice_cree_par_moi')).toBe(false);
  });
});
