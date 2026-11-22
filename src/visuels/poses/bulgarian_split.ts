import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Squat bulgare.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bulgarian_split: PoseExercice = {
  id: 'bulgarian_split',
  camera: { tour: 72, hauteur: 10 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [23, 0, -52], tour: 90, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 92, 0], bascule: 6 },
      bras: { epaule: { flex: 4, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 28], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-11, 50, -40], pole: [0, -0.3, 1], tour: 0, pointe: 150 } },
    }),
    pose({
      bassin: { pos: [0, 60, -2], bascule: 14 },
      lombaires: { flex: 2 },
      bras: { epaule: { flex: 4, abd: 7 }, coude: 6 },
      jambeG: { cible: { pos: [11, 8, 28], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
      jambeD: { cible: { pos: [-11, 50, -40], pole: [0, -0.3, 1], tour: 0, pointe: 150 } },
    }),
  ],
  valide: true,
  cote: 'G',
};
