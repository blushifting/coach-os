import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pont fessier au poids du corps.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const glute_bridge_bw: PoseExercice = {
  id: 'glute_bridge_bw',
  camera: { tour: 75, hauteur: 14 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.68, 0], bascule: -90 },
      cou: { flex: 10 },
      bras: {
        pronation: -8.5,
        poignet: { flex: -6.5, dev: -9 },
        cible: { repere: 'monde', pos: [30, 3, 2], pole: [1, -0.15, 0] },
      },
      jambe: { cible: { pos: [11, 8, 42], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 35.8, -7.36], bascule: -120 },
      cou: { flex: 34 },
      bras: {
        pronation: -8.5,
        poignet: { flex: -6.5, dev: -7 },
        cible: { repere: 'monde', pos: [30, 3, 2], pole: [1, -0.15, 0] },
      },
      jambe: { cible: { pos: [11, 8, 42], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
