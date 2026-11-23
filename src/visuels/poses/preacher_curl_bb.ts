import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl pupitre barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const preacher_curl_bb: PoseExercice = {
  id: 'preacher_curl_bb',
  camera: { tour: 60, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'pupitre', pos: [0, 0, 0], tour: 0 },
    { type: 'barreEz', repere: 'mains', centre: [0, 0, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 11.99, pronation: -90, poignet: { flex: 0.01 } },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 25.74, pronation: -90, poignet: { flex: -0.01 } },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 39.49, pronation: -90, poignet: { flex: -0.01 } },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 53.25, pronation: -90, poignet: { flex: -0.01 } },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 66.99, pronation: -90 },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 80.75, pronation: -90 },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 94.49, pronation: -90 },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 108.25, pronation: -90 },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 74.52, -16.91], bascule: -1.77 },
      lombaires: { flex: 12 },
      thorax: { flex: 20 },
      cou: { flex: -12 },
      bras: { epaule: { flex: 83.24 }, coude: 121.99, pronation: -90 },
      jambe: { cible: { pos: [12, 8, 14], pole: [0.1, 0.3, 1], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
