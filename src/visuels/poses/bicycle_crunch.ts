import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crunch bicyclette.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bicycle_crunch: PoseExercice = {
  id: 'bicycle_crunch',
  camera: { tour: 55, hauteur: 22 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.69, 0], bascule: -90 },
      lombaires: { flex: 10, tour: -12.6 },
      thorax: { flex: 26, tour: -15.4 },
      cou: { flex: 12 },
      bras: { cible: { repere: 'tete', pos: [8.5, 3, -6], pole: [1, 0.2, 0.2] } },
      jambeG: { hanche: { flex: 32 }, genou: 12, cheville: -15 },
      jambeD: { hanche: { flex: 105 }, genou: 110, cheville: -15 },
    }),
    pose({
      bassin: { pos: [0, 11.69, 0], bascule: -90 },
      lombaires: { flex: 10 },
      thorax: { flex: 26 },
      cou: { flex: 12 },
      bras: { cible: { repere: 'tete', pos: [8.5, 3, -6], pole: [1, 0.2, 0.2] } },
      jambe: { hanche: { flex: 68 }, genou: 60, cheville: -15 },
    }),
    pose({
      bassin: { pos: [0, 11.69, 0], bascule: -90 },
      lombaires: { flex: 10, tour: 12.6 },
      thorax: { flex: 26, tour: 15.4 },
      cou: { flex: 12 },
      bras: { cible: { repere: 'tete', pos: [8.5, 3, -6], pole: [1, 0.2, 0.2] } },
      jambeG: { hanche: { flex: 105 }, genou: 110, cheville: -15 },
      jambeD: { hanche: { flex: 32 }, genou: 12, cheville: -15 },
    }),
  ],
  valide: true,
  duree: 1.6,
};
