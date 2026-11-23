/**
 * Machines guidées. Chacune a sa propre course (`course` : une valeur par
 * étape du mouvement, la première au départ, où la charge est posée) : un
 * angle pour un levier qui pivote, des centimètres pour un traîneau qui
 * coulisse. La machine bouge selon sa course, ses pièces restent rigides, et
 * elle offre des repères (poignées, rouleau, plateau…) que les mains et les
 * pieds visent. C'est la machine qui porte le mouvement : une poignée décrit
 * un arc de cercle si son levier pivote.
 *
 * Règles de construction (relecture d'Azur) : l'articulation qui travaille est
 * sur l'axe du levier (genou, coude, épaule) ; un coussin est là où le corps
 * repose, tourné vers lui ; rien ne flotte (chaque pièce tient au châssis) ;
 * la course ne dépasse pas l'amplitude du corps.
 *
 * Repères d'une paire : suffixe G (côté gauche du mannequin, X positif) ou D.
 * Celui de droite est le miroir de celui de gauche, si bien qu'une pose
 * décrite pour le côté gauche vaut pour les deux.
 *
 * Toutes sont décrites l'utilisateur regardant vers +Z, le milieu du siège (ou
 * de la place) au-dessus de `pos`. Les mesures supposent le mannequin de
 * 180 cm (épaules à 19,4 cm du milieu, hanches à 10 cm) assis sur le siège dessiné.
 */

import { M, RAD, V } from '../maths';
import type { Mat3, Vec3 } from '../maths';
import type { Repere } from '../squelette';
import { auSol, auTemps, cablePile, dans, dossier, leveeDe, poignee, socle, siege, tourCharge, traceur } from './outils';
import type { Contexte, Modele, Traceur } from './outils';

interface AuSol { readonly pos: Vec3; readonly tour: number; readonly course: readonly number[] }

/**
 * Pec deck : bras qui pivotent au-dessus des épaules, assez longs pour des bras presque tendus. `course` : ouverture
 * (0 = poignées devant la poitrine, 90 = sur le côté). `variante` : `butterfly`, ou `inverse` (deltoïdes postérieurs) :
 * l'utilisateur s'assied face à la colonne, la poitrine contre le coussin (il regarde vers −Z) ; les bras, plus courts,
 * partent devant lui. Repères : `poigneeG`, `poigneeD` (axe Y).
 */
export interface PecDeck extends AuSol { readonly type: 'pecDeck'; readonly variante: 'butterfly' | 'inverse' }
/**
 * Développé machine : leviers qui pivotent, poignées horizontales. `variante` :
 * couché (pousser devant soi), incliné, épaules (pousser vers le haut).
 * `course` : cm parcourus par les poignées (0 = mains à la poitrine ou aux
 * épaules). Repères : `poigneeG`, `poigneeD` (axe X).
 */
export interface DeveloppeMachine extends AuSol { readonly type: 'developpeMachine'; readonly variante: 'couche' | 'incline' | 'epaules' }
/** Tirage horizontal à la machine : appui contre le haut des abdos, leviers qui pivotent en bas. `course` : cm tirés (0 = bras tendus). Repères : `poigneeG`, `poigneeD` (axe Y). */
export interface TirageHorizontalMachine extends AuSol { readonly type: 'tirageHorizontalMachine' }
/** Presse à cuisses assise : plaque verticale devant, qui recule sur des rails horizontaux. `course` : cm de recul (0 = jambes pliées). Repère : `plateau` (Y sort de la semelle, Z vers les orteils). */
export interface PresseCuisses extends AuSol { readonly type: 'presseCuisses' }
/** Hack squat : dos au traîneau, épaulières. `course` : cm de descente (0 = debout). Repères : `plateau` (fixe), `traineau` (Y le long des rails, Z vers l'avant ; poignées en [±32, 6, 18]). */
export interface HackSquat extends AuSol { readonly type: 'hackSquat' }
/** Smith machine : barre guidée verticalement. `course` : hauteur de la barre (cm). Repère : `barre`. */
export interface Smith extends AuSol { readonly type: 'smith' }
/**
 * Leg extension, leg curl assis et couché : le levier pivote dans l'axe des
 * genoux (seul le bas de la jambe bouge). `course` : flexion des genoux
 * (0 = jambes tendues, 90 = pliées). Repère : `rouleau` (Y le long du tibia
 * vers le genou, Z vers l'avant du tibia) ; cheville en [±10, 0, −9] pour
 * l'extension (rouleau devant le tibia), [±10, 0, 9] pour les curls (rouleau derrière).
 */
export interface LegExtension extends AuSol { readonly type: 'legExtension' }
export interface LegCurlAssis extends AuSol { readonly type: 'legCurlAssis' }
/** Leg curl couché, sur le ventre, tête vers +Z. */
export interface LegCurlCouche extends AuSol { readonly type: 'legCurlCouche' }
/** Mollets debout : épaulières qui montent. `course` : cm d'élévation. Repères : `epaulieres` (poignées en [±20, 6, 18], axe Y), `marche` (fixe). */
export interface MolletsDebout extends AuSol { readonly type: 'molletsDebout' }
/** Mollets assis : coussin sur les genoux, levier chargé. `course` : cm d'élévation. Repères : `genoux`, `marche` (fixe). */
export interface MolletsAssis extends AuSol { readonly type: 'molletsAssis' }
/**
 * Élévations latérales à la machine : un levier par bras, qui pivote devant
 * l'épaule, dans son axe ; un coussin contre l'extérieur du bras, une poignée
 * au bout de l'avant-bras. `course` : abduction (degrés). Repères : `poigneeG`, `poigneeD` (axe Y).
 */
export interface ElevationsMachine extends AuSol { readonly type: 'elevationsMachine' }
/**
 * Curl ou extension triceps à la machine : les bras reposent sur un pupitre
 * large, les coudes dans l'axe du levier. `course` : angle de l'avant-bras
 * (0 = vers l'avant à l'horizontale, 90 = vers le haut, −40 = dans le
 * prolongement du bras). `variante` : curl (barre, mains à ±14 cm, axe X) ou
 * triceps (deux poignées verticales, prise neutre, mains à ±12 cm, axe Y) : la
 * poignée dit tout de suite de quel exercice il s'agit. Repère : `barre`.
 *
 * Variante `ecarte` (curl biceps machine, bras écartés) : assis droit, les bras à
 * l'horizontale sur les côtés (un peu vers l'avant), posés sur des coussins ; un
 * levier par bras pivote dans l'axe du coude. `course` : flexion du coude (0 =
 * bras tendu). Repères : `poigneeG`, `poigneeD` (la poignée traverse le poing
 * d'arrière en avant, perpendiculaire au plan du bras : axe Z du repère ; X le
 * long de l'avant-bras, vers la main).
 */
export interface CurlMachine extends AuSol { readonly type: 'curlMachine'; readonly variante: 'curl' | 'triceps' | 'ecarte' }
/**
 * Pullover à la machine, bras presque tendus : le levier pivote dans l'axe des
 * épaules, la barre est au bout, à une longueur de bras ; elle décrit un grand
 * arc de derrière la tête jusqu'aux cuisses. `course` : angle des bras (0 = devant
 * à l'horizontale, 90 = en haut, 130 = derrière la tête). Repère : `barre` (axe X ;
 * mains à ±16 cm).
 */
export interface PulloverMachine extends AuSol { readonly type: 'pulloverMachine' }
/** Kickback fessiers : debout penché, buste sur un appui ; la jambe gauche pousse un plateau vers l'arrière. `course` : angle du levier (0 = vers le bas). Repère : `plateau`. */
export interface KickbackMachine extends AuSol { readonly type: 'kickbackMachine' }
/**
 * Abducteurs ou adducteurs : assis, genoux contre des coussins qui s'ouvrent.
 * `course` : ouverture de chaque jambe (degrés). Repères : `coussinG`/`D`, `piedG`/`D` (repose-pieds).
 */
export interface AbdAdducteurs extends AuSol { readonly type: 'abdAdducteurs'; readonly variante: 'abduction' | 'adduction' }
/**
 * Hip thrust à la machine : omoplates sur le dossier, rouleau sur les hanches ;
 * le corps pivote autour des épaules. `course` : bascule du buste (degrés, comme
 * celle du bassin : −60 = hanches basses, −95 = en pont). Le bassin est alors en
 * [0, 58 − 49·cos, −38 − 49·sin]. Repère : `coussin` (mains sur le rouleau, à ±22 cm, axe X).
 */
export interface HipThrustMachine extends AuSol { readonly type: 'hipThrustMachine' }
/**
 * Crunch à la machine : levier qui pivote sur les côtés, à la taille ; ses bras
 * montent derrière les épaules et portent deux coussins posés sur le haut des
 * épaules, et deux poignées verticales à côté de la tête ; les pieds se calent
 * sous des rouleaux. `course` : angle du buste (degrés vers l'avant).
 * Repères : `poigneeG`, `poigneeD` (axe Y).
 */
export interface CrunchMachine extends AuSol { readonly type: 'crunchMachine' }
/**
 * Tractions et dips assistés : à genoux sur un plateau porté par un chariot
 * qui glisse le long de deux tiges, tiré vers le haut par la pile (un contrepoids :
 * elle monte quand on descend). `course` : cm de montée du plateau.
 * L'utilisateur est face à la tour (devant lui, vers +Z) ; le plateau s'étend
 * derrière ses genoux, sous les tibias. Repères : `barre` (tractions), `barres` (dips), `genoux`.
 */
export interface Assistee extends AuSol { readonly type: 'assistee' }

// -----------------------------------------------------------------------------
// Outils propres aux machines
// -----------------------------------------------------------------------------

/** `p` tourné de `deg` autour de l'axe X passant par `pivot`. */
const autourX = (pivot: Vec3, p: Vec3, deg: number): Vec3 => V.add(pivot, M.vec(M.rx(deg), V.sub(p, pivot)));
/** Miroir gauche-droite d'une orientation (pour le repère de droite d'une paire). */
const miroir = (R: Mat3): Mat3 => { const Mx = [-1, 0, 0, 0, 1, 0, 0, 0, 1]; return M.mul(M.mul(Mx, R), Mx); };
const paire = (base: Repere, nom: string, o: Vec3, R: Mat3): Record<string, Repere> => ({
  [nom + 'G']: dans(base, o, R),
  [nom + 'D']: dans(base, [-o[0], o[1], o[2]], miroir(R)),
});
const sym = (s: number, v: Vec3): Vec3 => [s * v[0], v[1], v[2]];
/** Course de la charge pour un levier : l'angle (degrés) ramené en cm de câble sur un rayon `r`. */
const cmDeLevier = (deg: number, r = 14): number => deg * RAD * r;
/**
 * Pile dans le plan `z`. Le câble monte jusqu'à la poulie du haut de la tour,
 * puis jusqu'à `vers` seulement s'il longe le châssis : un câble qui traverserait
 * l'espace devant l'utilisateur est censé passer dans le châssis, on ne le dessine pas.
 */
function charge(t: Traceur, c: Contexte, course: number, z: number, haut: number, vers: readonly Vec3[], x = 0): void {
  const tige = tourCharge(t, z, haut, 10, leveeDe(course, c.repos), x);
  cablePile(t, tige, haut, vers);
}
/** Poignées de part et d'autre du siège, le long de Z, sur un montant qui part du socle. */
function poigneesSiege(t: Traceur, y: number, z: number, x = 24): void {
  traverseAuSol(t, x, z);
  for (const s of [1, -1]) {
    t.poutre([s * x, 0, z], [s * x, y, z], 4, 4);
    poignee(t, [s * x, y, z], [0, 0, 1], 6);
  }
}
/**
 * Traverse au sol, de `-x` à `x` en `z`, qui rattache les pieds de deux montants (en `±x`) à la
 * poutre centrale du socle : une machine est d'un seul tenant, rien n'est simplement posé à côté.
 */
function traverseAuSol(t: Traceur, x: number, z: number): void {
  t.poutre([-x, 3, z], [x, 3, z], 6, 6, 'cadre', [0, 0, 1]);
}

// -----------------------------------------------------------------------------
// Pec deck
// -----------------------------------------------------------------------------

const PEC = { y: 186, z: -8, zInverse: -2, x: 21, bras: 58, mains: 113 };
const anglePec = (p: PecDeck, t: number): number => auTemps(p.course, t) - 13;
/**
 * Axe des bras (Z) : au-dessus des épaules de l'utilisateur, qui, au pec deck inversé, sont plus loin du
 * coussin (la poitrine s'y appuie, pas le dos) : les bras pivotent alors un peu plus près du siège.
 */
const zPec = (inverse: boolean): number => (inverse ? PEC.zInverse : PEC.z);
/** Poignée gauche (`s` = 1) ou droite : devant le coussin, ou derrière lui, côté colonne (pec deck inversé). */
function poignePec(th: number, s = 1, inverse = false): Vec3 {
  return [s * (PEC.x + PEC.bras * Math.sin(th * RAD)), PEC.mains, zPec(inverse) + (inverse ? -1 : 1) * PEC.bras * Math.cos(th * RAD)];
}
export const PEC_DECK: Modele<PecDeck> = {
  reperes(p, _F, t) {
    const th = anglePec(p, t), inv = p.variante === 'inverse';
    return paire(auSol(p.pos, p.tour), 'poignee', poignePec(th, 1, inv), M.ry(inv ? -th : th));
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), th = anglePec(p, c.t), haut = PEC.y, zt = -72, zc = -26, inv = p.variante === 'inverse';
    for (const s of [1, -1]) {
      const P: Vec3 = [s * PEC.x, haut - 4, zPec(inv)], H = poignePec(th, s, inv), Q: Vec3 = [H[0], P[1], H[2]];
      t.cyl([P[0], haut - 10, P[2]], [P[0], haut + 2, P[2]], 3.4, 'metal');
      t.poutre(P, Q, 5, 5, 'cadre', [0, 1, 0]);
      t.boule(Q, 2.6, 'cadre');
      t.cyl(Q, V.sub(H, [0, 10, 0]), 1.6, 'metal');
      t.cyl(V.add(H, [0, 7, 0]), V.sub(H, [0, 8, 0]), 2.3, 'coussin');
    }
    socle(t, zt, 34, 56, 48);
    siege(t, [0, 51.5, 4], 18, 17);
    // Coussin du dos ; au pec deck inversé, la poitrine s'y appuie : il s'arrête plus haut, au-dessus des cuisses.
    if (inv) t.pave([0, 100, -15], [15, 0, 0], [0, 24, 0], [0, 0, 3.5], 'coussin', 2.6);
    else t.pave([0, 92, -15], [15, 0, 0], [0, 32, 0], [0, 0, 3.5], 'coussin', 2.6);
    t.poutre([0, 0, zc], [0, haut + 4, zc], 9, 9);
    for (const y of [inv ? 84 : 72, 112]) t.poutre([0, y, -18.5], [0, y, zc], 6, 5);
    t.poutre([-24, haut + 4, zPec(inv)], [24, haut + 4, zPec(inv)], 6, 6, 'cadre', [0, 0, 1]);
    t.poutre([0, haut + 4, zt], [0, haut + 4, zPec(inv)], 7, 7, 'cadre', [1, 0, 0]);
    const course = cmDeLevier(2 * auTemps(p.course, c.t), 15);
    charge(t, c, course, zt, haut + 4, []);
    return course;
  },
};

// -----------------------------------------------------------------------------
// Développé machine (couché, incliné, épaules) et tirage horizontal machine
// -----------------------------------------------------------------------------

/**
 * Levier dont la poignée part de `H0` et avance dans la direction `d` : son
 * pivot est à 85 cm de là, du côté `n`. Rend le pivot, et la poignée (et son
 * orientation) après `cm` centimètres d'arc.
 */
function levier(H0: Vec3, d: Vec3, n: Vec3, cm: number): { pivot: Vec3; poignee: Vec3; R: Mat3 } {
  const pivot = V.add(V.add(H0, V.mul(d, 20)), V.mul(n, 85)), v0 = V.sub(H0, pivot), R0 = Math.hypot(v0[1], v0[2]);
  // Sens de rotation (autour de X) qui fait partir la poignée vers `d`.
  const sens = Math.sign(-v0[2] * d[1] + v0[1] * d[2]) || 1, deg = (sens * cm) / R0 / RAD;
  return { pivot, poignee: autourX(pivot, H0, deg), R: M.rx(deg) };
}
/**
 * Pivot au sol d'un levier dont la poignée part de `H0` dans la direction `d` : il est sur la
 * perpendiculaire à `d` menée du milieu de la course (`demi` cm plus loin), là où elle touche le sol,
 * si bien que la poignée avance à peu près dans la direction `d`, en arc très ouvert.
 */
const Y_PIVOT_SOL = 4;
function pivotBas(H0: Vec3, d: Vec3, demi: number): Vec3 {
  const M0 = V.add(H0, V.mul(d, demi)), b0: Vec3 = [0, -d[2], d[1]], bas = b0[1] < 0 ? b0 : V.mul(b0, -1);
  return V.add(M0, V.mul(bas, (Y_PIVOT_SOL - M0[1]) / bas[1]));
}
function levierBas(H0: Vec3, d: Vec3, pivot: Vec3, cm: number): { pivot: Vec3; poignee: Vec3; R: Mat3 } {
  const v0 = V.sub(H0, pivot), R0 = Math.hypot(v0[1], v0[2]);
  const sens = Math.sign(-v0[2] * d[1] + v0[1] * d[2]) || 1, deg = (sens * cm) / R0 / RAD;
  return { pivot, poignee: autourX(pivot, H0, deg), R: M.rx(deg) };
}
/** Couché et incliné : leviers qui pivotent au sol, sur les côtés. Épaules : leviers qui pendent de derrière. */
const DEVELOPPES = {
  couche: { H0: [24, 108, 12] as Vec3, d: [0, 0, 1] as Vec3, dossier: 10, bas: { demi: 20 } },
  incline: { H0: [22, 114, 0] as Vec3, d: [0, Math.sin(25 * RAD), Math.cos(25 * RAD)] as Vec3, dossier: 18, bas: { demi: 18 } },
  epaules: { H0: [32, 128, -6] as Vec3, d: [0, 1, 0] as Vec3, dossier: 6, bas: null },
} as const;
/** Écart des leviers : à l'extérieur des coudes. */
const X_LEVIER_DEV = 40;
function etatDeveloppe(p: DeveloppeMachine, t: number) {
  const v = DEVELOPPES[p.variante], cm = auTemps(p.course, t);
  if (v.bas === null) return { v, ...levier(v.H0, v.d, [0, v.d[2], -v.d[1]], cm) };
  const P = pivotBas(v.H0, v.d, v.bas.demi);
  return { v, ...levierBas(v.H0, v.d, [X_LEVIER_DEV, P[1], P[2]], cm) };
}
export const DEVELOPPE_MACHINE: Modele<DeveloppeMachine> = {
  reperes(p, _F, t) {
    const e = etatDeveloppe(p, t);
    return paire(auSol(p.pos, p.tour), 'poignee', e.poignee, e.R);
  },
  dessiner(c, p) {
    if (DEVELOPPES[p.variante].bas !== null) return dessinerDeveloppeBas(c, p);
    const t = traceur(c.out, auSol(p.pos, p.tour)), e = etatDeveloppe(p, c.t), P = e.pivot;
    const zt = Math.min(-58, P[2] - 26);
    socle(t, zt, 22, 60, 60);
    siege(t, [0, 48, 0], 18, 17);
    dossier(t, [0, 50, -15], e.v.dossier, 62, 17, [0, 60, -32]);
    t.poutre([0, 0, -32], [0, 62, -32], 7, 7);
    // Axe des leviers, porté par deux montants ; leviers à l'extérieur des mains, poignées vers l'intérieur.
    const xm = Math.abs(e.v.H0[0]), xl = xm + 9, xa = xl + 8;
    t.cyl([-xa, P[1], P[2]], [xa, P[1], P[2]], 3.2, 'metal');
    traverseAuSol(t, xa, P[2]);
    for (const s of [1, -1]) {
      t.poutre([s * xa, 0, P[2]], [s * xa, P[1] + 6, P[2]], 7, 7);
      const H: Vec3 = sym(s, e.poignee);
      t.poutre([s * xl, P[1], P[2]], [s * xl, H[1], H[2]], 5, 5, 'cadre', [1, 0, 0]);
      t.boule([s * xl, H[1], H[2]], 2.5, 'cadre');
      poignee(t, [s * (xm + 1), H[1], H[2]], [1, 0, 0], 7);
    }
    const course = auTemps(p.course, c.t);
    charge(t, c, course, zt, 190, []);
    return course;
  },
};

/**
 * Développé couché ou incliné, leviers qui partent du bas : chaque levier pivote sur un moyeu porté par un
 * montant, à l'extérieur des cuisses, monte jusqu'à hauteur de poitrine puis tourne vers l'intérieur jusqu'à la
 * poignée. Des longerons au sol relient les montants à la tour ; le câble descend de la pile au pied de la tour
 * et file dans le châssis jusqu'aux leviers.
 */
function dessinerDeveloppeBas(c: Contexte, p: DeveloppeMachine): number {
  const t = traceur(c.out, auSol(p.pos, p.tour)), e = etatDeveloppe(p, c.t), P = e.pivot, zt = -62, xl = X_LEVIER_DEV + 6;
  // Socle : poutre sous le siège jusqu'à la tour, longerons au sol de chaque côté (les pieds restent entre eux).
  t.poutre([0, 3, zt], [0, 3, 8], 8, 6, 'cadre', [1, 0, 0]);
  t.poutre([-xl, 3, zt], [xl, 3, zt], 6, 6, 'cadre', [0, 0, 1]);
  siege(t, [0, 48, 0], 18, 17);
  dossier(t, [0, 50, -15], e.v.dossier, 62, 17, [0, 60, -32]);
  t.poutre([0, 0, -32], [0, 62, -32], 7, 7);
  for (const s of [1, -1]) {
    t.poutre([s * xl, 3, zt], [s * xl, 3, P[2] + 6], 6, 6, 'cadre', [1, 0, 0]);
    t.poutre([s * xl, 0, P[2]], [s * xl, P[1], P[2]], 7, 7);
    t.cyl([s * (xl - 7), P[1], P[2]], [s * (xl + 4), P[1], P[2]], 3.2, 'metal');
    // Levier : du moyeu à hauteur de la poignée (dans le plan du moyeu), puis vers l'intérieur jusqu'à elle.
    const H = sym(s, e.poignee), coude: Vec3 = [s * (X_LEVIER_DEV - 4), H[1], H[2]];
    t.poutre([s * X_LEVIER_DEV, P[1], P[2]], [s * X_LEVIER_DEV, H[1], H[2]], 5, 5, 'cadre', [1, 0, 0]);
    t.chemin([[s * X_LEVIER_DEV, H[1], H[2]], coude], 5);
    t.boule(coude, 2.5, 'cadre');
    poignee(t, [s * 26, H[1], H[2]], [1, 0, 0], 7);
  }
  const course = auTemps(p.course, c.t);
  charge(t, c, course, zt, 190, [[0, 190 - 9, zt + 7], [0, 10, zt + 7]]);
  t.roue([0, 10, zt + 7], 3.2);
  return course;
}

const H0_TIRAGE: Vec3 = [22, 88, 68];
const etatTirageMachine = (p: TirageHorizontalMachine, t: number) => levier(H0_TIRAGE, [0, 0, -1], [0, -1, 0], auTemps(p.course, t));
export const TIRAGE_HORIZONTAL_MACHINE: Modele<TirageHorizontalMachine> = {
  reperes(p, _F, t) {
    const e = etatTirageMachine(p, t);
    return paire(auSol(p.pos, p.tour), 'poignee', e.poignee, e.R);
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), e = etatTirageMachine(p, c.t), P = e.pivot, zt = 96;
    socle(t, -30, zt, 50, 60);
    siege(t, [0, 46, -2], 18, 12);
    // Appui contre le haut des abdos (son dos touche le ventre), porté par une poutre qui part de la tour (entre les bras).
    t.coussin([0, 96, 16], [0, 12, 0], [0, 0, 3.5], 15);
    t.poutre([0, 96, 19.5], [0, 96, zt], 7, 7, 'cadre', [1, 0, 0]);
    // Leviers qui pivotent en bas, devant les pieds.
    t.cyl([-38, P[1], P[2]], [38, P[1], P[2]], 3.2, 'metal');
    for (const s of [1, -1]) {
      t.poutre([s * 40, 0, P[2]], [s * 40, P[1] + 5, P[2]], 7, 7);
      // La poignée est tenue par son bout bas : rien au-dessus de la main, qui arrive contre l'épaule.
      const H = sym(s, e.poignee), bas = V.add(H, M.vec(e.R, [0, -9, 0]));
      t.poutre([s * 32, P[1], P[2]], [s * 32, bas[1], bas[2]], 5, 5, 'cadre', [1, 0, 0]);
      t.poutre([s * 32, bas[1], bas[2]], bas, 4, 4, 'cadre', [0, 1, 0]);
      poignee(t, H, M.vec(e.R, [0, 1, 0]), 7);
    }
    const course = auTemps(p.course, c.t);
    charge(t, c, course, zt, 180, []);
    return course;
  },
};

// -----------------------------------------------------------------------------
// Presse à cuisses, hack squat, Smith machine
// -----------------------------------------------------------------------------

/** Plaque de la presse : verticale, face à l'utilisateur ; Y vers lui, Z vers le haut. */
function plateauPresse(p: PresseCuisses, t: number): Repere {
  return dans(auSol(p.pos, p.tour), [0, 72, 48 + auTemps(p.course, t)], M.depuisColonnes([1, 0, 0], [0, 0, -1], [0, 1, 0]));
}
export const PRESSE_CUISSES: Modele<PresseCuisses> = {
  reperes: (p, _F, t) => ({ plateau: plateauPresse(p, t) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), recul = auTemps(p.course, c.t), zp = 48 + recul, zt = 150;
    socle(t, -50, zt, 60, 60);
    siege(t, [0, 46, -2], 19, 17);
    dossier(t, [0, 48, -19], 25, 66, 18, [0, 56, -40]);
    t.poutre([0, 0, -40], [0, 58, -40], 7, 7);
    poigneesSiege(t, 54, 0, 25);
    // Rails horizontaux, chariot, plaque verticale.
    for (const s of [1, -1]) {
      t.poutre([s * 18, 30, 28], [s * 18, 30, zt], 5, 5, 'cadre', [1, 0, 0]);
      t.poutre([s * 18, 0, 30], [s * 18, 27.5, 30], 5, 5);
    }
    t.pave([0, 34, zp + 9], [24, 0, 0], [0, 3, 0], [0, 0, 9], 'moyeu');
    t.poutre([0, 37, zp + 6], [0, 72, zp + 3], 7, 6);
    const pl = traceur(c.out, plateauPresse(p, c.t));
    pl.pave([0, -2, 0], [28, 0, 0], [0, 2, 0], [0, 0, 26], 'cadre');
    // Câble : descend la tour, puis longe les rails jusqu'au chariot.
    charge(t, c, recul, zt, 170, [[0, 34, zt - 4], [0, 34, zp + 18]]);
    return recul;
  },
};

const PENTE_HACK = 25 * RAD;
const U_HACK: Vec3 = [0, Math.cos(PENTE_HACK), -Math.sin(PENTE_HACK)], N_HACK: Vec3 = [0, Math.sin(PENTE_HACK), Math.cos(PENTE_HACK)];
const PLATEAU_HACK = { o: [0, 16, 14] as Vec3, R: M.depuisColonnes([1, 0, 0], [0, Math.cos(15 * RAD), -Math.sin(15 * RAD)], [0, Math.sin(15 * RAD), Math.cos(15 * RAD)]) };
function traineauHack(p: HackSquat, t: number): Repere {
  return dans(auSol(p.pos, p.tour), V.sub([0, 122, -26], V.mul(U_HACK, auTemps(p.course, t))), M.depuisColonnes([1, 0, 0], U_HACK, N_HACK));
}
export const HACK_SQUAT: Modele<HackSquat> = {
  reperes: (p, _F, t) => ({ traineau: traineauHack(p, t), plateau: dans(auSol(p.pos, p.tour), PLATEAU_HACK.o, PLATEAU_HACK.R) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour));
    socle(t, -90, 40, 70, 70);
    const pl = traceur(c.out, dans(auSol(p.pos, p.tour), PLATEAU_HACK.o, PLATEAU_HACK.R));
    pl.pave([0, -2, 0], [30, 0, 0], [0, 2, 0], [0, 0, 22], 'cadre');
    t.poutre([0, 0, 14], [0, 12, 14], 10, 10);
    // Rails penchés vers l'arrière.
    // Rails contre le dos du traîneau (il glisse dessus).
    const bas: Vec3 = [0, 37, 0.9];
    for (const s of [1, -1]) {
      t.poutre([s * 27, bas[1], bas[2]], V.add([s * 27, bas[1], bas[2]], V.mul(U_HACK, 200)), 6, 6, 'cadre', [1, 0, 0]);
      t.poutre([s * 27, 3, -88], V.add([s * 27, bas[1], bas[2]], V.mul(U_HACK, 190)), 7, 7);
      t.poutre([s * 27, 3, bas[2]], [s * 27, bas[1], bas[2]], 6, 6);
    }
    // Traîneau : dossier, épaulières, poignées, disques derrière.
    const tr = traceur(c.out, traineauHack(p, c.t));
    tr.coussin([0, 0, 0], [0, 32, 0], [0, 0, 3.5], 15);
    tr.pave([0, 0, -6], [29, 0, 0], [0, 34, 0], [0, 0, 2.5], 'cadre');
    for (const s of [1, -1]) {
      tr.coussin([s * 12, 34, 9], [0, 0, 9], [0, 3.5, 0], 6);
      tr.poutre([s * 12, 30, -4], [s * 12, 30.5, 5], 4, 4);
      tr.chemin([[s * 29, 6, -6], [s * 32, 6, 4], [s * 32, 0, 18]], 4);
      poignee(tr, [s * 32, 6, 18], [0, 1, 0], 5);
      tr.disques([s * 29, -14, -10], [s * 50, -14, -10], 22);
    }
    return Number.NaN;
  },
};

function barreSmith(p: Smith, t: number): Repere {
  return dans(auSol(p.pos, p.tour), [0, auTemps(p.course, t), 0]);
}
export const SMITH: Modele<Smith> = {
  reperes: (p, _F, t) => ({ barre: barreSmith(p, t) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), h = auTemps(p.course, c.t), haut = 218;
    for (const sz of [1, -1]) t.poutre([-68, 3, sz * 26], [68, 3, sz * 26], 6, 6, 'cadre', [0, 0, 1]);
    for (const s of [1, -1]) {
      t.poutre([s * 68, 3, -26], [s * 68, 3, 26], 6, 6, 'cadre', [1, 0, 0]);
      for (const sz of [1, -1]) t.poutre([s * 68, 0, sz * 26], [s * 68, haut, sz * 26], 6, 6);
      t.poutre([s * 68, haut, -26], [s * 68, haut, 26], 6, 6, 'cadre', [1, 0, 0]);
      // Tige de guidage, tenue en haut et en bas, et chariot de la barre.
      t.cyl([s * 60, 6, 0], [s * 60, haut - 3, 0], 1.4, 'metal');
      t.poutre([s * 60, 6, 0], [s * 68, 6, 0], 4, 4);
      t.poutre([s * 60, haut - 3, 0], [s * 68, haut - 3, 0], 4, 4);
      t.pave([s * 60, h, 0], [3.4, 0, 0], [0, 6, 0], [0, 0, 3.4], 'moyeu');
    }
    t.poutre([-68, haut, 0], [68, haut, 0], 6, 6, 'cadre', [0, 0, 1]);
    // La barre, chargée hors des tiges.
    t.cyl([-58, h, 0], [58, h, 0], 1.4, 'metal');
    for (const s of [1, -1]) {
      t.cyl([s * 56, h, 0], [s * 84, h, 0], 2.3, 'metal');
      t.cyl([s * 72, h, 0], [s * 76.5, h, 0], 22, 'fonte');
      t.cyl([s * 76.5, h, 0], [s * 80, h, 0], 16, 'fonte');
    }
    return Number.NaN;
  },
};

// -----------------------------------------------------------------------------
// Leviers dans l'axe des genoux : leg extension, leg curl assis et couché
// -----------------------------------------------------------------------------

/** Du genou à la cheville (longueur du tibia) : la cheville est sur l'axe du tibia, le rouleau à 9 cm d'elle, devant ou derrière. */
const TIBIA = 41.5, ECART_ROULEAU = 9;
/** Assis : genoux 10 cm au-dessus du siège (dessus à 52), juste au-delà de son bord avant. */
const GENOU_ASSIS: Vec3 = [0, 62, 21];
/** Couché : genoux au bout du coussin des cuisses. */
const GENOU_COUCHE: Vec3 = [0, 70, -46.5];
/**
 * Rouleau d'un levier qui pivote aux genoux, `flex` degrés de flexion ; `couche` :
 * sur le ventre, jambes vers −Z ; `devantTibia` : le rouleau est devant le tibia
 * (leg extension) ou derrière (leg curls).
 */
function rouleauGenoux(base: Repere, pivot: Vec3, flex: number, couche: boolean, devantTibia: boolean): Repere {
  const a = flex * RAD;
  const dir: Vec3 = couche ? [0, Math.sin(a), -Math.cos(a)] : [0, -Math.sin(a), Math.cos(a)];
  const devant: Vec3 = couche ? [0, -Math.cos(a), -Math.sin(a)] : [0, Math.cos(a), Math.sin(a)];
  const cheville = V.add(pivot, V.mul(dir, TIBIA));
  return dans(base, V.add(cheville, V.mul(devant, devantTibia ? ECART_ROULEAU : -ECART_ROULEAU)), M.depuisColonnes([1, 0, 0], V.mul(dir, -1), devant));
}
function levierGenoux(c: Contexte, t: Traceur, base: Repere, pivot: Vec3, flex: number, couche: boolean, devantTibia: boolean): void {
  const r = traceur(c.out, rouleauGenoux(base, pivot, flex, couche, devantTibia));
  // Axe court sur le côté, porté par un montant ; bras du levier jusqu'au rouleau.
  t.poutre([31, 0, pivot[2]], [31, pivot[1], pivot[2]], 7, 7);
  t.poutre([31, 3, pivot[2]], [0, 3, pivot[2]], 6, 6, 'cadre', [0, 0, 1]);
  t.cyl([22, pivot[1], pivot[2]], [33, pivot[1], pivot[2]], 3.2, 'metal');
  traceur(c.out, { o: [0, 0, 0], R: M.ry(0) }).poutre(t.P([26, pivot[1], pivot[2]]), r.P([26, 0, 0]), 5, 5, 'cadre', V.sub(r.P([0, 0, 1]), r.P([0, 0, 0])));
  r.cyl([-17, 0, 0], [28, 0, 0], 1.2, 'metal');
  r.rouleau([-17, 0, 0], [17, 0, 0], 5);
}
const machineGenoux = (couche: boolean, pivot: Vec3, devantTibia: boolean) => ({
  reperes: (p: AuSol, _F: unknown, t: number) => ({ rouleau: rouleauGenoux(auSol(p.pos, p.tour), pivot, auTemps(p.course, t), couche, devantTibia) }),
});
/** Siège des machines aux genoux : les cuisses dessus jusqu'avant les genoux, dossier derrière. */
function siegeGenoux(t: Traceur): void {
  socle(t, -70, 40, 56, 50);
  siege(t, [0, 52, -10], 18, 22);
  dossier(t, [0, 54, -34], 12, 58, 17, [0, 64, -48]);
  t.poutre([0, 0, -48], [0, 66, -48], 7, 7);
  poigneesSiege(t, 62, -12, 25);
}
export const LEG_EXTENSION: Modele<LegExtension> = {
  ...machineGenoux(false, GENOU_ASSIS, true),
  dessiner(c, p) {
    const base = auSol(p.pos, p.tour), t = traceur(c.out, base), flex = auTemps(p.course, c.t);
    siegeGenoux(t);
    levierGenoux(c, t, base, GENOU_ASSIS, flex, false, true);
    const course = cmDeLevier(flex);
    charge(t, c, course, -70, 160, []);
    return course;
  },
};
export const LEG_CURL_ASSIS: Modele<LegCurlAssis> = {
  ...machineGenoux(false, GENOU_ASSIS, false),
  dessiner(c, p) {
    const base = auSol(p.pos, p.tour), t = traceur(c.out, base), flex = auTemps(p.course, c.t);
    siegeGenoux(t);
    // Rouleau qui bloque les cuisses juste avant les genoux, sur un bras qui part du montant du levier.
    t.rouleau([-18, 76.5, 8], [18, 76.5, 8], 5.5);
    t.chemin([[31, GENOU_ASSIS[1], GENOU_ASSIS[2]], [31, 76.5, 8], [18, 76.5, 8]], 4);
    levierGenoux(c, t, base, GENOU_ASSIS, flex, false, false);
    const course = cmDeLevier(flex);
    charge(t, c, course, -70, 160, []);
    return course;
  },
};
export const LEG_CURL_COUCHE: Modele<LegCurlCouche> = {
  ...machineGenoux(true, GENOU_COUCHE, false),
  dessiner(c, p) {
    const base = auSol(p.pos, p.tour), t = traceur(c.out, base), flex = auTemps(p.course, c.t);
    socle(t, -60, 110, 56, 56);
    // Coussin des cuisses (relevé aux hanches) et coussin du buste.
    t.coussin([0, 57, -16], [0, 1.5, 24], [0, 3.5, -0.2], 18);
    t.coussin([0, 53, 58], [0, 0, 40], [0, 3.5, 0], 17);
    t.poutre([0, 0, -20], [0, 55, -20], 8, 8);
    t.poutre([0, 0, 70], [0, 50, 70], 8, 8);
    traverseAuSol(t, 24, 100);
    for (const s of [1, -1]) {
      t.poutre([s * 24, 0, 100], [s * 24, 45, 100], 4, 4);
      poignee(t, [s * 24, 48, 100], [0, 1, 0], 5);
    }
    levierGenoux(c, t, base, GENOU_COUCHE, flex, true, false);
    return cmDeLevier(flex);
  },
};

// -----------------------------------------------------------------------------
// Mollets
// -----------------------------------------------------------------------------

export const MOLLETS_DEBOUT: Modele<MolletsDebout> = {
  reperes: (p, _F, t) => ({
    epaulieres: dans(auSol(p.pos, p.tour), [0, 165 + auTemps(p.course, t), -4]),
    marche: dans(auSol(p.pos, p.tour), [0, 12, 0]),
  }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), e = auTemps(p.course, c.t), y = 165 + e;
    socle(t, -66, 26, 60, 60);
    t.pave([0, 6, 12], [26, 0, 0], [0, 6, 0], [0, 0, 12], 'cadre');
    // Épaulières sur un chariot qui glisse le long de la colonne, poignées devant.
    t.poutre([0, 0, -34], [0, 212, -34], 9, 9);
    t.pave([0, y, -34], [7, 0, 0], [0, 12, 0], [0, 0, 7], 'moyeu');
    t.poutre([0, y, -30], [0, y + 5, -10], 6, 6);
    t.poutre([-20, y + 5, -10], [20, y + 5, -10], 5, 5, 'cadre', [0, 0, 1]);
    for (const s of [1, -1]) {
      t.coussin([s * 12, y + 4, -2], [0, 0, 9], [0, 3, 0], 5.5);
      t.poutre([s * 20, y + 5, -10], [s * 20, y + 6, 14], 4, 4);
      poignee(t, [s * 20, y + 6, 14], [0, 1, 0], 5);
    }
    charge(t, c, e, -58, 200, [[0, y + 10, -34]]);
    return e;
  },
};
const GENOUX_ASSIS: Vec3 = [0, 72, 26], PIVOT_MOLLETS: Vec3 = [0, 30, -36];
function coussinGenoux(p: MolletsAssis, t: number): Vec3 {
  const L = V.len(V.sub(GENOUX_ASSIS, PIVOT_MOLLETS));
  return autourX(PIVOT_MOLLETS, GENOUX_ASSIS, -(auTemps(p.course, t) / L) / RAD);
}
export const MOLLETS_ASSIS: Modele<MolletsAssis> = {
  reperes: (p, _F, t) => ({
    genoux: dans(auSol(p.pos, p.tour), coussinGenoux(p, t)),
    marche: dans(auSol(p.pos, p.tour), [0, 14, 30]),
  }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), k = coussinGenoux(p, c.t);
    socle(t, -44, 52, 56, 56);
    siege(t, [0, 48, -8], 17, 15);
    t.pave([0, 7, 38], [24, 0, 0], [0, 7, 0], [0, 0, 10], 'cadre');
    // Levier : du pivot (derrière, bas) au coussin des genoux, disques sur le côté.
    t.cyl([-10, PIVOT_MOLLETS[1], PIVOT_MOLLETS[2]], [10, PIVOT_MOLLETS[1], PIVOT_MOLLETS[2]], 3, 'metal');
    t.poutre([0, 3, PIVOT_MOLLETS[2]], PIVOT_MOLLETS, 8, 8);
    t.poutre(PIVOT_MOLLETS, [0, k[1] + 5, k[2]], 7, 6);
    t.cyl([-20, k[1], k[2]], [20, k[1], k[2]], 1.2, 'metal');
    t.rouleau([-18, k[1], k[2]], [18, k[1], k[2]], 6);
    // Disques sur une corne en avant et en dessous du coussin, hors du chemin des bras.
    t.poutre([20, k[1], k[2]], [24, k[1] - 14, k[2] + 10], 4, 4);
    t.disques([24, k[1] - 14, k[2] + 10], [40, k[1] - 14, k[2] + 10], 13);
    return Number.NaN;
  },
};

// -----------------------------------------------------------------------------
// Bras : élévations latérales, curl et extension, pullover
// -----------------------------------------------------------------------------

/** Épaules du mannequin assis (siège à 48 cm, bassin 16 cm au-dessus, à −6 cm). */
const EPAULE_ELEV: Vec3 = [19.4, 113, -6];
/** Plan des leviers, devant l'épaule. */
const Z_LEVIER = 9;
const dirElev = (a: number, s = 1): Vec3 => [s * Math.sin(a * RAD), -Math.cos(a * RAD), 0];
function poigneeElev(a: number, s = 1): Vec3 {
  // Au bout de l'avant-bras, plié à angle droit vers l'avant.
  return V.add(V.add(sym(s, EPAULE_ELEV), V.mul(dirElev(a, s), 30)), [0, 0, 30.8]);
}
export const ELEVATIONS_MACHINE: Modele<ElevationsMachine> = {
  reperes(p, _F, t) {
    const a = auTemps(p.course, t);
    return paire(auSol(p.pos, p.tour), 'poignee', poigneeElev(a), M.rz(a));
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), a = auTemps(p.course, c.t);
    socle(t, -62, 26, 50, 70);
    siege(t, [0, 48, -6], 17, 15);
    dossier(t, [0, 50, -18], 6, 52, 15, [0, 62, -36]);
    // Colonne derrière le dossier, qui monte au-dessus des épaules : d'elle partent, par-dessus chaque
    // épaule, les potences qui tiennent les moyeux devant les épaules. Rien n'est devant ni à côté de
    // l'utilisateur, et tout tient à la colonne.
    const yp = EPAULE_ELEV[1] + 21, zc = -36;
    t.poutre([0, 0, zc], [0, yp + 3, zc], 7, 7);
    t.poutre([-EPAULE_ELEV[0], yp, zc], [EPAULE_ELEV[0], yp, zc], 5, 5, 'cadre', [0, 1, 0]);
    for (const s of [1, -1]) {
      const E = sym(s, EPAULE_ELEV), P: Vec3 = [E[0], E[1], Z_LEVIER], dir = dirElev(a, s), dehors: Vec3 = [s * Math.cos(a * RAD), Math.sin(a * RAD), 0];
      t.chemin([[E[0], yp, zc], [E[0], yp, Z_LEVIER + 6], [E[0], E[1], Z_LEVIER + 6]], 5);
      t.cyl([E[0], E[1], Z_LEVIER - 3], [E[0], E[1], Z_LEVIER + 8], 3.4, 'metal');
      // Levier dans l'axe de l'épaule, devant le bras, jusqu'au-dessus du coude ; coussin contre l'extérieur du bras.
      const bout = V.add(P, V.mul(dir, 21));
      t.poutre(P, bout, 5, 4, 'cadre', [0, 0, 1]);
      const appui = V.add(V.add(E, V.mul(dir, 21)), V.mul(dehors, 7.5));
      t.chemin([V.add(P, V.mul(dir, 19)), [appui[0], appui[1], Z_LEVIER], V.add(appui, [0, 0, 4])], 3.5);
      t.coussin(appui, [0, 0, 7], V.mul(dehors, 2.5), 5);
      // Poignée au bout de l'avant-bras, dans l'axe du bras : une tige part du bout du levier vers l'avant,
      // au-dessus de l'avant-bras (côté épaule), et tient la poignée par son bout haut.
      const H = poigneeElev(a, s), haut = V.add(H, V.mul(dir, -6.5));
      t.poutre(bout, [bout[0], bout[1], haut[2]], 3.5, 3.5, 'cadre', V.mul(dir, -1));
      t.poutre([bout[0], bout[1], haut[2]], haut, 3.5, 3.5, 'cadre', [0, 0, 1]);
      poignee(t, H, V.mul(dir, -1), 5);
    }
    const course = cmDeLevier(2 * a, 12);
    charge(t, c, course, -62, 170, []);
    return course;
  },
};

/**
 * Coudes de l'utilisateur assis penché sur le pupitre (siège à 54 cm, buste
 * penché de 16°) : ses bras descendent de 40° depuis les épaules. Le levier
 * pivote là, et la barre est à une longueur d'avant-bras.
 */
const EPAULE_CURL: Vec3 = [19.4, 118.2, -16.2], PENTE_BRAS = 40 * RAD;
const BRAS_CURL: Vec3 = [0, -Math.sin(PENTE_BRAS), Math.cos(PENTE_BRAS)], N_BRAS: Vec3 = [0, Math.cos(PENTE_BRAS), Math.sin(PENTE_BRAS)];
const COUDES: Vec3 = V.add([0, EPAULE_CURL[1], EPAULE_CURL[2]], V.mul(BRAS_CURL, 30));
const RAYON_CURL = 30.8;
function barreCurl(p: CurlMachine, t: number): Repere {
  const phi = auTemps(p.course, t);
  return dans(auSol(p.pos, p.tour), V.add(COUDES, [0, RAYON_CURL * Math.sin(phi * RAD), RAYON_CURL * Math.cos(phi * RAD)]), M.rx(-phi));
}
/** Curl bras écartés : épaule du mannequin assis (siège à 48 cm), direction du bras (25° vers l'avant), axe des leviers. */
const EPAULE_ECART: Vec3 = [19.4, 113, -6], ECART = 25 * RAD;
const BRAS_ECART: Vec3 = [Math.cos(ECART), 0, Math.sin(ECART)], AXE_ECART: Vec3 = [-Math.sin(ECART), 0, Math.cos(ECART)];
const COUDE_ECART: Vec3 = V.add(EPAULE_ECART, V.mul(BRAS_ECART, 30));
/** Repère de la poignée gauche après `phi` degrés de flexion : X le long de l'avant-bras, Z le long de la poignée. */
function poigneeEcart(phi: number): { o: Vec3; R: Mat3 } {
  const R = M.mul(M.axe(AXE_ECART, phi * RAD), M.depuisColonnes(BRAS_ECART, [0, 1, 0], AXE_ECART));
  return { o: V.add(COUDE_ECART, M.vec(R, [RAYON_CURL, 0, 0])), R };
}
function dessinerCurlEcarte(c: Contexte, p: CurlMachine): number {
  const base = auSol(p.pos, p.tour), t = traceur(c.out, base), phi = auTemps(p.course, c.t);
  socle(t, -60, 22, 110, 60);
  siege(t, [0, 48, -6], 17, 15);
  dossier(t, [0, 50, -21], 4, 52, 15, [0, 60, -36]);
  t.poutre([0, 0, -36], [0, 62, -36], 7, 7);
  for (const s of [1, -1]) {
    const S = sym(s, EPAULE_ECART), C = sym(s, COUDE_ECART), u = sym(s, BRAS_ECART), n = sym(s, AXE_ECART);
    // Coussin sous le bras, du milieu du bras jusqu'au coude, sur une potence qui part d'un montant derrière.
    const sous = V.add(V.add(S, V.mul(u, 19)), [0, -9.2, 0]);
    t.coussin(sous, V.mul(u, 11), [0, 3.5, 0], 6.5);
    const pied: Vec3 = V.add(sous, [0, -3.5, 0]), arriere: Vec3 = V.add(C, V.mul(n, -12));
    t.poutre([arriere[0], 0, arriere[2]], [arriere[0], C[1], arriere[2]], 7, 7);
    t.poutre([arriere[0], 3, arriere[2]], [0, 3, arriere[2]], 6, 6, 'cadre', [0, 0, 1]);
    t.poutre(V.add(pied, [0, -2, 0]), [arriere[0], pied[1] - 2, arriere[2]], 5, 5);
    // Moyeu dans l'axe du coude, derrière lui ; levier parallèle à l'avant-bras, poignée au bout.
    t.cyl(V.add(C, V.mul(n, -14)), V.add(C, V.mul(n, -7)), 3.2, 'metal');
    const g = poigneeEcart(phi), H = sym(s, g.o), f = sym(s, M.vec(g.R, [1, 0, 0]));
    const debut = V.add(C, V.mul(n, -10)), fin = V.add(H, V.mul(n, -10));
    t.poutre(debut, V.add(debut, V.mul(f, 4)), 5, 5, 'cadre', n);
    t.poutre(V.add(debut, V.mul(f, 4)), fin, 4.5, 4.5, 'cadre', n);
    t.poutre(fin, V.add(H, V.mul(n, -8.5)), 3.5, 3.5, 'cadre', f);
    poignee(t, H, n, 6);
  }
  const course = cmDeLevier(phi);
  charge(t, c, course, -60, 160, []);
  return course;
}
export const CURL_MACHINE: Modele<CurlMachine> = {
  reperes(p, _F, t) {
    if (p.variante !== 'ecarte') return { barre: barreCurl(p, t) };
    const g = poigneeEcart(auTemps(p.course, t));
    return paire(auSol(p.pos, p.tour), 'poignee', g.o, g.R);
  },
  dessiner(c, p) {
    if (p.variante === 'ecarte') return dessinerCurlEcarte(c, p);
    const t = traceur(c.out, auSol(p.pos, p.tour)), phi = auTemps(p.course, c.t);
    socle(t, -60, 52, 50, 64);
    siege(t, [0, 52.5, -22], 17, 12);
    // Pupitre large sous la moitié avant des bras, jusqu'au coude : son bord haut arrive contre
    // la poitrine (le buste s'y appuie sans y entrer).
    const milieu = V.sub(V.add([0, EPAULE_CURL[1], EPAULE_CURL[2]], V.mul(BRAS_CURL, 26)), V.mul(N_BRAS, 10));
    t.coussin(milieu, V.mul(BRAS_CURL, 7.5), V.mul(N_BRAS, 3.5), 27);
    const dessous = V.sub(milieu, V.mul(N_BRAS, 6));
    t.pave(V.add(dessous, V.mul(BRAS_CURL, 4)), [20, 0, 0], V.mul(N_BRAS, 1), V.mul(BRAS_CURL, 6), 'cadre');
    // Pied du pupitre : monte devant les genoux, puis vient sous le pupitre par-dessus eux (rien entre les cuisses).
    t.chemin([[0, 3, 34], [0, 74, 34], V.add(dessous, [0, -1, 6])], 7);
    // Moyeux sur les côtés, dans l'axe des coudes (rien ne passe à travers les bras).
    const b = traceur(c.out, barreCurl(p, c.t));
    traverseAuSol(t, 32, COUDES[2]);
    for (const s of [1, -1]) {
      t.poutre([s * 32, 0, COUDES[2]], [s * 32, COUDES[1], COUDES[2]], 7, 7);
      t.cyl([s * 26, COUDES[1], COUDES[2]], [s * 34, COUDES[1], COUDES[2]], 3.2, 'metal');
      t.poutre([s * 28, COUDES[1], COUDES[2]], b.P([s * 28, p.variante === 'curl' ? 0 : -9, 0]), 4.5, 4.5, 'cadre', [1, 0, 0]);
    }
    // Curl : une barre droite. Triceps : deux poignées verticales, reliées par une barre qui passe sous elles.
    const yb = p.variante === 'curl' ? 0 : -9;
    b.cyl([-28, yb, 0], [28, yb, 0], 1.4, 'metal');
    for (const s of [1, -1]) {
      if (p.variante === 'curl') b.cyl([s * 7, 0, 0], [s * 21, 0, 0], 2, 'coussin');
      else poignee(b, [s * 12, 0, 0], [0, 1, 0], 6);
    }
    const course = cmDeLevier(phi);
    charge(t, c, course, -60, 160, []);
    return course;
  },
};

const EPAULES_PULL: Vec3 = [0, 113, -6];
/** Repère du levier : Z le long des bras. La barre est à 59,5 cm de l'axe des épaules (bras presque tendus). */
const levierPull = (p: PulloverMachine, t: number): Repere => dans(auSol(p.pos, p.tour), EPAULES_PULL, M.rx(-auTemps(p.course, t)));
const RAYON_PULL = 59.5;
const barrePull = (p: PulloverMachine, t: number): Repere => dans(levierPull(p, t), [0, 0, RAYON_PULL]);
export const PULLOVER_MACHINE: Modele<PulloverMachine> = {
  reperes: (p, _F, t) => ({ barre: barrePull(p, t) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), phi = auTemps(p.course, c.t);
    socle(t, -70, 24, 56, 50);
    siege(t, [0, 48, -2], 18, 16);
    // Dossier droit, contre le dos (le buste est droit, les épaules sur l'axe du levier).
    dossier(t, [0, 50, -17.2], 0, 68, 17, [0, 64, -34]);
    t.poutre([0, 0, -34], [0, 64, -34], 7, 7);
    const b = traceur(c.out, barrePull(p, c.t)), l = traceur(c.out, levierPull(p, c.t));
    traverseAuSol(t, 44, EPAULES_PULL[2]);
    for (const s of [1, -1]) {
      t.poutre([s * 44, 0, EPAULES_PULL[2]], [s * 44, EPAULES_PULL[1], EPAULES_PULL[2]], 7, 7);
      t.cyl([s * 34, EPAULES_PULL[1], EPAULES_PULL[2]], [s * 46, EPAULES_PULL[1], EPAULES_PULL[2]], 3.2, 'metal');
      // Bras du levier, à l'écart des épaules et des bras de l'utilisateur, jusqu'à la barre.
      l.poutre([s * 37, 0, 0], [s * 37, 0, RAYON_PULL], 5, 5, 'cadre', [0, 1, 0]);
    }
    b.cyl([-37, 0, 0], [37, 0, 0], 1.4, 'metal');
    for (const s of [1, -1]) b.cyl([s * 8, 0, 0], [s * 24, 0, 0], 2, 'coussin');
    const course = cmDeLevier(Math.abs(phi), 15);
    charge(t, c, course, -70, 175, []);
    return course;
  },
};

// -----------------------------------------------------------------------------
// Bas du corps : kickback, abducteurs et adducteurs, hip thrust
// -----------------------------------------------------------------------------

const HANCHE_KICK: Vec3 = [10, 92, -4];
function plateauKick(p: KickbackMachine, t: number): Repere {
  const R = M.rx(auTemps(p.course, t));
  return dans(auSol(p.pos, p.tour), V.add(HANCHE_KICK, M.vec(R, [0, -84, 0])), R);
}
/** Buste penché de 35° vers l'avant : l'appui est sous la poitrine, tourné vers elle. */
const BUSTE_KICK: Vec3 = [0, Math.cos(35 * RAD), Math.sin(35 * RAD)], FACE_KICK: Vec3 = [0, Math.sin(35 * RAD), -Math.cos(35 * RAD)];
export const KICKBACK_MACHINE: Modele<KickbackMachine> = {
  reperes: (p, _F, t) => ({ plateau: plateauKick(p, t) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), phi = auTemps(p.course, c.t);
    socle(t, -40, 80, 60, 60);
    // Plate-forme du pied d'appui.
    t.pave([-12, 3, 4], [14, 0, 0], [0, 3, 0], [0, 0, 20], 'cadre');
    // Appui de la poitrine, poignées sous son bord avant, sur la colonne de devant.
    const appui: Vec3 = [0, 117, 31];
    t.coussin(appui, V.mul(BUSTE_KICK, 15), V.mul(FACE_KICK, 3.5), 17);
    const dessous = V.sub(appui, V.mul(FACE_KICK, 5));
    t.pave(dessous, [12, 0, 0], V.mul(FACE_KICK, 1), V.mul(BUSTE_KICK, 10), 'cadre');
    t.poutre([0, 0, 66], [0, 112, 60], 9, 9);
    t.poutre([0, 112, 60], dessous, 7, 7);
    t.poutre([-24, 100, 58], [24, 100, 58], 5, 5, 'cadre', [0, 0, 1]);
    for (const s of [1, -1]) poignee(t, [s * 24, 106, 58], [0, 1, 0], 6);
    // Levier de la jambe gauche, du pivot (à la hanche) au plateau du pied.
    t.poutre([26, 0, HANCHE_KICK[2]], [26, HANCHE_KICK[1], HANCHE_KICK[2]], 7, 7);
    t.poutre([26, 3, HANCHE_KICK[2]], [0, 3, HANCHE_KICK[2]], 6, 6, 'cadre', [0, 0, 1]);
    t.cyl([HANCHE_KICK[0] + 4, HANCHE_KICK[1], HANCHE_KICK[2]], [28, HANCHE_KICK[1], HANCHE_KICK[2]], 3, 'metal');
    const pl = traceur(c.out, plateauKick(p, c.t)), l = traceur(c.out, dans(auSol(p.pos, p.tour), HANCHE_KICK, M.rx(phi)));
    l.poutre([14, 0, 0], [14, -84, 0], 5, 5, 'cadre', [0, 0, 1]);
    l.poutre([14, -84, 0], [6, -84, 0], 4, 4);
    pl.pave([0, -1.5, 4], [9, 0, 0], [0, 1.5, 0], [0, 0, 14], 'cadre');
    const course = cmDeLevier(Math.abs(phi), 20);
    charge(t, c, course, 80, 160, []);
    return course;
  },
};

const ABD = { x: 10, y: 46, z: 2, r: 38 };
function etatAbd(p: AbdAdducteurs, t: number) {
  const a = auTemps(p.course, t), R = M.ry(a);
  const dir = M.vec(R, [0, 0, 1]), dehors = M.vec(R, [1, 0, 0]), signe = p.variante === 'abduction' ? 1 : -1;
  return { a, R, dir, dehors, coussin: V.add(V.add([ABD.x, ABD.y + 16, ABD.z], V.mul(dir, ABD.r)), V.mul(dehors, 9 * signe)), pied: V.add([ABD.x, 12, ABD.z], V.mul(dir, ABD.r + 6)) };
}
export const ABD_ADDUCTEURS: Modele<AbdAdducteurs> = {
  reperes(p, _F, t) {
    const e = etatAbd(p, t), base = auSol(p.pos, p.tour);
    return { ...paire(base, 'coussin', e.coussin, e.R), ...paire(base, 'pied', e.pied, e.R) };
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), e = etatAbd(p, c.t);
    socle(t, -70, 50, 56, 70);
    siege(t, [0, 50, -2], 18, 18);
    dossier(t, [0, 52, -20], 18, 62, 17, [0, 62, -40]);
    t.poutre([0, 0, -40], [0, 64, -40], 7, 7);
    poigneesSiege(t, 56, -6, 27);
    for (const s of [1, -1]) {
      const dir = sym(s, e.dir), P = sym(s, [ABD.x, ABD.y, ABD.z]);
      t.cyl(V.sub(P, [0, 6, 0]), V.add(P, [0, 2, 0]), 3, 'metal');
      const bout = V.add(P, V.mul(dir, ABD.r + 6));
      t.poutre(P, bout, 5, 5, 'cadre', [0, 1, 0]);
      // Coussin vertical contre le genou, repose-pied en bas.
      const k = sym(s, e.coussin), pied = V.add(P, V.mul(dir, ABD.r));
      t.chemin([pied, [k[0], P[1], k[2]], V.sub(k, [0, 8, 0])], 3.5);
      t.coussin(k, V.mul(dir, 8), V.mul(sym(s, e.dehors), 2.5), 9);
      t.poutre(bout, [bout[0], 12, bout[2]], 4, 4);
      t.pave(sym(s, e.pied), [6, 0, 0], [0, 1.5, 0], [0, 0, 12], 'cadre');
    }
    const course = cmDeLevier(2 * e.a, 12);
    charge(t, c, course, -62, 150, []);
    return course;
  },
};

/**
 * Le corps pivote autour des épaules, posées (par les omoplates) sur le dossier :
 * le levier tourne dans cet axe, si bien que le rouleau décrit le même arc que
 * le bassin et ne le quitte pas. Le rouleau est à 49 cm le long du buste (la
 * longueur bassin-épaules) et 17 cm devant le bassin.
 */
const EPAULES_HT: Vec3 = [0, 58, -38];
const coussinHt = (p: HipThrustMachine, t: number): Vec3 => V.add(EPAULES_HT, M.vec(M.rx(auTemps(p.course, t)), [0, -49, 17]));
export const HIP_THRUST_MACHINE: Modele<HipThrustMachine> = {
  reperes: (p, _F, t) => ({ coussin: dans(auSol(p.pos, p.tour), coussinHt(p, t)) }),
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), k = coussinHt(p, c.t), E = EPAULES_HT;
    socle(t, -56, 60, 70, 60);
    // Dossier sous les omoplates, plateau des pieds.
    t.coussin([0, 42.8, -40.6], [0, 0, 7], [0, 3.5, 0], 24);
    t.poutre([0, 0, -40.6], [0, 39, -40.6], 8, 8);
    t.pave([0, 3, 40], [28, 0, 0], [0, 2, 0], [0, 0, 20], 'cadre');
    // Moyeux de part et d'autre des épaules, leviers jusqu'au rouleau des hanches.
    traverseAuSol(t, 34, E[2]);
    for (const s of [1, -1]) {
      t.poutre([s * 34, 0, E[2]], [s * 34, E[1], E[2]], 7, 7);
      t.cyl([s * 28, E[1], E[2]], [s * 36, E[1], E[2]], 3.2, 'metal');
      t.poutre([s * 31, E[1], E[2]], [s * 31, k[1], k[2]], 5, 5, 'cadre', [1, 0, 0]);
    }
    t.cyl([-31, k[1], k[2]], [31, k[1], k[2]], 1.2, 'metal');
    t.rouleau([-26, k[1], k[2]], [26, k[1], k[2]], 6);
    // Disques sur une corne, à l'extérieur du levier droit.
    t.poutre([-31, k[1], k[2]], [-38, k[1], k[2]], 4, 4);
    t.disques([-38, k[1], k[2]], [-52, k[1], k[2]], 14);
    return Number.NaN;
  },
};

// -----------------------------------------------------------------------------
// Crunch, tractions et dips assistés
// -----------------------------------------------------------------------------

/** Axe du levier, sur les côtés, à hauteur de taille de l'utilisateur assis. */
const TAILLE_CRUNCH: Vec3 = [0, 74, -10];
/**
 * Dans le repère du levier (origine sur son axe, au départ du mouvement) : coussin posé sur le haut de
 * l'épaule (`COUSSIN_CRUNCH`, tourné vers elle selon `NORMALE_CRUNCH`), poignée verticale à côté de la tête.
 */
const COUSSIN_CRUNCH: Vec3 = [14, 50.5, 6];
const NORMALE_CRUNCH: Vec3 = V.norm([0, -1, -0.15]), PENTE_COUSSIN_CRUNCH: Vec3 = V.norm([0, 0.15, -1]);
const POIGNEE_CRUNCH: Vec3 = [15, 65, 12];
/** Le cadre du levier monte à l'extérieur des épaules, puis passe par-dessus jusqu'aux coussins. */
const X_CADRE_CRUNCH = 34, Y_CADRE_CRUNCH = 57;
export const CRUNCH_MACHINE: Modele<CrunchMachine> = {
  reperes(p, _F, t) {
    const R = M.rx(auTemps(p.course, t));
    return paire(auSol(p.pos, p.tour), 'poignee', V.add(TAILLE_CRUNCH, M.vec(R, POIGNEE_CRUNCH)), R);
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour)), phi = auTemps(p.course, c.t), x = X_CADRE_CRUNCH, y = Y_CADRE_CRUNCH;
    socle(t, -66, 22, 56, 60);
    siege(t, [0, 48, -4], 18, 16);
    dossier(t, [0, 50, -20], 6, 30, 16, [0, 56, -38]);
    t.poutre([0, 0, -38], [0, 60, -38], 7, 7);
    // Rouleaux contre le bas des tibias (les pieds se calent dessous), sur un pied au bout du socle.
    const zr = 43.5;
    t.poutre([0, 3, 22], [0, 3, zr], 8, 6, 'cadre', [1, 0, 0]);
    t.poutre([0, 0, zr], [0, 18, zr], 6, 6);
    t.cyl([-21, 18, zr], [21, 18, zr], 1.2, 'metal');
    for (const s of [1, -1]) t.rouleau([s * 3, 18, zr], [s * 20, 18, zr], 6);
    traverseAuSol(t, x, TAILLE_CRUNCH[2]);
    const l = traceur(c.out, dans(auSol(p.pos, p.tour), TAILLE_CRUNCH, M.rx(phi)));
    for (const s of [1, -1]) {
      // Moyeu sur un montant, à la taille.
      t.poutre([s * x, 0, TAILLE_CRUNCH[2]], [s * x, TAILLE_CRUNCH[1], TAILLE_CRUNCH[2]], 7, 7);
      t.cyl([s * (x - 6), TAILLE_CRUNCH[1], TAILLE_CRUNCH[2]], [s * (x + 3), TAILLE_CRUNCH[1], TAILLE_CRUNCH[2]], 3.2, 'metal');
      // Bras du levier : il monte derrière l'épaule, puis vient par-dessus jusqu'au coussin.
      const C = sym(s, COUSSIN_CRUNCH), H = sym(s, POIGNEE_CRUNCH), dessus = V.sub(C, V.mul(NORMALE_CRUNCH, 4.5));
      l.chemin([[s * (x - 3), 0, 0], [s * x, y - 8, -4], [s * x, y, 0], [dessus[0], y, dessus[2]], dessus], 4.5);
      l.coussin(C, V.mul(PENTE_COUSSIN_CRUNCH, 7), V.mul(NORMALE_CRUNCH, 2.5), 5.5);
      // Poignée verticale à côté de la tête, sur une tige qui part du dessus du coussin.
      const bas = V.sub(H, [0, 7.5, 0]);
      l.chemin([dessus, [H[0], dessus[1], H[2]], bas], 3.5);
      poignee(l, H, [0, 1, 0], 6);
    }
    const course = cmDeLevier(phi, 20);
    charge(t, c, course, -66, 160, []);
    return course;
  },
};

/**
 * La machine est dessinée la tour vers −Z (repère tourné d'un demi-tour par rapport à celui de
 * l'utilisateur, qui la regarde). Plateau des genoux : sur un chariot qui monte le long de deux tiges.
 */
const genouxAssist = (p: Assistee, t: number): Vec3 => [0, 74 + auTemps(p.course, t), 24];
/** Dans le repère de l'utilisateur (Z vers la tour) : le point `v` du dessin. */
const versUtilisateur = (v: Vec3): Vec3 => [-v[0], v[1], -v[2]];
export const ASSISTEE: Modele<Assistee> = {
  reperes(p, _F, t) {
    const base = auSol(p.pos, p.tour);
    return { barre: dans(base, versUtilisateur([0, 214, 2])), barres: dans(base, versUtilisateur([0, 118, 8])), genoux: dans(base, versUtilisateur(genouxAssist(p, t))) };
  },
  dessiner(c, p) {
    const t = traceur(c.out, auSol(p.pos, p.tour + 180)), k = genouxAssist(p, c.t), course = auTemps(p.course, c.t);
    socle(t, -78, 40, 90, 80);
    for (const s of [1, -1]) {
      t.poutre([s * 38, 0, -30], [s * 38, 222, -30], 8, 8);
      // Poignées de traction (en haut) et de dips (au milieu).
      // Poignée de traction tenue par son bout extérieur (la main est au milieu).
      t.chemin([[s * 38, 214, -30], [s * 48, 214, -20], [s * 48, 214, 2]], 5);
      t.cyl([s * 18, 214, 2], [s * 46, 214, 2], 1.6, 'metal');
      t.chemin([[s * 38, 118, -30], [s * 27, 118, -14]], 5);
      t.cyl([s * 27, 118, -14], [s * 27, 118, 26], 2.4, 'cadre');
      t.cyl([s * 27, 118, -2], [s * 27, 118, 22], 2.9, 'coussin');
      // Marches pour monter.
      t.chemin([[s * 38, 44, -30], [s * 34, 44, -18]], 4);
      t.pave([s * 30, 44, -12], [9, 0, 0], [0, 2, 0], [0, 0, 8], 'cadre');
      // Tiges du chariot, tenues par une traverse basse et une traverse haute.
      t.cyl([s * 20, 6, -26], [s * 20, 180, -26], 1.4, 'metal');
    }
    t.poutre([-40, 222, -30], [40, 222, -30], 8, 8, 'cadre', [0, 0, 1]);
    for (const y of [6, 180]) t.poutre([-38, y, -27], [38, y, -27], 5, 5, 'cadre', [0, 0, 1]);
    // Chariot, bras, plateau des genoux.
    t.pave([0, k[1] - 6, -26], [22, 0, 0], [0, 7, 0], [0, 0, 3.5], 'moyeu');
    t.poutre([0, k[1] - 6, -23], [0, k[1] - 6, k[2]], 6, 6, 'cadre', [1, 0, 0]);
    t.coussin(V.sub(k, [0, 3, 0]), [0, 0, 14], [0, 3, 0], 18);
    // La pile est un contrepoids : posée quand le plateau est au plus haut, elle monte quand on descend.
    const tige = tourCharge(t, -62, 200, 10, Math.max(...p.course) - course);
    cablePile(t, tige, 200, [[0, 222, -30], [0, k[1] + 1, -26]]);
    return course;
  },
};
