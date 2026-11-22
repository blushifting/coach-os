/**
 * Outils communs aux pièces de matériel : volumes, dessin dans un repère,
 * éléments récurrents (siège, dossier, tour de charge, poignée), prises au bout
 * d'un câble, interpolation de la course d'une pièce mobile.
 */

import { IDENTITE, M, V, clamp, interpoler } from '../maths';
import type { Mat3, Vec3 } from '../maths';
import { PRISE } from '../squelette';
import type { Repere, Reperes } from '../squelette';

export type TonMateriel = 'metal' | 'fonte' | 'moyeu' | 'cadre' | 'coussin';

export type Volume =
  | { readonly forme: 'cylindre'; readonly p0: Vec3; readonly p1: Vec3; readonly r: number; readonly ton: TonMateriel }
  | { readonly forme: 'boule'; readonly centre: Vec3; readonly r: number; readonly ton: TonMateriel }
  | {
    readonly forme: 'pave'; readonly centre: Vec3; readonly dx: Vec3; readonly dy: Vec3; readonly dz: Vec3;
    readonly arrondi: number; readonly ton: TonMateriel;
  };

/** Ce dont une pièce a besoin pour se dessiner à un instant du mouvement. */
export interface Contexte {
  readonly out: Volume[];
  /** Repères du corps (et du matériel) pour cette pose. */
  readonly F: Reperes;
  /** Avancement du mouvement : 0 = départ, 1 = arrivée. */
  readonly t: number;
  /** Course de la charge au départ (NaN : inconnue, la charge reste posée). */
  readonly repos: number;
}

/** Ce que sait faire un type de pièce. */
export interface Modele<P> {
  /** Dessine la pièce ; rend la course de sa charge en cm (NaN : pas de charge guidée). */
  dessiner(c: Contexte, p: P): number;
  /** Repères que la pièce offre aux mains et aux pieds (poignées, plateau, rouleau…). */
  reperes?(p: P, tronc: Reperes, t: number): Record<string, Repere>;
}

/**
 * Une valeur qui change au fil du mouvement : une par étape, la première au départ.
 * Même courbe que les poses clés du corps (`interpoler`), pour que mains et pieds restent dessus.
 */
export const auTemps = (valeurs: readonly number[], t: number): number => interpoler(valeurs, t);
export function auTempsV(valeurs: readonly Vec3[], t: number): Vec3 {
  return [0, 1, 2].map((k) => auTemps(valeurs.map((v) => v[k]!), t)) as unknown as Vec3;
}

/** La charge monte de l'écart de course avec le départ, où elle est posée. */
export const leveeDe = (course: number, repos: number): number => (Number.isFinite(repos) && Number.isFinite(course) ? Math.abs(course - repos) : 0);

/** Repère d'un appareil posé au sol : `pos` au sol, `tour` en degrés autour de la verticale. */
export const auSol = (pos: Vec3, tour: number): Repere => ({ o: pos, R: M.ry(tour) });

/** Un repère local (origine `o`, orientation `R`) ramené dans l'espace. */
export const dans = (rep: Repere, o: Vec3, R: Mat3 = IDENTITE): Repere => ({ o: V.add(rep.o, M.vec(rep.R, o)), R: M.mul(rep.R, R) });

/** Le repère d'une partie du corps (ou de `monde`). */
export function repereDe(F: Reperes, nom: string): Repere {
  const r = F[nom];
  if (r === undefined) throw new Error(`Repère inconnu pour le matériel : ${nom}`);
  return r;
}

/** Dessine dans un repère : chaque point et chaque direction y sont donnés en coordonnées locales. */
export function traceur(out: Volume[], rep: Repere) {
  const P = (v: Vec3): Vec3 => V.add(rep.o, M.vec(rep.R, v));
  const D = (v: Vec3): Vec3 => M.vec(rep.R, v);
  const t = {
    P,
    D,
    cyl(a: Vec3, b: Vec3, r: number, ton: TonMateriel): void {
      out.push({ forme: 'cylindre', p0: P(a), p1: P(b), r, ton });
    },
    boule(c: Vec3, r: number, ton: TonMateriel): void {
      out.push({ forme: 'boule', centre: P(c), r, ton });
    },
    pave(c: Vec3, dx: Vec3, dy: Vec3, dz: Vec3, ton: TonMateriel, arrondi = 1): void {
      out.push({ forme: 'pave', centre: P(c), dx: D(dx), dy: D(dy), dz: D(dz), arrondi, ton });
    },
    /**
     * Tube carré d'un point à un autre (montant, traverse, levier) : `l` de
     * large dans la direction `cote` (ramenée perpendiculaire à l'axe), `e` d'épais.
     */
    poutre(a: Vec3, b: Vec3, l: number, e: number, ton: TonMateriel = 'cadre', cote: Vec3 = [1, 0, 0]): void {
      const ax = V.sub(b, a), A = V.norm(ax);
      let X = V.sub(cote, V.mul(A, V.dot(cote, A)));
      if (V.len(X) < 1e-6) X = V.cross(A, [0, 0, 1]);
      if (V.len(X) < 1e-6) X = V.cross(A, [0, 1, 0]);
      X = V.norm(X);
      t.pave(V.mul(V.add(a, b), 0.5), V.mul(X, l / 2), V.mul(ax, 0.5), V.mul(V.cross(X, A), e / 2), ton, Math.min(l, e) * 0.22);
    },
    /** Tube carré qui passe par plusieurs points, avec un nœud à chaque coude. */
    chemin(points: readonly Vec3[], l: number, ton: TonMateriel = 'cadre', cote: Vec3 = [1, 0, 0]): void {
      for (let i = 0; i + 1 < points.length; i++) t.poutre(points[i]!, points[i + 1]!, l, l, ton, cote);
      for (let i = 1; i + 1 < points.length; i++) t.pave(points[i]!, [l / 2, 0, 0], [0, l / 2, 0], [0, 0, l / 2], ton, l * 0.22);
    },
    /**
     * Coussin : pavé aux arêtes très arrondies. `c` : son centre ; `long` :
     * demi-axe dans sa longueur ; `n` : demi-axe vers sa face d'appui (son
     * épaisseur) ; `demiLarge` : sa demi-largeur, perpendiculaire aux deux.
     */
    coussin(c: Vec3, long: Vec3, n: Vec3, demiLarge: number): void {
      // L'épaisseur est ramenée perpendiculaire à la longueur (un pavé a des axes d'équerre).
      const L = V.norm(long), e = V.len(n), N = V.mul(V.norm(V.sub(n, V.mul(L, V.dot(n, L)))), e);
      const X = V.norm(V.cross(N, long));
      t.pave(c, V.mul(X, demiLarge), N, long, 'coussin', Math.min(2.6, e * 0.9));
    },
    /** Rouleau de mousse, d'axe quelconque. */
    rouleau(a: Vec3, b: Vec3, r = 5.5): void {
      t.cyl(a, b, r, 'coussin');
    },
    /**
     * Pile de plaques de fonte, posée en `bas`, guidée par deux tiges qui
     * montent de `hautTiges`. Les plaques du haut, prises par la goupille,
     * montent de `levee` ; celles du bas restent posées. Rend le haut de la
     * tige de sélection, où s'accroche le câble (en local).
     */
    pile(bas: Vec3, plaques: number, hautTiges: number, levee: number): Vec3 {
      const prises = Math.ceil(plaques / 2), haut = 5 * plaques;
      const l = clamp(levee, 0, hautTiges - haut - 10);
      for (let i = 0; i < plaques; i++) {
        const y = 2.5 + i * 5 + (i >= plaques - prises ? l : 0);
        t.pave(V.add(bas, [0, y, 0]), [12, 0, 0], [0, 2.3, 0], [0, 0, 6], 'fonte', 0.8);
      }
      for (const x of [-7, 7]) t.cyl(V.add(bas, [x, 0, 0]), V.add(bas, [x, hautTiges, 0]), 0.8, 'metal');
      const tige = V.add(bas, [0, haut + l + 7, 0]);
      t.cyl(V.add(bas, [0, (plaques - prises) * 5 + l, 0]), tige, 1, 'metal');
      return tige;
    },
    /** Câble passant par plusieurs points. */
    cable(points: readonly Vec3[]): void {
      for (let i = 0; i + 1 < points.length; i++) t.cyl(points[i]!, points[i + 1]!, 0.4, 'metal');
    },
    /** Roue de poulie, d'axe `axe` (X par défaut). */
    roue(c: Vec3, r = 4.5, axe: Vec3 = [1, 0, 0]): void {
      t.cyl(V.sub(c, V.mul(axe, 1.4)), V.add(c, V.mul(axe, 1.4)), r, 'metal');
    },
    /** Disques de fonte enfilés sur un manchon, de `a` vers `b` (la charge d'une machine à disques). */
    disques(a: Vec3, b: Vec3, r = 16): void {
      const u = V.norm(V.sub(b, a)), L = V.len(V.sub(b, a));
      t.cyl(a, b, 2.2, 'metal');
      for (let s = 2; s + 3 <= L; s += 4) t.cyl(V.add(a, V.mul(u, s)), V.add(a, V.mul(u, s + 3.2)), r - (s > 6 ? 3 : 0), 'fonte');
    },
  };
  return t;
}
export type Traceur = ReturnType<typeof traceur>;

// -----------------------------------------------------------------------------
// Éléments récurrents
// -----------------------------------------------------------------------------

/** Socle au sol : une poutre de `z0` à `z1`, une traverse à chaque bout. */
export function socle(t: Traceur, z0: number, z1: number, l0 = 50, l1 = 50): void {
  t.poutre([0, 3, z0], [0, 3, z1], 8, 6, 'cadre', [1, 0, 0]);
  t.poutre([-l0 / 2, 3, z0], [l0 / 2, 3, z0], 6, 6, 'cadre', [0, 0, 1]);
  t.poutre([-l1 / 2, 3, z1], [l1 / 2, 3, z1], 6, 6, 'cadre', [0, 0, 1]);
}

/** Siège : coussin dont le dessus est en `c`, sur un pied qui descend au sol. */
export function siege(t: Traceur, c: Vec3, demiLarge = 18, demiProf = 17): void {
  t.coussin(V.sub(c, [0, 3.5, 0]), [0, 0, demiProf], [0, 3.5, 0], demiLarge);
  t.poutre([c[0], 3, c[2]], [c[0], c[1] - 7, c[2]], 7, 7);
}

/**
 * Dossier : coussin qui part de `bas` (milieu de son bord bas, côté dos) et
 * monte de `longueur`, penché vers l'arrière de `inclinaison` degrés par
 * rapport à la verticale. Un appui le relie à `appui` (sur le châssis).
 */
export function dossier(t: Traceur, bas: Vec3, inclinaison: number, longueur: number, demiLarge: number, appui: Vec3 | null): void {
  const a = (inclinaison * Math.PI) / 180, dir: Vec3 = [0, Math.cos(a), -Math.sin(a)], n: Vec3 = [0, Math.sin(a), Math.cos(a)];
  const c = V.add(V.sub(bas, V.mul(n, 3.5)), V.mul(dir, longueur / 2));
  t.coussin(c, V.mul(dir, longueur / 2), V.mul(n, 3.5), demiLarge);
  if (appui !== null) t.poutre(V.sub(V.add(bas, V.mul(dir, longueur * 0.45)), V.mul(n, 7)), appui, 6, 5);
}

/**
 * Tour de charge : deux montants, la pile entre eux, une traverse en haut,
 * dans le plan `z`. Rend le haut de la tige de sélection.
 */
export function tourCharge(t: Traceur, z: number, haut: number, plaques: number, levee: number, x = 0): Vec3 {
  for (const s of [-19, 19]) t.poutre([x + s, 4, z], [x + s, haut + 3, z], 6, 6);
  t.poutre([x - 22, haut, z], [x + 22, haut, z], 6, 6, 'cadre', [0, 0, 1]);
  t.poutre([x - 28, 3, z], [x + 28, 3, z], 6, 6, 'cadre', [0, 0, 1]);
  return t.pile([x, 4, z], plaques, haut - 6, levee);
}

/** Câble de la pile jusqu'à un point (par une poulie en haut de la tour). */
export function cablePile(t: Traceur, tige: Vec3, haut: number, vers: readonly Vec3[]): void {
  const roue: Vec3 = [tige[0], haut - 9, tige[2]];
  t.roue(roue, 3.2);
  t.cable([tige, roue, ...vers]);
}

/** Poignée : manchon de mousse de `demi` cm de part et d'autre de `c`, le long de `axe`. */
export function poignee(t: Traceur, c: Vec3, axe: Vec3, demi = 7): void {
  t.cyl(V.sub(c, V.mul(axe, demi + 1.5)), V.add(c, V.mul(axe, demi + 1.5)), 1.4, 'metal');
  t.cyl(V.sub(c, V.mul(axe, demi)), V.add(c, V.mul(axe, demi)), 2, 'coussin');
}

// -----------------------------------------------------------------------------
// Prises au bout d'un câble
// -----------------------------------------------------------------------------

/**
 * Ce que les mains tiennent au bout d'un câble. La pièce passe dans le poing :
 * elle suit les mains, et le câble suit la pièce.
 */
export type Prise =
  | { readonly type: 'poignee'; readonly main: 'poignetG' | 'poignetD' }
  | { readonly type: 'corde' }
  /** Barre droite, les deux mains dessus. */
  | { readonly type: 'barre'; readonly longueur: number }
  /** Triangle (prise serrée, paumes face à face), les deux mains dessus. */
  | { readonly type: 'triangle' };

/** Centre du poing (là où passe une poignée) et axe de la poignée, dans l'espace. */
export function poing(F: Reperes, main: string): { g: Vec3; ax: Vec3 } {
  const p = repereDe(F, main);
  return { g: V.add(p.o, M.vec(p.R, [0, -PRISE, 0])), ax: M.vec(p.R, [0, 0, 1]) };
}

/**
 * La pièce tenue au bout d'un câble, et le câble jusqu'à la poulie `depart`
 * (dans l'espace). Rend la longueur de câble sortie de la poulie : quand elle
 * s'allonge, la charge monte d'autant.
 */
export function prise(out: Volume[], F: Reperes, p: Prise, depart: Vec3): number {
  const m = traceur(out, { o: [0, 0, 0], R: IDENTITE });
  let attache: Vec3;
  if (p.type === 'poignee') {
    // Poignée en D : la barre dans le poing, l'arceau vers le câble.
    const { g, ax } = poing(F, p.main), d = V.norm(V.sub(depart, g));
    const a = V.add(g, V.mul(ax, 5.8)), b = V.sub(g, V.mul(ax, 5.8));
    attache = V.add(g, V.mul(d, 10));
    m.cyl(b, a, 1.5, 'metal');
    m.cyl(a, attache, 0.8, 'metal');
    m.cyl(b, attache, 0.8, 'metal');
  } else {
    const G = poing(F, 'poignetG').g, Dr = poing(F, 'poignetD').g, mil = V.mul(V.add(G, Dr), 0.5);
    const d = V.norm(V.sub(depart, mil)), demi = V.len(V.sub(G, Dr)) / 2;
    if (p.type === 'corde') {
      // Deux brins de 30 cm qui se rejoignent à l'attache : la corde s'ouvre quand les mains s'écartent.
      attache = V.add(mil, V.mul(d, Math.sqrt(Math.max(30 * 30 - demi * demi, 16))));
      for (const g of [G, Dr]) {
        const u = V.norm(V.sub(attache, g));
        m.cyl(V.sub(g, V.mul(u, 5)), attache, 1.3, 'fonte');
        m.boule(V.sub(g, V.mul(u, 6.5)), 2.3, 'fonte');
      }
    } else if (p.type === 'triangle') {
      // Deux poignées parallèles, réunies en pointe vers le câble.
      attache = V.add(mil, V.mul(d, 16));
      const u = V.norm(V.sub(G, Dr));
      for (const g of [G, Dr]) {
        const ax = V.norm(V.cross(u, V.cross(d, u)));
        m.cyl(V.sub(g, V.mul(ax, 6)), V.add(g, V.mul(ax, 6)), 1.6, 'metal');
        m.cyl(V.add(g, V.mul(ax, 6)), attache, 1, 'metal');
      }
      m.cyl(V.sub(G, V.mul(V.norm(V.cross(u, V.cross(d, u))), 6)), V.sub(Dr, V.mul(V.norm(V.cross(u, V.cross(d, u))), 6)), 1, 'metal');
    } else {
      const u = V.norm(V.sub(G, Dr)), L = p.longueur / 2;
      m.cyl(V.sub(mil, V.mul(u, L)), V.add(mil, V.mul(u, L)), 1.3, 'metal');
      attache = V.add(mil, V.mul(d, 5));
      m.cyl(mil, attache, 0.9, 'metal');
    }
  }
  m.boule(attache, 1.5, 'metal');
  m.cyl(attache, depart, 0.4, 'metal');
  return V.len(V.sub(attache, depart));
}
