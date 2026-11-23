import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pull-through poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_pull_through: PoseExercice = {
  id: 'cable_pull_through',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'poulie', pos: [0, 0, -62], tour: 0, hauteur: 15, prise: { type: 'corde' } }],
  cles: [
    pose({
      bassin: { pos: [0, 86, -20], bascule: 58 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -14 },
      bras: { epaule: { flex: 48, abd: -6 }, coude: 6 },
      jambe: { cible: { pos: [25, 8, 0], pole: [0.45, 0, 0.9], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95.8, 5], bascule: -8 },
      lombaires: { flex: 2 },
      cou: { flex: 4 },
      bras: { epaule: { flex: 18, abd: -8 }, coude: 8 },
      jambe: { cible: { pos: [25, 8, 0], pole: [0.45, 0, 0.9], tour: 22, pointe: 0 } },
    }),
  ],
  valide: true,
};
