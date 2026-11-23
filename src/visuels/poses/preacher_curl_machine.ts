import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl pupitre machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const preacher_curl_machine: PoseExercice = {
  id: 'preacher_curl_machine',
  camera: { tour: 60, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'curlMachine', pos: [0, 0, 0], tour: 0, variante: 'curl', course: [-20, 77] }],
  cles: [
    pose({
      bassin: { pos: [0, 70, -22] },
      thorax: { flex: 16 },
      cou: { flex: -10 },
      bras: {
        pronation: -90,
        cible: { repere: 'barre', pos: [14, 0, 0], axe: [1, 0, 0], pole: [0, 0, -1] },
      },
      jambe: { cible: { pos: [12, 8, 19], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 70, -22] },
      thorax: { flex: 16 },
      cou: { flex: -10 },
      bras: {
        pronation: -90,
        cible: { repere: 'barre', pos: [14, 0, 0], axe: [1, 0, 0], pole: [0, 0, -1] },
      },
      jambe: { cible: { pos: [12, 8, 19], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
