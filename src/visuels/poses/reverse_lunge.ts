import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Fente arrière.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const reverse_lunge: PoseExercice = {
  id: 'reverse_lunge',
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
      bassin: { pos: [0, 92, -12], bascule: 8 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: {
        cible: { pos: [-10.84, 24.31, -35.14], pole: [0.14, 0, 0.99], tour: 8, pointe: 30 },
      },
    }),
    pose({
      bassin: { pos: [0, 80, -24], bascule: 8 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: {
        cible: { pos: [-12.24, 15.92, -55.95], pole: [-0.14, 0, 0.99], tour: 8, pointe: 50 },
      },
    }),
    pose({
      bassin: { pos: [0, 58, -30], bascule: 8 },
      bras: { epaule: { flex: 2, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: {
        cible: { pos: [-12.58, 16.41, -53.55], pole: [-0.14, 0, 0.99], tour: 8, pointe: 60 },
      },
    }),
  ],
  valide: true,
  cote: 'G',
};
