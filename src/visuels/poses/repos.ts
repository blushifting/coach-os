/**
 * Pose de repos : debout, bras le long du corps, légèrement écartés. C'est
 * elle qui fixe la longueur de repos de chaque muscle (un muscle plus court
 * que dans cette pose gonfle, plus long il s'affine).
 */

import { piedAuSol, pose } from '../squelette';

export const REPOS = pose({
  bassin: { pos: [0, 97.6, 0] },
  bras: { epaule: { flex: 2, abd: 12, rot: 0 }, coude: 8 },
  jambe: { cible: piedAuSol(9.5, 8) },
});
