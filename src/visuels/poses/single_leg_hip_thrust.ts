import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Hip thrust unilatéral.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const single_leg_hip_thrust: PoseExercice = {
  id: 'single_leg_hip_thrust',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: false,
  materiel: [{ type: 'banc', pos: [23, 0, -13.5], tour: 90, dossier: 0 }],
  cles: [
    pose({
      bassin: { pos: [0, 28.48, 39.98], bascule: -56 },
      cou: { flex: 3 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 72 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 32.73, 41.07], bascule: -62 },
      cou: { flex: 6.83 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 66 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 37.1, 41.7], bascule: -68 },
      cou: { flex: 10.67 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 72 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 41.54, 41.86], bascule: -74 },
      cou: { flex: 14.5 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 78 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 46.16, 41.55], bascule: -80 },
      cou: { flex: 18.33 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 84 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 50.42, 40.77], bascule: -86 },
      cou: { flex: 22.17 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 90 }, genou: 95 },
    }),
    pose({
      bassin: { pos: [0, 54.96, 39.54], bascule: -92 },
      cou: { flex: 26 },
      bras: { epaule: { abd: 84 }, coude: 12, pronation: 60 },
      jambeG: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
      jambeD: { hanche: { flex: 96 }, genou: 95 },
    }),
  ],
  valide: true,
  cote: 'G',
};
