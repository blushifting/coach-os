import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Soulevé trap bar (hex bar).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const deadlift_trap_bar: PoseExercice = {
  id: 'deadlift_trap_bar',
  camera: { tour: 150, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'trapBar', repere: 'mains', centre: [0, 0, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 50.1, -29.9], bascule: 50 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -16 },
      tete: { flex: -6 },
      bras: { epaule: { flex: 44.5, abd: 9.9, rot: -11.7 }, coude: 13.7 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97, -1] },
      bras: { epaule: { flex: 1.4, abd: 8.8, rot: -16.6 }, coude: 11.9 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
