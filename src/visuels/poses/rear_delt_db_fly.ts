import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Oiseau.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const rear_delt_db_fly: PoseExercice = {
  id: 'rear_delt_db_fly',
  camera: { tour: 30, hauteur: 24 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 91.2, -16.2], bascule: 50 },
      lombaires: { flex: 5 },
      thorax: { flex: 5 },
      cou: { flex: -22 },
      tete: { flex: -8 },
      bras: { epaule: { flex: 60, abd: 12 }, coude: 18 },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 91.2, -16.2], bascule: 50 },
      lombaires: { flex: 5 },
      thorax: { flex: 5 },
      cou: { flex: -22 },
      tete: { flex: -8 },
      bras: { epaule: { flex: 40, abd: 58 }, coude: 18 },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 91.2, -16.2], bascule: 50 },
      lombaires: { flex: 5 },
      thorax: { flex: 5 },
      cou: { flex: -22 },
      tete: { flex: -8 },
      bras: { clav: [0, -1.5], epaule: { flex: 4, abd: 88 }, coude: 16 },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
