import type { PoseExercice } from '../scene';
import { piedAuSol, pose } from '../squelette';
import type { CibleBras } from '../squelette';

// Prise de la barre, dans le repère du thorax : la barre repose sur les
// trapèzes, les mains la tiennent plus large que les épaules, coudes vers le bas.
const PRISE: CibleBras = { repere: 'thorax', pos: [40, 19, -9.5], pole: [0.35, -1, -0.55] };

/** Squat à la barre. Les pieds restent au sol, la barre reste sur le dos. */
export const squat_bb_high: PoseExercice = {
  id: 'squat_bb_high',
  camera: { tour: 48, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'thorax', centre: [0, 23, -10.4] }],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      bras: { cible: PRISE },
      jambe: { cible: piedAuSol(16, 22) },
    }),
    pose({
      bassin: { pos: [0, 51, -19], bascule: 30 },
      lombaires: { flex: 6 },
      thorax: { flex: 6 },
      cou: { flex: -14 },
      tete: { flex: -14 },
      bras: { cible: PRISE },
      jambe: { cible: piedAuSol(16, 22) },
    }),
  ],
  valide: false,
};
