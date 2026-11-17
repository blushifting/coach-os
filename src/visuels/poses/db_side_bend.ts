import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Inclinaison latérale haltère.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_side_bend: PoseExercice = {
  id: 'db_side_bend',
  camera: { tour: 8, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0] },
      lombaires: { penche: -12 },
      thorax: { penche: -10 },
      cou: { penche: -4 },
      brasG: { epaule: { abd: 17 }, coude: 4 },
      brasD: {
        cible: { repere: 'bassin', pos: [-17, 2, 2], axe: [0, 1, 0], pole: [-1, 0.2, -0.6] },
      },
      jambe: { cible: { pos: [14, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      lombaires: { penche: 6 },
      thorax: { penche: 5 },
      cou: { penche: 2 },
      brasG: { epaule: { abd: 17 }, coude: 4 },
      brasD: {
        cible: { repere: 'bassin', pos: [-17, 2, 2], axe: [0, 1, 0], pole: [-1, 0.2, -0.6] },
      },
      jambe: { cible: { pos: [14, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
