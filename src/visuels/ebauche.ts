/**
 * Ébauche d'une pose à partir d'une photo : les points du corps détectés par
 * MediaPipe Pose (Google, licence Apache 2.0) deviennent des angles du
 * mannequin. Pur : la détection elle-même se fait dans l'atelier.
 *
 * L'ébauche donne l'inclinaison du tronc, les épaules, les coudes, les hanches
 * et les genoux. Elle ne donne pas la tête, les poignets, la pronation ni le
 * matériel ; la hauteur du bassin vient des pieds posés au sol.
 *
 * Les points sont les « points du monde » de MediaPipe : en mètres, origine
 * entre les hanches, x vers la droite de l'image, y vers le bas, z qui
 * s'éloigne de l'appareil. « Gauche » y est la gauche de la personne, comme ici.
 */

import { balancement } from './edition';
import { M, RAD, V, clamp } from './maths';
import type { Mat3, Vec3 } from './maths';
import { LIMITES, OS, pose, resoudre } from './squelette';
import type { AnglesRotule, CibleJambe, Pose } from './squelette';

export interface PointDetecte {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Confiance de MediaPipe que le point est visible (0 à 1). */
  readonly visibility?: number;
}

/** Indices des points MediaPipe utilisés : [gauche, droite]. */
export const POINTS = {
  epaule: [11, 12],
  coude: [13, 14],
  poignet: [15, 16],
  hanche: [23, 24],
  genou: [25, 26],
  cheville: [27, 28],
} as const;
const TOUS = Object.values(POINTS).flat();

/** Part de l'inclinaison du tronc prise par le bassin, les lombaires et le thorax. */
const PARTAGE = { bassin: 0.7, lombaires: 0.15, thorax: 0.15 } as const;

export interface Ebauche {
  readonly pose: Pose;
  /** Angle de vue de la photo, dans la convention de la caméra (0 = de face). */
  readonly tourCamera: number;
  /** Visibilité moyenne des douze points utilisés (0 à 1). */
  readonly confiance: number;
}

type Bornes = readonly [number, number];
const borneRotule = (a: AnglesRotule, l: { flex: Bornes; abd: Bornes; rot: Bornes }): AnglesRotule => ({
  flex: clamp(a.flex, l.flex[0], l.flex[1]),
  abd: clamp(a.abd, l.abd[0], l.abd[1]),
  rot: clamp(a.rot, l.rot[0], l.rot[1]),
});

/** Un membre à deux os : rotule (balancement + rotation) et pliure au milieu. */
interface Membre {
  readonly rotule: AnglesRotule;
  readonly pli: number;
  readonly vis: number;
}

/**
 * Angles d'un membre à deux os, dans le repère `R` de son parent.
 * `sens` : −1 pour un bras (l'avant-bras part vers l'avant quand le coude
 * plie), +1 pour une jambe (la jambe part vers l'arrière).
 */
function membre(R: Mat3, racine: Vec3, milieu: Vec3, bout: Vec3, cote: number, sens: 1 | -1, vis: number): Membre {
  const u = M.vec(M.transposee(R), V.sub(milieu, racine));
  const { flex, abd, B } = balancement(u, cote);
  const f = V.norm(M.vec(M.transposee(M.mul(R, B)), V.sub(bout, milieu)));
  const pli = Math.acos(clamp(-f[1], -1, 1)) / RAD;
  // La rotation de l'os se lit dans le plan où plie le membre ; membre presque
  // tendu : rien à lire.
  const a = Math.sin(pli * RAD) > 0.25 ? Math.atan2(-sens * f[0], -sens * f[2]) / RAD : 0;
  return { rotule: { flex, abd, rot: a / cote }, pli, vis };
}

/** Moyenne pondérée de deux membres (gauche et droit), pour un exercice symétrique. */
function moyenne(g: Membre, d: Membre): Membre {
  const pg = Math.max(g.vis, 0.05), pd = Math.max(d.vis, 0.05), m = (a: number, b: number): number => (a * pg + b * pd) / (pg + pd);
  return {
    rotule: { flex: m(g.rotule.flex, d.rotule.flex), abd: m(g.rotule.abd, d.rotule.abd), rot: m(g.rotule.rot, d.rotule.rot) },
    pli: m(g.pli, d.pli),
    vis: (g.vis + d.vis) / 2,
  };
}

/** Inclinaison du tronc (des hanches aux épaules) dans un repère : vers l'avant et de côté, en degrés. */
function inclinaison(t: Vec3): { avant: number; cote: number } {
  return { avant: Math.atan2(t[2], t[1]) / RAD, cote: Math.atan2(-t[0], Math.hypot(t[1], t[2])) / RAD };
}

/** Le tronc du mannequin incliné de `avant` et `cote`, partagés entre bassin, lombaires et thorax. */
const tronc = (avant: number, cote: number): Pose =>
  pose({
    bassin: { bascule: avant * PARTAGE.bassin, penche: cote * PARTAGE.bassin },
    lombaires: { flex: avant * PARTAGE.lombaires, penche: cote * PARTAGE.lombaires },
    thorax: { flex: avant * PARTAGE.thorax, penche: cote * PARTAGE.thorax },
  });

/** Ligne hanches → épaules du mannequin dans cette pose. */
function ligneTronc(p: Pose): Vec3 {
  const F = resoudre(p);
  const milieu = (a: string, b: string): Vec3 => V.mul(V.add(F[a]!.o, F[b]!.o), 0.5);
  return V.sub(milieu('epauleG', 'epauleD'), milieu('hancheG', 'hancheD'));
}

/**
 * Ébauche d'une pose depuis les points d'une photo.
 * `symetrique` : les deux côtés reçoivent la moyenne des deux (pondérée par la
 * visibilité : le membre caché compte peu).
 */
export function ebaucher(points: readonly PointDetecte[], symetrique: boolean): Ebauche {
  // Repère : y vers le haut, z vers l'appareil, puis tourné autour de la
  // verticale pour que la personne regarde vers +Z (sa gauche en +X).
  const brut = (i: number): Vec3 => {
    const p = points[i]!;
    return [p.x, -p.y, -p.z];
  };
  const vis = (i: number): number => points[i]?.visibility ?? 1;
  const axe = V.add(V.sub(brut(23), brut(24)), V.sub(brut(11), brut(12)));
  const lacet = Math.hypot(axe[0], axe[2]) < 1e-6 ? 0 : Math.atan2(axe[2], axe[0]) / RAD;
  const Ry = M.ry(lacet), P = (i: number): Vec3 => M.vec(Ry, brut(i));
  const versAppareil = M.vec(Ry, [0, 0, 1]);
  const tourCamera = Math.atan2(versAppareil[0], versAppareil[2]) / RAD;

  // Tronc : on cherche l'inclinaison qui donne au mannequin la même ligne
  // hanches → épaules que sur la photo (quelques passes suffisent).
  const vise = inclinaison(V.sub(V.mul(V.add(P(11), P(12)), 0.5), V.mul(V.add(P(23), P(24)), 0.5)));
  let avant = vise.avant, cote = vise.cote;
  for (let i = 0; i < 6; i++) {
    const obtenu = inclinaison(ligneTronc(tronc(avant, cote)));
    avant += vise.avant - obtenu.avant;
    cote += vise.cote - obtenu.cote;
  }
  const base = tronc(avant, cote), F = resoudre(base);

  const cotes = [['G', 1, 0], ['D', -1, 1]] as const;
  let bras = cotes.map(([, s, k]) => membre(F.thorax!.R, P(POINTS.epaule[k]), P(POINTS.coude[k]), P(POINTS.poignet[k]), s, -1, (vis(POINTS.coude[k]) + vis(POINTS.poignet[k])) / 2));
  let jambes = cotes.map(([, s, k]) => membre(F.bassin!.R, P(POINTS.hanche[k]), P(POINTS.genou[k]), P(POINTS.cheville[k]), s, 1, (vis(POINTS.genou[k]) + vis(POINTS.cheville[k])) / 2));
  if (symetrique) {
    const b = moyenne(bras[0]!, bras[1]!), j = moyenne(jambes[0]!, jambes[1]!);
    bras = [b, b];
    jambes = [j, j];
  }
  const avecMembres = (p: Pose): Pose => ({
    ...p,
    brasG: { ...p.brasG, epaule: borneRotule(bras[0]!.rotule, LIMITES.epaule), coude: clamp(bras[0]!.pli, ...LIMITES.coude) },
    brasD: { ...p.brasD, epaule: borneRotule(bras[1]!.rotule, LIMITES.epaule), coude: clamp(bras[1]!.pli, ...LIMITES.coude) },
    jambeG: { ...p.jambeG, hanche: borneRotule(jambes[0]!.rotule, LIMITES.hanche), genou: clamp(jambes[0]!.pli, ...LIMITES.genou) },
    jambeD: { ...p.jambeD, hanche: borneRotule(jambes[1]!.rotule, LIMITES.hanche), genou: clamp(jambes[1]!.pli, ...LIMITES.genou) },
  });

  // Le bassin descend jusqu'à ce que le pied le plus bas touche le sol.
  let p = avecMembres(base);
  const G = resoudre(p), bas = Math.min(G.chevilleG!.o[1], G.chevilleD!.o[1]);
  p = { ...p, bassin: { ...p.bassin, pos: [0, p.bassin.pos[1] + OS.cheville - bas, 0] } };

  const confiance = TOUS.reduce((s, i) => s + vis(i), 0) / TOUS.length;
  return { pose: p, tourCamera, confiance };
}

/**
 * Les pieds restent-ils en place d'une photo à l'autre ? Les deux photos d'un
 * exercice sont prises du même endroit : on compare la position des chevilles
 * sur l'image (coordonnées de 0 à 1). Squat, rowing, curl : oui. Leg extension,
 * traction : non.
 */
export function piedsImmobiles(depart: readonly PointDetecte[], arrivee: readonly PointDetecte[]): boolean {
  const ecart = (i: number): number => Math.hypot(depart[i]!.x - arrivee[i]!.x, depart[i]!.y - arrivee[i]!.y);
  return (ecart(POINTS.cheville[0]) + ecart(POINTS.cheville[1])) / 2 < 0.04;
}

/**
 * Pose les pieds au sol : chaque jambe passe en cible, la cheville à hauteur
 * de sol, à l'aplomb de l'endroit où elle est ; le genou pointe là où il est.
 * Si `pieds` est donné (les cibles d'une autre pose clé), les pieds y restent :
 * ils ne glissent pas d'une pose clé à l'autre.
 */
export function piedsAuSol(p: Pose, pieds?: { readonly G: CibleJambe; readonly D: CibleJambe }): { pose: Pose; pieds: { G: CibleJambe; D: CibleJambe } } {
  const F = resoudre(p);
  const cible = (c: 'G' | 'D'): CibleJambe => {
    if (pieds !== undefined) return { ...pieds[c], pole: genouVers(F, c) };
    const o = F['cheville' + c]!.o;
    return { pos: [o[0], OS.cheville, o[2]], pole: genouVers(F, c), tour: 0, pointe: 0 };
  };
  const G = cible('G'), D = cible('D');
  return { pose: { ...p, jambeG: { ...p.jambeG, cible: G }, jambeD: { ...p.jambeD, cible: D } }, pieds: { G, D } };
}

/** Direction du genou, perpendiculaire à la ligne hanche → cheville ; vers l'avant si la jambe est tendue. */
function genouVers(F: ReturnType<typeof resoudre>, c: 'G' | 'D'): Vec3 {
  const H = F['hanche' + c]!.o, J = F['genou' + c]!.o, E = F['cheville' + c]!.o;
  const dir = V.norm(V.sub(E, H)), j = V.sub(J, H), pp = V.sub(j, V.mul(dir, V.dot(j, dir)));
  return V.len(pp) < 1e-3 ? [0, 0, 1] : V.norm(pp);
}
