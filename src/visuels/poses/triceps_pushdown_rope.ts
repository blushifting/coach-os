import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Extension triceps à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const triceps_pushdown_rope: PoseExercice = {
  id: 'triceps_pushdown_rope',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'poulie', pos: [0, 0, 46], tour: 180, hauteur: 200, prise: { type: 'corde' } }],
  cles: [
    pose({
      bassin: { pos: [0, 97, -2], bascule: 8 },
      thorax: { flex: 6 },
      cou: { flex: -6 },
      bras: { epaule: { flex: 12, abd: 7 }, coude: 105 },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97, -2], bascule: 8 },
      thorax: { flex: 6 },
      cou: { flex: -6 },
      bras: { epaule: { flex: 16, abd: 8 }, coude: 8, pronation: 30 },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
