import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Kickback poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_kickback: PoseExercice = {
  id: 'cable_kickback',
  camera: { tour: 80, hauteur: 12 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [11, 0, 62],
      tour: 180,
      hauteur: 15,
      prise: { type: 'sangle', jambe: 'genouG' },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 95.5, 4], bascule: 16 },
      lombaires: { flex: 2 },
      cou: { flex: -8 },
      brasG: { cible: { repere: 'monde', pos: [29, 118, 68], axe: [0, 1, 0], pole: [1, -1, 0] } },
      brasD: { cible: { repere: 'monde', pos: [-7, 118, 68], axe: [0, 1, 0], pole: [-1, -1, 0] } },
      jambeG: { hanche: { flex: 14 }, genou: 14, cheville: 10 },
      jambeD: { cible: { pos: [-11, 8, 2], pole: [-0.1, 0, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95.5, 4], bascule: 16 },
      lombaires: { flex: 2 },
      cou: { flex: -8 },
      brasG: { cible: { repere: 'monde', pos: [29, 118, 68], axe: [0, 1, 0], pole: [1, -1, 0] } },
      brasD: { cible: { repere: 'monde', pos: [-7, 118, 68], axe: [0, 1, 0], pole: [-1, -1, 0] } },
      jambeG: { hanche: { flex: -24 }, genou: 6, cheville: 15 },
      jambeD: { cible: { pos: [-11, 8, 2], pole: [-0.1, 0, 1], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
  cote: 'G',
};
