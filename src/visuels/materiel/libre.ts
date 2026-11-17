/**
 * Poids libres et petits accessoires : barre, barre EZ, trap bar, haltère,
 * landmine (T-bar), roue abdominale.
 *
 * Une barre tenue à deux mains n'est pas accrochée aux mains : elle suit son
 * propre trajet (`trajet`, des déplacements de son centre au fil du
 * mouvement) et les mains la visent (cible sur le repère `barre`, avec un
 * `axe`). C'est ce qui garde les mains au même endroit de la barre.
 */

import { M, RAD, V } from '../maths';
import type { Vec3 } from '../maths';
import type { Repere } from '../squelette';
import { auSol, auTemps, auTempsV, dans, repereDe, traceur } from './outils';
import type { Modele } from './outils';

/** Barre chargée, le long de l'axe X du repère qui la porte. Repère offert : `barre` (son centre). */
export interface Barre {
  readonly type: 'barre';
  readonly repere: string;
  readonly centre: Vec3;
  /** Déplacements du centre au fil du mouvement (dans le repère) ; absent : elle ne bouge pas dans ce repère. */
  readonly trajet?: readonly Vec3[];
}
/** Barre EZ (coudée en W), mêmes réglages que la barre. Prise large à ±23 cm, serrée à ±15 cm. */
export interface BarreEz { readonly type: 'barreEz'; readonly repere: string; readonly centre: Vec3; readonly trajet?: readonly Vec3[] }
/** Trap bar (hexagonale) ; poignées à ±27 cm, le long de Z. */
export interface TrapBar { readonly type: 'trapBar'; readonly repere: string; readonly centre: Vec3; readonly trajet?: readonly Vec3[] }
/** Haltère tenu dans une main (repère `poignetG` ou `poignetD`), poignée d'avant en arrière. */
export interface Haltere { readonly type: 'haltere'; readonly repere: string; readonly centre: Vec3 }
/**
 * Landmine (T-bar row) : barre articulée au sol en `pos`, qui part vers +Z.
 * `course` : son angle au-dessus du sol (degrés) au fil du mouvement. Repère
 * offert : `poignee` (la poignée en V sous le bout chargé ; mains à ±6 cm en X, axe Z).
 */
export interface Landmine { readonly type: 'landmine'; readonly pos: Vec3; readonly tour: number; readonly course: readonly number[] }
/** Roue abdominale : `course` = distance de la roue devant `pos` (cm). Repère offert : `poignee` (mains à ±10 cm en X, axe X). */
export interface RoueAbdo { readonly type: 'roueAbdo'; readonly pos: Vec3; readonly tour: number; readonly course: readonly number[] }

/** Où est le centre d'une barre (et son orientation) à cet instant. */
function repereBarre(p: Barre | BarreEz | TrapBar, tronc: Readonly<Record<string, Repere>>, t: number): Repere {
  const d = p.trajet === undefined || p.trajet.length === 0 ? [0, 0, 0] as Vec3 : auTempsV(p.trajet, t);
  return dans(repereDe(tronc, p.repere), V.add(p.centre, d));
}

export const BARRE: Modele<Barre> = {
  reperes: (p, F, t) => ({ barre: repereBarre(p, F, t) }),
  dessiner({ out, F, t }, p) {
    const b = traceur(out, repereBarre(p, F, t));
    // Raccourcie par rapport à une vraie barre (2,20 m), pour que le mannequin reste grand dans la case.
    b.cyl([-58, 0, 0], [58, 0, 0], 1.4, 'metal');
    for (const s of [1, -1]) {
      b.cyl([s * 60, 0, 0], [s * 64.5, 0, 0], 22, 'fonte');
      b.cyl([s * 59.4, 0, 0], [s * 65.1, 0, 0], 6, 'moyeu');
      b.cyl([s * 64.5, 0, 0], [s * 68, 0, 0], 16, 'fonte');
      b.cyl([s * 58, 0, 0], [s * 80, 0, 0], 2.3, 'metal');
    }
    return Number.NaN;
  },
};

export const BARRE_EZ: Modele<BarreEz> = {
  reperes: (p, F, t) => ({ barre: repereBarre(p, F, t) }),
  dessiner({ out, F, t }, p) {
    const b = traceur(out, repereBarre(p, F, t));
    for (const s of [1, -1]) {
      const pts: Vec3[] = [[0, 0, 0], [s * 9, 0, 0], [s * 13, 0, 2.6], [s * 19, 0, 0.4], [s * 25, 0, 2.6], [s * 30, 0, 0], [s * 44, 0, 0]];
      for (let i = 0; i + 1 < pts.length; i++) b.cyl(pts[i]!, pts[i + 1]!, 1.3, 'metal');
      for (let i = 1; i + 1 < pts.length; i++) b.boule(pts[i]!, 1.3, 'metal');
      b.cyl([s * 44, 0, 0], [s * 62, 0, 0], 2.2, 'metal');
      b.cyl([s * 45, 0, 0], [s * 48.5, 0, 0], 15, 'fonte');
      b.cyl([s * 48.5, 0, 0], [s * 51.5, 0, 0], 11, 'fonte');
    }
    return Number.NaN;
  },
};

export const TRAP_BAR: Modele<TrapBar> = {
  reperes: (p, F, t) => ({ barre: repereBarre(p, F, t) }),
  dessiner({ out, F, t }, p) {
    const b = traceur(out, repereBarre(p, F, t));
    const hex: Vec3[] = [[34, 0, 0], [18, 0, 26], [-18, 0, 26], [-34, 0, 0], [-18, 0, -26], [18, 0, -26]];
    for (let i = 0; i < 6; i++) {
      b.cyl(hex[i]!, hex[(i + 1) % 6]!, 1.6, 'cadre');
      b.boule(hex[i]!, 1.6, 'cadre');
    }
    for (const s of [1, -1]) {
      // Poignées à l'intérieur, d'un côté à l'autre de l'hexagone.
      b.cyl([s * 27, 0, -11.4], [s * 27, 0, 11.4], 1.4, 'metal');
      b.cyl([s * 34, 0, 0], [s * 60, 0, 0], 2.3, 'metal');
      b.cyl([s * 37, 0, 0], [s * 41, 0, 0], 20, 'fonte');
      b.cyl([s * 41, 0, 0], [s * 44, 0, 0], 15, 'fonte');
    }
    return Number.NaN;
  },
};

export const HALTERE: Modele<Haltere> = {
  dessiner({ out, F }, p) {
    const h = traceur(out, dans(repereDe(F, p.repere), p.centre));
    h.cyl([0, 0, -5.5], [0, 0, 5.5], 1.2, 'metal');
    h.cyl([0, 0, 5.5], [0, 0, 10], 5.2, 'fonte');
    h.cyl([0, 0, -10], [0, 0, -5.5], 5.2, 'fonte');
    return Number.NaN;
  },
};

const LONGUEUR_LANDMINE = 140;
function repereLandmine(p: Landmine, t: number): { bout: Repere; poignee: Repere } {
  const a = auTemps(p.course, t) * RAD, base = auSol(p.pos, p.tour);
  const Z: Vec3 = [0, Math.sin(a), Math.cos(a)], Y: Vec3 = [0, Math.cos(a), -Math.sin(a)];
  const R = M.depuisColonnes([1, 0, 0], Y, Z);
  const bout = dans(base, V.add([0, 4, 0], V.mul(Z, LONGUEUR_LANDMINE)), R);
  return { bout, poignee: dans(bout, [0, -9, -10]) };
}
export const LANDMINE: Modele<Landmine> = {
  reperes: (p, _F, t) => ({ poignee: repereLandmine(p, t).poignee }),
  dessiner({ out, t }, p) {
    const s = traceur(out, auSol(p.pos, p.tour)), { bout } = repereLandmine(p, t), b = traceur(out, bout);
    s.pave([0, 1.5, 0], [12, 0, 0], [0, 1.5, 0], [0, 0, 12], 'cadre');
    s.cyl([-4, 4, 0], [4, 4, 0], 3, 'moyeu');
    b.cyl([0, 0, -LONGUEUR_LANDMINE], [0, 0, 0], 1.4, 'metal');
    b.cyl([0, 0, 2], [0, 0, 22], 2.3, 'metal');
    // Disques de 10 et 5 kg en fonte (33 et 23 cm) : de gros disques buteraient contre la poitrine bien avant la fin du tirage.
    b.cyl([0, 0, 4], [0, 0, 8], 16.5, 'fonte');
    b.cyl([0, 0, 8], [0, 0, 11], 11.5, 'fonte');
    // Poignée en V accrochée sous la barre : un crochet, une traverse, deux poignées.
    b.cyl([0, -1, -10], [0, -9, -10], 1.2, 'metal');
    b.cyl([-7, -9, -10], [7, -9, -10], 1.2, 'metal');
    for (const x of [-6, 6]) {
      b.cyl([x, -9, -17], [x, -9, -3], 1.6, 'metal');
      b.boule([x, -9, -10], 1.6, 'metal');
    }
    return Number.NaN;
  },
};

function repereRoue(p: RoueAbdo, t: number): Repere {
  return dans(auSol(p.pos, p.tour), [0, 9, auTemps(p.course, t)]);
}
export const ROUE_ABDO: Modele<RoueAbdo> = {
  reperes: (p, _F, t) => ({ poignee: repereRoue(p, t) }),
  dessiner({ out, t }, p) {
    const r = traceur(out, repereRoue(p, t));
    r.cyl([-3.5, 0, 0], [3.5, 0, 0], 9, 'fonte');
    r.cyl([-14, 0, 0], [14, 0, 0], 1.2, 'metal');
    for (const s of [1, -1]) r.cyl([s * 6, 0, 0], [s * 14, 0, 0], 2, 'coussin');
    return Number.NaN;
  },
};
