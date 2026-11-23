import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Dips assistés.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const dips_assisted: PoseExercice = {
  id: 'dips_assisted',
  camera: { tour: 110, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'assistee', pos: [0, 0, 0], tour: 0, course: [1.6, -20.6] }],
  cles: [
    pose({
      bassin: { pos: [0, 129, -15], bascule: 10 },
      cou: { flex: -9.33 },
      bras: { cible: { repere: 'barres', pos: [27, 0, 0], axe: [0, 0, 1], pole: [0.45, 0, -1] } },
      jambe: { hanche: { flex: 10 }, genou: 92 },
    }),
    pose({
      bassin: { pos: [0, 106, -21], bascule: 26 },
      cou: { flex: -14.67 },
      bras: { cible: { repere: 'barres', pos: [27, 0, 0], axe: [0, 0, 1], pole: [0.45, 0, -1] } },
      jambe: { hanche: { flex: 26 }, genou: 92 },
    }),
  ],
  valide: true,
};
