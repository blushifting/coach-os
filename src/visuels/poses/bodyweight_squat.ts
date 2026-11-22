import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Squat au poids du corps.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bodyweight_squat: PoseExercice = {
  id: 'bodyweight_squat',
  camera: { tour: 48, hauteur: 10 },
  mainFermee: true,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 0], bascule: 3 },
      bras: { epaule: { flex: 8, abd: 6 }, coude: 10 },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 51, -19], bascule: 30 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -14 },
      tete: { flex: -10 },
      bras: { epaule: { flex: 92, abd: 8 }, coude: 6 },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
  ],
  valide: true,
};
