import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl haltères alterné.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_curl_alt: PoseExercice = {
  id: 'db_curl_alt',
  camera: { tour: 30, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 16, abd: 2 }, coude: 130, pronation: -85, poignet: { dev: -6 } },
      brasD: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: {
        epaule: { flex: 15.7, abd: 2 },
        coude: 121.11,
        pronation: -85,
        poignet: { dev: -5.56 },
      },
      brasD: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: {
        epaule: { flex: 14.96, abd: 2 },
        coude: 98.89,
        pronation: -85,
        poignet: { dev: -4.44 },
      },
      brasD: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 14, abd: 2 }, coude: 70, pronation: -85, poignet: { dev: -3 } },
      brasD: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: {
        epaule: { flex: 13.04, abd: 2 },
        coude: 41.11,
        pronation: -85,
        poignet: { dev: -1.56 },
      },
      brasD: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        epaule: { flex: 12.3, abd: 2 },
        coude: 18.89,
        pronation: -85,
        poignet: { dev: -0.44 },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      brasD: {
        epaule: { flex: 13.04, abd: 2 },
        coude: 41.11,
        pronation: -85,
        poignet: { dev: -1.56 },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      brasD: { epaule: { flex: 14, abd: 2 }, coude: 70, pronation: -85, poignet: { dev: -3 } },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      brasD: {
        epaule: { flex: 14.96, abd: 2 },
        coude: 98.89,
        pronation: -85,
        poignet: { dev: -4.44 },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      brasD: {
        epaule: { flex: 15.7, abd: 2 },
        coude: 121.11,
        pronation: -85,
        poignet: { dev: -5.56 },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      brasG: { epaule: { flex: 12, abd: 2 }, coude: 10, pronation: -85 },
      brasD: { epaule: { flex: 16, abd: 2 }, coude: 130, pronation: -85, poignet: { dev: -6 } },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  duree: 1.6,
};
