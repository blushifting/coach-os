import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Dips poitrine penché.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const dips_chest: PoseExercice = {
  id: 'dips_chest',
  camera: { tour: 60, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'barresParalleles', pos: [0, 0, 0], tour: 0, hauteur: 125, ecart: 56 }],
  cles: [
    pose({
      bassin: { pos: [0, 136.07, -7.19], bascule: 12 },
      cou: { flex: -6 },
      bras: { cible: { repere: 'barres', pos: [28, 0, 0], axe: [0, 0, 1], pole: [0.45, 0, -1] } },
      jambe: { hanche: { flex: 25 }, genou: 85 },
    }),
    pose({
      bassin: { pos: [0, 112.44, -12.96], bascule: 32 },
      cou: { flex: -16 },
      bras: { cible: { repere: 'barres', pos: [28, 0, 0], axe: [0, 0, 1], pole: [0.45, 0, -1] } },
      jambe: { hanche: { flex: 25 }, genou: 85 },
    }),
  ],
  valide: true,
};
