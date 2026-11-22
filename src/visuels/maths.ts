/**
 * Vecteurs et rotations pour le moteur de visuels d'exercice.
 *
 * Repère du mannequin : X = sa gauche, Y = le haut, Z = devant lui. Unité : le
 * centimètre (mannequin de 180 cm). Une matrice 3×3 est rangée ligne par ligne ;
 * ses colonnes sont les images des trois axes.
 */

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly number[];

export const RAD = Math.PI / 180;
export const TAU = Math.PI * 2;
export const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/**
 * Valeur à l'avancement `t` (0 à 1) d'une suite de valeurs réparties à intervalles
 * égaux (une par pose clé). Courbe lisse qui passe par chaque valeur : pas de
 * cassure de vitesse au passage d'une pose clé (le mouvement saccaderait), et pas
 * de dépassement (une valeur qui monte puis reste ne redescend pas en chemin, un
 * pied ne s'enfonce pas dans le sol). Avec deux valeurs, c'est une droite.
 */
export function interpoler(v: readonly number[], t: number): number {
  const n = v.length;
  if (n === 0) return 0;
  if (n === 1) return v[0]!;
  const x = clamp(t, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(x)), u = x - i;
  const pente = (k: number): number => v[k + 1]! - v[k]!;
  const tangente = (k: number): number => {
    if (k === 0) return pente(0);
    if (k === n - 1) return pente(n - 2);
    const d0 = pente(k - 1), d1 = pente(k);
    if (d0 * d1 <= 0) return 0;
    // Moyenne des pentes, bornée pour que la courbe reste monotone entre deux valeurs.
    const m = (d0 + d1) / 2, lim = 3 * Math.min(Math.abs(d0), Math.abs(d1));
    return Math.sign(m) * Math.min(Math.abs(m), lim);
  };
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v[i]! + (u3 - 2 * u2 + u) * tangente(i) + (-2 * u3 + 3 * u2) * v[i + 1]! + (u3 - u2) * tangente(i + 1);
}

export const V = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

export const IDENTITE: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const M = {
  mul(A: Mat3, B: Mat3): Mat3 {
    const o = new Array<number>(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        o[i * 3 + j] = A[i * 3]! * B[j]! + A[i * 3 + 1]! * B[3 + j]! + A[i * 3 + 2]! * B[6 + j]!;
      }
    }
    return o;
  },
  vec: (A: Mat3, v: Vec3): Vec3 => [
    A[0]! * v[0] + A[1]! * v[1] + A[2]! * v[2],
    A[3]! * v[0] + A[4]! * v[1] + A[5]! * v[2],
    A[6]! * v[0] + A[7]! * v[1] + A[8]! * v[2],
  ],
  transposee: (A: Mat3): Mat3 => [A[0]!, A[3]!, A[6]!, A[1]!, A[4]!, A[7]!, A[2]!, A[5]!, A[8]!],
  depuisColonnes: (x: Vec3, y: Vec3, z: Vec3): Mat3 => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]],
  /** Rotations autour des axes, en degrés. */
  rx(d: number): Mat3 {
    const c = Math.cos(d * RAD), s = Math.sin(d * RAD);
    return [1, 0, 0, 0, c, -s, 0, s, c];
  },
  ry(d: number): Mat3 {
    const c = Math.cos(d * RAD), s = Math.sin(d * RAD);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  },
  rz(d: number): Mat3 {
    const c = Math.cos(d * RAD), s = Math.sin(d * RAD);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  },
  /** Rotation d'angle `a` (radians) autour de l'axe unitaire `k`. */
  axe(k: Vec3, a: number): Mat3 {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = k;
    return [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c,
    ];
  },
  /** Orientation intermédiaire entre A et B (t = 0 → A, t = 1 → B). */
  entre(A: Mat3, B: Mat3, t: number): Mat3 {
    const R = M.mul(M.transposee(A), B);
    const ang = Math.acos(clamp((R[0]! + R[4]! + R[8]! - 1) / 2, -1, 1));
    const s = Math.sin(ang);
    if (ang < 1e-6 || s < 1e-6) return t < 0.5 ? A : B;
    const k: Vec3 = [(R[7]! - R[5]!) / (2 * s), (R[2]! - R[6]!) / (2 * s), (R[3]! - R[1]!) / (2 * s)];
    return M.mul(A, M.axe(V.norm(k), ang * t));
  },
};
