/**
 * Moteur de visuels d'exercice — calculs purs (le rendu WebGL se juge à l'œil,
 * dans l'atelier `visuels.html`).
 */

import { describe, expect, it } from 'vitest';

import { loadExercises } from '@/engine/catalog';
import { MUSCLES as MUSCLES_SUIVIS } from '@/engine/models';
import { cadrer, camera } from '@/visuels/camera';
import { MUSCLES, OSSATURE, construireCorps, geomMuscle, geomOs, profondeur } from '@/visuels/corps';
import { M, V } from '@/visuels/maths';
import type { Vec3 } from '@/visuels/maths';
import { Maillage, PAR_SOMMET, ajouterPave } from '@/visuels/maillage';
import { volumesMateriel } from '@/visuels/materiel';
import { POSES, poseValidee } from '@/visuels/poses';
import { REPOS } from '@/visuels/poses/repos';
import { avancement, construireScene, mesurerSujet } from '@/visuels/scene';
import { LIMITES, OS, deuxOs, pose, poseAu, resoudre } from '@/visuels/squelette';

const corps = construireCorps(1, false, REPOS);
const sommet = (mesh: Maillage, i: number): { p: Vec3; n: Vec3 } => {
  const k = i * PAR_SOMMET, s = mesh.s;
  return { p: [s[k]!, s[k + 1]!, s[k + 2]!], n: [s[k + 3]!, s[k + 4]!, s[k + 5]!] };
};

describe('visuels — maths', () => {
  it('une rotation garde les longueurs et les angles droits', () => {
    const R = M.mul(M.mul(M.ry(37), M.rx(-52)), M.rz(110));
    const x = M.vec(R, [1, 0, 0]), y = M.vec(R, [0, 1, 0]), z = M.vec(R, [0, 0, 1]);
    expect(V.len(x)).toBeCloseTo(1, 9);
    expect(V.dot(x, y)).toBeCloseTo(0, 9);
    expect(V.dot(V.cross(x, y), z)).toBeCloseTo(1, 9);
  });

  it('l\'orientation intermédiaire est à mi-chemin', () => {
    const milieu = M.entre(M.rx(0), M.rx(80), 0.5), attendu = M.rx(40);
    milieu.forEach((v, i) => expect(v).toBeCloseTo(attendu[i]!, 9));
  });
});

describe('visuels — squelette', () => {
  it('au repos, le mannequin est symétrique et ses pieds sont au sol', () => {
    const F = resoudre(REPOS);
    expect(F.chevilleG!.o[1]).toBeCloseTo(OS.cheville, 6);
    expect(F.chevilleD!.o[1]).toBeCloseTo(OS.cheville, 6);
    for (const nom of ['epaule', 'coude', 'poignet', 'hanche', 'genou', 'cheville']) {
      const g = F[nom + 'G']!.o, d = F[nom + 'D']!.o;
      expect(d[0]).toBeCloseTo(-g[0], 6);
      expect(d[1]).toBeCloseTo(g[1], 6);
      expect(d[2]).toBeCloseTo(g[2], 6);
    }
  });

  it('deux os atteignent une cible à portée, en gardant leurs longueurs', () => {
    const S: Vec3 = [0, 100, 0], T: Vec3 = [20, 70, 15];
    const k = deuxOs(S, T, 30, 26, [0, 0, -1], -1, 150);
    expect(V.len(V.sub(k.E, T))).toBeLessThan(1e-9);
    expect(V.len(V.sub(k.J, S))).toBeCloseTo(30, 9);
    expect(V.len(V.sub(k.E, k.J))).toBeCloseTo(26, 9);
    // Le coude part du côté du pôle (vers l'arrière).
    expect(k.J[2]).toBeLessThan(0);
  });

  it('une cible hors de portée est ramenée à portée, sans dépasser la flexion maximale', () => {
    const loin = deuxOs([0, 0, 0], [0, -200, 0], 30, 26, [0, 0, 1], 1, 150);
    expect(V.len(loin.E)).toBeLessThanOrEqual(56);
    const pres = deuxOs([0, 0, 0], [0, -1, 0], 30, 26, [0, 0, 1], 1, 150);
    const pli = Math.acos(V.dot(V.norm(pres.J), V.norm(V.sub(pres.E, pres.J)))) * (180 / Math.PI);
    expect(pli).toBeLessThanOrEqual(150 + 1e-6);
  });

  it('un angle hors limite est ramené dans la limite (un coude ne plie pas à l\'envers)', () => {
    const plie = resoudre(pose({ bras: { coude: 400 } })), limite = resoudre(pose({ bras: { coude: LIMITES.coude[1] } }));
    expect(V.len(V.sub(plie.poignetG!.o, limite.poignetG!.o))).toBeLessThan(1e-9);
    const envers = resoudre(pose({ bras: { coude: -40 } })), tendu = resoudre(pose({ bras: { coude: 0 } }));
    expect(V.len(V.sub(envers.poignetG!.o, tendu.poignetG!.o))).toBeLessThan(1e-9);
  });

  it('une pose symétrique décrit le bras droit comme le miroir du gauche', () => {
    const p = pose({ bras: { cible: { repere: 'thorax', pos: [40, 19, -9], pole: [0.3, -1, -0.5] } } });
    expect(p.brasD.cible!.pos[0]).toBe(-40);
    expect(p.brasD.cible!.pole[0]).toBe(-0.3);
  });

  it('entre deux poses clés, les angles sont interpolés', () => {
    const a = pose({ bras: { epaule: { abd: 10 } } }), b = pose({ bras: { epaule: { abd: 90 } } });
    expect(poseAu([a, b], 0.25).brasG.epaule.abd).toBeCloseTo(30, 9);
    expect(poseAu([a], 0.7)).toBe(a);
  });
});

describe('visuels — corps', () => {
  it('chaque muscle suivi par le catalogue a au moins une pièce, et aucune pièce ne cite un muscle inconnu', () => {
    const cites = new Set(MUSCLES.map((m) => m.m).filter((m) => m !== undefined));
    for (const m of MUSCLES_SUIVIS) expect(cites.has(m), `muscle sans pièce : ${m}`).toBe(true);
    for (const m of cites) expect(MUSCLES_SUIVIS).toContain(m);
  });

  it('les identifiants sont uniques et tous les repères cités existent', () => {
    const ids = [...MUSCLES.map((m) => m.id), ...OSSATURE.map((o) => o.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const F = resoudre(REPOS);
    for (const os of corps.os) expect(F[os.joint], os.joint).toBeDefined();
    for (const m of corps.muscles) for (const l of [m.de, m.a, m.n]) expect(F[l.rep], `${m.id} → ${l.rep}`).toBeDefined();
  });

  it('un muscle étiré contourne le corps au lieu de le traverser (pectoral et fessier au bas du squat)', () => {
    // Aucune section d'aucun muscle ne s'enfonce dans un os qu'il longe plus qu'au repos.
    for (const sujet of Object.values(POSES)) {
      const c = construireCorps(1, sujet.mainFermee, REPOS);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const F = resoudre(poseAu(sujet.cles, t));
        for (const m of c.muscles) {
          const g = geomMuscle(m, F);
          for (const h of m.hotes) {
            const os = geomOs(h.os, F);
            g.st.forEach((s, i) => {
              const P = V.add(V.add(V.add(g.O, V.mul(g.A, s.u * g.L)), V.mul(g.X, s.cx)), V.mul(g.Z, s.cz));
              const d = profondeur(P, os);
              // Tolérance : une section peut être retenue de quelques millimètres par sa voisine
              // (les sections d'un muscle ne se doublent jamais le long de son axe).
              if (d !== null && d.poids === 1 && d.q < h.seuil[i]! - 0.06) {
                throw new Error(`${sujet.id} à ${t} : ${m.id} s'enfonce dans ${h.os.id} (${d.q.toFixed(2)} < ${h.seuil[i]!.toFixed(2)})`);
              }
            });
          }
        }
      }
    }
    // Et le fessier reste sur la fesse : au bas du squat, son milieu est derrière le bassin, pas sous la cuisse.
    const squat = POSES.squat_bb_high!, c = construireCorps(1, true, REPOS), F = resoudre(poseAu(squat.cles, 1));
    const g = geomMuscle(c.muscles.find((m) => m.id === 'fessierG')!, F), milieu = g.st[6]!;
    const P = V.add(V.add(V.add(g.O, V.mul(g.A, milieu.u * g.L)), V.mul(g.X, milieu.cx)), V.mul(g.Z, milieu.cz));
    const dansBassin = M.vec(M.transposee(F.bassin!.R), V.sub(P, F.bassin!.o));
    expect(dansBassin[2]).toBeLessThan(-2);
  });

  it('au repos, contourner le corps ne déplace rien', () => {
    const F = resoudre(REPOS);
    for (const m of corps.muscles) {
      const g = geomMuscle(m, F);
      g.st.forEach((s, i) => {
        expect(s.u).toBeCloseTo(m.st[i]!.u, 9);
        expect(s.cx).toBeCloseTo(m.st[i]!.cx, 9);
        expect(s.cz).toBeCloseTo(m.st[i]!.cz, 9);
      });
    }
  });

  it('un muscle raccourci gonfle, un muscle étiré s\'affine', () => {
    const biceps = corps.muscles.find((m) => m.id === 'bicepsG')!;
    const epais = (coude: number): number =>
      Math.max(...geomMuscle(biceps, resoudre(pose({ bras: { coude } }))).st.map((s) => s.b));
    expect(epais(120)).toBeGreaterThan(epais(8) * 1.05);
    const dorsal = corps.muscles.find((m) => m.id === 'dorsalG')!;
    const brasBaisse = geomMuscle(dorsal, resoudre(REPOS));
    const brasLeve = geomMuscle(dorsal, resoudre(pose({ bras: { epaule: { flex: 160 } } })));
    expect(brasLeve.L).toBeGreaterThan(brasBaisse.L);
    expect(Math.max(...brasLeve.st.map((s) => s.b))).toBeLessThan(Math.max(...brasBaisse.st.map((s) => s.b)));
  });

  it('la fesse est une seule pièce, qui tient au bassin et ne se déforme pas quand la hanche plie', () => {
    expect(corps.muscles.filter((m) => m.muscle === 'fessiers').map((m) => m.id)).toEqual(['fessierG', 'fessierD']);
    const fessier = corps.muscles.find((m) => m.id === 'fessierG')!;
    const debout = geomMuscle(fessier, resoudre(REPOS));
    const F = resoudre(pose({ jambe: { hanche: { flex: 100 }, genou: 100 } })), assis = geomMuscle(fessier, F);
    // Même longueur, mêmes sections : rien ne gonfle ni ne glisse.
    expect(assis.L).toBeCloseTo(debout.L, 9);
    assis.st.forEach((s, i) => {
      expect(s.a).toBeCloseTo(debout.st[i]!.a, 9);
      expect(s.cx).toBeCloseTo(debout.st[i]!.cx, 9);
    });
    // Hanche pliée à 100° : elle n'a suivi la cuisse que d'un quart, soit 25°.
    // Plus, elle part sous le bassin et le laisse à nu ; elle doit rester derrière lui.
    const angle = Math.acos(V.dot(assis.A, debout.A)) * (180 / Math.PI);
    expect(angle).toBeGreaterThan(20);
    expect(angle).toBeLessThan(30);
  });
});

describe('visuels — maillage', () => {
  it('un pavé a six faces tournées vers l\'extérieur', () => {
    const mesh = new Maillage(100, 100), centre: Vec3 = [3, 4, 5];
    ajouterPave(mesh, centre, [2, 0, 0], [0, 1, 0], [0, 0, 3], [255, 255, 255]);
    expect(mesh.ns).toBe(24);
    expect(mesh.ni).toBe(36);
    for (let t = 0; t < mesh.ni; t += 3) {
      const [a, b, c] = [mesh.i[t]!, mesh.i[t + 1]!, mesh.i[t + 2]!].map((i) => sommet(mesh, i));
      const face = V.cross(V.sub(b!.p, a!.p), V.sub(c!.p, a!.p));
      expect(V.dot(face, a!.n)).toBeGreaterThan(0);
      expect(V.dot(a!.n, V.sub(a!.p, centre))).toBeGreaterThan(0);
    }
  });

  it('chaque exercice posé donne un maillage sain, à tout instant du mouvement', () => {
    const mesh = new Maillage();
    for (const sujet of Object.values(POSES)) {
      const c = construireCorps(1, sujet.mainFermee, REPOS);
      for (const t of [0, 0.37, 1]) {
        const finSol = construireScene(mesh, c, sujet, t, { quadriceps: 1, fessiers: 0.5 });
        expect(finSol).toBeGreaterThan(0);
        expect(mesh.ns).toBeLessThan(60000);
        // Compté plutôt que vérifié un à un : il y a près de 20 000 sommets.
        let malades = 0, horsBornes = 0, tordus = 0;
        for (let i = 0; i < mesh.ns; i++) {
          const { p, n } = sommet(mesh, i);
          if (!Number.isFinite(p[0] + p[1] + p[2]) || Math.abs(V.len(n) - 1) > 1e-3) malades++;
        }
        for (let k = finSol; k < mesh.ni; k += 3) {
          const [a, b, d] = [mesh.i[k]!, mesh.i[k + 1]!, mesh.i[k + 2]!].map((i) => sommet(mesh, i));
          if (Math.max(mesh.i[k]!, mesh.i[k + 1]!, mesh.i[k + 2]!) >= mesh.ns) horsBornes++;
          const face = V.cross(V.sub(b!.p, a!.p), V.sub(d!.p, a!.p));
          if (V.len(face) > 1e-6 && V.dot(face, V.add(V.add(a!.n, b!.n), d!.n)) < 0) tordus++;
        }
        expect(malades).toBe(0);
        expect(horsBornes).toBe(0);
        // Les triangles regardent du même côté que leurs normales (sinon ils seraient dessinés à l'envers).
        expect(tordus / ((mesh.ni - finSol) / 3)).toBeLessThan(0.01);
      }
    }
  });
});

describe('visuels — caméra et cadrage', () => {
  it('le sujet reste centré, à la même taille, quand on tourne autour', () => {
    const sujet = POSES.squat_bb_high!, cadre = mesurerSujet(construireCorps(1, true, REPOS), sujet);
    const tailles = [-180, -90, 0, 48, 135].map((tour) => {
      const cam = camera(tour, 10), { centre, demi } = cadrer(cadre, cam, 10), pivot = cam.p(cadre.pivot);
      expect(centre[0]).toBeCloseTo(pivot[0], 9);
      expect(centre[1]).toBeCloseTo(pivot[1], 9);
      return demi;
    });
    for (const d of tailles) expect(d).toBeCloseTo(tailles[0]!, 9);
  });

  it('le cadre contient le sujet sous tous les angles', () => {
    const sujet = POSES.db_lateral_raise!, c = construireCorps(1, true, REPOS), cadre = mesurerSujet(c, sujet), mesh = new Maillage();
    for (const tour of [0, 60, 120, 180]) {
      const cam = camera(tour, sujet.camera.hauteur), { centre, demi } = cadrer(cadre, cam, sujet.camera.hauteur);
      for (const t of [0, 1]) {
        construireScene(mesh, c, sujet, t, {});
        let dehors = 0;
        for (let i = 0; i < mesh.ns; i++) {
          const q = cam.p(sommet(mesh, i).p);
          if (Math.abs(q[0] - centre[0]) > demi || Math.abs(q[1] - centre[1]) > demi) dehors++;
        }
        expect(dehors).toBe(0);
      }
    }
  });
});

describe('visuels — poses', () => {
  const catalogue = new Map(loadExercises().map((e) => [e.id, e]));

  it('chaque pose porte l\'identifiant d\'un exercice du catalogue', () => {
    for (const [cle, p] of Object.entries(POSES)) {
      expect(p.id).toBe(cle);
      expect(catalogue.has(cle), `exercice inconnu : ${cle}`).toBe(true);
    }
  });

  it('une pose non validée laisse la fiche sur ses photos', () => {
    for (const p of Object.values(POSES)) expect(poseValidee(p.id) === null).toBe(!p.valide);
    expect(poseValidee('exercice_inexistant')).toBeNull();
  });

  it('les pieds posés restent au sol pendant tout le mouvement', () => {
    for (const p of Object.values(POSES)) {
      const depart = resoudre(poseAu(p.cles, 0));
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const F = resoudre(poseAu(p.cles, t));
        for (const c of ['G', 'D'] as const) {
          if ((c === 'G' ? p.cles[0]!.jambeG : p.cles[0]!.jambeD).cible === null) continue;
          expect(V.len(V.sub(F['cheville' + c]!.o, depart['cheville' + c]!.o)), `${p.id} à ${t}`).toBeLessThan(1e-6);
          expect(F['cheville' + c]!.o[1]).toBeCloseTo(OS.cheville, 6);
        }
      }
    }
  });

  it('au squat, la barre reste rigide et les mains restent dessus', () => {
    const p = POSES.squat_bb_high!;
    const ecart = (t: number): number => {
      const F = resoudre(poseAu(p.cles, t)), barre = volumesMateriel(p.materiel, F)[0]!;
      if (barre.forme !== 'cylindre') throw new Error('la barre doit être un cylindre');
      expect(V.len(V.sub(barre.p1, barre.p0))).toBeCloseTo(116, 6);
      const axe = V.norm(V.sub(barre.p1, barre.p0)), d = V.sub(F.poignetG!.o, barre.p0);
      return V.len(V.sub(d, V.mul(axe, V.dot(d, axe))));
    };
    const repere = ecart(0);
    for (const t of [0.3, 0.6, 1]) expect(ecart(t)).toBeCloseTo(repere, 6);
  });

  it('un câble suit ses deux ancrages, même s\'ils bougent l\'un par rapport à l\'autre', () => {
    const cable = [{ type: 'cable', de: ['monde', [0, 200, 30]], a: ['poignetG', [0, -5, 0]] }] as const;
    for (const coude of [10, 90]) {
      const F = resoudre(pose({ bras: { coude } })), v = volumesMateriel(cable, F)[0]!;
      if (v.forme !== 'cylindre') throw new Error('le câble doit être un cylindre');
      expect(v.p0).toEqual([0, 200, 30]);
      expect(V.len(V.sub(v.p1, F.poignetG!.o))).toBeCloseTo(5, 6);
    }
  });

  it('sur la pointe des pieds, le pied bascule sans quitter sa cible', () => {
    const cible = { pos: [10, 14, 0] as Vec3, pole: [0, 0, 1] as Vec3, tour: 0, pointe: 0 };
    const plat = resoudre(pose({ jambe: { cible } }));
    const pointe = resoudre(pose({ jambe: { cible: { ...cible, pointe: 30 } } }));
    expect(pointe.chevilleG!.o).toEqual(plat.chevilleG!.o);
    // Les orteils (vers l'avant du pied) descendent.
    expect(M.vec(pointe.chevilleG!.R, [0, 0, 1])[1]).toBeCloseTo(-0.5, 6);
    expect(M.vec(plat.chevilleG!.R, [0, 0, 1])[1]).toBeCloseTo(0, 9);
  });

  it('le mouvement part du départ, tient à l\'arrivée, et revient', () => {
    expect(avancement(0)).toBe(0);
    expect(avancement(0.55)).toBe(1);
    expect(avancement(0.31)).toBeCloseTo(avancement(0.81), 6);
    expect(avancement(1.25)).toBeCloseTo(avancement(0.25), 9);
  });
});
