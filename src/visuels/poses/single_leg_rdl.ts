import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * RDL unilatéral.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const single_leg_rdl: PoseExercice = {
  id: 'single_leg_rdl',
  camera: { tour: 120, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97, 0] },
      bras: { epaule: { flex: 18, abd: 3 }, coude: 4, pronation: 90 },
      jambeG: { cible: { pos: [8, 8, 0], pole: [0.1, 0, 0.99], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 6 }, genou: 20, cheville: 10 },
    }),
    pose({
      bassin: { pos: [0, 91.04, 0.89], bascule: 78 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -24 },
      tete: { flex: -10 },
      bras: { epaule: { flex: 92, abd: 3 }, coude: 4, pronation: 90 },
      jambeG: { cible: { pos: [8, 8, 0], pole: [0.1, 0, 0.99], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: -4 }, genou: 6, cheville: 10 },
    }),
  ],
  valide: true,
  cote: 'G',
};
