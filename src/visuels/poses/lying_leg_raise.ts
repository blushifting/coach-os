import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Relevé de jambes allongé.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const lying_leg_raise: PoseExercice = {
  id: 'lying_leg_raise',
  camera: { tour: 75, hauteur: 14 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.59, 0], bascule: -90 },
      cou: { flex: 6 },
      bras: {
        pronation: 58,
        poignet: { flex: -10, dev: 7 },
        cible: { repere: 'monde', pos: [27, 3, 6], pole: [0.6, 1, 0] },
      },
      jambe: { hanche: { flex: 12 }, genou: 4, cheville: -25 },
    }),
    pose({
      bassin: { pos: [0, 12.11, -0.02], bascule: -95 },
      lombaires: { flex: 5 },
      cou: { flex: 6 },
      bras: {
        pronation: 58,
        poignet: { flex: -10, dev: 7 },
        cible: { repere: 'monde', pos: [27, 3, 6], pole: [0.6, 1, 0] },
      },
      jambe: { hanche: { flex: 48 }, genou: 28, cheville: -25 },
    }),
    pose({
      bassin: { pos: [0, 13.64, -0.36], bascule: -110 },
      lombaires: { flex: 20 },
      cou: { flex: 6 },
      bras: {
        pronation: 58,
        poignet: { flex: -10, dev: 7 },
        cible: { repere: 'monde', pos: [27, 3, 6], pole: [0.6, 1, 0] },
      },
      jambe: { hanche: { flex: 86 }, genou: 8, cheville: -25 },
    }),
  ],
  valide: true,
};
