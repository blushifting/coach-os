import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Sissy squat.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const sissy_squat: PoseExercice = {
  id: 'sissy_squat',
  camera: { tour: 80, hauteur: 10 },
  mainFermee: true,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 106, 9.98], bascule: -3.2 },
      cou: { flex: 1.92 },
      bras: { epaule: { flex: 84.8, abd: 10 }, coude: 10 },
      jambe: { cible: { pos: [11, 16.22, 9.21], pole: [0, -1.04, 2.95], tour: 0, pointe: 55 } },
    }),
    pose({
      bassin: { pos: [0, 71.1, 13.74], bascule: -42 },
      cou: { flex: 25.2 },
      bras: { epaule: { flex: 46, abd: 10 }, coude: 10 },
      jambe: { cible: { pos: [11, 16.22, 9.21], pole: [0, -6.74, 33.04], tour: 0, pointe: 55 } },
    }),
  ],
  valide: true,
};
