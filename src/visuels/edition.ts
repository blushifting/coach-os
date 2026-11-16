/**
 * Édition des poses, pour l'atelier : décrire une pose par ce qui diffère de la
 * pose neutre, écrire le fichier d'un exercice et le registre, faire passer un
 * membre des angles à une cible (et inversement) sans qu'il bouge.
 *
 * Pur : l'atelier s'en sert, les tests aussi. Le fichier écrit ici est celui
 * que lisent la fiche, l'atelier et la planche (une seule source par exercice).
 */

import { IDENTITE, M, RAD, V, clamp } from './maths';
import type { Mat3, Vec3 } from './maths';
import type { PoseExercice } from './scene';
import { BRAS0, JAMBE0, LIMITES, POSE0, miroirBras, miroirJambe, resoudre } from './squelette';
import type { AnglesRotule, DescriptionPose, Pose, PoseBras, PoseJambe, Reperes } from './squelette';

export type Cote = 'G' | 'D';
const signe = (c: Cote): number => (c === 'G' ? 1 : -1);

// -----------------------------------------------------------------------------
// Comparer, arrondir
// -----------------------------------------------------------------------------
/** Deux décimales, symétrique (−x s'arrondit en −arrondi(x)), jamais « −0 ». */
export function arrondi(x: number): number {
  const r = (Math.sign(x) * Math.round(Math.abs(x) * 100)) / 100;
  return r === 0 ? 0 : r;
}

/** Égalité à l'arrondi près, en profondeur. */
export function egal(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return arrondi(a) === arrondi(b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => egal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Ce qui, dans `v`, diffère de `base` ; `undefined` si rien. Un tableau ou une cible se donne en entier. */
function difference(v: unknown, base: unknown): unknown {
  if (egal(v, base)) return undefined;
  if (v === null || base === null || typeof v !== 'object' || typeof base !== 'object' || Array.isArray(v)) return v;
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const d = difference(x, (base as Record<string, unknown>)[k]);
    if (d !== undefined) o[k] = d;
  }
  return o;
}

/** Une pose décrite par ce qui diffère de la pose neutre : `pose(decrirePose(p))` redonne `p`. */
export function decrirePose(p: Pose): DescriptionPose {
  const d: Record<string, unknown> = {};
  const noter = (cle: string, v: unknown): void => {
    if (v !== undefined) d[cle] = v;
  };
  for (const k of ['bassin', 'lombaires', 'thorax', 'cou', 'tete'] as const) noter(k, difference(p[k], POSE0[k]));
  if (egal(p.brasD, miroirBras(p.brasG))) noter('bras', difference(p.brasG, BRAS0));
  else {
    noter('brasG', difference(p.brasG, BRAS0));
    noter('brasD', difference(p.brasD, BRAS0));
  }
  if (egal(p.jambeD, miroirJambe(p.jambeG))) noter('jambe', difference(p.jambeG, JAMBE0));
  else {
    noter('jambeG', difference(p.jambeG, JAMBE0));
    noter('jambeD', difference(p.jambeD, JAMBE0));
  }
  return d as DescriptionPose;
}

// -----------------------------------------------------------------------------
// Écrire du TypeScript lisible
// -----------------------------------------------------------------------------
const LARGEUR = 100;
const cle = (k: string): string => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const entrees = (v: object): [string, unknown][] => Object.entries(v).filter(([, x]) => x !== undefined);

function enLigne(v: unknown): string {
  if (typeof v === 'number') return String(arrondi(v));
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v === 'boolean' || v === null) return String(v);
  if (Array.isArray(v)) return `[${v.map(enLigne).join(', ')}]`;
  const e = entrees(v as object);
  return e.length === 0 ? '{}' : `{ ${e.map(([k, x]) => `${cle(k)}: ${enLigne(x)}`).join(', ')} }`;
}

/** Un littéral sur une ligne s'il tient dans la largeur, sinon déplié. */
function litteral(v: unknown, retrait: string, debut = 0): string {
  const l = enLigne(v);
  if (retrait.length + debut + l.length <= LARGEUR || v === null || typeof v !== 'object') return l;
  const r2 = retrait + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => `${r2}${litteral(x, r2)},`).join('\n')}\n${retrait}]`;
  const lignes = entrees(v).map(([k, x]) => `${r2}${cle(k)}: ${litteral(x, r2, cle(k).length + 2)},`);
  return `{\n${lignes.join('\n')}\n${retrait}}`;
}

/** Le fichier `src/visuels/poses/<id>.ts` d'un exercice. `nom` : son nom dans le catalogue. */
export function fichierPose(sujet: PoseExercice, nom: string): string {
  return [
    "import type { PoseExercice } from '../scene';",
    "import { pose } from '../squelette';",
    '',
    '/**',
    ` * ${nom}.`,
    ' *',
    " * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement",
    ' * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;',
    ' * un commentaire ajouté ici serait perdu au prochain enregistrement.',
    ' */',
    `export const ${sujet.id}: PoseExercice = {`,
    `  id: '${sujet.id}',`,
    `  camera: ${enLigne(sujet.camera)},`,
    `  mainFermee: ${sujet.mainFermee},`,
    `  materiel: ${litteral(sujet.materiel, '  ', 'materiel: '.length)},`,
    '  cles: [',
    ...sujet.cles.map((k) => `    pose(${litteral(decrirePose(k), '    ', 'pose('.length)}),`),
    '  ],',
    `  valide: ${sujet.valide},`,
    '};',
    '',
  ].join('\n');
}

/** Le registre `src/visuels/poses/index.ts`, pour ces identifiants. */
export function fichierRegistre(ids: readonly string[]): string {
  const tries = [...ids].sort();
  return [
    '/**',
    " * Registre des poses : une entrée par exercice posé, sous l'identifiant du",
    ' * catalogue. Un fichier par exercice, à côté de celui-ci.',
    ' *',
    " * Écrit par l'atelier des visuels à chaque enregistrement.",
    ' *',
    " * Une pose non validée (`valide: false`) n'est vue que dans l'atelier : la",
    " * fiche de l'exercice garde ses photos tant qu'Azur ne l'a pas validée.",
    ' */',
    '',
    "import type { PoseExercice } from '../scene';",
    ...tries.map((id) => `import { ${id} } from './${id}';`),
    '',
    'export const POSES: Readonly<Record<string, PoseExercice>> = {',
    ...tries.map((id) => `  ${id},`),
    '};',
    '',
    '/** La pose d\'un exercice, si elle existe et qu\'elle est validée. */',
    'export function poseValidee(exerciseId: string): PoseExercice | null {',
    '  const p = POSES[exerciseId];',
    '  return p !== undefined && p.valide ? p : null;',
    '}',
    '',
  ].join('\n');
}

// -----------------------------------------------------------------------------
// Angles ↔ cible
// -----------------------------------------------------------------------------
type Bornes = readonly [number, number];
const borne = (v: number, [a, b]: Bornes): number => clamp(v, a, b);
const T = M.transposee;

/** Repère d'une partie du corps (erreur si inconnu). */
const rep = (F: Reperes, nom: string): { o: Vec3; R: Mat3 } => {
  const r = F[nom];
  if (r === undefined) throw new Error(`Repère inconnu : ${nom}`);
  return r;
};

/**
 * Balancement d'une rotule (épaule, hanche) : la flexion et l'abduction qui
 * amènent l'os, dirigé vers −Y au repos, dans la direction `d` (repère du
 * parent), et la rotation `B` correspondante. `cote` : +1 à gauche, −1 à droite.
 */
export function balancement(d: Vec3, cote: number): { flex: number; abd: number; B: Mat3 } {
  const u = V.norm(d), ang = Math.acos(clamp(-u[1], -1, 1));
  if (ang < 1e-6) return { flex: 0, abd: 0, B: IDENTITE };
  // Axe du balancement : perpendiculaire à la verticale et à l'os (dans le plan horizontal).
  const c = V.cross([0, -1, 0], u);
  const k: Vec3 = V.len(c) > 1e-6 ? V.norm(c) : [-1, 0, 0];
  return { flex: (-k[0] * ang) / RAD, abd: (k[2] * ang) / (RAD * cote), B: M.axe(k, ang) };
}

/**
 * Angles d'une rotule (épaule, hanche) depuis l'orientation de l'os par rapport
 * à son parent. Inverse de la rotule du squelette : un balancement sans torsion
 * qui amène l'os dans sa direction, puis une rotation sur l'axe de l'os.
 */
function anglesRotule(rel: Mat3, cote: number, l: { flex: Bornes; abd: Bornes; rot: Bornes }): AnglesRotule {
  const { flex, abd, B } = balancement(M.vec(rel, [0, -1, 0]), cote);
  const Q = M.mul(T(B), rel);
  const rot = Math.atan2(Q[2]!, Q[0]!) / RAD / cote;
  return { flex: borne(flex, l.flex), abd: borne(abd, l.abd), rot: borne(rot, l.rot) };
}

/** Vers où pointe l'articulation du milieu (J), perpendiculairement à la ligne racine (S) → bout (E). */
function poleDe(S: Vec3, J: Vec3, E: Vec3, secours: Vec3): Vec3 {
  const dir = V.norm(V.sub(E, S)), j = V.sub(J, S);
  const pp = V.sub(j, V.mul(dir, V.dot(j, dir)));
  return V.len(pp) < 1e-3 ? V.norm(secours) : V.norm(pp);
}

const brasDe = (p: Pose, c: Cote): PoseBras => (c === 'G' ? p.brasG : p.brasD);
const jambeDe = (p: Pose, c: Cote): PoseJambe => (c === 'G' ? p.jambeG : p.jambeD);

/**
 * Repères du matériel, pour une pose dont un membre vise une pièce (poignée,
 * plateau…) : à passer aux conversions ci-dessous.
 */
export type ReperesEnPlus = (tronc: Reperes) => Reperes;

/** Le bras passe en cible (la main suit un point d'un repère), sans bouger. */
export function brasEnCible(p: Pose, c: Cote, repere: string, autres?: ReperesEnPlus): PoseBras {
  const F = resoudre(p, autres), r = rep(F, repere);
  const S = rep(F, 'epaule' + c).o, J = rep(F, 'coude' + c).o, E = rep(F, 'poignet' + c).o;
  // Bras tendu : le coude n'indique rien ; on le fait pointer vers l'arrière.
  const secours = M.vec(rep(F, 'thorax').R, [0, -0.4, -1]);
  return {
    ...brasDe(p, c),
    cible: { repere, pos: M.vec(T(r.R), V.sub(E, r.o)), pole: M.vec(T(r.R), poleDe(S, J, E, secours)) },
  };
}

/** Le bras passe en angles, sans bouger (à la rotation du bras près si la cible la laissait libre). */
export function brasEnAngles(p: Pose, c: Cote, autres?: ReperesEnPlus): PoseBras {
  const F = resoudre(p, autres), br = brasDe(p, c), cote = signe(c);
  const Ru = rep(F, 'epaule' + c).R;
  const epaule = anglesRotule(M.mul(T(rep(F, 'thorax').R), Ru), cote, LIMITES.epaule);
  // Avant-bras : flexion du coude autour de l'axe X du bras, une fois la pronation ôtée.
  const X = M.mul(M.mul(T(Ru), rep(F, 'coude' + c).R), M.ry(-borne(br.pronation, LIMITES.pronation) * cote));
  const coude = borne(Math.atan2(-X[7]!, X[4]!) / RAD, LIMITES.coude);
  return { ...br, epaule, coude, cible: null };
}

/** La jambe passe en cible (le pied reste où il est, dans l'espace ou sur une pièce), sans bouger. */
export function jambeEnCible(p: Pose, c: Cote, repere = 'monde', autres?: ReperesEnPlus): PoseJambe {
  const F = resoudre(p, autres), cote = signe(c), r = rep(F, repere), Rt = T(r.R);
  const H = rep(F, 'hanche' + c).o, J = rep(F, 'genou' + c).o, ch = rep(F, 'cheville' + c);
  // Orientation du pied, dans le repère : tour autour de sa verticale, puis talon levé (`pointe`).
  const f = M.vec(Rt, M.vec(ch.R, [0, 0, 1]));
  const tour = (Math.atan2(f[0], f[2]) / RAD) * cote;
  const pointe = Math.atan2(-f[1], Math.hypot(f[0], f[2])) / RAD;
  const secours: Vec3 = M.vec(r.R, [f[0], 0, f[2]]);
  const cible = { pos: M.vec(Rt, V.sub(ch.o, r.o)), pole: M.vec(Rt, poleDe(H, J, ch.o, secours)), tour, pointe };
  return { ...jambeDe(p, c), cible: repere === 'monde' ? cible : { ...cible, repere } };
}

/** La jambe passe en angles, sans bouger. */
export function jambeEnAngles(p: Pose, c: Cote, autres?: ReperesEnPlus): PoseJambe {
  const F = resoudre(p, autres), cote = signe(c);
  const Rc = rep(F, 'hanche' + c).R, Rj = rep(F, 'genou' + c).R;
  const hanche = anglesRotule(M.mul(T(rep(F, 'bassin').R), Rc), cote, LIMITES.hanche);
  const X = M.mul(T(Rc), Rj), Y = M.mul(T(Rj), rep(F, 'cheville' + c).R);
  return {
    ...jambeDe(p, c),
    hanche,
    genou: borne(Math.atan2(X[7]!, X[4]!) / RAD, LIMITES.genou),
    cheville: borne(Math.atan2(-Y[7]!, Y[4]!) / RAD, LIMITES.cheville),
    cible: null,
  };
}
