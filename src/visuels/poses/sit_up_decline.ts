import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Sit-up banc décliné.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const sit_up_decline: PoseExercice = {
  id: 'sit_up_decline',
  camera: { tour: 70, hauteur: 14 },
  mainFermee: false,
  materiel: [{ type: 'banc', pos: [0, 0, 0], tour: 0, dossier: -20 }],
  cles: [
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.53 },
      cou: { flex: 5.6 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 67.58, -8.12], bascule: -76.53 },
      lombaires: { flex: 24 },
      thorax: { flex: 20 },
      cou: { flex: 16 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 70.66, -5.91], bascule: -32 },
      lombaires: { flex: 10 },
      thorax: { flex: 6 },
      cou: { flex: 6 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
