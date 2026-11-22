import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Dead bug.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const dead_bug: PoseExercice = {
  id: 'dead_bug',
  camera: { tour: 70, hauteur: 20 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.74, 0], bascule: -90 },
      cou: { flex: 6 },
      brasG: { epaule: { flex: 170, abd: 4 }, coude: 4 },
      brasD: { epaule: { flex: 90, abd: 4 }, coude: 4 },
      jambeG: { hanche: { flex: 90 }, genou: 90, cheville: -10 },
      jambeD: { hanche: { flex: 20 }, genou: 6, cheville: -10 },
    }),
    pose({
      bassin: { pos: [0, 11.74, 0], bascule: -90 },
      cou: { flex: 6 },
      bras: { epaule: { flex: 90, abd: 4 }, coude: 4 },
      jambe: { hanche: { flex: 90 }, genou: 90, cheville: -10 },
    }),
    pose({
      bassin: { pos: [0, 11.74, 0], bascule: -90 },
      cou: { flex: 6 },
      brasG: { epaule: { flex: 90, abd: 4 }, coude: 4 },
      brasD: { epaule: { flex: 170, abd: 4 }, coude: 4 },
      jambeG: { hanche: { flex: 20 }, genou: 6, cheville: -10 },
      jambeD: { hanche: { flex: 90 }, genou: 90, cheville: -10 },
    }),
  ],
  valide: true,
  duree: 1.6,
};
