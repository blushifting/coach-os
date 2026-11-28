/**
 * Pose de repos : debout, bras le long du corps, légèrement écartés. C'est
 * elle qui fixe la longueur de repos de chaque muscle (un muscle plus court
 * que dans cette pose gonfle, plus long il s'affine).
 */

import type { PoseExercice } from '../scene';
import { piedAuSol, pose } from '../squelette';

export const REPOS = pose({
  bassin: { pos: [0, 97.6, 0] },
  bras: { epaule: { flex: 2, abd: 12, rot: 0 }, coude: 8 },
  jambe: { cible: piedAuSol(9.5, 8) },
});

/**
 * Le mannequin immobile, au repos, pour un exercice qui n'a pas de mouvement
 * (exercice créé par l'utilisateur) : ses muscles colorés tiennent la place de
 * l'animation, et la fiche garde la même mise en page.
 */
export function mannequinAuRepos(exerciseId: string): PoseExercice {
  return { id: exerciseId, camera: { tour: 25, hauteur: 8 }, mainFermee: false, cles: [REPOS], materiel: [], valide: true };
}
