/**
 * Postes sans charge guidée : bancs, barre de traction, barres parallèles,
 * pupitre à curl, banc à lombaires, banc à ischios (GHR), reverse hyper.
 * Un appareil au sol a sa place (`pos`, au sol) et son orientation (`tour`,
 * degrés ; 0 = l'utilisateur regarde vers +Z).
 */

import { M, RAD, V } from '../maths';
import type { Vec3 } from '../maths';
import type { Repere } from '../squelette';
import { auSol, auTemps, dans, socle, siege, traceur } from './outils';
import type { Modele } from './outils';

/**
 * Banc réglable. `pos` : au sol, sous la charnière entre l'assise (vers +Z)
 * et le dossier (vers −Z). `dossier` : angle du dossier au-dessus de
 * l'horizontale (0 = plat, 30 = incliné, 85 = assis droit) ; négatif = banc
 * décliné, avec ses rouleaux pour bloquer les pieds.
 */
export interface Banc { readonly type: 'banc'; readonly pos: Vec3; readonly tour: number; readonly dossier: number }
/** Barre de traction entre deux montants. `pos` : au sol, sous le milieu de la barre. Repère offert : `barre`. */
export interface BarreTraction { readonly type: 'barreTraction'; readonly pos: Vec3; readonly tour: number; readonly hauteur: number; readonly largeur: number }
/** Barres parallèles (dips), le long de Z. `ecart` : d'un axe à l'autre. Repère offert : `barres` (au milieu, à leur hauteur). */
export interface BarresParalleles { readonly type: 'barresParalleles'; readonly pos: Vec3; readonly tour: number; readonly hauteur: number; readonly ecart: number }
/** Pupitre à curl : siège, et le pupitre devant, penché vers l'avant (dessus à 112 cm). */
export interface Pupitre { readonly type: 'pupitre'; readonly pos: Vec3; readonly tour: number }
/** Banc à lombaires à 45°. Repère offert : `plateau` (sous les pieds ; Y sort de la semelle, Z vers les orteils). */
export interface BancLombaires { readonly type: 'bancLombaires'; readonly pos: Vec3; readonly tour: number }
/** Banc à ischios (glute-ham raise). Repère offert : `plateau` (sous les pieds, comme ci-dessus). */
export interface Ghr { readonly type: 'ghr'; readonly pos: Vec3; readonly tour: number }
/**
 * Reverse hyper : couché sur le ventre (tête vers +Z), les hanches au bord
 * arrière du plateau, les jambes pendent dans une sangle. `course` : angle du
 * balancier vers l'arrière (degrés). Repère offert : `chevilles` (la sangle).
 */
export interface ReverseHyper { readonly type: 'reverseHyper'; readonly pos: Vec3; readonly tour: number; readonly course: readonly number[] }

export const BANC: Modele<Banc> = {
  dessiner({ out }, { pos, tour, dossier }) {
    const t = traceur(out, auSol(pos, tour)), decline = dossier < 0;
    // Charnière, au milieu de l'épaisseur des coussins. Un banc décliné est monté plus haut.
    const J: Vec3 = [0, decline ? 40.5 - dossier * 0.6 : 40.5, 0];
    const a = dossier * RAD, s = decline ? -a : 0;
    const dirDos: Vec3 = [0, Math.sin(a), -Math.cos(a)], nDos: Vec3 = [0, Math.cos(a), Math.sin(a)];
    const dirAssise: Vec3 = [0, Math.sin(s), Math.cos(s)], nAssise: Vec3 = [0, Math.cos(s), -Math.sin(s)];
    const le = (dir: Vec3, n: Vec3, d: number, h = 0): Vec3 => V.add(V.add(J, V.mul(dir, d)), V.mul(n, h));
    const DOS = 80, ASSISE = 34;
    t.coussin(le(dirDos, nDos, 1.5 + DOS / 2), V.mul(dirDos, DOS / 2), V.mul(nDos, 3.5), 13.5);
    t.coussin(le(dirAssise, nAssise, 1.5 + ASSISE / 2), V.mul(dirAssise, ASSISE / 2), V.mul(nAssise, 3.5), 14);
    // Châssis : une poutre centrale, deux pieds en T, des appuis sous les coussins.
    const bout = le(dirAssise, nAssise, 1.5 + ASSISE);
    const avant = decline ? bout[2] + 24 : 34, arriere = -58, y = 20;
    t.poutre([0, y, arriere], [0, y, avant], 7, 5, 'cadre', [1, 0, 0]);
    for (const [z, l] of [[arriere + 3, 50], [avant - 3, 44]] as const) {
      t.poutre([-l / 2, 2.5, z], [l / 2, 2.5, z], 5, 5, 'cadre', [0, 0, 1]);
      t.poutre([0, 2.5, z], [0, y, z], 6, 6);
    }
    const sousAssise = le(dirAssise, nAssise, 1.5 + ASSISE * 0.5, -3.5);
    t.poutre([0, y, sousAssise[2]], sousAssise, 6, 5);
    const sousDos = le(dirDos, nDos, 1.5 + DOS * 0.4, -3.5);
    t.poutre([0, y, Math.min(-38, sousDos[2] - 10)], sousDos, 6, 5);
    if (decline) {
      // Rouleaux pour bloquer les pieds, au-delà du bout haut de l'assise.
      const r: Vec3 = [0, bout[1] - 24, bout[2] + 22];
      t.poutre([0, y, avant - 4], r, 5, 5);
      t.cyl([-18, r[1], r[2]], [18, r[1], r[2]], 1.2, 'metal');
      for (const sx of [1, -1]) t.rouleau([sx * 3, r[1], r[2]], [sx * 18, r[1], r[2]], 7);
    }
    return Number.NaN;
  },
};

export const BARRE_TRACTION: Modele<BarreTraction> = {
  reperes: (p) => ({ barre: dans(auSol(p.pos, p.tour), [0, p.hauteur, 0]) }),
  dessiner({ out }, { pos, tour, hauteur, largeur }) {
    const t = traceur(out, auSol(pos, tour)), x = largeur / 2 + 3.5;
    t.cyl([-x, hauteur, 0], [x, hauteur, 0], 1.6, 'metal');
    for (const s of [1, -1]) {
      t.poutre([s * x, 3, 0], [s * x, hauteur + 8, 0], 7, 7);
      t.poutre([s * x, 3, -45], [s * x, 3, 45], 7, 6, 'cadre', [1, 0, 0]);
      t.poutre([s * x, hauteur * 0.5, 0], [s * x, 5, -40], 5, 5);
    }
    return Number.NaN;
  },
};

export const BARRES_PARALLELES: Modele<BarresParalleles> = {
  reperes: (p) => ({ barres: dans(auSol(p.pos, p.tour), [0, p.hauteur, 0]) }),
  dessiner({ out }, { pos, tour, hauteur, ecart }) {
    const t = traceur(out, auSol(pos, tour)), x = ecart / 2, z = 30;
    for (const s of [1, -1]) {
      t.cyl([s * x, hauteur, -z - 3], [s * x, hauteur, z + 3], 2.4, 'cadre');
      t.cyl([s * x, hauteur, -13], [s * x, hauteur, 13], 2.9, 'coussin');
      for (const sz of [1, -1]) t.poutre([s * x, 3, sz * z], [s * x, hauteur - 2, sz * z], 6, 6);
    }
    for (const sz of [1, -1]) t.poutre([-x - 16, 3, sz * z], [x + 16, 3, sz * z], 6, 5, 'cadre', [0, 0, 1]);
    return Number.NaN;
  },
};

/** Pupitre : il part sous les aisselles et descend vers l'avant ; les bras s'y posent, de l'aisselle au coude. */
const PUPITRE_HAUT: Vec3 = [0, 108, 4], PENTE_PUPITRE = 35 * RAD;
export const PUPITRE: Modele<Pupitre> = {
  dessiner({ out }, { pos, tour }) {
    const t = traceur(out, auSol(pos, tour));
    const dir: Vec3 = [0, -Math.sin(PENTE_PUPITRE), Math.cos(PENTE_PUPITRE)], n: Vec3 = [0, Math.cos(PENTE_PUPITRE), Math.sin(PENTE_PUPITRE)];
    socle(t, -40, 50, 50, 56);
    siege(t, [0, 60, -18], 18, 15);
    // Le dessus du coussin passe par son bord haut, juste sous les aisselles.
    const c = V.sub(V.add(PUPITRE_HAUT, V.mul(dir, 17)), V.mul(n, 3.5)), dessous = V.sub(c, V.mul(n, 4.5));
    t.coussin(c, V.mul(dir, 17), V.mul(n, 3.5), 26);
    t.pave(dessous, [20, 0, 0], V.mul(n, 1), V.mul(dir, 13), 'cadre');
    t.poutre([0, 3, dessous[2] + 6], dessous, 8, 8);
    return Number.NaN;
  },
};

/**
 * Banc à lombaires : le corps suit une ligne à 45° qui monte vers l'avant.
 * Chevilles à 8 cm du plateau, coussin devant le haut des cuisses, juste sous
 * le pli de la hanche (les hanches sont 85 cm plus haut que les chevilles).
 */
const LIGNE_45: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2], DEVANT_45: Vec3 = [0, -Math.SQRT1_2, Math.SQRT1_2];
const PLATEAU_45: Repere = { o: [0, 14, -40], R: M.depuisColonnes([1, 0, 0], LIGNE_45, DEVANT_45) };
const CHEVILLES_45 = V.add(PLATEAU_45.o, V.mul(LIGNE_45, 8));
export const BANC_LOMBAIRES: Modele<BancLombaires> = {
  reperes: (p) => ({ plateau: dans(auSol(p.pos, p.tour), PLATEAU_45.o, PLATEAU_45.R) }),
  dessiner({ out }, { pos, tour }) {
    const t = traceur(out, auSol(pos, tour));
    socle(t, -66, 52, 56, 56);
    // Coussin devant le haut des cuisses.
    const coussin = V.add(V.add(CHEVILLES_45, V.mul(LIGNE_45, 72)), V.mul(DEVANT_45, 13));
    t.coussin(coussin, V.mul(LIGNE_45, 13), V.mul(DEVANT_45, 4), 24);
    // Châssis sous la ligne du corps : du sol à l'arrière jusque sous le coussin, et un pied devant.
    const sous = V.add(coussin, V.mul(DEVANT_45, 5));
    t.pave(sous, [16, 0, 0], V.mul(DEVANT_45, 1), V.mul(LIGNE_45, 10), 'cadre');
    t.poutre([0, 3, -62], sous, 8, 8);
    t.poutre([0, 3, 48], sous, 7, 7);
    // Plateau des pieds, perpendiculaire au corps, et rouleaux derrière les chevilles.
    const pl = PLATEAU_45.o;
    t.pave(V.sub(pl, V.mul(LIGNE_45, 1.5)), [17, 0, 0], V.mul(LIGNE_45, 1.5), V.mul(DEVANT_45, 14), 'cadre');
    t.poutre([0, 3, -52], V.sub(pl, V.mul(LIGNE_45, 3)), 6, 6);
    const rouleau = V.add(V.sub(CHEVILLES_45, V.mul(DEVANT_45, 8)), V.mul(LIGNE_45, 3));
    t.poutre(V.sub(pl, V.mul(DEVANT_45, 12)), rouleau, 4, 4);
    t.cyl([-17, rouleau[1], rouleau[2]], [17, rouleau[1], rouleau[2]], 1, 'metal');
    for (const s of [1, -1]) t.rouleau([s * 3, rouleau[1], rouleau[2]], [s * 16, rouleau[1], rouleau[2]], 4.5);
    return Number.NaN;
  },
};

/**
 * Banc à ischios (GHR) : à genoux, les tibias à l'horizontale sur leur appui,
 * les pieds contre la plaque, les chevilles bloquées par les rouleaux ; le gros
 * coussin rond est devant les genoux. Départ buste droit, arrivée buste à
 * l'horizontale par-dessus le coussin.
 */
const PLATEAU_GHR: Repere = { o: [0, 95, -52], R: M.depuisColonnes([1, 0, 0], [0, 0, 1], [0, -1, 0]) };
export const GHR: Modele<Ghr> = {
  reperes: (p) => ({ plateau: dans(auSol(p.pos, p.tour), PLATEAU_GHR.o, PLATEAU_GHR.R) }),
  dessiner({ out }, { pos, tour }) {
    const t = traceur(out, auSol(pos, tour));
    socle(t, -66, 50, 60, 60);
    // Colonne arrière, plaque des pieds, rouleaux sur l'arrière des chevilles.
    t.poutre([0, 3, -58], [0, 112, -58], 8, 8);
    t.pave([0, 95, -53.5], [17, 0, 0], [0, 15, 0], [0, 0, 1.5], 'cadre');
    t.poutre([0, 110, -58], [0, 104, -40], 4, 4);
    t.cyl([-17, 104, -40], [17, 104, -40], 1, 'metal');
    for (const s of [1, -1]) t.rouleau([s * 3, 104, -40], [s * 16, 104, -40], 4.5);
    // Appui des tibias, puis le coussin rond des genoux, sur une poutre au-dessus du socle.
    t.poutre([0, 78, -58], [0, 78, 15], 7, 7, 'cadre', [1, 0, 0]);
    t.coussin([0, 85.5, -23], [0, 0, 17], [0, 3.5, 0], 16);
    t.poutre([0, 78, -23], [0, 82, -23], 6, 6);
    t.poutre([0, 3, 15], [0, 89, 15], 9, 9);
    t.cyl([-22, 101, 15], [22, 101, 15], 12, 'coussin');
    return Number.NaN;
  },
};

/**
 * Reverse hyper : le balancier pivote juste sous le bord arrière du plateau,
 * presque dans l'axe des hanches ; sa sangle, à 71 cm du pivot, passe derrière
 * les chevilles : les jambes, tendues, la poussent sans la quitter.
 */
const PIVOT_RH: Vec3 = [0, 100, -8], RAYON_RH = 71;
function repereSangle(p: ReverseHyper, t: number): Repere {
  const R = M.rx(auTemps(p.course, t));
  return dans(auSol(p.pos, p.tour), V.add(PIVOT_RH, M.vec(R, [0, -RAYON_RH, 0])), R);
}
export const REVERSE_HYPER: Modele<ReverseHyper> = {
  reperes: (p, _F, t) => ({ chevilles: repereSangle(p, t) }),
  dessiner({ out, t }, p) {
    const s = traceur(out, auSol(p.pos, p.tour));
    socle(s, -70, 84, 70, 60);
    // Plateau : on s'y couche sur le ventre, les hanches au bord arrière.
    s.coussin([0, 101.5, 28], [0, 0, 34], [0, 3.5, 0], 21);
    s.poutre([0, 3, 30], [0, 95, 30], 9, 9);
    s.poutre([0, 95, -8], [0, 95, 64], 8, 6, 'cadre', [1, 0, 0]);
    // Poignées courtes au bout du plateau.
    s.poutre([-26, 93, 64], [26, 93, 64], 5, 5, 'cadre', [0, 0, 1]);
    for (const x of [-24, 24]) {
      s.poutre([x, 93, 64], [x, 103, 66], 4, 4);
      s.cyl([x, 103, 62], [x, 103, 72], 2, 'coussin');
    }
    // Deux montants portent l'axe du balancier, qui pend entre eux.
    for (const x of [-14, 14]) s.poutre([x, 3, PIVOT_RH[2]], [x, PIVOT_RH[1] + 3, PIVOT_RH[2]], 7, 7);
    s.poutre([-14, 95, -8], [14, 95, -8], 6, 6, 'cadre', [0, 0, 1]);
    s.cyl([-12, PIVOT_RH[1], PIVOT_RH[2]], [12, PIVOT_RH[1], PIVOT_RH[2]], 2.6, 'metal');
    const b = traceur(out, dans(auSol(p.pos, p.tour), PIVOT_RH, M.rx(auTemps(p.course, t))));
    b.poutre([0, 0, 0], [0, -RAYON_RH - 14, 0], 6, 6, 'cadre', [1, 0, 0]);
    b.cyl([-15, -RAYON_RH, 0], [15, -RAYON_RH, 0], 1, 'metal');
    b.rouleau([-14, -RAYON_RH, 0], [14, -RAYON_RH, 0], 4);
    b.disques([0, -RAYON_RH - 14, 0], [0, -RAYON_RH - 14, -22], 15);
    return Number.NaN;
  },
};
