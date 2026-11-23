import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Step-up.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const step_up: PoseExercice = {
  id: 'step_up',
  camera: { tour: 70, hauteur: 8 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [23, 0, 30], tour: 90, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 92, 4], bascule: 18 },
      lombaires: { flex: 4 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 52, 30], pole: [0.07, 0, 1], tour: 4, pointe: 0 } },
      jambeD: { cible: { pos: [-10.99, 8, -9.97], pole: [-0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 103, 14], bascule: 12 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 52, 30], pole: [0.07, 0, 1], tour: 4, pointe: 0 } },
      jambeD: {
        cible: { pos: [-12.24, 15.92, -1.05], pole: [-0.14, 0, 0.99], tour: 8, pointe: 50 },
      },
    }),
    pose({
      bassin: { pos: [0, 136, 26], bascule: 4 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 52, 30], pole: [0.07, 0, 1], tour: 4, pointe: 0 } },
      jambeD: { cible: { pos: [-11, 64, 4], pole: [0.14, 0, 0.99], tour: 8, pointe: 45 } },
    }),
    pose({
      bassin: { pos: [0, 141, 28], bascule: 2 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 52, 30], pole: [0.07, 0, 1], tour: 4, pointe: 0 } },
      jambeD: { cible: { pos: [-11, 52, 28], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
  cote: 'G',
};
