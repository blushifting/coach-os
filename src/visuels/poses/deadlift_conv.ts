import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Soulevé de terre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const deadlift_conv: PoseExercice = {
  id: 'deadlift_conv',
  camera: { tour: 150, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'mains', centre: [0, 0, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 55.3, -26.1], bascule: 54 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -18 },
      tete: { flex: -8 },
      bras: { epaule: { flex: 51.2, abd: 7, rot: -13.1 }, coude: 13.1, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 81.3, -23.1], bascule: 52 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -16 },
      tete: { flex: -6 },
      bras: { epaule: { flex: 47, abd: 6.9, rot: -13.2 }, coude: 13.6, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 92.9, -13.7], bascule: 34 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -10 },
      tete: { flex: -4 },
      bras: { epaule: { flex: 30.4, abd: 6.4, rot: -14.3 }, coude: 13.5, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97, -2] },
      bras: { epaule: { flex: 10.1, abd: 6.1, rot: -17.3 }, coude: 11.9, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
