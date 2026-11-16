/**
 * Ébauche depuis une photo : des points tirés d'une pose connue du mannequin,
 * vus sous un angle quelconque, redonnent cette pose.
 */

import { describe, expect, it } from 'vitest';

import { POINTS, ebaucher, piedsAuSol, piedsImmobiles } from '@/visuels/ebauche';
import type { PointDetecte } from '@/visuels/ebauche';
import { M, V } from '@/visuels/maths';
import { OS, pose, resoudre } from '@/visuels/squelette';
import type { Pose } from '@/visuels/squelette';

/** Les 33 points MediaPipe d'une pose du mannequin, photographiée depuis l'angle `tour`. */
function photographier(p: Pose, tour: number, visibilite: (i: number) => number = () => 1): PointDetecte[] {
  const F = resoudre(p), points: PointDetecte[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const vers = M.ry(-tour);
  for (const [nom, [g, d]] of Object.entries(POINTS)) {
    for (const [c, i] of [['G', g], ['D', d]] as const) {
      const r = M.vec(vers, F[nom + c]!.o);
      points[i] = { x: r[0] / 100, y: -r[1] / 100, z: -r[2] / 100, visibility: visibilite(i) };
    }
  }
  return points;
}

const TRONC = { bassin: { bascule: 21 }, lombaires: { flex: 4.5 }, thorax: { flex: 4.5 } };

describe('visuels — ébauche depuis une photo', () => {
  const modele = pose({
    ...TRONC,
    bras: { epaule: { flex: 40, abd: 25, rot: 20 }, coude: 60 },
    jambe: { hanche: { flex: 50, abd: 10, rot: 10 }, genou: 70 },
  });

  for (const tour of [0, 70, 150, -100]) {
    it(`retrouve les angles d'une pose vue sous ${tour}°`, () => {
      const e = ebaucher(photographier(modele, tour), false);
      expect(e.tourCamera).toBeCloseTo(tour, 3);
      expect(e.pose.bassin.bascule).toBeCloseTo(21, 2);
      expect(e.pose.lombaires.flex).toBeCloseTo(4.5, 2);
      for (const c of ['G', 'D'] as const) {
        const b = e.pose[`bras${c}`], j = e.pose[`jambe${c}`];
        expect(b.epaule.flex).toBeCloseTo(40, 2);
        expect(b.epaule.abd).toBeCloseTo(25, 2);
        expect(b.epaule.rot).toBeCloseTo(20, 2);
        expect(b.coude).toBeCloseTo(60, 2);
        expect(j.hanche.flex).toBeCloseTo(50, 2);
        expect(j.hanche.abd).toBeCloseTo(10, 2);
        expect(j.hanche.rot).toBeCloseTo(10, 2);
        expect(j.genou).toBeCloseTo(70, 2);
      }
    });
  }

  it('le pied le plus bas touche le sol', () => {
    const F = resoudre(ebaucher(photographier(modele, 30), false).pose);
    expect(Math.min(F.chevilleG!.o[1], F.chevilleD!.o[1])).toBeCloseTo(OS.cheville, 6);
  });

  it('symétrique : le membre caché compte peu', () => {
    const asym = pose({ ...TRONC, brasG: { epaule: { flex: 30, abd: 10, rot: 0 }, coude: 50 }, brasD: { epaule: { flex: 80, abd: 10, rot: 0 }, coude: 10 } });
    const cache = (i: number): number => (i % 2 === 0 ? 0 : 1); // indices pairs = côté droit
    const e = ebaucher(photographier(asym, 90, cache), true);
    expect(e.pose.brasD.coude).toBeCloseTo(e.pose.brasG.coude, 6);
    expect(Math.abs(e.pose.brasG.epaule.flex - 30)).toBeLessThan(3);
    expect(Math.abs(e.pose.brasG.coude - 50)).toBeLessThan(3);
  });

  it('les pieds sont immobiles si les chevilles ne bougent pas sur l\'image', () => {
    const photo = (cheville: number): PointDetecte[] =>
      Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: i === 27 || i === 28 ? cheville : 0.3, z: 0 }));
    expect(piedsImmobiles(photo(0.9), photo(0.91))).toBe(true);
    expect(piedsImmobiles(photo(0.9), photo(0.7))).toBe(false);
  });

  it('pieds au sol : d\'une pose clé à l\'autre, les pieds ne glissent pas', () => {
    const depart = ebaucher(photographier(pose({ jambe: { hanche: { flex: 10, abd: 8, rot: 0 }, genou: 15 } }), 40), true).pose;
    const arrivee = ebaucher(photographier(modele, 40), true).pose;
    const a = piedsAuSol(depart), b = piedsAuSol(arrivee, a.pieds);
    const Fa = resoudre(a.pose), Fb = resoudre(b.pose);
    for (const c of ['G', 'D'] as const) {
      expect(Fa[`cheville${c}`]!.o[1]).toBeCloseTo(OS.cheville, 6);
      expect(V.len(V.sub(Fa[`cheville${c}`]!.o, Fb[`cheville${c}`]!.o))).toBeLessThan(1e-6);
    }
  });
});
