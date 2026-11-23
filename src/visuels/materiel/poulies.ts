/**
 * Poulies : colonne simple, vis-à-vis (deux colonnes), tirage horizontal à la
 * poulie basse, et la machine de tirage vertical.
 *
 * Au bout d'un câble libre, la prise (poignée, corde, barre, triangle) suit
 * les mains. La barre du tirage vertical, elle, suit son propre trajet le long
 * du câble, et les mains la visent : elles ne glissent pas dessus.
 */

import { M, V, clamp } from '../maths';
import type { Vec3 } from '../maths';
import type { Repere } from '../squelette';
import { auSol, auTemps, dans, leveeDe, prise, socle, siege, tourCharge, traceur } from './outils';
import type { Modele, Prise, Volume } from './outils';

/** Colonne de poulie. `hauteur` : hauteur de la poulie (basse ≈ 15, haute ≈ 200). Elle regarde vers +Z. */
export interface Poulie { readonly type: 'poulie'; readonly pos: Vec3; readonly tour: number; readonly hauteur: number; readonly prise: Prise }
/**
 * Vis-à-vis : deux colonnes face à face, de part et d'autre de `pos` (à ±`ecart`/2
 * en X), poulies à `hauteur`. La main gauche tient la poignée de la colonne de
 * gauche (X positif), la droite celle de droite ; `croise` : câbles croisés,
 * la main gauche tient celle de droite (oiseau à la poulie).
 */
export interface VisAVis { readonly type: 'visAVis'; readonly pos: Vec3; readonly tour: number; readonly ecart: number; readonly hauteur: number; readonly croise?: boolean }
/**
 * Tirage horizontal à la poulie basse : banc bas, cale-pieds, colonne devant
 * (vers +Z). Repère offert : `plateau` (le cale-pieds ; Y sort de la semelle, Z vers les orteils).
 */
export interface TirageHorizontalPoulie { readonly type: 'tirageHorizontalPoulie'; readonly pos: Vec3; readonly tour: number; readonly prise: Prise }
/**
 * Machine de tirage vertical. `pos` : au sol, sous le milieu du siège ; on
 * s'assoit face à +Z. `course` : hauteur de la barre au fil du mouvement (cm
 * au-dessus du sol). Repère offert : `barre` (son milieu ; X le long de la
 * barre, partie droite jusqu'à ±43 cm).
 */
export interface TirageVertical { readonly type: 'tirageVertical'; readonly pos: Vec3; readonly tour: number; readonly course: readonly number[] }

const HAUT_COLONNE = 212;

/** Point d'où part le câble d'une colonne posée en `base`, poulie à `hauteur`. */
const departColonne = (base: Repere, hauteur: number): Vec3 => dans(base, [0, clamp(hauteur, 10, HAUT_COLONNE - 14), 12]).o;

/** La colonne elle-même : montants, pile (levée de `levee`), rail, chariot, poulies, câble. */
function colonne(out: Volume[], base: Repere, hauteur: number, levee: number): void {
  const t = traceur(out, base), haut = HAUT_COLONNE, h = clamp(hauteur, 10, haut - 14);
  t.pave([0, 2, -6], [27, 0, 0], [0, 2, 0], [0, 0, 20], 'cadre');
  for (const x of [-18, 18]) t.poutre([x, 4, -6], [x, haut, -6], 6, 6);
  t.poutre([-21, haut, -6], [21, haut, -6], 6, 6, 'cadre', [0, 0, 1]);
  const tige = t.pile([0, 4, -6], 10, haut - 6, levee);
  // Rail du chariot, du socle à la traverse du haut, où il est fixé par une patte.
  t.poutre([0, 3, 3], [0, haut, 3], 5, 4);
  t.poutre([0, haut, 3], [0, haut, -6], 4, 4);
  t.pave([0, h, 7], [4.5, 0, 0], [0, 7, 0], [0, 0, 3.2], 'moyeu');
  t.roue([0, h, 12]);
  t.roue([0, haut - 8, -1.5], 3.2);
  t.poutre([0, haut - 8, -1.5], [0, haut, -1.5], 2.2, 2.2);
  t.cable([tige, [0, haut - 8, -4.7], [0, haut - 8, 5.4], [0, h + 7, 5.4]]);
}

export const POULIE: Modele<Poulie> = {
  dessiner({ out, F, repos }, p) {
    const base = auSol(p.pos, p.tour), course = prise(out, F, p.prise, departColonne(base, p.hauteur));
    colonne(out, base, p.hauteur, leveeDe(course, repos));
    return course;
  },
};

export const VIS_A_VIS: Modele<VisAVis> = {
  dessiner({ out, F, repos }, p) {
    const centre = auSol(p.pos, p.tour), bases: Repere[] = [];
    let course = 0;
    for (const [s, main] of p.croise === true ? ([[1, 'poignetD'], [-1, 'poignetG']] as const) : ([[1, 'poignetG'], [-1, 'poignetD']] as const)) {
      const base = dans(centre, [(s * p.ecart) / 2, 0, 0], M.ry(-90 * s));
      bases.push(base);
      course += prise(out, F, { type: 'poignee', main }, departColonne(base, p.hauteur));
    }
    const levee = leveeDe(course, repos) / 2;
    for (const b of bases) colonne(out, b, p.hauteur, levee);
    // Traverse haute entre les deux colonnes.
    traceur(out, centre).poutre([-p.ecart / 2 - 6, HAUT_COLONNE + 3, -6], [p.ecart / 2 + 6, HAUT_COLONNE + 3, -6], 6, 6, 'cadre', [0, 0, 1]);
    return course;
  },
};

/** Poulie à hauteur du bas de la poitrine de l'utilisateur assis : le tirage est horizontal et le câble passe au-dessus des genoux. */
const HAUTEUR_TIRAGE_POULIE = 78;
const PENTE_CALE = 20 * (Math.PI / 180);
const calePieds = (p: TirageHorizontalPoulie): Repere =>
  dans(auSol(p.pos, p.tour), [0, 26, 50], M.depuisColonnes([1, 0, 0], [0, Math.sin(PENTE_CALE), -Math.cos(PENTE_CALE)], [0, Math.cos(PENTE_CALE), Math.sin(PENTE_CALE)]));
export const TIRAGE_HORIZONTAL_POULIE: Modele<TirageHorizontalPoulie> = {
  reperes: (p) => ({ plateau: calePieds(p) }),
  dessiner({ out, F, repos }, p) {
    const sol = auSol(p.pos, p.tour), t = traceur(out, sol), base = dans(sol, [0, 0, 92], M.ry(180));
    const course = prise(out, F, p.prise, departColonne(base, HAUTEUR_TIRAGE_POULIE));
    colonne(out, base, HAUTEUR_TIRAGE_POULIE, leveeDe(course, repos));
    // Banc bas, long, et le cale-pieds incliné.
    socle(t, -70, 80, 44, 50);
    t.coussin([0, 38.5, -20], [0, 0, 42], [0, 3.5, 0], 15);
    for (const z of [-50, 10]) t.poutre([0, 3, z], [0, 35, z], 7, 7);
    const c = calePieds(p), cp = traceur(out, c);
    cp.pave([0, -1.5, 0], [20, 0, 0], [0, 1.5, 0], [0, 0, 16], 'cadre');
    t.poutre([0, 3, 62], [0, 24.5, 52], 6, 6);
    return course;
  },
};

const HAUT_TIRAGE = 228, AVANT_TIRAGE = 8;
function repereBarreTirage(p: TirageVertical, t: number): Repere {
  const h = auTemps(p.course, t);
  // La barre descend sous la poulie, en reculant un peu vers la poitrine.
  return dans(auSol(p.pos, p.tour), [0, h, AVANT_TIRAGE - 4 - (172 - h) * 0.06]);
}
export const TIRAGE_VERTICAL: Modele<TirageVertical> = {
  reperes: (p, _F, t) => ({ barre: repereBarreTirage(p, t) }),
  dessiner({ out, t: temps, repos }, p) {
    // La tour est devant l'utilisateur, au-delà de ses pieds : on s'assoit face à la pile, le dos dégagé.
    const sol = auSol(p.pos, p.tour), t = traceur(out, sol), haut = HAUT_TIRAGE, zt = 74, avant = AVANT_TIRAGE;
    const rb = repereBarreTirage(p, temps), b = traceur(out, rb), depart = t.P([0, haut - 10.5, avant]);
    // Barre coudée : partie droite, bouts relevés vers le bas, mousses aux bouts.
    b.cyl([-43, 0, 0], [43, 0, 0], 1.3, 'metal');
    for (const s of [1, -1]) {
      const e: Vec3 = [s * 43, 0, 0], f: Vec3 = [s * 59, -7, 0];
      b.boule(e, 1.3, 'metal');
      b.cyl(e, f, 1.3, 'metal');
      b.cyl(V.add(e, V.mul(V.sub(f, e), 0.25)), f, 1.8, 'coussin');
    }
    b.cyl([0, 0, 0], [0, 5, 0], 0.9, 'metal');
    b.boule([0, 5, 0], 1.5, 'metal');
    const attache = b.P([0, 5, 0]);
    traceur(out, { o: [0, 0, 0], R: M.ry(0) }).cyl(attache, depart, 0.4, 'metal');
    const course = V.len(V.sub(attache, depart));
    // Socle et siège.
    socle(t, -24, zt, 48, 56);
    siege(t, [0, 47.5, 0], 19, 17);
    // Rouleaux qui bloquent les cuisses, sur un bras qui monte entre les tibias.
    t.poutre([0, 3, 40], [0, 66, 26], 6, 5);
    t.cyl([-21, 68.5, 24], [21, 68.5, 24], 1, 'metal');
    for (const s of [1, -1]) t.rouleau([s * 3, 68.5, 24], [s * 21, 68.5, 24], 6);
    // Tour de charge, bras vers l'avant, renfort, poulies.
    const tige = tourCharge(t, zt, haut, 12, leveeDe(course, repos));
    t.poutre([0, haut, zt], [0, haut, avant - 4], 8, 8, 'cadre', [1, 0, 0]);
    t.poutre([0, haut - 50, zt - 3], [0, haut - 4, zt - 40], 5, 5);
    t.roue([0, haut - 8, zt]);
    t.roue([0, haut - 8, avant]);
    for (const z of [zt, avant]) t.poutre([0, haut - 8, z], [0, haut, z], 2.2, 2.2);
    t.cable([tige, [0, haut - 8, zt], [0, haut - 8, avant], [0, haut - 10.5, avant]]);
    return course;
  },
};

