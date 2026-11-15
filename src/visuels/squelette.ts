/**
 * Squelette du mannequin : articulations en 3D, limites anatomiques,
 * cinématique inverse. Une pose (des angles, ou des cibles à atteindre) donne
 * la position et l'orientation de chaque partie du corps.
 */

import { IDENTITE, M, RAD, V, clamp } from './maths';
import type { Mat3, Vec3 } from './maths';

// -----------------------------------------------------------------------------
// Dimensions, au repos (debout, bras le long du corps). Côté gauche.
// -----------------------------------------------------------------------------
export const OS = {
  lombaires: [0, 6, 0] as Vec3, // depuis le bassin
  thorax: [0, 22, 0] as Vec3, // depuis les lombaires
  cou: [0, 27, 0] as Vec3, // depuis le thorax
  tete: [0, 6.5, 0.5] as Vec3, // depuis le cou
  epaule: [20.2, 21, 0] as Vec3, // depuis le thorax
  hanche: [9.6, -5, 0] as Vec3, // depuis le bassin
  bras: 30,
  avantBras: 26,
  cuisse: 43.5,
  jambe: 41.5,
  /** Hauteur de la cheville au-dessus du sol, pied à plat. */
  cheville: 8,
} as const;

// -----------------------------------------------------------------------------
// Pose
// -----------------------------------------------------------------------------
/** Segment du tronc : flexion vers l'avant, penché de côté, torsion. Degrés. */
export interface AnglesTronc {
  readonly flex: number;
  readonly penche: number;
  readonly tour: number;
}
/** Épaule ou hanche : flexion (vers l'avant), abduction (vers l'extérieur), rotation sur l'axe de l'os. */
export interface AnglesRotule {
  readonly flex: number;
  readonly abd: number;
  readonly rot: number;
}
/** La main doit atteindre `pos` (dans le repère d'une partie du corps) ; le coude pointe vers `pole`. */
export interface CibleBras {
  readonly repere: string;
  readonly pos: Vec3;
  readonly pole: Vec3;
}
/**
 * La cheville doit atteindre `pos` (dans l'espace) ; le genou pointe vers
 * `pole` ; le pied tourne de `tour` autour de la verticale. Il est à plat,
 * sauf si `pointe` est donné : degrés dont le talon se lève (extension des
 * mollets) ; la hauteur de la cheville est alors à régler dans `pos`.
 */
export interface CibleJambe {
  readonly pos: Vec3;
  readonly pole: Vec3;
  readonly tour: number;
  readonly pointe?: number;
}
export interface PoseBras {
  /** Haussement de l'épaule : [vers le haut, vers l'avant], en cm. */
  readonly clav: readonly [number, number];
  readonly epaule: AnglesRotule;
  readonly coude: number;
  readonly pronation: number;
  readonly poignet: { readonly flex: number; readonly dev: number };
  /** Si présente, l'épaule et le coude sont calculés pour que la main l'atteigne. */
  readonly cible: CibleBras | null;
}
export interface PoseJambe {
  readonly hanche: AnglesRotule;
  readonly genou: number;
  readonly cheville: number;
  /** Si présente, la hanche et le genou sont calculés pour que le pied y reste. */
  readonly cible: CibleJambe | null;
}
export interface Pose {
  readonly bassin: { readonly pos: Vec3; readonly bascule: number; readonly tour: number; readonly penche: number };
  readonly lombaires: AnglesTronc;
  readonly thorax: AnglesTronc;
  readonly cou: AnglesTronc;
  readonly tete: AnglesTronc;
  readonly brasG: PoseBras;
  readonly brasD: PoseBras;
  readonly jambeG: PoseJambe;
  readonly jambeD: PoseJambe;
}

type Partiel<T> = T extends readonly unknown[] ? T : T extends object ? { readonly [K in keyof T]?: Partiel<T[K]> } : T;

const TRONC0: AnglesTronc = { flex: 0, penche: 0, tour: 0 };
const BRAS0: PoseBras = {
  clav: [0, 0],
  epaule: { flex: 0, abd: 0, rot: 0 },
  coude: 0,
  pronation: 0,
  poignet: { flex: 0, dev: 0 },
  cible: null,
};
const JAMBE0: PoseJambe = { hanche: { flex: 0, abd: 0, rot: 0 }, genou: 0, cheville: 0, cible: null };
const POSE0: Pose = {
  bassin: { pos: [0, 98, 0], bascule: 0, tour: 0, penche: 0 },
  lombaires: TRONC0,
  thorax: TRONC0,
  cou: TRONC0,
  tete: TRONC0,
  brasG: BRAS0,
  brasD: BRAS0,
  jambeG: JAMBE0,
  jambeD: JAMBE0,
};

function fusion<T>(base: T, ajout: Partiel<T> | undefined): T {
  if (ajout === undefined) return base;
  if (ajout === null || typeof ajout !== 'object' || Array.isArray(ajout) || base === null) return ajout as T;
  const o = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(ajout)) o[k] = fusion(o[k], v as Partiel<unknown>);
  return o as T;
}

const miroirBras = (p: PoseBras): PoseBras =>
  p.cible === null
    ? p
    : { ...p, cible: { ...p.cible, pos: [-p.cible.pos[0], p.cible.pos[1], p.cible.pos[2]], pole: [-p.cible.pole[0], p.cible.pole[1], p.cible.pole[2]] } };
const miroirJambe = (p: PoseJambe): PoseJambe =>
  p.cible === null
    ? p
    : { ...p, cible: { ...p.cible, pos: [-p.cible.pos[0], p.cible.pos[1], p.cible.pos[2]], pole: [-p.cible.pole[0], p.cible.pole[1], p.cible.pole[2]] } };

export interface DescriptionPose extends Partiel<Omit<Pose, 'brasG' | 'brasD' | 'jambeG' | 'jambeD'>> {
  /** Les deux bras, décrits pour le côté gauche (le droit est son miroir). */
  readonly bras?: Partiel<PoseBras>;
  /** Les deux jambes, décrites pour le côté gauche. */
  readonly jambe?: Partiel<PoseJambe>;
  /** Pour un mouvement qui n'est pas symétrique : un membre à part. */
  readonly brasG?: Partiel<PoseBras>;
  readonly brasD?: Partiel<PoseBras>;
  readonly jambeG?: Partiel<PoseJambe>;
  readonly jambeD?: Partiel<PoseJambe>;
}

/** Construit une pose complète à partir de ce qui diffère du repos. */
export function pose(d: DescriptionPose): Pose {
  const { bras, jambe, brasG, brasD, jambeG, jambeD, ...tronc } = d;
  const p = fusion<Pose>(POSE0, tronc as Partiel<Pose>);
  const brasSym = fusion<PoseBras>(BRAS0, bras), jambeSym = fusion<PoseJambe>(JAMBE0, jambe);
  return {
    ...p,
    brasG: fusion<PoseBras>(brasSym, brasG),
    brasD: fusion<PoseBras>(miroirBras(brasSym), brasD),
    jambeG: fusion<PoseJambe>(jambeSym, jambeG),
    jambeD: fusion<PoseJambe>(miroirJambe(jambeSym), jambeD),
  };
}

function entreValeurs(a: unknown, b: unknown, t: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => entreValeurs(x, b[i], t));
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(a)) o[k] = entreValeurs((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], t);
    return o;
  }
  return a;
}

/**
 * Pose à l'avancement `t` (0 = première pose clé, 1 = dernière). Entre deux
 * poses clés, chaque nombre est interpolé ; un membre doit garder le même mode
 * (angles ou cible) d'une pose clé à l'autre.
 */
export function poseAu(cles: readonly Pose[], t: number): Pose {
  if (cles.length === 1) return cles[0]!;
  const x = clamp(t, 0, 1) * (cles.length - 1), i = Math.min(cles.length - 2, Math.floor(x));
  return entreValeurs(cles[i], cles[i + 1], x - i) as Pose;
}

/** Cible d'un pied posé au sol : écart au centre, et angle d'ouverture du pied. */
export const piedAuSol = (ecart: number, tour: number, avance = 0): CibleJambe => ({
  pos: [ecart, OS.cheville, avance],
  pole: [Math.sin(tour * RAD), 0, Math.cos(tour * RAD)],
  tour,
});

// -----------------------------------------------------------------------------
// Limites anatomiques, en degrés. Une pose qui en sort est ramenée dedans.
// -----------------------------------------------------------------------------
type Bornes = readonly [number, number];
export const LIMITES = {
  epaule: { flex: [-60, 180] as Bornes, abd: [-40, 180] as Bornes, rot: [-90, 90] as Bornes },
  coude: [0, 150] as Bornes,
  pronation: [-90, 90] as Bornes,
  poignet: { flex: [-70, 80] as Bornes, dev: [-25, 35] as Bornes },
  hanche: { flex: [-25, 125] as Bornes, abd: [-30, 55] as Bornes, rot: [-45, 45] as Bornes },
  genou: [0, 150] as Bornes,
  cheville: [-45, 25] as Bornes,
  lombaires: { flex: [-25, 50] as Bornes, penche: [-25, 25] as Bornes, tour: [-20, 20] as Bornes },
  thorax: { flex: [-20, 35] as Bornes, penche: [-25, 25] as Bornes, tour: [-35, 35] as Bornes },
  cou: { flex: [-40, 40] as Bornes, penche: [-30, 30] as Bornes, tour: [-45, 45] as Bornes },
  tete: { flex: [-35, 35] as Bornes, penche: [-20, 20] as Bornes, tour: [-45, 45] as Bornes },
} as const;

const borne = (v: number, [a, b]: Bornes): number => clamp(v, a, b);
const borneTronc = (a: AnglesTronc, l: { flex: Bornes; penche: Bornes; tour: Bornes }): AnglesTronc => ({
  flex: borne(a.flex, l.flex),
  penche: borne(a.penche, l.penche),
  tour: borne(a.tour, l.tour),
});
const borneRotule = (a: AnglesRotule, l: { flex: Bornes; abd: Bornes; rot: Bornes }): AnglesRotule => ({
  flex: borne(a.flex, l.flex),
  abd: borne(a.abd, l.abd),
  rot: borne(a.rot, l.rot),
});

// Rotation d'un segment du tronc : torsion, puis flexion vers l'avant, puis penché de côté.
const rotTronc = (a: AnglesTronc): Mat3 => M.mul(M.mul(M.ry(a.tour), M.rx(a.flex)), M.rz(a.penche));

// Rotule (épaule, hanche) : la flexion et l'abduction forment un seul
// balancement, sans torsion parasite ; la rotation sur l'axe de l'os vient
// ensuite. `cote` : +1 à gauche, −1 à droite.
function rotRotule(a: AnglesRotule, cote: number): Mat3 {
  const w: Vec3 = [-a.flex * RAD, 0, a.abd * RAD * cote];
  const ang = V.len(w);
  const balance = ang < 1e-9 ? IDENTITE : M.axe(V.mul(w, 1 / ang), ang);
  return M.mul(balance, M.ry(a.rot * cote));
}

/**
 * Cinématique inverse à deux os : d'où part le membre (S), où doit arriver son
 * extrémité (T), vers où pointe le coude ou le genou (`pole`). Rend les
 * orientations des deux os, la position de l'articulation du milieu (J) et
 * celle de l'extrémité réellement atteinte (E).
 * `sens` : −1 pour un bras (le coude pointe vers le pôle, le biceps regarde à
 * l'opposé), +1 pour une jambe (le genou et le quadriceps regardent le pôle).
 * La cible est ramenée à portée : ni plus loin que le membre tendu, ni plus
 * près que ne le permet la flexion maximale.
 */
export function deuxOs(S: Vec3, T: Vec3, L1: number, L2: number, pole: Vec3, sens: 1 | -1, flexMax: number) {
  const d = V.sub(T, S);
  let dist = V.len(d);
  const dir: Vec3 = dist > 1e-6 ? V.mul(d, 1 / dist) : [0, -1, 0];
  const dMin = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos((180 - flexMax) * RAD));
  dist = clamp(dist, dMin, L1 + L2 - 0.01);
  const ca = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const sa = Math.sqrt(1 - ca * ca);
  let pp = V.sub(pole, V.mul(dir, V.dot(pole, dir)));
  if (V.len(pp) < 1e-6) pp = V.cross(dir, [1, 0, 0]);
  pp = V.norm(pp);
  const b1 = V.add(V.mul(dir, ca), V.mul(pp, sa));
  const J = V.add(S, V.mul(b1, L1));
  const E = V.add(S, V.mul(dir, dist));
  const b2 = V.norm(V.sub(E, J));
  const X = V.mul(V.cross(dir, pp), -sens);
  const repere = (b: Vec3): Mat3 => {
    const Y = V.mul(b, -1);
    return M.depuisColonnes(X, Y, V.cross(X, Y));
  };
  return { R1: repere(b1), J, R2: repere(b2), E };
}

// -----------------------------------------------------------------------------
// Pose → repères
// -----------------------------------------------------------------------------
/** Position et orientation d'une partie du corps. Un os de membre descend le long de −Y. */
export interface Repere {
  readonly o: Vec3;
  readonly R: Mat3;
}
export type Reperes = Readonly<Record<string, Repere>>;

/** Repères qui existent en deux exemplaires : suffixe `G` (gauche) ou `D` (droite). */
export const REPERES_PAIRS = ['epaule', 'coude', 'poignet', 'delto', 'hanche', 'genou', 'cheville', 'fessier', 'rotule'] as const;
/** Repères du tronc, et le repère fixe du monde. */
export const REPERES_CENTRAUX = ['monde', 'bassin', 'lombaires', 'thorax', 'cou', 'tete'] as const;

/**
 * Pose → repères de chaque partie du corps.
 *
 * Trois repères sont à cheval sur une articulation et tournent à mi-chemin
 * entre les deux os : `delto` (épaule), `fessier` (hanche), `rotule` (genou).
 * Les muscles qui coiffent ces articulations s'en servent pour savoir vers où
 * ils regardent.
 */
export function resoudre(p: Pose): Reperes {
  const F: Record<string, Repere> = { monde: { o: [0, 0, 0], R: IDENTITE } };
  const b = p.bassin;
  const Rb = M.mul(M.mul(M.ry(b.tour), M.rx(b.bascule)), M.rz(b.penche));
  F.bassin = { o: b.pos, R: Rb };
  const suite = (parent: string, nom: 'lombaires' | 'thorax' | 'cou' | 'tete', decal: Vec3): void => {
    const q = F[parent]!;
    F[nom] = { o: V.add(q.o, M.vec(q.R, decal)), R: M.mul(q.R, rotTronc(borneTronc(p[nom], LIMITES[nom]))) };
  };
  suite('bassin', 'lombaires', OS.lombaires);
  suite('lombaires', 'thorax', OS.thorax);
  suite('thorax', 'cou', OS.cou);
  suite('cou', 'tete', OS.tete);
  const th = F.thorax!;

  for (const [c, cote] of [['G', 1], ['D', -1]] as const) {
    // Bras
    const br = c === 'G' ? p.brasG : p.brasD;
    const S = V.add(th.o, M.vec(th.R, [OS.epaule[0] * cote, OS.epaule[1] + br.clav[0], OS.epaule[2] + br.clav[1]]));
    let Ru: Mat3, coude: Vec3, Rf: Mat3, poignet: Vec3;
    if (br.cible !== null) {
      const rep = F[br.cible.repere];
      if (rep === undefined) throw new Error(`Repère inconnu pour la cible du bras : ${br.cible.repere}`);
      const T = V.add(rep.o, M.vec(rep.R, br.cible.pos));
      const k = deuxOs(S, T, OS.bras, OS.avantBras, M.vec(rep.R, br.cible.pole), -1, LIMITES.coude[1]);
      Ru = k.R1; coude = k.J; Rf = k.R2; poignet = k.E;
    } else {
      Ru = M.mul(th.R, rotRotule(borneRotule(br.epaule, LIMITES.epaule), cote));
      coude = V.add(S, M.vec(Ru, [0, -OS.bras, 0]));
      Rf = M.mul(Ru, M.rx(-borne(br.coude, LIMITES.coude)));
      poignet = V.add(coude, M.vec(Rf, [0, -OS.avantBras, 0]));
    }
    Rf = M.mul(Rf, M.ry(borne(br.pronation, LIMITES.pronation) * cote));
    F['epaule' + c] = { o: S, R: Ru };
    F['coude' + c] = { o: coude, R: Rf };
    F['poignet' + c] = {
      o: poignet,
      R: M.mul(M.mul(Rf, M.rx(-borne(br.poignet.flex, LIMITES.poignet.flex))), M.rz(borne(br.poignet.dev, LIMITES.poignet.dev) * cote)),
    };
    F['delto' + c] = { o: S, R: M.entre(th.R, Ru, 0.55) };

    // Jambe
    const ja = c === 'G' ? p.jambeG : p.jambeD;
    const H = V.add(b.pos, M.vec(Rb, [OS.hanche[0] * cote, OS.hanche[1], OS.hanche[2]]));
    let Rc: Mat3, genou: Vec3, Rj: Mat3, cheville: Vec3, Rp: Mat3;
    if (ja.cible !== null) {
      const k = deuxOs(H, ja.cible.pos, OS.cuisse, OS.jambe, ja.cible.pole, 1, LIMITES.genou[1]);
      Rc = k.R1; genou = k.J; Rj = k.R2; cheville = k.E;
      // Le pied ne suit pas la jambe : il reste posé (à plat, ou sur la pointe).
      Rp = M.mul(M.ry(ja.cible.tour * cote), M.rx(ja.cible.pointe ?? 0));
    } else {
      Rc = M.mul(Rb, rotRotule(borneRotule(ja.hanche, LIMITES.hanche), cote));
      genou = V.add(H, M.vec(Rc, [0, -OS.cuisse, 0]));
      Rj = M.mul(Rc, M.rx(borne(ja.genou, LIMITES.genou)));
      cheville = V.add(genou, M.vec(Rj, [0, -OS.jambe, 0]));
      Rp = M.mul(Rj, M.rx(-borne(ja.cheville, LIMITES.cheville)));
    }
    F['hanche' + c] = { o: H, R: Rc };
    F['genou' + c] = { o: genou, R: Rj };
    F['cheville' + c] = { o: cheville, R: Rp };
    F['fessier' + c] = { o: H, R: M.entre(Rb, Rc, 0.5) };
    F['rotule' + c] = { o: genou, R: M.entre(Rc, Rj, 0.5) };
  }
  return F;
}
