/**
 * Squelette du mannequin : articulations en 3D, limites anatomiques,
 * cinématique inverse. Une pose (des angles, ou des cibles à atteindre) donne
 * la position et l'orientation de chaque partie du corps.
 */

import { IDENTITE, M, RAD, V, clamp, interpoler } from './maths';
import type { Mat3, Vec3 } from './maths';

// -----------------------------------------------------------------------------
// Dimensions, au repos (debout, bras le long du corps). Côté gauche.
// -----------------------------------------------------------------------------
export const OS = {
  lombaires: [0, 6, 0] as Vec3, // depuis le bassin
  thorax: [0, 22, 0] as Vec3, // depuis les lombaires
  cou: [0, 27, 0] as Vec3, // depuis le thorax
  tete: [0, 6.5, 0.5] as Vec3, // depuis le cou
  epaule: [19.4, 21, 0] as Vec3, // depuis le thorax
  hanche: [10, -5, 0] as Vec3, // depuis le bassin
  bras: 30,
  avantBras: 26,
  cuisse: 43.5,
  jambe: 41.5,
  /** Hauteur de la cheville au-dessus du sol, pied à plat. */
  cheville: 8,
  /**
   * Articulation des orteils, depuis la cheville : au centre de la tête des métatarsiens,
   * à `plante` cm au-dessus de la semelle. C'est autour d'elle que le pied roule quand le
   * talon se lève (un pivot au ras de la semelle enfonçait le dessus des orteils dans le pied).
   */
  orteils: [0, -5.7, 13] as Vec3,
  /** Rayon de la tête des métatarsiens : hauteur de l'articulation des orteils au-dessus du sol. */
  plante: 2.3,
} as const;

/**
 * Pli des orteils pour un pied posé dont le talon est levé de `pointe` degrés :
 * ils restent à plat sur l'appui (sur la pointe des pieds, au fond d'une fente).
 * Au-delà de 70°, le pied bascule sur son dessus (pied arrière du squat bulgare) :
 * les orteils se remettent peu à peu dans l'axe du pied.
 */
export function plieOrteils(pointe: number): number {
  if (pointe <= 0) return 0;
  if (pointe <= 70) return pointe;
  return pointe >= 110 ? 0 : (70 * (110 - pointe)) / 40;
}

/**
 * Cible d'un pied qui se lève sur la pointe sans glisser : la plante (sous la tête
 * des métatarsiens) reste en `appui` (au sol : y = 0), le talon levé de `pointe`
 * degrés ; le pied roule autour de l'articulation des orteils. `cote` : 1 pour le
 * pied gauche, −1 pour le droit (son `tour` s'ouvre de l'autre côté).
 */
export function surLaPointe(appui: Vec3, pointe: number, tour = 0, cote: 1 | -1 = 1): CibleJambe {
  const b = M.vec(M.mul(M.ry(tour * cote), M.rx(pointe)), OS.orteils);
  return { pos: V.sub(V.add(appui, [0, OS.plante, 0]), b), pole: [Math.sin(tour * cote * RAD), 0, Math.cos(tour * RAD)], tour, pointe };
}

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
/**
 * La main doit atteindre `pos` (dans le repère d'une partie du corps, ou d'une
 * pièce de matériel) ; le coude pointe vers `pole`.
 *
 * Sans `axe`, c'est le poignet qui va en `pos`. Avec `axe`, la main tient une
 * poignée : c'est le centre du poing qui va en `pos`, et le poing tourne pour
 * que la poignée le traverse le long de `axe` (dans le même repère). Des deux
 * façons de la tenir, c'est celle qui tourne le moins l'avant-bras depuis
 * `pronation` qui est prise (0 : sa position naturelle ; ±90 pour l'autre prise).
 * La main reste ainsi au même endroit de la barre tout le long du mouvement.
 *
 * Avec `plat` (sans `axe`), la main est posée à plat, comme un pied : la paume
 * regarde `normale` et les doigts `doigts` (dans le même repère) à chaque image,
 * et c'est le poignet qui prend l'angle (pompes). Interpolée entre poses clés,
 * l'orientation de la main ferait se soulever les doigts.
 */
export interface CibleBras {
  readonly repere: string;
  readonly pos: Vec3;
  readonly pole: Vec3;
  readonly axe?: Vec3;
  readonly plat?: { readonly normale: Vec3; readonly doigts: Vec3 };
}
/**
 * La cheville doit atteindre `pos` (dans l'espace, ou dans le repère
 * `repere` d'une pièce de matériel : plateau de presse, rouleau…) ; le genou
 * pointe vers `pole` ; le pied tourne de `tour` autour de la verticale (de ce
 * repère). `pointe` : degrés dont le talon se lève (0 = pied à plat ; sur la
 * pointe, extension des mollets) ; la hauteur de la cheville est alors à
 * régler dans `pos`.
 */
export interface CibleJambe {
  readonly pos: Vec3;
  readonly pole: Vec3;
  readonly tour: number;
  readonly pointe: number;
  readonly repere?: string;
}

/** Du poignet au centre du poing (là où passe une poignée), le long de la main, en cm. */
export const PRISE = 4.8;
export interface PoseBras {
  /** Haussement de l'épaule : [vers le haut, vers l'avant], en cm. */
  readonly clav: readonly [number, number];
  readonly epaule: AnglesRotule;
  readonly coude: number;
  readonly pronation: number;
  /**
   * Poignet : `flex`, flexion (les doigts vers la paume ; négatif : extension, le dos
   * de la main vers l'avant-bras) ; `dev`, inclinaison (vers le pouce ; négatif : vers
   * l'auriculaire). Dans le repère de la main gauche, la paume regarde vers −X, les
   * doigts vers −Y, le pouce vers +Z.
   */
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

export const TRONC0: AnglesTronc = { flex: 0, penche: 0, tour: 0 };
export const BRAS0: PoseBras = {
  clav: [0, 0],
  epaule: { flex: 0, abd: 0, rot: 0 },
  coude: 0,
  pronation: 0,
  poignet: { flex: 0, dev: 0 },
  cible: null,
};
export const JAMBE0: PoseJambe = { hanche: { flex: 0, abd: 0, rot: 0 }, genou: 0, cheville: 0, cible: null };
/** Pose neutre : tout à zéro, debout. `pose({...})` décrit ce qui en diffère. */
export const POSE0: Pose = {
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

/**
 * Membre de l'autre côté, en miroir : seule une cible change (elle passe de
 * l'autre côté ; un repère d'une paire, suffixé G ou D, devient son pendant).
 */
const repereMiroir = (r: string): string => (r.endsWith('G') ? r.slice(0, -1) + 'D' : r.endsWith('D') ? r.slice(0, -1) + 'G' : r);
export const miroirBras = (p: PoseBras): PoseBras =>
  p.cible === null
    ? p
    : {
      ...p,
      cible: {
        ...p.cible,
        repere: repereMiroir(p.cible.repere),
        pos: [-p.cible.pos[0], p.cible.pos[1], p.cible.pos[2]],
        pole: [-p.cible.pole[0], p.cible.pole[1], p.cible.pole[2]],
        ...(p.cible.axe === undefined ? {} : { axe: [-p.cible.axe[0], p.cible.axe[1], p.cible.axe[2]] as Vec3 }),
        ...(p.cible.plat === undefined ? {} : {
          plat: {
            normale: [-p.cible.plat.normale[0], p.cible.plat.normale[1], p.cible.plat.normale[2]] as Vec3,
            doigts: [-p.cible.plat.doigts[0], p.cible.plat.doigts[1], p.cible.plat.doigts[2]] as Vec3,
          },
        }),
      },
    };
export const miroirJambe = (p: PoseJambe): PoseJambe =>
  p.cible === null
    ? p
    : {
      ...p,
      cible: {
        ...p.cible,
        ...(p.cible.repere === undefined ? {} : { repere: repereMiroir(p.cible.repere) }),
        pos: [-p.cible.pos[0], p.cible.pos[1], p.cible.pos[2]],
        pole: [-p.cible.pole[0], p.cible.pole[1], p.cible.pole[2]],
      },
    };

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

/** Chaque nombre suit sa courbe à travers toutes les poses clés ; le reste est pris à la pose clé `i`. */
function entreCles(vals: readonly unknown[], t: number, i: number): unknown {
  if (vals.every((v) => typeof v === 'number')) return interpoler(vals as number[], t);
  if (vals.every((v) => Array.isArray(v))) return (vals[0] as unknown[]).map((_, k) => entreCles(vals.map((v) => (v as unknown[])[k]), t, i));
  if (vals.every((v) => v !== null && typeof v === 'object')) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(vals[0]!)) o[k] = entreCles(vals.map((v) => (v as Record<string, unknown>)[k]), t, i);
    return o;
  }
  return vals[i];
}

/**
 * Pose à l'avancement `t` (0 = première pose clé, 1 = dernière). Chaque nombre
 * passe par sa valeur de chaque pose clé, sans à-coup (`interpoler`) ; un membre
 * doit garder le même mode (angles ou cible) d'une pose clé à l'autre.
 */
export function poseAu(cles: readonly Pose[], t: number): Pose {
  if (cles.length === 1) return cles[0]!;
  const i = Math.min(cles.length - 2, Math.floor(clamp(t, 0, 1) * (cles.length - 1)));
  return entreCles(cles, t, i) as Pose;
}

/** Cible d'un pied posé au sol : écart au centre, et angle d'ouverture du pied. */
export const piedAuSol = (ecart: number, tour: number, avance = 0): CibleJambe => ({
  pos: [ecart, OS.cheville, avance],
  pole: [Math.sin(tour * RAD), 0, Math.cos(tour * RAD)],
  tour,
  pointe: 0,
});

// -----------------------------------------------------------------------------
// Limites anatomiques, en degrés. Une pose qui en sort est ramenée dedans.
// -----------------------------------------------------------------------------
type Bornes = readonly [number, number];
export const LIMITES = {
  epaule: { flex: [-60, 180] as Bornes, abd: [-40, 180] as Bornes, rot: [-90, 90] as Bornes },
  coude: [0, 160] as Bornes,
  pronation: [-90, 90] as Bornes,
  // Extension jusqu'à 90° (amplitude passive, citée de mémoire) : la main à plat au sol
  // sous un avant-bras vertical (pompes, gainage).
  poignet: { flex: [-90, 80] as Bornes, dev: [-35, 25] as Bornes },
  hanche: { flex: [-25, 140] as Bornes, abd: [-30, 55] as Bornes, rot: [-45, 45] as Bornes },
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
export const REPERES_PAIRS = ['omoplate', 'epaule', 'coude', 'cubitus', 'poignet', 'delto', 'hanche', 'genou', 'cheville', 'orteils', 'plante', 'fessier', 'rotule'] as const;
/** Repères du tronc, et le repère fixe du monde. */
export const REPERES_CENTRAUX = ['monde', 'bassin', 'lombaires', 'thorax', 'cou', 'tete'] as const;

/**
 * Orientation à mi-chemin entre le tronc (A) et le bras (B), pour l'épaule :
 * le balancement du bras (de combien et dans quel sens il s'écarte du corps)
 * et sa rotation sur lui-même sont partagés séparément. Le plus court chemin
 * d'une orientation à l'autre (`M.entre`) bascule d'un coup quand le bras
 * levé au-dessus de la tête approche du demi-tour : les deltoïdes sautaient.
 */
function aMiChemin(A: Mat3, B: Mat3, t: number): Mat3 {
  const R = M.mul(M.transposee(A), B), d = M.vec(R, [0, -1, 0]);
  const cosA = clamp(-d[1], -1, 1), ang = Math.acos(cosA);
  let k: Vec3 = V.cross([0, -1, 0], d);
  // Bras le long du corps : pas de balancement. Tendu droit vers le haut : on balance vers l'avant.
  k = V.len(k) > 1e-6 ? V.norm(k) : [1, 0, 0];
  const balance = ang < 1e-6 ? IDENTITE : M.axe(k, ang);
  const tors = M.mul(M.transposee(balance), R);
  const phi = Math.atan2(tors[2]!, tors[0]!) / RAD;
  return M.mul(A, M.mul(ang < 1e-6 ? IDENTITE : M.axe(k, ang * t), M.ry(phi * t)));
}

/**
 * Pose → repères de chaque partie du corps.
 *
 * Trois repères sont à cheval sur une articulation et tournent entre les deux
 * os : `delto` (épaule, à mi-chemin), `rotule` (genou, à mi-chemin) et
 * `fessier` (hanche, un quart du chemin seulement).
 * Les muscles qui coiffent ces articulations s'en servent pour savoir vers où
 * ils regardent.
 *
 * Deux repères portent les attaches qui ne suivent pas l'os voisin :
 * `omoplate` (le thorax, déplacé du haussement d'épaule `clav` : deltoïdes et
 * trapèze montent avec l'épaule) et `cubitus` (l'avant-bras sans la
 * pronation : le coude, où s'attache le triceps, ne tourne pas avec la main).
 *
 * `materiel` : les repères des pièces de matériel (poignées, plateau,
 * rouleau…), calculés une fois le tronc placé (une barre posée sur le dos suit
 * le thorax) ; une main ou un pied peut ensuite les viser.
 */
export function resoudre(p: Pose, materiel?: (tronc: Reperes) => Reperes): Reperes {
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
  if (materiel !== undefined) Object.assign(F, materiel(F));

  for (const [c, cote] of [['G', 1], ['D', -1]] as const) {
    // Bras
    const br = c === 'G' ? p.brasG : p.brasD;
    const S = V.add(th.o, M.vec(th.R, [OS.epaule[0] * cote, OS.epaule[1] + br.clav[0], OS.epaule[2] + br.clav[1]]));
    let Ru: Mat3, coude: Vec3, Rf: Mat3, Rcub: Mat3, poignet: Vec3, Rmain: Mat3 | null = null;
    if (br.cible !== null) {
      const rep = F[br.cible.repere];
      if (rep === undefined) throw new Error(`Repère inconnu pour la cible du bras : ${br.cible.repere}`);
      const T = V.add(rep.o, M.vec(rep.R, br.cible.pos)), pole = M.vec(rep.R, br.cible.pole);
      if (br.cible.axe === undefined) {
        const k = deuxOs(S, T, OS.bras, OS.avantBras, pole, -1, LIMITES.coude[1]);
        Ru = k.R1; coude = k.J; poignet = k.E; Rcub = k.R2;
        Rf = M.mul(k.R2, M.ry(borne(br.pronation, LIMITES.pronation) * cote));
        if (br.cible.plat !== undefined) {
          // Main posée à plat : la paume (−X à gauche, +X à droite) et les doigts (−Y) sont imposés.
          const X = V.norm(V.mul(M.vec(rep.R, br.cible.plat.normale), -cote));
          const d = V.mul(M.vec(rep.R, br.cible.plat.doigts), -1), Y = V.norm(V.sub(d, V.mul(X, V.dot(X, d))));
          Rmain = M.depuisColonnes(X, Y, V.cross(X, Y));
        }
      } else {
        // Une poignée : l'avant-bras tourne, puis le poignet s'incline, jusqu'à ce
        // qu'elle traverse le poing ; le poignet est ensuite placé pour que le
        // centre du poing soit sur la poignée (quelques passes). Une poignée se
        // tient dans un sens ou dans l'autre : on prend celui qui tourne le moins
        // l'avant-bras par rapport à la pronation demandée (0 : sa position
        // naturelle), sans quoi l'avant-bras se tordrait d'un demi-tour.
        const A0 = M.vec(rep.R, br.cible.axe), voulu = borne(br.pronation, LIMITES.pronation) * cote * RAD;
        const ecart = (x: number): number => Math.abs(Math.atan2(Math.sin(x - voulu), Math.cos(x - voulu)));
        const tenir = (R2: Mat3): { Rf: Mat3; Rm: Mat3 } => {
          let R = R2, a = M.vec(M.transposee(R), A0);
          if (Math.hypot(a[0], a[2]) > 1e-6) {
            const phi = Math.atan2(a[0], a[2]), autre = phi + Math.PI;
            if (ecart(autre) < ecart(phi)) a = V.mul(a, -1);
            R = M.mul(R, M.ry(Math.atan2(a[0], a[2]) / RAD));
            a = [0, a[1], Math.hypot(a[0], a[2])];
          }
          return { Rf: R, Rm: M.mul(R, M.rx(clamp(Math.atan2(-a[1], a[2]) / RAD, -40, 40))) };
        };
        let k = deuxOs(S, T, OS.bras, OS.avantBras + PRISE, pole, -1, LIMITES.coude[1]), m = tenir(k.R2);
        for (let passe = 0; passe < 3; passe++) {
          k = deuxOs(S, V.sub(T, M.vec(m.Rm, [0, -PRISE, 0])), OS.bras, OS.avantBras, pole, -1, LIMITES.coude[1]);
          m = tenir(k.R2);
        }
        Ru = k.R1; coude = k.J; poignet = k.E; Rcub = k.R2; Rf = m.Rf; Rmain = m.Rm;
      }
    } else {
      Ru = M.mul(th.R, rotRotule(borneRotule(br.epaule, LIMITES.epaule), cote));
      coude = V.add(S, M.vec(Ru, [0, -OS.bras, 0]));
      Rf = M.mul(Ru, M.rx(-borne(br.coude, LIMITES.coude)));
      Rcub = Rf;
      poignet = V.add(coude, M.vec(Rf, [0, -OS.avantBras, 0]));
      Rf = M.mul(Rf, M.ry(borne(br.pronation, LIMITES.pronation) * cote));
    }
    F['epaule' + c] = { o: S, R: Ru };
    F['coude' + c] = { o: coude, R: Rf };
    F['cubitus' + c] = { o: coude, R: Rcub };
    F['poignet' + c] = {
      o: poignet,
      R: Rmain ?? M.mul(M.mul(Rf, M.rx(-borne(br.poignet.dev, LIMITES.poignet.dev))), M.rz(-borne(br.poignet.flex, LIMITES.poignet.flex) * cote)),
    };
    F['delto' + c] = { o: S, R: aMiChemin(th.R, Ru, 0.55) };
    F['omoplate' + c] = { o: V.add(th.o, M.vec(th.R, [0, br.clav[0], br.clav[1]])), R: th.R };

    // Jambe
    const ja = c === 'G' ? p.jambeG : p.jambeD;
    const H = V.add(b.pos, M.vec(Rb, [OS.hanche[0] * cote, OS.hanche[1], OS.hanche[2]]));
    let Rc: Mat3, genou: Vec3, Rj: Mat3, cheville: Vec3, Rp: Mat3, orteils = 0;
    if (ja.cible !== null) {
      orteils = plieOrteils(ja.cible.pointe);
      const rp = F[ja.cible.repere ?? 'monde'];
      if (rp === undefined) throw new Error(`Repère inconnu pour la cible de la jambe : ${ja.cible.repere}`);
      const T = V.add(rp.o, M.vec(rp.R, ja.cible.pos));
      const k = deuxOs(H, T, OS.cuisse, OS.jambe, M.vec(rp.R, ja.cible.pole), 1, LIMITES.genou[1]);
      Rc = k.R1; genou = k.J; Rj = k.R2; cheville = k.E;
      // Le pied ne suit pas la jambe : il reste posé (à plat, ou sur la pointe), au sol ou sur la pièce.
      Rp = M.mul(rp.R, M.mul(M.ry(ja.cible.tour * cote), M.rx(ja.cible.pointe)));
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
    F['orteils' + c] = { o: V.add(cheville, M.vec(Rp, OS.orteils)), R: M.mul(Rp, M.rx(-orteils)) };
    // À cheval sur la base des orteils, comme la rotule sur le genou.
    F['plante' + c] = { o: F['orteils' + c]!.o, R: M.mul(Rp, M.rx(-orteils / 2)) };
    // La fesse tient au bassin : elle ne suit la cuisse que d'un quart.
    F['fessier' + c] = { o: H, R: M.entre(Rb, Rc, 0.25) };
    F['rotule' + c] = { o: genou, R: M.entre(Rc, Rj, 0.5) };
  }
  return F;
}
