import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Élévations frontales haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_front_raise: PoseExercice = {
  id: 'db_front_raise',
  camera: { tour: 62, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      lombaires: { flex: 1 },
      thorax: { flex: 2 },
      bras: { epaule: { flex: 14, abd: 3 }, coude: 10, pronation: 90 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      lombaires: { flex: -1 },
      bras: { clav: [1, 0.5], epaule: { flex: 98, abd: 4 }, coude: 10, pronation: 90 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
