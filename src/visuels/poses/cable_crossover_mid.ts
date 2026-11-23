import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crossover à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_crossover_mid: PoseExercice = {
  id: 'cable_crossover_mid',
  camera: { tour: 25, hauteur: 16 },
  mainFermee: true,
  materiel: [{ type: 'visAVis', pos: [0, 0, -34], tour: 0, ecart: 200, hauteur: 165 }],
  cles: [
    pose({
      bassin: { pos: [0, 93, 0], bascule: 22 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -10 },
      bras: { epaule: { flex: 10, abd: 80 }, coude: 26, pronation: 20 },
      jambeG: { cible: { pos: [12, 8, 20], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-12, 8, -24], pole: [-0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 93, 0], bascule: 22 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -10 },
      bras: { epaule: { flex: 50, abd: 55 }, coude: 22, pronation: 20 },
      jambeG: { cible: { pos: [12, 8, 20], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-12, 8, -24], pole: [-0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 93, 0], bascule: 22 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -10 },
      bras: { clav: [0, 1.5], epaule: { flex: 80, abd: -10 }, coude: 35, pronation: 20 },
      jambeG: { cible: { pos: [12, 8, 20], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-12, 8, -24], pole: [-0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
