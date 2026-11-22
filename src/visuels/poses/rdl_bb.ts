import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Romanian deadlift barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const rdl_bb: PoseExercice = {
  id: 'rdl_bb',
  camera: { tour: 150, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'mains', centre: [0, 0, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 97, -2] },
      bras: { epaule: { flex: 6.2, abd: 6, rot: -17 }, coude: 11.9, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 86, -19], bascule: 68 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -26 },
      tete: { flex: -12 },
      bras: { epaule: { flex: 51.6, abd: 6.8, rot: -12.8 }, coude: 11.9, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
