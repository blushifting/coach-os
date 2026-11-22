import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Calf raise haltère unilatéral.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const calf_db_single: PoseExercice = {
  id: 'calf_db_single',
  camera: { tour: 140, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      bras: { epaule: { flex: 2, abd: 6 }, coude: 6 },
      jambeG: { cible: { pos: [6.04, 8, -0.03], pole: [0.1, 0, 0.99], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 4 }, genou: 75, cheville: 20 },
    }),
    pose({
      bassin: { pos: [0, 103.6, 6], bascule: 2 },
      bras: { epaule: { flex: 2, abd: 6 }, coude: 6 },
      jambeG: { cible: { pos: [6.69, 14.8, 6.2], pole: [0.1, 0, 0.99], tour: 6, pointe: 38 } },
      jambeD: { hanche: { flex: 4 }, genou: 75, cheville: 20 },
    }),
  ],
  valide: true,
  cote: 'G',
};
