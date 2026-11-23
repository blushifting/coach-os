import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Kickback haltère.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const kickback_db: PoseExercice = {
  id: 'kickback_db',
  camera: { tour: 75, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 88.8, -17.9], bascule: 56 },
      lombaires: { flex: 7 },
      thorax: { flex: 7 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      brasG: { epaule: { flex: -8, abd: 10 }, coude: 82 },
      brasD: { pronation: 60, cible: { repere: 'monde', pos: [-13, 60, 8], pole: [-0.4, 0, -1] } },
      jambeG: { cible: { pos: [12, 8, -18], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-12, 8, 6], pole: [-0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 88.8, -17.9], bascule: 56 },
      lombaires: { flex: 7 },
      thorax: { flex: 7 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      brasG: { epaule: { flex: -10, abd: 6 }, coude: 3 },
      brasD: { pronation: 60, cible: { repere: 'monde', pos: [-13, 60, 8], pole: [-0.4, 0, -1] } },
      jambeG: { cible: { pos: [12, 8, -18], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-12, 8, 6], pole: [-0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
  cote: 'G',
  effort: 'aller',
};
