/**
 * Scène : un sujet (un exercice posé), à un instant du mouvement, devient un
 * maillage prêt à dessiner. C'est le point d'entrée du moteur pour la fiche
 * d'exercice comme pour l'atelier.
 */

import { V } from './maths';
import type { Vec3 } from './maths';
import { AXE, SOL, mesurerCadre } from './camera';
import type { Cadre } from './camera';
import { geomMuscle, geomOs } from './corps';
import type { Corps, PieceMuscle } from './corps';
import { Maillage, ajouterBoule, ajouterCylindre, ajouterFuseau, ajouterPave } from './maillage';
import { coursesMateriel, etendue, reperesMateriel, volumesMateriel } from './materiel';
import type { Piece } from './materiel';
import { poseAu, resoudre } from './squelette';
import type { Pose, Reperes } from './squelette';
import { STYLE, tonMuscle } from './style';

/** Un exercice posé : tout ce que le moteur doit savoir pour l'animer. */
export interface PoseExercice {
  /** Identifiant de l'exercice dans le catalogue (`exercises.json`). */
  readonly id: string;
  /** Angle de vue par défaut : celui qui montre le mieux le mouvement. */
  readonly camera: { readonly tour: number; readonly hauteur: number };
  /** Mains fermées sur une prise. */
  readonly mainFermee: boolean;
  /** Poses clés : la première est le départ, la dernière l'arrivée. */
  readonly cles: readonly Pose[];
  readonly materiel: readonly Piece[];
  /** Validée par Azur : tant que c'est faux, la fiche garde ses photos. */
  readonly valide: boolean;
  /**
   * Durée d'un cycle (aller et retour), en multiples de la durée ordinaire ;
   * absente : 1. Un exercice qui fait deux répétitions par cycle (curl
   * alterné : un bras à l'aller, l'autre au retour) en demande plus.
   */
  readonly duree?: number;
  /**
   * Exercice à un bras ou une jambe : le côté qui travaille (`G` ou `D`).
   * Seuls ses muscles sont colorés ; absent, les deux côtés le sont.
   */
  readonly cote?: 'G' | 'D';
  /**
   * La phase d'effort (celle où l'on pousse ou tire la charge), un peu plus lente
   * que l'autre pour qu'on la reconnaisse : `aller` (du départ à l'arrivée) ou
   * `retour`. Absente : aller et retour à la même vitesse.
   */
  readonly effort?: 'aller' | 'retour';
}

/**
 * Coefficient de travail d'une pièce musculaire (1, 0,5, ou rien : ton d'un
 * muscle au repos). Une pièce neutre (avant-bras, tibial, rotule…) n'en a
 * pas. Un exercice à un seul côté (`cote`) ne colore que les pièces de ce
 * côté (leur identifiant finit par G ou D).
 */
export function coefficientPiece(
  m: Pick<PieceMuscle, 'id' | 'muscle'>,
  cote: PoseExercice['cote'],
  coefficients: Readonly<Record<string, number>>,
): number | undefined {
  if (m.muscle === null) return undefined;
  if (cote !== undefined && m.id.endsWith(cote === 'G' ? 'D' : 'G')) return undefined;
  return coefficients[m.muscle];
}

/** Durée d'un cycle de cet exercice, en millisecondes. */
export const periodeDe = (sujet: Pick<PoseExercice, 'duree'>): number => STYLE.periode * (sujet.duree ?? 1);

/**
 * Avancement du mouvement (0 = départ, 1 = arrivée) pour une phase du cycle
 * (0 à 1) : pause au départ, aller, pause à l'arrivée, retour (la phase d'effort,
 * si l'exercice la nomme, un peu plus lente).
 */
export function avancement(phase: number, effort?: PoseExercice['effort']): number {
  const doux = (t: number): number => t * t * (3 - 2 * t);
  const p = ((phase % 1) + 1) % 1;
  // Pauses de 0,12 au départ et à l'arrivée ; la phase d'effort prend 0,46 du cycle, l'autre 0,30 : l'effort
  // se reconnaît (une fois et demie plus lent) sans que le retour soit jeté.
  const aller = effort === 'aller' ? 0.46 : effort === 'retour' ? 0.3 : 0.38, retour = 0.76 - aller;
  if (p < 0.12) return 0;
  if (p < 0.12 + aller) return doux((p - 0.12) / aller);
  if (p < 0.24 + aller) return 1;
  return doux(1 - (p - 0.24 - aller) / retour);
}

// Courses au départ, par sujet : calculées une fois (le sujet ne change pas d'une image à l'autre).
const reposCalcules = new WeakMap<readonly Pose[], WeakMap<readonly Piece[], readonly number[]>>();

/** Repères du corps et du matériel à l'instant `t` du mouvement. */
export function reperesAu(sujet: Pick<PoseExercice, 'cles' | 'materiel'>, t: number): Reperes {
  return resoudre(poseAu(sujet.cles, t), (tronc) => reperesMateriel(sujet.materiel, tronc, t));
}

/**
 * Course de la charge de chaque pièce au départ du mouvement : la charge y
 * est posée ; ailleurs, elle monte de l'écart.
 */
export function reposMateriel(sujet: Pick<PoseExercice, 'cles' | 'materiel'>): readonly number[] {
  let parCles = reposCalcules.get(sujet.cles);
  if (parCles === undefined) reposCalcules.set(sujet.cles, (parCles = new WeakMap()));
  let repos = parCles.get(sujet.materiel);
  if (repos === undefined) {
    repos = coursesMateriel(sujet.materiel, reperesAu(sujet, 0), 0);
    parCles.set(sujet.materiel, repos);
  }
  return repos;
}

/** Cadre d'un sujet : la place qu'il occupe pendant tout son mouvement. */
export function mesurerSujet(corps: Corps, sujet: Pick<PoseExercice, 'cles' | 'materiel'>): Cadre {
  const pts: { p: Vec3; r: number }[] = [];
  for (const t of [0, 0.5, 1]) {
    const F = reperesAu(sujet, t);
    for (const os of corps.os) {
      const g = geomOs(os, F);
      for (const st of [g.st[0]!, g.st[g.st.length >> 1]!, g.st[g.st.length - 1]!]) {
        pts.push({ p: V.add(g.O, V.mul(g.A, st.u * g.L)), r: Math.max(st.a, st.b) + 3 });
      }
    }
    for (const v of volumesMateriel(sujet.materiel, F, t, reposMateriel(sujet))) pts.push(...etendue(v));
  }
  return mesurerCadre(pts);
}

/**
 * Remplit le maillage : le sol, puis le corps, ses muscles et le matériel.
 * `coefficients` : muscles travaillés, tels que le catalogue les donne
 * (identifiant du muscle → 1 ou 0,5). Rend l'indice où finit le sol (le sol
 * n'a pas de trait de contour).
 */
export function construireScene(
  mesh: Maillage,
  corps: Corps,
  sujet: Pick<PoseExercice, 'cles' | 'materiel' | 'cote'>,
  t: number,
  coefficients: Readonly<Record<string, number>>,
): number {
  const F = reperesAu(sujet, t);
  mesh.vider();
  ajouterFuseau(mesh, {
    O: [AXE[0], -0.4, AXE[1]], X: [1, 0, 0], A: [0, 1, 0], Z: [0, 0, 1], L: 0.4,
    st: [0, 1].map((u) => ({ u, a: SOL, b: SOL, cx: 0, cz: 0, cr: 0 })),
  }, STYLE.sol, 0, 48);
  const finSol = mesh.ni;
  for (const os of corps.os) {
    const g = geomOs(os, F), ton = STYLE[os.ton];
    ajouterFuseau(mesh, g, ton);
    if (g.bouts !== null) {
      const premier = g.st[0]!, dernier = g.st[g.st.length - 1]!;
      ajouterBoule(mesh, V.add(V.add(g.O, V.mul(g.X, premier.cx)), V.mul(g.Z, premier.cz)), g.bouts[0], ton);
      ajouterBoule(mesh, V.add(V.add(V.add(g.O, V.mul(g.A, g.L)), V.mul(g.X, dernier.cx)), V.mul(g.Z, dernier.cz)), g.bouts[1], ton);
    }
  }
  for (const m of corps.muscles) {
    ajouterFuseau(mesh, geomMuscle(m, F), tonMuscle(coefficientPiece(m, sujet.cote, coefficients)));
  }
  for (const v of volumesMateriel(sujet.materiel, F, t, reposMateriel(sujet))) {
    if (v.forme === 'cylindre') ajouterCylindre(mesh, v.p0, v.p1, v.r, STYLE[v.ton]);
    else if (v.forme === 'boule') ajouterBoule(mesh, v.centre, v.r, STYLE[v.ton]);
    else ajouterPave(mesh, v.centre, v.dx, v.dy, v.dz, STYLE[v.ton], 1, v.arrondi);
  }
  return finSol;
}
