import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Squat smith machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const smith_squat: PoseExercice = {
  id: 'smith_squat',
  camera: { tour: 48, hauteur: 10 },
  mainFermee: true,
  materiel: [
    { type: 'smith', pos: [0, 0, -4], tour: 0, course: [148.5, 142.33, 126.61, 109.73, 102.4] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 1.29], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, -1], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 90.06, -1.92], bascule: 5.93 },
      lombaires: { flex: 2.44 },
      thorax: { flex: 2.44 },
      cou: { flex: -1.46 },
      tete: { flex: -1.17 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, -1], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.5, -9.69], bascule: 13 },
      lombaires: { flex: 3.5 },
      thorax: { flex: 3.5 },
      cou: { flex: -5 },
      tete: { flex: -4 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, -1], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.94, -17.37], bascule: 20.07 },
      lombaires: { flex: 4.56 },
      thorax: { flex: 4.56 },
      cou: { flex: -8.54 },
      tete: { flex: -6.83 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, -1], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 52.5, -20.48], bascule: 23 },
      lombaires: { flex: 5 },
      thorax: { flex: 5 },
      cou: { flex: -10 },
      tete: { flex: -8 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, -1], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'retour',
};
