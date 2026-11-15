/**
 * Le corps du mannequin : une ossature, et des muscles posés dessus.
 *
 * Tout est fait d'un seul type de volume, le « fuseau » : un axe, et le long de
 * cet axe des sections en ellipse (demi-largeur, demi-épaisseur).
 *
 *  - L'OSSATURE : un fuseau par os (tronc, bras, cuisse…), fixé à son os. C'est
 *    le corps lui-même, à peine plus mince que le corps fini : là où aucun
 *    muscle ne passe, c'est lui qu'on voit.
 *  - Les MUSCLES : chaque muscle est une pièce à part, tendue entre deux points
 *    d'attache qui peuvent être sur deux os différents. Quand l'articulation
 *    bouge, il s'allonge et s'affine, ou raccourcit et gonfle. Il est à moitié
 *    enfoncé dans le corps : seul son dessus dépasse, il fait donc partie de la
 *    silhouette au lieu d'être posé dessus.
 *
 * Les muscles colorés sur une fiche viennent du catalogue : chaque pièce porte
 * l'identifiant d'un des 17 muscles suivis (`Muscle`), ou aucun (pièce neutre).
 */

import type { Muscle } from '@/engine/models';
import { M, V, clamp } from './maths';
import type { Vec3 } from './maths';
import { REPERES_PAIRS, resoudre } from './squelette';
import type { Pose, Reperes } from './squelette';

/** Une section d'un fuseau. `cx`, `cz` : décalage de son centre ; `cr` : bords rabattus vers le corps. */
export interface Section {
  readonly u: number;
  readonly a: number;
  readonly b: number;
  readonly cx: number;
  readonly cz: number;
  readonly cr: number;
}

/**
 * Un fuseau placé dans l'espace. `A` : son axe ; `X` : sa largeur ; `Z` : son
 * épaisseur (vers l'extérieur du corps, pour un muscle). Un point de sa
 * surface : O + A·u·L + X·(cx + a·cos θ) + Z·(cz + b·sin θ − cr·cos² θ).
 */
export interface Fuseau {
  readonly O: Vec3;
  readonly X: Vec3;
  readonly A: Vec3;
  readonly Z: Vec3;
  readonly L: number;
  readonly st: readonly Section[];
  /** Rayons des boules d'articulation aux deux bouts (os de membre), ou rien. */
  readonly bouts: readonly [number, number] | null;
}

// -----------------------------------------------------------------------------
// Ossature
// -----------------------------------------------------------------------------
type Anneau = readonly [u: number, a: number, b: number, cx: number, cz: number];
export type TonOs = 'corps' | 'cheveux';

interface SpecOs {
  readonly id: string;
  /** Repère (os) auquel le fuseau est fixé. */
  readonly joint: string;
  /** Sens de l'axe dans ce repère : il descend (membres), monte (tronc), ou va vers l'avant (pied). */
  readonly base: 'bas' | 'haut' | 'avant';
  readonly o: Vec3;
  readonly L: number;
  readonly ton: TonOs;
  /** Part du rayon gardée, pour que les muscles dépassent. */
  readonly mince?: number;
  /** La carrure ne le change pas (tête, mains, pieds). */
  readonly fixe?: boolean;
  /** Une à gauche (décrite ici), une à droite (en miroir). */
  readonly pair?: boolean;
  readonly bouts?: readonly [number, number];
  readonly anneaux: readonly Anneau[];
  /** Variante main fermée sur une prise. */
  readonly ferme?: { readonly L: number; readonly anneaux: readonly Anneau[] };
}

const BASES = {
  bas: { x: [1, 0, 0], a: [0, -1, 0], z: [0, 0, 1] },
  haut: { x: [1, 0, 0], a: [0, 1, 0], z: [0, 0, 1] },
  avant: { x: [1, 0, 0], a: [0, 0, 1], z: [0, 1, 0] },
} as const satisfies Record<string, { x: Vec3; a: Vec3; z: Vec3 }>;

/** Anneaux d'un ovoïde (rayon nul aux deux bouts). `p` < 1 : bouts plus ronds. */
function ovoide(A: number, B: number, p: number, n = 12): Anneau[] {
  const r: Anneau[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, g = Math.pow(Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)), p);
    r.push([u, A * g, B * g, 0, 0]);
  }
  return r;
}
function anneauxTete(): Anneau[] {
  const r: Anneau[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const f = u < 0.55
      ? 0.54 + 0.46 * Math.pow(Math.sin((Math.PI / 2) * u / 0.55), 0.85)
      : Math.sqrt(Math.max(0, 1 - ((u - 0.55) / 0.45) ** 2));
    const cz = u < 0.3 ? 1.1 * (1 - u / 0.3) : -0.5 * Math.min(1, (u - 0.3) / 0.4);
    r.push([u, 7.9 * f, 9.6 * f, 0, cz]);
  }
  return r;
}

export const OSSATURE: readonly SpecOs[] = [
  { id: 'bassin', joint: 'bassin', base: 'haut', o: [0, -12, 0], L: 18, ton: 'corps', mince: 0.97,
    anneaux: [[0, 7, 6, 0, -0.5], [0.17, 13.2, 9.6, 0, -0.8], [0.39, 16.4, 11, 0, -1], [0.67, 15.9, 10.6, 0, -0.6], [1, 14.6, 9.7, 0, 0]] },
  { id: 'ventre', joint: 'lombaires', base: 'haut', o: [0, 0, 0], L: 22, ton: 'corps', mince: 0.97,
    anneaux: [[0, 14.6, 9.7, 0, 0], [0.3, 13.8, 9.2, 0, 0.2], [0.65, 14, 9.4, 0, 0.5], [1, 15, 9.9, 0, 0.6]] },
  { id: 'thorax', joint: 'thorax', base: 'haut', o: [0, 0, 0], L: 27, ton: 'corps', mince: 0.97,
    anneaux: [[0, 15, 9.9, 0, 0.6], [0.3, 17, 11.3, 0, 1], [0.56, 17.6, 11.8, 0, 0.8], [0.78, 16, 10.4, 0, 0.2], [0.9, 14, 8.7, 0, -0.4], [1, 7.6, 6.2, 0, -0.6]] },
  { id: 'cou', joint: 'cou', base: 'haut', o: [0, -1, 0], L: 7.5, ton: 'corps', fixe: true,
    anneaux: [[0, 5.6, 5.8, 0, 0], [1, 5, 5.4, 0, 0.4]] },
  { id: 'tete', joint: 'tete', base: 'haut', o: [0, -1.2, 1], L: 22.6, ton: 'corps', fixe: true, anneaux: anneauxTete() },
  // Les cheveux : une calotte un peu plus large que le crâne, reculée. De face
  // elle dépasse à peine ; de profil et de dos elle dit où regarde la tête.
  { id: 'cheveux', joint: 'tete', base: 'haut', o: [0, 7, -1], L: 15.4, ton: 'cheveux', fixe: true, anneaux: ovoide(8.2, 9.6, 0.75) },
  { id: 'bras', joint: 'epaule', pair: true, base: 'bas', o: [0, 0, 0], L: 30, ton: 'corps', mince: 0.92, bouts: [4.8, 4.2],
    anneaux: [[0, 5.4, 5.6, 0, 0], [0.4, 5.7, 6.6, 0, 0.3], [0.8, 4.9, 5.3, 0, 0], [1, 4.5, 4.8, 0, 0]] },
  { id: 'avantBras', joint: 'coude', pair: true, base: 'bas', o: [0, 0, 0], L: 26, ton: 'corps', mince: 0.92, bouts: [4.2, 2.9],
    anneaux: [[0, 4.6, 4.8, 0, 0], [0.22, 5.1, 5.5, 0, 0], [0.62, 3.9, 4.2, 0, 0], [1, 2.9, 3.4, 0, 0]] },
  { id: 'main', joint: 'poignet', pair: true, base: 'bas', o: [0, 0, 0], L: 18, ton: 'corps', fixe: true,
    anneaux: [[0, 2.6, 3.2, 0, 0], [0.3, 2.1, 4.7, 0, 0], [0.75, 1.7, 4.2, 0, 0], [1, 0.9, 2.4, 0, 0]],
    ferme: { L: 10, anneaux: [[0, 2.8, 3.2, 0, 0], [0.3, 3.7, 4.7, 0, 0], [0.75, 3.7, 4.6, 0, 0], [1, 2.4, 3.4, 0, 0]] } },
  { id: 'cuisse', joint: 'hanche', pair: true, base: 'bas', o: [0, 0, 0], L: 43.5, ton: 'corps', mince: 0.92, bouts: [7.6, 5.2],
    anneaux: [[0, 9.2, 9.4, 0, 0], [0.25, 9.4, 10.2, 0, 0.5], [0.6, 7.8, 8.6, 0, 0.7], [0.88, 5.9, 6.2, 0, 0.3], [1, 5.4, 5.6, 0, 0]] },
  { id: 'jambe', joint: 'genou', pair: true, base: 'bas', o: [0, 0, 0], L: 41.5, ton: 'corps', mince: 0.92, bouts: [5.2, 3.2],
    anneaux: [[0, 5.4, 5.6, 0, 0], [0.25, 6.2, 7, 0, -1.3], [0.55, 4.9, 5.4, 0, -0.7], [0.85, 3.4, 3.7, 0, 0], [1, 3.2, 3.4, 0, 0]] },
  { id: 'pied', joint: 'cheville', pair: true, base: 'avant', o: [0, -4.6, -6.5], L: 26, ton: 'corps', fixe: true,
    anneaux: [[0, 2.9, 2.8, 0, 0.6], [0.15, 3.9, 3.7, 0, 0.6], [0.45, 4.7, 3.5, 0, 0], [0.8, 4.9, 2.4, 0, -1], [1, 3.4, 1.6, 0, -1.6]] },
];

// -----------------------------------------------------------------------------
// Muscles
// -----------------------------------------------------------------------------
/** Un point dans le repère d'un os : [nom du repère, [x, y, z]]. */
type Attache = readonly [repere: string, point: Vec3];
/** [u, demi-largeur, demi-épaisseur, décalage en largeur (facultatif)]. */
type Profil = readonly (readonly [number, number, number, number?])[];

export interface SpecMuscle {
  readonly id: string;
  /** Muscle du catalogue que cette pièce représente ; absent : pièce neutre. */
  readonly m?: Muscle;
  /** Points d'attache. */
  readonly de: Attache;
  readonly a: Attache;
  /** Vers où regarde le muscle (vers l'extérieur du corps), dans le repère d'un os. */
  readonly n: Attache;
  /**
   * Sa forme le long de son trajet. La largeur se mesure dans la direction
   * Z × A (épaisseur × axe) ; le décalage en largeur déplace la section dans
   * cette même direction.
   */
  readonly profil: Profil;
  /** De combien son milieu se bombe vers l'extérieur. */
  readonly arc?: number;
  /** De combien ses bords se rabattent vers le corps, à sa plus grande largeur. */
  readonly creux?: number;
  /** Part de la longueur sur laquelle chaque bout s'arrondit (petit = bout large). */
  readonly pointes?: readonly [number, number];
  /**
   * Os que le muscle longe, en plus de ceux de ses deux attaches (qui sont
   * pris d'office) : il les contourne au lieu de les traverser quand il s'étire.
   */
  readonly autour?: readonly string[];
}

// Règle de pose : la ligne d'un muscle suit la surface du corps, si bien qu'une
// moitié est dedans et que seul le dessus dépasse. Décrits pour le côté gauche
// (X positif = vers l'extérieur du corps) ; le côté droit est leur miroir.
const PAVE: Profil = [[0, 2.8, 1.2], [0.5, 3, 1.7], [1, 2.8, 1.2]];
export const MUSCLES: readonly SpecMuscle[] = [
  // --- Tronc, devant ---
  { id: 'pectoral', m: 'pectoraux', de: ['thorax', [0.9, 11.5, 11.5]], a: ['epaule', [0.8, -7.5, 3.2]], n: ['thorax', [0.4, 0, 1]], arc: 2.4, creux: 0.5, pointes: [0.06, 0.22],
    profil: [[0, 7.2, 1.5], [0.3, 7.6, 2.4], [0.65, 6, 2.7], [1, 2.4, 2]] },
  { id: 'pectoralHaut', m: 'pectoraux', de: ['thorax', [3.2, 20.4, 9.6]], a: ['epaule', [0.9, -5.5, 3.4]], n: ['thorax', [0.35, 0.3, 1]], arc: 1.6, pointes: [0.08, 0.2],
    profil: [[0, 2.6, 1.4], [0.4, 3.4, 2.2], [1, 2, 1.8]] },
  { id: 'abdo1', m: 'abdos', de: ['thorax', [3.2, 5.6, 11.1]], a: ['thorax', [3.2, 0.2, 10.7]], n: ['thorax', [0, 0, 1]], profil: PAVE, pointes: [0.3, 0.3] },
  { id: 'abdo2', m: 'abdos', de: ['lombaires', [3.2, 21.6, 10]], a: ['lombaires', [3.2, 15, 9.6]], n: ['lombaires', [0, 0, 1]], profil: PAVE, pointes: [0.3, 0.3] },
  { id: 'abdo3', m: 'abdos', de: ['lombaires', [3.2, 14.6, 9.6]], a: ['lombaires', [3.2, 7.8, 9.4]], n: ['lombaires', [0, 0, 1]], profil: PAVE, pointes: [0.3, 0.3] },
  { id: 'abdo4', m: 'abdos', de: ['lombaires', [3.1, 7.4, 9.4]], a: ['bassin', [2.1, -3.4, 9.6]], n: ['bassin', [0, 0, 1]],
    profil: [[0, 2.9, 1.1], [0.4, 2.8, 1.6], [1, 1.2, 0.9]] },
  { id: 'dentele', m: 'obliques', de: ['thorax', [15, 11, 4.2]], a: ['thorax', [13.4, 1.5, 6.6]], n: ['thorax', [0.9, 0, 0.45]], creux: 0.6, pointes: [0.12, 0.12],
    profil: [[0, 3, 1.2], [0.5, 4.2, 1.7], [1, 3.2, 1.2]] },
  { id: 'oblique', m: 'obliques', de: ['thorax', [12.4, 2.5, 6.6]], a: ['bassin', [13, 4, 4.6]], n: ['lombaires', [0.8, 0, 0.6]], arc: -0.6, creux: 1.2, pointes: [0.1, 0.1], autour: ['ventre'],
    profil: [[0, 5, 1.2], [0.5, 6, 1.8], [1, 4.6, 1.2]] },
  { id: 'sternoCleido', de: ['tete', [5.6, 1.8, -1]], a: ['thorax', [1.8, 26, 5.2]], n: ['cou', [0.6, 0, 0.8]], autour: ['cou'],
    profil: [[0, 1.3, 1], [0.5, 1.6, 1.2], [1, 1.2, 1]] },
  // --- Tronc, derrière ---
  // Un coin, épais et large près du cou, qui s'amincit jusqu'à l'épaule et se
  // rabat devant et derrière : il fait la pente de l'épaule, pas une épaulette.
  { id: 'trapeze', m: 'trapezes_hauts', de: ['cou', [3.4, 4.6, -2.8]], a: ['thorax', [16.4, 22, -2.2]], n: ['thorax', [0.2, 0.85, -0.5]], arc: -0.4, creux: 2.2, pointes: [0.1, 0.3],
    profil: [[0, 3.6, 2.4], [0.3, 5.6, 2.4], [0.7, 4.8, 1.5], [1, 2.4, 0.9]] },
  { id: 'hautDos', m: 'dos_epaisseur', de: ['thorax', [2.2, 15, -10.3]], a: ['thorax', [13.5, 20.5, -5.6]], n: ['thorax', [0.3, 0, -1]], arc: 1.2, creux: 0.6, pointes: [0.07, 0.2],
    profil: [[0, 9, 1.4], [0.5, 7.2, 2], [1, 3.4, 1.5]] },
  { id: 'sousEpineux', m: 'dos_epaisseur', de: ['thorax', [8.5, 12.5, -9.2]], a: ['epaule', [0.5, -4, -3.6]], n: ['thorax', [0.55, 0, -0.85]], arc: 1, creux: 0.6,
    profil: [[0, 4.5, 1.4], [0.5, 4.8, 2], [1, 2.2, 1.5]] },
  { id: 'dorsal', m: 'dos_largeur', de: ['lombaires', [7, 5, -7.8]], a: ['epaule', [-2.6, -7.5, -1.2]], n: ['thorax', [0.72, 0, -0.7]], arc: 2.2, creux: 2.6, pointes: [0.12, 0.2], autour: ['thorax'],
    // Décalé vers la colonne (largeur négative) : les deux dorsaux se rejoignent au milieu du dos.
    profil: [[0, 3.6, 1.2, 0], [0.25, 7.2, 1.8, -2], [0.55, 9.5, 2.4, -2.6], [0.8, 7, 2.4, -1], [1, 2.8, 1.8, 0]] },
  { id: 'lombaire', m: 'lombaires', de: ['bassin', [3.1, 5, -9.5]], a: ['thorax', [3.3, 2.5, -9.9]], n: ['lombaires', [0.1, 0, -1]], autour: ['ventre'],
    profil: [[0, 2.8, 1.4], [0.5, 3.4, 1.8], [1, 2.4, 1.2]] },
  // --- Épaule et bras ---
  { id: 'deltoAnt', m: 'deltos_anterieurs', de: ['thorax', [15, 23, 4.5]], a: ['epaule', [3.4, -14, 1.8]], n: ['delto', [0.45, 0.1, 1]], arc: 1.6, creux: 0.6,
    profil: [[0, 3.6, 2], [0.4, 4.8, 3.2], [1, 1.8, 1.4]] },
  { id: 'deltoLat', m: 'deltos_lateraux', de: ['thorax', [20.4, 24.8, 0]], a: ['epaule', [4.6, -15, 0]], n: ['delto', [1, 0.25, 0]], arc: 1.8, creux: 0.8,
    profil: [[0, 4, 2], [0.4, 5.2, 3.4], [1, 1.9, 1.5]] },
  { id: 'deltoPost', m: 'deltos_posterieurs', de: ['thorax', [15, 23, -5]], a: ['epaule', [3.2, -14, -2]], n: ['delto', [0.45, 0.1, -1]], arc: 1.6, creux: 0.6,
    profil: [[0, 3.6, 2], [0.4, 4.8, 3.2], [1, 1.8, 1.4]] },
  { id: 'biceps', m: 'biceps', de: ['epaule', [0.4, -5.5, 3.2]], a: ['coude', [0.3, -3.5, 2.6]], n: ['epaule', [0, 0, 1]], creux: 0.6,
    profil: [[0, 2.6, 1.8], [0.45, 4.2, 3.5], [1, 1.8, 1.5]] },
  { id: 'tricepsLong', m: 'triceps', de: ['epaule', [-1.2, -5, -3.4]], a: ['coude', [-0.5, 1.5, -3.4]], n: ['epaule', [-0.3, 0, -1]], creux: 0.5,
    profil: [[0, 2.6, 1.8], [0.4, 3.8, 3.3], [1, 2, 1.5]] },
  { id: 'tricepsLat', m: 'triceps', de: ['epaule', [3, -8.5, -2.4]], a: ['coude', [0.9, 1.5, -3.4]], n: ['epaule', [0.8, 0, -0.6]], creux: 0.5,
    profil: [[0, 2.4, 1.6], [0.4, 3.6, 3], [1, 1.8, 1.4]] },
  { id: 'brachioRadial', de: ['epaule', [3.4, -23, 1.2]], a: ['coude', [2.4, -21, 1.6]], n: ['coude', [1, 0, 0.5]],
    profil: [[0, 1.4, 1.2], [0.4, 2.4, 2], [1, 1.2, 1]] },
  { id: 'avantBrasExt', de: ['coude', [2.2, -1.5, -0.6]], a: ['coude', [0.9, -24.5, -0.3]], n: ['coude', [1, 0, -0.25]], creux: 0.8,
    profil: [[0, 2.6, 2], [0.3, 4.2, 3.2], [0.75, 2.6, 2.1], [1, 1.6, 1.3]] },
  { id: 'avantBrasFlex', de: ['coude', [-2, -1.5, 0.8]], a: ['coude', [-0.8, -24.5, 0.3]], n: ['coude', [-1, 0, 0.25]], creux: 0.8,
    profil: [[0, 2.6, 2], [0.3, 4.2, 3.2], [0.75, 2.6, 2.1], [1, 1.6, 1.3]] },
  // --- Hanche et jambe ---
  // Son bas tient au repère à mi-chemin entre bassin et cuisse, pas à la cuisse :
  // quand la hanche plie, il ne part pas sous la cuisse, il reste sur la fesse
  // et l'enveloppe par-dessous.
  { id: 'fessier', m: 'fessiers', de: ['bassin', [5, 6.5, -8.6]], a: ['fessier', [-2.4, -13, -5.5]], n: ['fessier', [0.1, 0, -1]], arc: 1.8, creux: 1.5, pointes: [0.14, 0.24], autour: ['cuisse'],
    profil: [[0, 7, 2.6], [0.45, 10, 5], [1, 5.8, 2.8]] },
  { id: 'moyenFessier', m: 'fessiers', de: ['bassin', [14, 5.5, -1]], a: ['hanche', [5.6, -7, -0.6]], n: ['fessier', [1, 0, -0.15]], creux: 0.8,
    profil: [[0, 4.4, 1.5], [0.5, 5, 2.3], [1, 2.4, 1.6]] },
  { id: 'droitFemoral', m: 'quadriceps', de: ['hanche', [-0.4, -2.5, 6.8]], a: ['rotule', [0, 3.6, 4.6]], n: ['hanche', [0, 0, 1]], arc: 1.2, creux: 0.8,
    profil: [[0, 2.6, 1.8], [0.35, 4.6, 3.2], [0.8, 3.4, 2.4], [1, 2, 1.3]] },
  { id: 'vasteExterne', m: 'quadriceps', de: ['hanche', [5.4, -7, 3.4]], a: ['rotule', [2.8, 2.6, 3.4]], n: ['hanche', [0.85, 0, 0.5]], arc: 1, creux: 1,
    profil: [[0, 3, 2], [0.45, 5.6, 3.5], [0.85, 3.6, 2.5], [1, 1.9, 1.3]] },
  { id: 'vasteInterne', m: 'quadriceps', de: ['hanche', [-4.8, -23, 4.4]], a: ['rotule', [-2.8, 2, 3.4]], n: ['hanche', [-0.75, 0, 0.66]], creux: 0.6,
    profil: [[0, 1.8, 1.3], [0.55, 4.4, 3.1], [1, 1.9, 1.3]] },
  { id: 'adducteur', m: 'adducteurs', de: ['bassin', [3.2, -9, 1.5]], a: ['hanche', [-6, -26, 1]], n: ['hanche', [-1, 0, 0.1]], creux: 1,
    profil: [[0, 3.6, 2.2], [0.4, 5.4, 3.2], [1, 2, 1.4]] },
  { id: 'ischioLat', m: 'ischios', de: ['hanche', [3.6, -6, -6.6]], a: ['rotule', [3.4, 1.5, -4.4]], n: ['hanche', [0.45, 0, -0.9]], creux: 0.8,
    profil: [[0, 2.8, 2], [0.4, 4.6, 3.3], [1, 1.8, 1.4]] },
  { id: 'ischioMed', m: 'ischios', de: ['hanche', [-3, -6, -6.4]], a: ['rotule', [-3, 1.5, -4.2]], n: ['hanche', [-0.45, 0, -0.9]], creux: 0.8,
    profil: [[0, 2.8, 2], [0.4, 4.6, 3.3], [1, 1.8, 1.4]] },
  { id: 'rotule', de: ['rotule', [0, 3.2, 4.8]], a: ['rotule', [0, -3.4, 4.4]], n: ['rotule', [0, 0, 1]],
    profil: [[0, 1.8, 1.1], [0.5, 3, 1.8], [1, 1.9, 1.1]] },
  { id: 'molletLat', m: 'mollets', de: ['genou', [2.8, -2, -5]], a: ['genou', [0.9, -27, -3.6]], n: ['genou', [0.5, 0, -0.87]], creux: 0.6,
    profil: [[0, 2.4, 1.8], [0.35, 4, 3.4], [1, 1.2, 1]] },
  { id: 'molletMed', m: 'mollets', de: ['genou', [-3, -2, -5]], a: ['genou', [-0.9, -28.5, -3.6]], n: ['genou', [-0.5, 0, -0.87]], creux: 0.6,
    profil: [[0, 2.4, 1.8], [0.35, 4, 3.4], [1, 1.2, 1]] },
  { id: 'soleaire', m: 'mollets', de: ['genou', [0, -19, -3.6]], a: ['genou', [0, -38.5, -2.4]], n: ['genou', [0, 0, -1]], creux: 0.8,
    profil: [[0, 3.2, 1.4], [0.4, 3.4, 1.8], [1, 1.4, 1.1]] },
  { id: 'tibial', de: ['genou', [2, -4, 3.8]], a: ['genou', [0.7, -35, 2.6]], n: ['genou', [0.45, 0, 0.9]], creux: 0.5,
    profil: [[0, 2, 1.4], [0.3, 3.2, 2.2], [1, 1.3, 1]] },
  { id: 'peronier', de: ['genou', [4.2, -5, -0.4]], a: ['genou', [2.8, -36, -0.6]], n: ['genou', [1, 0, -0.1]],
    profil: [[0, 1.4, 1.2], [0.4, 1.9, 1.6], [1, 1.1, 1]] },
];

// -----------------------------------------------------------------------------
// Préparation (une fois) et mise en place (à chaque image)
// -----------------------------------------------------------------------------
/** Courbe lisse passant par des points (us, vs), sans dépassement. */
function courbe(us: readonly number[], vs: readonly number[]): (u: number) => number {
  const n = us.length, m = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    m[i] = (vs[b]! - vs[a]!) / (us[b]! - us[a]!);
    if (i > 0 && i < n - 1 && (vs[i]! - vs[i - 1]!) * (vs[i + 1]! - vs[i]!) <= 0) m[i] = 0;
  }
  return (u) => {
    let i = 0;
    while (i < n - 2 && u > us[i + 1]!) i++;
    const h = us[i + 1]! - us[i]!, t = clamp((u - us[i]!) / h, 0, 1), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * vs[i]! + (t3 - 2 * t2 + t) * h * m[i]!
      + (-2 * t3 + 3 * t2) * vs[i + 1]! + (t3 - t2) * h * m[i + 1]!;
  };
}

/** Sections d'un fuseau à intervalles réguliers le long de son axe. */
export function sections(N: number, f: (u: number) => Omit<Section, 'u'>): Section[] {
  const st: Section[] = [];
  for (let i = 0; i <= N; i++) st.push({ u: i / N, ...f(i / N) });
  return st;
}

export interface Os {
  readonly id: string;
  readonly joint: string;
  readonly ton: TonOs;
  readonly o: Vec3;
  readonly bx: Vec3;
  readonly ba: Vec3;
  readonly bz: Vec3;
  readonly L: number;
  readonly st: readonly Section[];
  readonly bouts: readonly [number, number] | null;
}
interface Lieu {
  readonly rep: string;
  readonly p: Vec3;
}
/** Un os que le muscle longe, et jusqu'où chaque section du muscle a le droit de s'y enfoncer. */
interface Hote {
  readonly os: Os;
  /** Par section : 1 = à la surface de l'os, 0 = sur son axe. */
  readonly seuil: readonly number[];
}
export interface PieceMuscle {
  readonly id: string;
  readonly muscle: Muscle | null;
  readonly de: Lieu;
  readonly a: Lieu;
  readonly n: Lieu;
  readonly st: readonly Section[];
  /** Longueur au repos : sert à savoir de combien le muscle est étiré ou raccourci. */
  readonly L0: number;
  readonly hotes: readonly Hote[];
}
export interface Corps {
  readonly os: readonly Os[];
  readonly muscles: readonly PieceMuscle[];
}

const PAIRS: ReadonlySet<string> = new Set(REPERES_PAIRS);
const suffixe = (cote: number): string => (cote > 0 ? 'G' : 'D');

function preparerOs(spec: SpecOs, cote: 1 | -1, carrure: number, mainFermee: boolean): Os {
  const src = spec.ferme !== undefined && mainFermee ? { ...spec, ...spec.ferme } : spec;
  const k = (spec.fixe ? 1 : carrure) * (spec.mince ?? 1);
  const us = src.anneaux.map((r) => r[0]);
  const f = ([1, 2, 3, 4] as const).map((j) => courbe(us, src.anneaux.map((r) => r[j])));
  const base = BASES[spec.base], sfx = spec.pair ? suffixe(cote) : '';
  return {
    id: spec.id + sfx,
    joint: spec.joint + sfx,
    ton: spec.ton,
    o: [src.o[0] * cote, src.o[1], src.o[2]],
    bx: base.x, ba: base.a, bz: base.z,
    L: src.L,
    st: sections(Math.max(8, Math.ceil(src.L / 2)), (u) => ({
      a: Math.max(0, f[0]!(u)) * k, b: Math.max(0, f[1]!(u)) * k, cx: f[2]!(u) * cote, cz: f[3]!(u), cr: 0,
    })),
    bouts: spec.bouts ? [spec.bouts[0] * carrure, spec.bouts[1] * carrure] : null,
  };
}

function preparerMuscle(spec: SpecMuscle, cote: 1 | -1, carrure: number): Omit<PieceMuscle, 'L0' | 'hotes'> {
  const sfx = suffixe(cote);
  const repere = (nom: string): string => (PAIRS.has(nom) ? nom + sfx : nom);
  const lieu = ([rep, p]: Attache): Lieu => ({ rep: repere(rep), p: [p[0] * cote * carrure, p[1], p[2] * carrure] });
  const us = spec.profil.map((r) => r[0]);
  const fa = courbe(us, spec.profil.map((r) => r[1]));
  const fb = courbe(us, spec.profil.map((r) => r[2]));
  const fx = courbe(us, spec.profil.map((r) => r[3] ?? 0));
  const large = Math.max(...spec.profil.map((r) => r[1]));
  // Bouts arrondis : le muscle se referme en pointe douce à chaque attache.
  const [e0, e1] = spec.pointes ?? [0.16, 0.16];
  const bout = (u: number): number =>
    u < e0 ? Math.sqrt(1 - (1 - u / e0) ** 2) : u > 1 - e1 ? Math.sqrt(1 - (1 - (1 - u) / e1) ** 2) : 1;
  return {
    id: spec.id + sfx,
    muscle: spec.m ?? null,
    de: lieu(spec.de),
    a: lieu(spec.a),
    n: { rep: repere(spec.n[0]), p: [spec.n[1][0] * cote, spec.n[1][1], spec.n[1][2]] },
    st: sections(12, (u) => {
      const a = fa(u) * bout(u);
      return {
        a: a * carrure,
        b: fb(u) * bout(u) * carrure,
        // Le miroir retourne la direction de la largeur : le décalage change de signe à droite.
        cx: fx(u) * cote * carrure,
        cz: (spec.arc ?? 0) * Math.sin(Math.PI * u),
        cr: (spec.creux ?? 0) * (a / large) ** 2,
      };
    }),
  };
}

const lieuMonde = (F: Reperes, l: Lieu): Vec3 => {
  const r = F[l.rep];
  if (r === undefined) throw new Error(`Repère inconnu : ${l.rep}`);
  return V.add(r.o, M.vec(r.R, l.p));
};

/** Où est un os dans l'espace, pour cette pose. */
export function geomOs(t: Os, F: Reperes): Fuseau {
  const f = F[t.joint];
  if (f === undefined) throw new Error(`Repère inconnu : ${t.joint}`);
  return { O: V.add(f.o, M.vec(f.R, t.o)), X: M.vec(f.R, t.bx), A: M.vec(f.R, t.ba), Z: M.vec(f.R, t.bz), L: t.L, st: t.st, bouts: t.bouts };
}

/** Part de la longueur d'un fuseau sur laquelle son effet s'éteint au-delà de chaque bout. */
const FONDU = 0.15;

/**
 * À quelle profondeur un point est enfoncé dans un fuseau : `q` = 0 sur son
 * axe, 1 à sa surface, plus de 1 dehors. Rend aussi ses écarts à l'axe (de quoi
 * le ramener vers la surface) et un `poids` : 1 le long du fuseau, qui tombe à
 * 0 un peu au-delà de chaque bout. Ce fondu évite qu'un muscle saute au moment
 * où une de ses sections dépasse le bout de l'os qu'il contourne.
 * `null` si le point est hors d'atteinte (trop loin d'un bout, ou face à une
 * section presque nulle).
 */
export function profondeur(P: Vec3, g: Fuseau): { q: number; x: number; z: number; a: number; b: number; poids: number } | null {
  const rel = V.sub(P, g.O), u = V.dot(rel, g.A) / g.L;
  const poids = u < 0 ? 1 + u / FONDU : u > 1 ? 1 - (u - 1) / FONDU : 1;
  if (poids <= 0) return null;
  const k = clamp(u, 0, 1) * (g.st.length - 1), i = Math.min(g.st.length - 2, Math.floor(k)), t = k - i, p = g.st[i]!, q = g.st[i + 1]!;
  const a = p.a + (q.a - p.a) * t, b = p.b + (q.b - p.b) * t;
  if (a < 0.5 || b < 0.5) return null;
  const x = V.dot(rel, g.X) - (p.cx + (q.cx - p.cx) * t), z = V.dot(rel, g.Z) - (p.cz + (q.cz - p.cz) * t);
  return { q: Math.hypot(x / a, z / b), x, z, a, b, poids };
}

interface Ligne {
  readonly O: Vec3;
  readonly X: Vec3;
  readonly A: Vec3;
  readonly Z: Vec3;
  readonly L: number;
}
/** La ligne droite d'un muscle, d'une attache à l'autre, et son repère. */
function ligne(m: Pick<PieceMuscle, 'de' | 'a' | 'n'>, F: Reperes): Ligne {
  const O = lieuMonde(F, m.de), ax = V.sub(lieuMonde(F, m.a), O), L = Math.max(V.len(ax), 0.5), A = V.mul(ax, 1 / L);
  const r = F[m.n.rep];
  if (r === undefined) throw new Error(`Repère inconnu : ${m.n.rep}`);
  const n = M.vec(r.R, m.n.p);
  let Z = V.sub(n, V.mul(A, V.dot(n, A)));
  if (V.len(Z) < 1e-6) Z = V.cross(A, [1, 0, 0]);
  Z = V.norm(Z);
  return { O, X: V.cross(Z, A), A, Z, L };
}
const centre = (l: Ligne, s: Section): Vec3 =>
  V.add(V.add(V.add(l.O, V.mul(l.A, s.u * l.L)), V.mul(l.X, s.cx)), V.mul(l.Z, s.cz));

/** Profondeur tolérée par défaut, pour une section qui ne longeait pas cet os au repos. */
const SEUIL = 0.95;

/**
 * Construit le corps. `carrure` : 1 = normale ; `mainFermee` : mains fermées
 * sur une prise ; `repos` : la pose où chaque muscle a sa longueur de repos,
 * et sa profondeur de référence dans les os qu'il longe.
 */
export function construireCorps(carrure: number, mainFermee: boolean, repos: Pose): Corps {
  const os: Os[] = [];
  for (const spec of OSSATURE) {
    os.push(preparerOs(spec, 1, carrure, mainFermee));
    if (spec.pair) os.push(preparerOs(spec, -1, carrure, mainFermee));
  }
  const F = resoudre(repos);
  const muscles: PieceMuscle[] = [];
  for (const spec of MUSCLES) {
    for (const cote of [1, -1] as const) {
      const m = preparerMuscle(spec, cote, carrure), l = ligne(m, F), sfx = suffixe(cote);
      // Les os qu'il longe : ceux de ses deux attaches, et ceux nommés dans `autour`.
      const noms = new Set(spec.autour ?? []);
      const longes = os.filter((o) => o.ton === 'corps' && (o.joint === m.de.rep || o.joint === m.a.rep || noms.has(o.id) || noms.has(o.id.slice(0, -1)) && o.id.endsWith(sfx)));
      const hotes = longes.map((o): Hote => {
        const g = geomOs(o, F);
        return { os: o, seuil: m.st.map((s) => Math.min(SEUIL, profondeur(centre(l, s), g)?.q ?? SEUIL)) };
      });
      muscles.push({ ...m, L0: l.L, hotes });
    }
  }
  return { os, muscles };
}

/**
 * Où est un muscle dans l'espace, pour cette pose.
 *
 * Il est tendu entre ses deux attaches, mais il ne traverse pas le corps : là
 * où la ligne droite s'enfoncerait dans un os qu'il longe plus qu'elle ne le
 * fait au repos, la section est ramenée vers la surface. C'est ce qui fait
 * qu'un pectoral ou un fessier étiré enveloppe le tronc ou la hanche au lieu
 * de disparaître dedans.
 *
 * Le volume est à peu près conservé : raccourci, il gonfle (surtout en
 * épaisseur) ; étiré, il s'affine.
 */
export function geomMuscle(m: PieceMuscle, F: Reperes): Fuseau {
  const l = ligne(m, F);
  const g = clamp(m.L0 / l.L, 0.8, 1.5), ga = Math.pow(g, 0.3), gb = Math.pow(g, 0.6);
  const hotes = m.hotes.map((h) => ({ g: geomOs(h.os, F), seuil: h.seuil }));
  let uAvant = -1;
  return {
    ...l,
    bouts: null,
    st: m.st.map((s, i) => {
      const depart = centre(l, s);
      let P = depart;
      // Plusieurs passes : sortir d'un os peut faire entrer dans son voisin.
      for (let passe = 0; passe < 4; passe++) {
        for (const h of hotes) {
          const d = profondeur(P, h.g), seuil = h.seuil[i]!;
          if (d === null || d.q >= seuil) continue;
          // Ramené vers la surface, surtout du côté où regarde le muscle, un
          // peu le long du rayon qui part de l'axe de l'os. Sortir seulement le
          // long du rayon ferait glisser le muscle autour de l'os : un fessier
          // partirait sur le côté de la hanche au lieu de rester derrière.
          const zx = V.dot(l.Z, h.g.X), zz = V.dot(l.Z, h.g.Z), r = Math.hypot(d.x, d.z);
          let dx = 1.5 * zx + (r > 1e-6 ? d.x / r : 0), dz = 1.5 * zz + (r > 1e-6 ? d.z / r : 0);
          const n = Math.hypot(dx, dz);
          if (n < 1e-6) continue;
          dx /= n; dz /= n;
          // Distance à parcourir dans cette direction pour revenir à la profondeur tolérée.
          const A2 = (dx / d.a) ** 2 + (dz / d.b) ** 2, B2 = 2 * ((d.x * dx) / d.a ** 2 + (d.z * dz) / d.b ** 2), C2 = d.q * d.q - seuil * seuil;
          const pas = ((-B2 + Math.sqrt(Math.max(0, B2 * B2 - 4 * A2 * C2))) / (2 * A2)) * d.poids;
          P = V.add(P, V.add(V.mul(h.g.X, dx * pas), V.mul(h.g.Z, dz * pas)));
        }
      }
      // L'écart se répartit sur les trois directions du muscle. Le long de son
      // axe, la section glisse (sans jamais passer devant la précédente).
      const ecart = V.sub(P, depart);
      const u = Math.max(uAvant + 0.004, s.u + V.dot(ecart, l.A) / l.L);
      uAvant = u;
      return { u, a: s.a * ga, b: s.b * gb, cx: s.cx + V.dot(ecart, l.X), cz: s.cz + V.dot(ecart, l.Z), cr: s.cr };
    }),
  };
}
