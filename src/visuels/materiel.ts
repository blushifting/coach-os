/**
 * Matériel : barres, bancs, poulies, machines… Chaque pièce est décrite en
 * volumes simples (cylindres, boules, pavés aux arêtes arrondies), dessinée
 * comme le corps, en teintes neutres : le matériel ne doit pas voler la
 * vedette au mannequin.
 *
 * Deux principes :
 * - **la pièce porte le mouvement** : une pièce mobile (barre, levier,
 *   traîneau) suit sa propre course au fil du mouvement, et reste rigide ;
 * - **les mains et les pieds la visent** : elle offre des repères (`barre`,
 *   `poigneeG`, `plateau`…) que les cibles des membres utilisent. La main
 *   reste ainsi au même endroit de la poignée, le pied à plat sur le plateau.
 * Exception : au bout d'un câble libre, la poignée suit les mains.
 *
 * Une machine à pile de plaques lève sa charge de l'écart de course avec le
 * départ du mouvement (où la charge est posée).
 *
 * Pour ajouter une pièce : son type dans le fichier de sa famille
 * (`materiel/`), son modèle (`dessiner`, et `reperes` si les membres la
 * visent), puis une ligne dans `MODELES` et dans `Piece`.
 *
 * Mesures en cm, d'après le matériel courant d'une salle (banc à 44 cm du
 * sol, coussins de 27 cm de large…), raccourcies quand une pièce pleine
 * taille rapetisserait le mannequin dans la case (barre, hauteur des tours).
 */

import { V } from './maths';
import type { Vec3 } from './maths';
import type { Repere, Reperes } from './squelette';
import { BARRE, BARRE_EZ, HALTERE, LANDMINE, ROUE_ABDO, TRAP_BAR } from './materiel/libre';
import type { Barre, BarreEz, Haltere, Landmine, RoueAbdo, TrapBar } from './materiel/libre';
import {
  ABD_ADDUCTEURS, ASSISTEE, CRUNCH_MACHINE, CURL_MACHINE, DEVELOPPE_MACHINE, ELEVATIONS_MACHINE, HACK_SQUAT, HIP_THRUST_MACHINE,
  KICKBACK_MACHINE, LEG_CURL_ASSIS, LEG_CURL_COUCHE, LEG_EXTENSION, MOLLETS_ASSIS, MOLLETS_DEBOUT, PEC_DECK, PRESSE_CUISSES,
  PULLOVER_MACHINE, SMITH, TIRAGE_HORIZONTAL_MACHINE,
} from './materiel/machines';
import type {
  AbdAdducteurs, Assistee, CrunchMachine, CurlMachine, DeveloppeMachine, ElevationsMachine, HackSquat, HipThrustMachine,
  KickbackMachine, LegCurlAssis, LegCurlCouche, LegExtension, MolletsAssis, MolletsDebout, PecDeck, PresseCuisses,
  PulloverMachine, Smith, TirageHorizontalMachine,
} from './materiel/machines';
import type { Modele, Volume } from './materiel/outils';
import { POULIE, TIRAGE_HORIZONTAL_POULIE, TIRAGE_VERTICAL, VIS_A_VIS } from './materiel/poulies';
import type { Poulie, TirageHorizontalPoulie, TirageVertical, VisAVis } from './materiel/poulies';
import { BANC, BANC_LOMBAIRES, BARRES_PARALLELES, BARRE_TRACTION, GHR, PUPITRE, REVERSE_HYPER } from './materiel/postes';
import type { Banc, BancLombaires, BarreTraction, BarresParalleles, Ghr, Pupitre, ReverseHyper } from './materiel/postes';

export type { Prise, TonMateriel, Volume } from './materiel/outils';

/** Une pièce de matériel. */
export type Piece =
  | Barre | BarreEz | TrapBar | Haltere | Landmine | RoueAbdo
  | Banc | BarreTraction | BarresParalleles | Pupitre | BancLombaires | Ghr | ReverseHyper
  | Poulie | VisAVis | TirageHorizontalPoulie | TirageVertical
  | PecDeck | DeveloppeMachine | TirageHorizontalMachine | PresseCuisses | HackSquat | Smith
  | LegExtension | LegCurlAssis | LegCurlCouche | MolletsDebout | MolletsAssis
  | ElevationsMachine | CurlMachine | PulloverMachine | KickbackMachine | AbdAdducteurs | HipThrustMachine
  | CrunchMachine | Assistee;

type ParType = { readonly [K in Piece['type']]: Modele<Extract<Piece, { type: K }>> };

/** Le modèle de chaque type de pièce. */
export const MODELES: ParType = {
  barre: BARRE, barreEz: BARRE_EZ, trapBar: TRAP_BAR, haltere: HALTERE, landmine: LANDMINE, roueAbdo: ROUE_ABDO,
  banc: BANC, barreTraction: BARRE_TRACTION, barresParalleles: BARRES_PARALLELES, pupitre: PUPITRE,
  bancLombaires: BANC_LOMBAIRES, ghr: GHR, reverseHyper: REVERSE_HYPER,
  poulie: POULIE, visAVis: VIS_A_VIS, tirageHorizontalPoulie: TIRAGE_HORIZONTAL_POULIE, tirageVertical: TIRAGE_VERTICAL,
  pecDeck: PEC_DECK, developpeMachine: DEVELOPPE_MACHINE, tirageHorizontalMachine: TIRAGE_HORIZONTAL_MACHINE,
  presseCuisses: PRESSE_CUISSES, hackSquat: HACK_SQUAT, smith: SMITH,
  legExtension: LEG_EXTENSION, legCurlAssis: LEG_CURL_ASSIS, legCurlCouche: LEG_CURL_COUCHE,
  molletsDebout: MOLLETS_DEBOUT, molletsAssis: MOLLETS_ASSIS,
  elevationsMachine: ELEVATIONS_MACHINE, curlMachine: CURL_MACHINE, pulloverMachine: PULLOVER_MACHINE,
  kickbackMachine: KICKBACK_MACHINE, abdAdducteurs: ABD_ADDUCTEURS, hipThrustMachine: HIP_THRUST_MACHINE,
  crunchMachine: CRUNCH_MACHINE, assistee: ASSISTEE,
};

const modele = <P extends Piece>(p: P): Modele<P> => MODELES[p.type] as unknown as Modele<P>;

/**
 * Les repères offerts par le matériel à cet instant du mouvement (`t` : 0 =
 * départ, 1 = arrivée), une fois le tronc placé. À passer à `resoudre`.
 */
export function reperesMateriel(materiel: readonly Piece[], tronc: Reperes, t: number): Record<string, Repere> {
  const out: Record<string, Repere> = {};
  for (const p of materiel) Object.assign(out, modele(p).reperes?.(p, tronc, t));
  return out;
}

/** Dessine le matériel. `repos` : course de chaque pièce au départ (voir `coursesMateriel`). */
function construire(materiel: readonly Piece[], F: Reperes, t: number, repos: readonly number[]): { volumes: Volume[]; courses: number[] } {
  const out: Volume[] = [];
  const courses = materiel.map((p, i) => modele(p).dessiner({ out, F, t, repos: repos[i] ?? Number.NaN }, p));
  return { volumes: out, courses };
}

/** Les volumes du matériel d'un exercice, placés dans l'espace pour cette pose. */
export function volumesMateriel(materiel: readonly Piece[], F: Reperes, t: number, repos: readonly number[] = []): Volume[] {
  return construire(materiel, F, t, repos).volumes;
}

/**
 * Course de la charge de chaque pièce (cm de câble, ou d'arc), NaN pour une
 * pièce sans charge guidée. Celle du départ sert de repos : la charge monte
 * de l'écart.
 */
export function coursesMateriel(materiel: readonly Piece[], F: Reperes, t: number): number[] {
  return construire(materiel, F, t, []).courses;
}

/** Points extrêmes d'un volume, avec leur rayon : sert au cadrage. */
export function etendue(v: Volume): { p: Vec3; r: number }[] {
  if (v.forme === 'cylindre') return [{ p: v.p0, r: v.r }, { p: v.p1, r: v.r }];
  if (v.forme === 'boule') return [{ p: v.centre, r: v.r }];
  // Les huit coins : un long montant ne doit pas compter comme une boule de sa longueur.
  const coins: { p: Vec3; r: number }[] = [];
  for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) {
    coins.push({ p: V.add(V.add(V.add(v.centre, V.mul(v.dx, a)), V.mul(v.dy, b)), V.mul(v.dz, c)), r: 0 });
  }
  return coins;
}
