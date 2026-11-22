import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Glute bridge.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const glute_bridge: PoseExercice = {
  id: 'glute_bridge',
  camera: { tour: 55, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'bassin', centre: [0, -1.5, 15.5] }],
  cles: [
    pose({
      bassin: { pos: [0, 11.68, 0], bascule: -90 },
      cou: { flex: 10 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [11, 8, 42], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 35.8, -7.36], bascule: -120 },
      cou: { flex: 34 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [11, 8, 42], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
