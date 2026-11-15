/**
 * Caméra et cadrage.
 *
 * Projection orthographique (pas de perspective). `tour` : la caméra tourne
 * autour du mannequin (0° = de face, 90° = elle voit son côté gauche, 180° =
 * de dos). `hauteur` : elle monte et regarde vers le bas. La lumière est fixe
 * par rapport à la caméra (en haut à gauche, un peu vers nous) : le relief ne
 * change pas de caractère quand on tourne.
 */

import { RAD, V } from './maths';
import type { Vec3 } from './maths';

export interface Camera {
  /** Vers la droite de l'image, vers le haut de l'image, vers la caméra. */
  readonly R: Vec3;
  readonly U: Vec3;
  readonly V: Vec3;
  readonly lumiere: Vec3;
  /** Position à l'écran d'un point de l'espace (x vers la droite, y vers le haut). */
  readonly p: (P: Vec3) => readonly [number, number];
}

export function camera(tour: number, hauteur: number): Camera {
  const cy = Math.cos(tour * RAD), sy = Math.sin(tour * RAD), cp = Math.cos(hauteur * RAD), sp = Math.sin(hauteur * RAD);
  const Vc: Vec3 = [sy * cp, sp, cy * cp], R: Vec3 = [cy, 0, -sy], U = V.cross(Vc, R);
  const l = V.norm([-0.5, 0.75, 0.55]);
  return {
    R, U, V: Vc,
    lumiere: V.add(V.add(V.mul(R, l[0]), V.mul(U, l[1])), V.mul(Vc, l[2])),
    p: (P) => [V.dot(P, R), V.dot(P, U)],
  };
}

/** Rayon du disque de sol, et position (x, z) de l'axe autour duquel tourne la caméra. */
export const SOL = 44;
export const AXE: readonly [number, number] = [0, 4];

/**
 * La place qu'occupe un sujet autour de l'axe de la caméra, pendant tout son
 * mouvement. La caméra tourne autour d'un axe vertical planté au centre du
 * sol, comme autour d'un plateau tournant : le sujet reste ainsi centré, à la
 * même taille, quel que soit l'angle.
 */
export interface Cadre {
  readonly pivot: Vec3;
  /** Plus grande distance à l'axe. */
  readonly rayon: number;
  readonly demiHaut: number;
}

/** Mesure le cadre à partir de points (avec leur rayon) relevés tout au long du mouvement. */
export function mesurerCadre(points: Iterable<{ readonly p: Vec3; readonly r: number }>): Cadre {
  let rayon = SOL, bas = 0, haut = 0;
  for (const { p, r } of points) {
    rayon = Math.max(rayon, Math.hypot(p[0] - AXE[0], p[2] - AXE[1]) + r);
    bas = Math.min(bas, p[1] - r);
    haut = Math.max(haut, p[1] + r);
  }
  return { pivot: [AXE[0], (bas + haut) / 2, AXE[1]], rayon, demiHaut: (haut - bas) / 2 };
}

/** Centre de l'image et demi-côté (en cm), pour cette caméra. */
export function cadrer(c: Cadre, cam: Camera, hauteur: number): { centre: readonly [number, number]; demi: number } {
  const h = Math.abs(hauteur) * RAD;
  return { centre: cam.p(c.pivot), demi: Math.max(c.rayon, c.demiHaut * Math.cos(h) + c.rayon * Math.sin(h)) + 4 };
}
