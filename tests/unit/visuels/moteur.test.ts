/**
 * Moteur de visuels d'exercice — calculs purs (le rendu WebGL se juge à l'œil,
 * dans l'atelier `visuels.html`).
 */

import { describe, expect, it } from 'vitest';

import { loadExercises } from '@/engine/catalog';
import { MUSCLES as MUSCLES_SUIVIS } from '@/engine/models';
import { cadrer, camera } from '@/visuels/camera';
import { MUSCLES, OSSATURE, construireCorps, geomMuscle, geomOs, profondeur } from '@/visuels/corps';
import { M, V, interpoler } from '@/visuels/maths';
import type { Vec3 } from '@/visuels/maths';
import { Maillage, PAR_SOMMET, ajouterPave } from '@/visuels/maillage';
import { MODELES, reperesMateriel, volumesMateriel } from '@/visuels/materiel';
import type { Piece } from '@/visuels/materiel';
import { SCENES } from '@/visuels/dev/vitrine-scenes';
import { POSES, poseValidee } from '@/visuels/poses';
import { REPOS } from '@/visuels/poses/repos';
import { avancement, coefficientPiece, construireScene, mesurerSujet, reperesAu, reposMateriel } from '@/visuels/scene';
import type { PoseExercice } from '@/visuels/scene';
import { LIMITES, OS, PRISE, deuxOs, pose, poseAu, resoudre, surLaPointe } from '@/visuels/squelette';
import type { Reperes } from '@/visuels/squelette';

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
        const F = reperesAu(sujet, t);
        for (const m of c.muscles) {
          const g = geomMuscle(m, F);
          for (const h of m.hotes) {
            const os = geomOs(h.os, F);
            g.st.forEach((s, i) => {
              const P = V.add(V.add(V.add(g.O, V.mul(g.A, s.u * g.L)), V.mul(g.X, s.cx)), V.mul(g.Z, s.cz));
              const d = profondeur(P, os);
              // Tolérance : une section peut être retenue de quelques millimètres par sa voisine
              // (les sections d'un muscle ne se doublent jamais le long de son axe). Une pointe
              // (section sans épaisseur, à l'attache) ne se voit pas : elle n'est pas jugée.
              if (d !== null && d.poids === 1 && s.a > 0.3 && d.q < h.seuil[i]! - 0.06) {
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

  it('un exercice à un seul côté ne colore que les muscles de ce côté', () => {
    const coef = { triceps: 1 };
    const piece = (id: string) => corps.muscles.find((m) => m.id === id)!;
    expect(coefficientPiece(piece('tricepsLatG'), 'G', coef)).toBe(1);
    expect(coefficientPiece(piece('tricepsLatD'), 'G', coef)).toBeUndefined();
    expect(coefficientPiece(piece('tricepsLatD'), undefined, coef)).toBe(1);
    expect(coefficientPiece(piece('brachioRadialG'), 'G', coef)).toBeUndefined();
    expect(POSES.kickback_db!.cote).toBe('G');
  });

  it('une pose non validée laisse la fiche sur ses photos', () => {
    for (const p of Object.values(POSES)) expect(poseValidee(p.id) === null).toBe(!p.valide);
    expect(poseValidee('exercice_inexistant')).toBeNull();
  });

  it('un pied posé ne bouge pas pendant tout le mouvement, et s\'il est à plat au sol, il y reste', () => {
    // Un pied qui fait un pas (fentes, step-up) ou se lève sur la pointe change de cible d'une
    // pose clé à l'autre : il n'est pas « posé ». Un pied sur une pièce mobile (rouleau d'un leg
    // curl, plateau d'un kickback) suit la pièce : il n'est pas posé non plus.
    for (const p of Object.values(POSES)) {
      const depart = reperesAu(p, 0);
      for (const c of ['G', 'D'] as const) {
        const cibles = p.cles.map((k) => (c === 'G' ? k.jambeG : k.jambeD).cible);
        const cible = cibles[0];
        if (cible === null || cible === undefined || cibles.some((x) => JSON.stringify(x) !== JSON.stringify(cible))) continue;
        const repere = cible.repere ?? 'monde';
        if ([0.25, 0.5, 0.75, 1].some((t) => V.len(V.sub(reperesAu(p, t)[repere]!.o, depart[repere]!.o)) > 1e-6)) continue;
        const auSol = (cible.repere ?? 'monde') === 'monde' && cible.pointe === 0 && cible.pos[1] === OS.cheville;
        for (const t of [0.25, 0.5, 0.75, 1]) {
          const F = reperesAu(p, t);
          expect(V.len(V.sub(F['cheville' + c]!.o, depart['cheville' + c]!.o)), `${p.id} à ${t}`).toBeLessThan(1e-6);
          if (auSol) expect(F['cheville' + c]!.o[1]).toBeCloseTo(OS.cheville, 6);
        }
      }
    }
  });

  it('au squat, la barre reste rigide et les mains restent dessus', () => {
    const p = POSES.squat_bb_high!;
    const ecart = (t: number): number => {
      const F = resoudre(poseAu(p.cles, t)), barre = volumesMateriel(p.materiel, F, t)[0]!;
      if (barre.forme !== 'cylindre') throw new Error('la barre doit être un cylindre');
      expect(V.len(V.sub(barre.p1, barre.p0))).toBeCloseTo(116, 6);
      const axe = V.norm(V.sub(barre.p1, barre.p0)), d = V.sub(F.poignetG!.o, barre.p0);
      return V.len(V.sub(d, V.mul(axe, V.dot(d, axe))));
    };
    const repere = ecart(0);
    for (const t of [0.3, 0.6, 1]) expect(ecart(t)).toBeCloseTo(repere, 6);
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

  it('la phase d\'effort est un peu plus lente que l\'autre, sans rien changer aux pauses', () => {
    // Effort à l'aller : à mi-cycle de l'aller ordinaire, on est moins avancé ; l'arrivée tient toujours.
    expect(avancement(0.31, 'aller')).toBeLessThan(avancement(0.31));
    expect(avancement(0.62, 'aller')).toBe(1);
    expect(avancement(0.99, 'aller')).toBeGreaterThan(0);
    // Effort au retour : l'aller est plus rapide.
    expect(avancement(0.31, 'retour')).toBeGreaterThan(avancement(0.31));
    for (const effort of ['aller', 'retour'] as const) {
      expect(avancement(0, effort)).toBe(0);
      expect(avancement(0.999, effort)).toBeLessThan(0.01);
    }
  });
});

describe('visuels — matériel', () => {
  const sujet = (materiel: readonly Piece[], cles: Parameters<typeof pose>[0][]): PoseExercice => ({
    id: 'essai', camera: { tour: 0, hauteur: 0 }, mainFermee: true, materiel, cles: cles.map(pose), valide: false,
  });
  const centrePoing = (F: Reperes, c: 'G' | 'D'): Vec3 => V.add(F['poignet' + c]!.o, M.vec(F['poignet' + c]!.R, [0, -PRISE, 0]));

  it('une main qui tient une barre reste au même endroit de la barre, poing dans l\'axe', () => {
    const s = sujet([{ type: 'tirageVertical', pos: [0, 0, 0], tour: 0, course: [168, 126] }], [{
      bassin: { pos: [0, 62, -4] },
      bras: { cible: { repere: 'barre', pos: [38, 0, 0], axe: [1, 0, 0], pole: [1, -0.2, -0.2] } },
    }, {
      bassin: { pos: [0, 62, -4], bascule: -12 },
      bras: { cible: { repere: 'barre', pos: [38, 0, 0], axe: [1, 0, 0], pole: [1, -0.2, -0.2] } },
    }]);
    for (const t of [0, 0.4, 1]) {
      const F = reperesAu(s, t), barre = F.barre!;
      for (const [c, x] of [['G', 38], ['D', -38]] as const) {
        const attendu = V.add(barre.o, M.vec(barre.R, [x, 0, 0]));
        expect(V.len(V.sub(centrePoing(F, c), attendu)), `main ${c} à ${t}`).toBeLessThan(0.01);
        // La poignée traverse le poing, dans l'axe (l'avant-bras tourne, le poignet s'incline).
        expect(Math.abs(V.dot(M.vec(F['poignet' + c]!.R, [0, 0, 1]), M.vec(barre.R, [1, 0, 0])))).toBeCloseTo(1, 6);
      }
    }
  });

  it('les pièces d\'une machine restent rigides : une poignée tourne autour de son pivot', () => {
    const p: Piece[] = [{ type: 'pecDeck', pos: [0, 0, 0], tour: 30, variante: 'butterfly', course: [90, 0] }];
    const rayon = (t: number): number => {
      const F = resoudre(pose({}), (tronc) => reperesMateriel(p, tronc, t));
      const o = M.vec(M.transposee(M.ry(30)), F.poigneeG!.o);
      return Math.hypot(o[0] - 21, o[2] + 8);
    };
    for (const t of [0.3, 0.7, 1]) expect(rayon(t)).toBeCloseTo(rayon(0), 6);
  });

  it('la pile de plaques est posée au départ et monte quand on tire', () => {
    const s = sujet([{ type: 'poulie', pos: [0, 0, 50], tour: 180, hauteur: 200, prise: { type: 'corde' } }], [
      { bras: { epaule: { flex: 8, abd: 6, rot: 0 }, coude: 105 } },
      { bras: { epaule: { flex: 14, abd: 6, rot: 0 }, coude: 8 } },
    ]);
    const hautDeLaPile = (t: number): number => Math.max(...volumesMateriel(s.materiel, reperesAu(s, t), t, reposMateriel(s))
      .filter((v) => v.forme === 'pave' && v.ton === 'fonte').map((v) => (v.forme === 'pave' ? v.centre[1] : 0)));
    const pose0 = Math.max(...volumesMateriel(s.materiel, reperesAu(s, 0), 0).filter((v) => v.forme === 'pave' && v.ton === 'fonte').map((v) => (v.forme === 'pave' ? v.centre[1] : 0)));
    expect(hautDeLaPile(0)).toBeCloseTo(pose0, 6);
    expect(hautDeLaPile(1)).toBeGreaterThan(pose0 + 20);
  });

  it('chaque type de pièce figure dans la vitrine, et chaque scène donne un maillage sain', () => {
    const presents = new Set(SCENES.flatMap((s) => s.sujet.materiel.map((p) => p.type)));
    for (const type of Object.keys(MODELES)) expect(presents.has(type as Piece['type']), type).toBe(true);
    const mesh = new Maillage(), c = construireCorps(1, true, REPOS);
    for (const s of SCENES) {
      for (const t of [0, 0.5, 1]) {
        construireScene(mesh, c, s.sujet, t, {});
        expect(mesh.ns, s.nom).toBeLessThan(60000);
        let malades = 0;
        for (let i = 0; i < mesh.ns; i++) {
          const { p, n } = sommet(mesh, i);
          if (!Number.isFinite(p[0] + p[1] + p[2]) || Math.abs(V.len(n) - 1) > 1e-3) malades++;
        }
        expect(malades, `${s.nom} à ${t}`).toBe(0);
      }
    }
  });

  it('un pavé aux arêtes arrondies a toutes ses faces tournées vers l\'extérieur', () => {
    const mesh = new Maillage(1000, 6000), centre: Vec3 = [3, 4, 5];
    ajouterPave(mesh, centre, [8, 0, 0], [0, 3, 0], [0, 0, 5], [255, 255, 255], 1, 2);
    let tordus = 0;
    for (let k = 0; k < mesh.ni; k += 3) {
      const [a, b, d] = [mesh.i[k]!, mesh.i[k + 1]!, mesh.i[k + 2]!].map((i) => sommet(mesh, i));
      const face = V.cross(V.sub(b!.p, a!.p), V.sub(d!.p, a!.p));
      if (V.len(face) > 1e-9 && V.dot(face, V.add(V.add(a!.n, b!.n), d!.n)) <= 0) tordus++;
    }
    expect(tordus).toBe(0);
    for (let i = 0; i < mesh.ns; i++) expect(V.dot(sommet(mesh, i).n, V.sub(sommet(mesh, i).p, centre))).toBeGreaterThan(0);
  });

  it('en miroir, une main sur la poignée de gauche passe sur celle de droite', () => {
    const p = pose({ bras: { cible: { repere: 'poigneeG', pos: [1, 2, 3], axe: [1, 0, 0], pole: [1, 0, 0] } } });
    expect(p.brasD.cible).toEqual({ repere: 'poigneeD', pos: [-1, 2, 3], axe: [-1, 0, 0], pole: [-1, 0, 0] });
  });
});

describe('visuels — contact avec le matériel', () => {
  /**
   * Écarts entre chaque main ou pied et ce qu'il vise, sur toute la course :
   * une cible hors de portée laisse la main à côté de la poignée (et la fait
   * « claquer » en bout de course). Rend la liste des écarts de plus de `tol` cm.
   */
  function horsContact(s: PoseExercice, tol: number): string[] {
    const out: string[] = [];
    for (const t of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      const pz = poseAu(s.cles, t), F = reperesAu(s, t);
      for (const c of ['G', 'D'] as const) {
        const b = c === 'G' ? pz.brasG : pz.brasD, j = c === 'G' ? pz.jambeG : pz.jambeD;
        if (b.cible !== null) {
          const r = F[b.cible.repere]!, vise = V.add(r.o, M.vec(r.R, b.cible.pos));
          const p = F['poignet' + c]!, main = b.cible.axe === undefined ? p.o : V.add(p.o, M.vec(p.R, [0, -PRISE, 0]));
          const e = V.len(V.sub(main, vise));
          if (e > tol) out.push(`main ${c} à ${t} : ${e.toFixed(1)} cm`);
        }
        if (j.cible !== null) {
          const r = F[j.cible.repere ?? 'monde']!, vise = V.add(r.o, M.vec(r.R, j.cible.pos));
          const e = V.len(V.sub(F['cheville' + c]!.o, vise));
          if (e > tol) out.push(`pied ${c} à ${t} : ${e.toFixed(1)} cm`);
        }
      }
    }
    return out;
  }

  it('aux leg extension et leg curls, seul le bas de la jambe bouge : le genou reste sur l\'axe', () => {
    for (const nom of ['Leg extension', 'Leg curl assis', 'Leg curl couché']) {
      const s = SCENES.find((x) => x.nom === nom)!.sujet, depart = reperesAu(s, 0);
      for (const t of [0.1, 0.3, 0.6, 1]) {
        const F = reperesAu(s, t);
        for (const r of ['hancheG', 'genouG']) expect(V.len(V.sub(F[r]!.o, depart[r]!.o)), `${nom}, ${r} à ${t}`).toBeLessThan(0.1);
      }
    }
  });

  it('dans chaque scène de la vitrine, mains et pieds restent sur ce qu\'ils visent', () => {
    const fautes = SCENES.map((s) => [s.nom, horsContact(s.sujet, 0.5)] as const).filter(([, f]) => f.length > 0);
    expect(fautes.map(([n, f]) => `${n} : ${f.slice(0, 3).join(' ; ')}`)).toEqual([]);
  });

  it('dans chaque pose du registre, le matériel ne traverse pas le corps', () => {
    // Des points sur la surface de chaque cylindre et boule du matériel, à 41 instants, ne
    // doivent pas s'enfoncer dans un os (la main, qui tient, n'est pas jugée). Une barre posée
    // sur le dos peut l'effleurer : seul ce qui entre franchement compte.
    const fautes: string[] = [];
    for (const s of Object.values(POSES)) {
      const c = construireCorps(1, s.mainFermee, REPOS);
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, F = reperesAu(s, t);
        const os = c.os.filter((o) => !o.id.startsWith('main')).map((o) => ({ id: o.id, g: geomOs(o, F) }));
        for (const v of volumesMateriel(s.materiel, F, t, reposMateriel(s))) {
          const pts: Vec3[] = [];
          if (v.forme === 'cylindre') {
            const ax = V.sub(v.p1, v.p0), a = V.norm(ax);
            const u = V.norm(V.cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), w = V.cross(a, u);
            for (const f of [0, 0.25, 0.5, 0.75, 1]) {
              for (let k = 0; k < 12; k++) {
                const ang = (k / 12) * 2 * Math.PI;
                pts.push(V.add(V.add(V.add(v.p0, V.mul(ax, f)), V.mul(u, Math.cos(ang) * v.r)), V.mul(w, Math.sin(ang) * v.r)));
              }
            }
          } else if (v.forme === 'boule') pts.push(v.centre);
          for (const P of pts) {
            for (const o of os) {
              const d = profondeur(P, o.g);
              if (d !== null && d.poids === 1 && d.q < 0.85) fautes.push(`${s.id} à ${t} : ${v.forme} dans ${o.id} (${d.q.toFixed(2)})`);
            }
          }
        }
      }
    }
    expect([...new Set(fautes)].slice(0, 5)).toEqual([]);
  });

  it('dans chaque pose du registre, mains et pieds restent sur ce qu\'ils visent', () => {
    const fautes = Object.values(POSES).map((p) => [p.id, horsContact(p, 0.5)] as const).filter(([, f]) => f.length > 0);
    expect(fautes.map(([n, f]) => `${n} : ${f.slice(0, 3).join(' ; ')}`)).toEqual([]);
  });
});

describe('visuels — continuité des muscles', () => {
  const lieu = (F: Reperes, l: { rep: string; p: Vec3 }): Vec3 => V.add(F[l.rep]!.o, M.vec(F[l.rep]!.R, l.p));

  it('aucun muscle ne saute d\'une image à l\'autre, dans aucune pose du registre', () => {
    // Un repère qui bascule d'un coup (l'épaule, bras levé au-dessus de la tête ; une main
    // qui change de sens de prise) fait sauter les muscles qui s'y attachent.
    const N = 120, fautes: string[] = [];
    for (const s of Object.values(POSES)) {
      const c = construireCorps(1, s.mainFermee, REPOS);
      const milieux = (t: number): Vec3[] => {
        const F = reperesAu(s, t);
        return c.muscles.map((m) => {
          const g = geomMuscle(m, F), st = g.st[g.st.length >> 1]!;
          return V.add(V.add(V.add(g.O, V.mul(g.A, st.u * g.L)), V.mul(g.X, st.cx)), V.mul(g.Z, st.cz));
        });
      };
      let avant = milieux(0);
      for (let i = 1; i <= N; i++) {
        const apres = milieux(i / N);
        apres.forEach((p, k) => {
          const d = V.len(V.sub(p, avant[k]!));
          if (d > 2.5) fautes.push(`${s.id}, ${c.muscles[k]!.id} à ${(i / N).toFixed(3)} : ${d.toFixed(1)} cm`);
        });
        avant = apres;
      }
    }
    expect(fautes.slice(0, 5)).toEqual([]);
  });

  it('au haussement d\'épaule, deltoïdes et trapèze montent avec l\'épaule, et le trapèze raccourcit', () => {
    const bas = resoudre(pose({})), haut = resoudre(pose({ bras: { clav: [6, 0] } }));
    const muscle = (id: string) => corps.muscles.find((x) => x.id === id)!;
    for (const id of ['deltoLatG', 'deltoAntG', 'deltoPostG']) {
      expect(lieu(haut, muscle(id).de)[1] - lieu(bas, muscle(id).de)[1], id).toBeCloseTo(6, 6);
    }
    const trap = muscle('trapezeG');
    expect(lieu(haut, trap.a)[1] - lieu(bas, trap.a)[1]).toBeCloseTo(6, 6);
    const longueur = (F: Reperes): number => V.len(V.sub(lieu(F, trap.a), lieu(F, trap.de)));
    expect(longueur(haut)).toBeLessThan(longueur(bas));
  });

  it('le triceps s\'attache au cubitus : la pronation de la main ne le fait pas tourner', () => {
    const tricepsLat = corps.muscles.find((x) => x.id === 'tricepsLatG')!;
    const neutre = resoudre(pose({ bras: { coude: 90 } })), prono = resoudre(pose({ bras: { coude: 90, pronation: 80 } }));
    expect(V.len(V.sub(lieu(prono, tricepsLat.a), lieu(neutre, tricepsLat.a)))).toBeLessThan(1e-9);
  });

  it('le poignet plie vers la paume et s\'incline vers le pouce, des deux côtés', () => {
    // Bras le long du corps, paume contre la cuisse, pouce vers l'avant.
    const doigts = (poignet: { flex?: number; dev?: number }, c: 'G' | 'D'): Vec3 =>
      M.vec(resoudre(pose({ bras: { poignet } }))['poignet' + c]!.R, [0, -1, 0]);
    for (const [c, dedans] of [['G', -1], ['D', 1]] as const) {
      expect(doigts({ flex: 60 }, c)[0] * dedans, `flexion, côté ${c}`).toBeGreaterThan(0.8);
      expect(doigts({ flex: -60 }, c)[0] * dedans, `extension, côté ${c}`).toBeLessThan(-0.8);
      expect(doigts({ dev: 20 }, c)[2], `vers le pouce, côté ${c}`).toBeGreaterThan(0.3);
    }
    // Main à plat au sol sous un avant-bras vertical : 90° d'extension.
    expect(doigts({ flex: -90 }, 'G')[0]).toBeCloseTo(1, 6);
  });

  it('une main posée à plat le reste tout le long du mouvement, dans chaque pose du registre', () => {
    let vues = 0;
    for (const s of Object.values(POSES)) {
      for (const c of ['G', 'D'] as const) {
        const plat = s.cles[0]![c === 'G' ? 'brasG' : 'brasD'].cible?.plat;
        if (plat === undefined) continue;
        vues++;
        for (let i = 0; i <= 20; i++) {
          const R = reperesAu(s, i / 20)['poignet' + c]!.R;
          // La paume regarde −X (main gauche) ou +X (main droite) ; les doigts, −Y.
          expect(V.dot(M.vec(R, [c === 'G' ? -1 : 1, 0, 0]), plat.normale), `${s.id}, paume ${c}`).toBeCloseTo(1, 6);
          expect(M.vec(R, [0, -1, 0])[1], `${s.id}, doigts ${c}`).toBeCloseTo(0, 6);
        }
      }
    }
    expect(vues).toBeGreaterThan(0);
  });
});

describe('visuels — fluidité', () => {
  it('entre poses clés, la courbe passe par chaque valeur, sans dépasser, et reste droite à deux valeurs', () => {
    expect(interpoler([10, 30], 0.25)).toBeCloseTo(15, 9);
    const v = [8, 22, 8, 8];
    for (let i = 0; i < v.length; i++) expect(interpoler(v, i / 3)).toBeCloseTo(v[i]!, 9);
    // Un pied qui se repose ne s'enfonce pas dans le sol, et ne monte pas plus haut que son pas.
    for (let t = 0; t <= 1; t += 0.01) {
      expect(interpoler(v, t)).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(interpoler(v, t)).toBeLessThanOrEqual(22 + 1e-9);
    }
  });

  it('aucune articulation ne change brusquement de vitesse en cours de mouvement', () => {
    // Variation d'un pas au suivant, rapportée au pas le plus long de la pose, hors des bouts
    // (le départ et l'arrivée sont adoucis par le tempo). Un bras presque tendu qui vise une
    // barre suivant son propre trajet dépassait nettement ce seuil : le coude battait.
    const N = 100, R = ['coudeG', 'coudeD', 'poignetG', 'poignetD', 'genouG', 'genouD', 'chevilleG', 'chevilleD'];
    const fautes: string[] = [];
    for (const s of Object.values(POSES)) {
      const F = Array.from({ length: N + 1 }, (_, i) => reperesAu(s, i / N));
      let pas = 1e-9;
      for (const r of R) for (let i = 0; i < N; i++) pas = Math.max(pas, V.len(V.sub(F[i + 1]![r]!.o, F[i]![r]!.o)));
      for (const r of R) {
        for (let i = 2; i < N - 2; i++) {
          const a = V.len(V.add(V.sub(F[i + 1]![r]!.o, F[i]![r]!.o), V.sub(F[i - 1]![r]!.o, F[i]![r]!.o))) / pas;
          if (a > 0.2) fautes.push(`${s.id}, ${r} à ${i / N} : ${a.toFixed(2)}`);
        }
      }
    }
    expect(fautes.slice(0, 5)).toEqual([]);
  });

  it('une barre portée par les mains reste horizontale, centrée entre les poings', () => {
    const s = POSES.deadlift_conv!;
    for (const t of [0, 0.3, 0.7, 1]) {
      const F = reperesAu(s, t);
      const poing = (c: string): Vec3 => V.add(F['poignet' + c]!.o, M.vec(F['poignet' + c]!.R, [0, -PRISE, 0]));
      const tige = volumesMateriel(s.materiel, F, t).find((v) => v.forme === 'cylindre')!;
      if (tige.forme !== 'cylindre') throw new Error('tige attendue');
      const milieu = V.mul(V.add(tige.p0, tige.p1), 0.5);
      expect(V.len(V.sub(milieu, V.mul(V.add(poing('G'), poing('D')), 0.5)))).toBeLessThan(1e-6);
      expect(Math.abs(tige.p0[1] - tige.p1[1])).toBeLessThan(1e-6);
    }
  });

  it('sur la pointe des pieds, la base des orteils ne glisse pas et les orteils restent à plat', () => {
    const appui: Vec3 = [8, 0, 13];
    for (const pointe of [0, 20, 38, 60]) {
      const F = resoudre(pose({ bassin: { pos: [0, 92, 0] }, jambe: { cible: surLaPointe(appui, pointe) } }));
      const o = F.orteilsG!;
      expect(o.o[0]).toBeCloseTo(appui[0], 2);
      expect(o.o[1]).toBeCloseTo(OS.cheville + OS.orteils[1], 2);
      expect(o.o[2]).toBeCloseTo(appui[2], 2);
      expect(M.vec(o.R, [0, 0, 1])[1]).toBeCloseTo(0, 6);
    }
  });
});

describe('visuels — le matériel forme un tout', () => {
  type Vol = ReturnType<typeof volumesMateriel>[number];
  /** Points d'échantillon d'un volume : coins, milieux d'arêtes et de faces ; anneaux d'un cylindre. */
  const echantillons = (v: Vol): Vec3[] => {
    if (v.forme === 'boule') return [v.centre, ...([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]).map((d) => V.add(v.centre, V.mul(d, v.r)))];
    if (v.forme === 'pave') {
      const out: Vec3[] = [];
      for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) out.push(V.add(V.add(V.add(v.centre, V.mul(v.dx, a)), V.mul(v.dy, b)), V.mul(v.dz, c)));
      return out;
    }
    const ax = V.sub(v.p1, v.p0), a = V.norm(ax), u = V.norm(V.cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), w = V.cross(a, u), out: Vec3[] = [];
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const c = V.add(v.p0, V.mul(ax, f));
      out.push(c);
      for (let k = 0; k < 8; k++) out.push(V.add(V.add(c, V.mul(u, Math.cos((k / 8) * 2 * Math.PI) * v.r)), V.mul(w, Math.sin((k / 8) * 2 * Math.PI) * v.r)));
    }
    return out;
  };
  const dedans = (P: Vec3, v: Vol, tol: number): boolean => {
    if (v.forme === 'boule') return V.len(V.sub(P, v.centre)) <= v.r + tol;
    if (v.forme === 'pave') {
      const r = V.sub(P, v.centre);
      return [v.dx, v.dy, v.dz].every((d) => Math.abs(V.dot(r, d) / V.len(d)) <= V.len(d) + tol);
    }
    const ax = V.sub(v.p1, v.p0), L = V.len(ax), a = V.mul(ax, 1 / L), u = V.dot(V.sub(P, v.p0), a);
    if (u < -tol || u > L + tol) return false;
    return V.len(V.sub(V.sub(P, v.p0), V.mul(a, Math.max(0, Math.min(L, u))))) <= v.r + tol;
  };
  // Le matériel porté (barres libres, haltères, disques…) n'a pas à toucher le sol.
  const PORTES = new Set<Piece['type']>(['barre', 'barreEz', 'trapBar', 'haltere', 'disque', 'landmine', 'roueAbdo']);
  /**
   * Morceaux d'une pièce de matériel : ses volumes reliés de proche en proche (à 6 mm près), sans passer par
   * le sol. Rend le nombre de morceaux, et s'il y en a un qui ne touche pas le sol.
   */
  const morceaux = (s: PoseExercice, k: number, t: number): { n: number; enLAir: boolean } => {
    const F = reperesAu(s, t), vols = volumesMateriel([s.materiel[k]!], F, t, [reposMateriel(s)[k]!]);
    const pts = vols.map(echantillons), parent = vols.map((_, i) => i);
    const racine = (i: number): number => (parent[i] === i ? i : (parent[i] = racine(parent[i]!)));
    for (let i = 0; i < vols.length; i++) for (let j = i + 1; j < vols.length; j++) {
      if (racine(i) !== racine(j) && (pts[i]!.some((p) => dedans(p, vols[j]!, 0.6)) || pts[j]!.some((p) => dedans(p, vols[i]!, 0.6)))) parent[racine(i)] = racine(j);
    }
    const groupes = new Set(vols.map((_, i) => racine(i)));
    const auSol = new Set(vols.map((_, i) => i).filter((i) => pts[i]!.some((p) => p[1] <= 1)).map(racine));
    return { n: groupes.size, enLAir: [...groupes].some((g) => !auSol.has(g)) };
  };

  it("chaque machine est d'un seul tenant et pose au sol : rien ne flotte, rien n'est simplement posé à côté", () => {
    const sujets = [...SCENES.map((s) => s.sujet), ...Object.values(POSES)];
    const fautes: string[] = [];
    for (const s of sujets) s.materiel.forEach((p, k) => {
      if (PORTES.has(p.type)) return;
      for (const t of [0, 1]) {
        const m = morceaux(s, k, t);
        if (m.n > 1 || m.enLAir) fautes.push(`${s.id}, ${p.type} à ${t} : ${m.n} morceau(x)${m.enLAir ? ", dont un en l'air" : ''}`);
      }
    });
    expect([...new Set(fautes)]).toEqual([]);
  });
});
