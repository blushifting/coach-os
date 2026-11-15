/**
 * Maillage : chaque volume (fuseau, boule, cylindre, pavé) devient des
 * triangles. La carte graphique décide ensuite, pixel par pixel, quelle
 * surface est devant ; c'est ce qui permet à des muscles de s'emboîter sans
 * qu'aucun ne « saute » devant l'autre pendant le mouvement.
 */

import { TAU, V } from './maths';
import type { Vec3 } from './maths';
import type { Fuseau, Section } from './corps';
import { sections } from './corps';

export type Couleur = readonly [number, number, number];

/** Nombre de valeurs par sommet : position (3), normale (3), couleur (3), part de relief (1). */
export const PAR_SOMMET = 10;

/** Un sac de triangles, réutilisé d'une image à l'autre. */
export class Maillage {
  readonly s: Float32Array;
  readonly i: Uint16Array;
  ns = 0;
  ni = 0;

  constructor(maxSommets = 60000, maxIndices = 360000) {
    this.s = new Float32Array(maxSommets * PAR_SOMMET);
    this.i = new Uint16Array(maxIndices);
  }

  vider(): void {
    this.ns = 0;
    this.ni = 0;
  }

  /** `relief` : 1 = surface éclairée, 0 = couleur à plat. */
  sommet(p: ArrayLike<number>, n: ArrayLike<number>, c: Couleur, relief: number): number {
    const k = this.ns * PAR_SOMMET, s = this.s;
    s[k] = p[0]!; s[k + 1] = p[1]!; s[k + 2] = p[2]!;
    s[k + 3] = n[0]!; s[k + 4] = n[1]!; s[k + 5] = n[2]!;
    s[k + 6] = c[0] / 255; s[k + 7] = c[1] / 255; s[k + 8] = c[2] / 255; s[k + 9] = relief;
    return this.ns++;
  }

  triangle(a: number, b: number, c: number): void {
    this.i[this.ni++] = a;
    this.i[this.ni++] = b;
    this.i[this.ni++] = c;
  }
}

const GRILLE = new Float32Array(64 * 48 * 3);

/**
 * Ajoute un fuseau au maillage. `tour` : nombre de points autour de chaque
 * section. Les bouts ouverts (section non nulle) sont fermés par un disque.
 */
export function ajouterFuseau(mesh: Maillage, g: Omit<Fuseau, 'bouts'>, rgb: Couleur, relief = 1, tour = 14): void {
  const { O, X, A, Z, L, st } = g;
  // Sens dans lequel tourner les triangles pour que leur face regarde dehors.
  const sens = V.dot(V.cross(X, A), Z) < 0;
  const n0 = st.length, P = GRILLE, base = mesh.ns;
  // 1. Les points. `cr` rabat les bords de la section vers le corps.
  for (let i = 0; i < n0; i++) {
    const s = st[i]!, al = s.u * L;
    for (let j = 0; j < tour; j++) {
      const th = (j * TAU) / tour, c = Math.cos(th), sn = Math.sin(th);
      const ex = s.cx + s.a * c, ez = s.cz + s.b * sn - s.cr * c * c, k = (i * tour + j) * 3;
      P[k] = O[0] + A[0] * al + X[0] * ex + Z[0] * ez;
      P[k + 1] = O[1] + A[1] * al + X[1] * ex + Z[1] * ez;
      P[k + 2] = O[2] + A[2] * al + X[2] * ex + Z[2] * ez;
    }
  }
  // 2. Les normales, d'après les points voisins sur la grille.
  const p = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < n0; i++) {
    const im = Math.max(0, i - 1), ip = Math.min(n0 - 1, i + 1);
    for (let j = 0; j < tour; j++) {
      const k = (i * tour + j) * 3, kg = (i * tour + ((j + tour - 1) % tour)) * 3, kd = (i * tour + ((j + 1) % tour)) * 3;
      const kh = (im * tour + j) * 3, kb = (ip * tour + j) * 3;
      const tx = P[kd]! - P[kg]!, ty = P[kd + 1]! - P[kg + 1]!, tz = P[kd + 2]! - P[kg + 2]!;
      const ux = P[kb]! - P[kh]!, uy = P[kb + 1]! - P[kh + 1]!, uz = P[kb + 2]! - P[kh + 2]!;
      n[0] = ty * uz - tz * uy; n[1] = tz * ux - tx * uz; n[2] = tx * uy - ty * ux;
      if (!sens) { n[0] = -n[0]!; n[1] = -n[1]!; n[2] = -n[2]!; }
      const l = Math.hypot(n[0]!, n[1]!, n[2]!);
      if (l < 1e-7) {
        // Pointe du fuseau : tous les points de la section sont confondus.
        const d = i < n0 / 2 ? -1 : 1;
        n[0] = A[0] * d; n[1] = A[1] * d; n[2] = A[2] * d;
      } else {
        n[0] = n[0]! / l; n[1] = n[1]! / l; n[2] = n[2]! / l;
      }
      p[0] = P[k]!; p[1] = P[k + 1]!; p[2] = P[k + 2]!;
      mesh.sommet(p, n, rgb, relief);
    }
  }
  for (let i = 0; i < n0 - 1; i++) {
    for (let j = 0; j < tour; j++) {
      const a = base + i * tour + j, b = base + i * tour + ((j + 1) % tour), c = a + tour, d = b + tour;
      if (sens) { mesh.triangle(a, b, c); mesh.triangle(b, d, c); } else { mesh.triangle(a, c, b); mesh.triangle(b, c, d); }
    }
  }
  // 3. Disques de fermeture, aux bouts qui ne finissent pas en pointe.
  for (const [i, d] of [[0, -1], [n0 - 1, 1]] as const) {
    const s = st[i]!;
    if (s.a < 0.05 || s.b < 0.05) continue;
    const nn = V.mul(A, d), al = s.u * L;
    const centre = mesh.sommet(
      [O[0] + A[0] * al + X[0] * s.cx + Z[0] * s.cz, O[1] + A[1] * al + X[1] * s.cx + Z[1] * s.cz, O[2] + A[2] * al + X[2] * s.cx + Z[2] * s.cz],
      nn, rgb, relief,
    );
    const b0 = mesh.ns;
    for (let j = 0; j < tour; j++) {
      const k = (i * tour + j) * 3;
      mesh.sommet([P[k]!, P[k + 1]!, P[k + 2]!], nn, rgb, relief);
    }
    for (let j = 0; j < tour; j++) {
      const a = b0 + j, b = b0 + ((j + 1) % tour);
      if (sens === d > 0) mesh.triangle(centre, a, b); else mesh.triangle(centre, b, a);
    }
  }
}

const rond = (r: number): Omit<Section, 'u'> => ({ a: r, b: r, cx: 0, cz: 0, cr: 0 });
const BOULE = sections(8, (u) => rond(Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))));

/** Boule (articulation). */
export function ajouterBoule(mesh: Maillage, centre: Vec3, r: number, rgb: Couleur, relief = 1): void {
  ajouterFuseau(mesh, {
    O: [centre[0], centre[1] + r, centre[2]], X: [1, 0, 0], A: [0, -1, 0], Z: [0, 0, 1], L: 2 * r,
    st: BOULE.map((s) => ({ ...s, a: s.a * r, b: s.b * r })),
  }, rgb, relief, 12);
}

/** Deux directions perpendiculaires à un axe (et entre elles). */
function travers(A: Vec3): [Vec3, Vec3] {
  const X = V.norm(V.cross(A, Math.abs(A[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return [X, V.cross(A, X)];
}

/** Cylindre plein de p0 à p1. */
export function ajouterCylindre(mesh: Maillage, p0: Vec3, p1: Vec3, r: number, rgb: Couleur, relief = 1): void {
  const ax = V.sub(p1, p0), L = V.len(ax), A = V.mul(ax, 1 / L), [X, Z] = travers(A);
  const st: Section[] = [{ u: 0, ...rond(r) }, { u: 1, ...rond(r) }];
  ajouterFuseau(mesh, { O: p0, X, A, Z, L, st }, rgb, relief, r > 10 ? 36 : r > 3 ? 20 : 10);
}

/**
 * Pavé (banc, coussin, plateau) : `centre`, puis ses trois demi-axes, chacun
 * donné comme un vecteur (direction × demi-longueur). Arêtes vives.
 */
export function ajouterPave(mesh: Maillage, centre: Vec3, dx: Vec3, dy: Vec3, dz: Vec3, rgb: Couleur, relief = 1): void {
  const axes = [dx, dy, dz];
  for (let f = 0; f < 3; f++) {
    const u = axes[(f + 1) % 3]!, v = axes[(f + 2) % 3]!;
    for (const d of [1, -1]) {
      const w = V.mul(axes[f]!, d), n = V.norm(w), c = V.add(centre, w);
      const q = [
        V.sub(V.sub(c, u), v), V.sub(V.add(c, u), v), V.add(V.add(c, u), v), V.add(V.sub(c, u), v),
      ].map((pt) => mesh.sommet(pt, n, rgb, relief));
      // La face regarde dehors si (u × v) va dans le sens de sa normale.
      const dehors = V.dot(V.cross(u, v), w) > 0;
      if (dehors) { mesh.triangle(q[0]!, q[1]!, q[2]!); mesh.triangle(q[0]!, q[2]!, q[3]!); }
      else { mesh.triangle(q[0]!, q[2]!, q[1]!); mesh.triangle(q[0]!, q[3]!, q[2]!); }
    }
  }
}
