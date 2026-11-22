import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Dips buste vertical.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const dips_triceps: PoseExercice = {
  id: 'dips_triceps',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'barresParalleles', pos: [0, 0, 0], tour: 0, hauteur: 125, ecart: 56 }],
  cles: [
    pose({
      bassin: { pos: [0, 135.57, -2.57], bascule: 3 },
      cou: { flex: -1.5 },
      bras: { cible: { repere: 'barres', pos: [28, 0, 0], axe: [0, 0, 1], pole: [0.15, 0, -1] } },
      jambe: { hanche: { flex: 10 }, genou: 80 },
    }),
    pose({
      bassin: { pos: [0, 109.48, -2.82], bascule: 8 },
      cou: { flex: -4 },
      bras: { cible: { repere: 'barres', pos: [28, 0, 0], axe: [0, 0, 1], pole: [0.15, 0, -1] } },
      jambe: { hanche: { flex: 10 }, genou: 80 },
    }),
  ],
  valide: true,
};
