import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Fente marchée.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const walking_lunge: PoseExercice = {
  id: 'walking_lunge',
  camera: { tour: 70, hauteur: 10 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-10.99, 8, 0.03], pole: [-0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, 14], bascule: 2 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 22, 34], pole: [0.14, 0, 0.99], tour: 8, pointe: -10 } },
      jambeD: { cible: { pos: [-10.99, 8, 0.03], pole: [-0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 90, 34], bascule: 4 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 66], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-11.42, 12.46, 3.08], pole: [-0.14, 0, 0.99], tour: 8, pointe: 22 } },
    }),
    pose({
      bassin: { pos: [0, 58, 32], bascule: 6 },
      lombaires: { flex: -2 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 66], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: {
        cible: { pos: [-12.58, 16.41, 11.35], pole: [-0.14, 0, 0.99], tour: 8, pointe: 60 },
      },
    }),
  ],
  valide: true,
  cote: 'G',
};
