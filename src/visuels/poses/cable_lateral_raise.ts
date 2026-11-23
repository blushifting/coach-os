import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Élévations latérales poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_lateral_raise: PoseExercice = {
  id: 'cable_lateral_raise',
  camera: { tour: 20, hauteur: 14 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [-50, 0, 10],
      tour: 90,
      hauteur: 15,
      prise: { type: 'poignee', main: 'poignetG' },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 4 },
      brasG: { epaule: { flex: 14, abd: -12 }, coude: 16 },
      brasD: { epaule: { flex: 4, abd: 10 }, coude: 12 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 4 },
      brasG: { clav: [1, 0], epaule: { flex: 26, abd: 86, rot: -8 }, coude: 18 },
      brasD: { epaule: { flex: 4, abd: 10 }, coude: 12 },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  cote: 'G',
};
