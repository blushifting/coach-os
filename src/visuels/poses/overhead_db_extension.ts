import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Extension haltères au-dessus tête.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const overhead_db_extension: PoseExercice = {
  id: 'overhead_db_extension',
  camera: { tour: 62, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0] },
      thorax: { flex: -2 },
      bras: { cible: { repere: 'thorax', pos: [16.1, 52.62, -12.72], pole: [0, 0.91, 0.42] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      thorax: { flex: -2 },
      bras: { cible: { repere: 'thorax', pos: [15.99, 59.9, -10.27], pole: [0, 0.91, 0.42] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      thorax: { flex: -2 },
      bras: { cible: { repere: 'thorax', pos: [16.39, 68.87, -2.77], pole: [0, 0.91, 0.42] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      thorax: { flex: -2 },
      bras: { cible: { repere: 'thorax', pos: [17.39, 73.65, 7.85], pole: [0, 0.91, 0.42] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0] },
      thorax: { flex: -2 },
      bras: { cible: { repere: 'thorax', pos: [18.69, 73.5, 18.59], pole: [0, 0.91, 0.42] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
