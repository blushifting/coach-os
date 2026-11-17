import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Shrug haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_shrug: PoseExercice = {
  id: 'db_shrug',
  camera: { tour: 28, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: { clav: [-0.5, 0], epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: { clav: [7, -0.5], epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
