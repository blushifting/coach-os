import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Romanian deadlift haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const rdl_db: PoseExercice = {
  id: 'rdl_db',
  camera: { tour: 120, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97, -2] },
      bras: { epaule: { flex: 20, abd: 3 }, coude: 4, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 86, -19], bascule: 68 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -26 },
      tete: { flex: -12 },
      bras: { epaule: { flex: 78, abd: 3 }, coude: 4, pronation: 90 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
