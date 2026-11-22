import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crunch inversé.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const reverse_crunch: PoseExercice = {
  id: 'reverse_crunch',
  camera: { tour: 75, hauteur: 14 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.74, 0], bascule: -90 },
      cou: { flex: 6 },
      bras: {
        pronation: 58,
        poignet: { flex: -10, dev: 7 },
        cible: { repere: 'monde', pos: [27, 3, 6], pole: [0.6, 1, 0] },
      },
      jambe: { hanche: { flex: 90 }, genou: 90, cheville: -15 },
    }),
    pose({
      bassin: { pos: [0, 15.27, -1.14], bascule: -126 },
      lombaires: { flex: 36 },
      cou: { flex: 6 },
      bras: {
        pronation: 58,
        poignet: { flex: -10, dev: 7 },
        cible: { repere: 'monde', pos: [27, 3, 6], pole: [0.6, 1, 0] },
      },
      jambe: { hanche: { flex: 90 }, genou: 90, cheville: -15 },
    }),
  ],
  valide: true,
};
