import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Élévations latérales haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_lateral_raise: PoseExercice = {
  id: 'db_lateral_raise',
  camera: { tour: 18, hauteur: 22 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 4 },
      bras: { epaule: { flex: 12, abd: 9 }, coude: 16 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 4 },
      bras: { clav: [1, 0], epaule: { flex: 26, abd: 86, rot: -8 }, coude: 18 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
