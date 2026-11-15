import type { PoseExercice } from '../scene';
import { piedAuSol, pose } from '../squelette';

/** Élévations latérales haltères. */
export const db_lateral_raise: PoseExercice = {
  id: 'db_lateral_raise',
  camera: { tour: 10, hauteur: 28 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 2 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      bras: { epaule: { flex: 5, abd: 9, rot: 0 }, coude: 14 },
      jambe: { cible: piedAuSol(11, 12) },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 2 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      bras: { clav: [1.5, 0], epaule: { flex: 22, abd: 84, rot: 0 }, coude: 16 },
      jambe: { cible: piedAuSol(11, 12) },
    }),
  ],
  valide: false,
};
