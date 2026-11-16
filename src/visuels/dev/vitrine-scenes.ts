/**
 * Scènes de la vitrine du matériel : une par pièce, avec un mannequin posé à
 * grands traits pour donner l'échelle. Ces poses sont des ébauches : les
 * vraies se font dans l'atelier, exercice par exercice (étape V-5).
 */

import type { Piece } from '../materiel';
import type { PoseExercice } from '../scene';
import { piedAuSol, pose } from '../squelette';
import type { CibleBras, CibleJambe, DescriptionPose } from '../squelette';

export type Famille = 'libres' | 'postes' | 'poulies' | 'haut' | 'bas';
export const FAMILLES: readonly { id: Famille; nom: string }[] = [
  { id: 'libres', nom: 'Bancs et poids libres' },
  { id: 'postes', nom: 'Postes' },
  { id: 'poulies', nom: 'Poulies' },
  { id: 'haut', nom: 'Machines, haut du corps' },
  { id: 'bas', nom: 'Machines, bas du corps' },
];

export interface Scene { readonly nom: string; readonly materiel: string; readonly famille: Famille; readonly sujet: PoseExercice }

type V3 = [number, number, number];
/** La main tient une poignée d'un repère (centre du poing en `pos`, poignée le long de `axe`). */
const tient = (repere: string, pos: V3, axe: V3, pole: V3): CibleBras => ({ repere, pos, axe, pole });
const pied = (pos: V3, pole: V3, repere?: string, pointe = 0): CibleJambe => ({ pos, pole, tour: 6, pointe, ...(repere === undefined ? {} : { repere }) });
const piedsAuSol = { jambe: { cible: piedAuSol(13, 10) } };
const HALTERES: readonly Piece[] = [
  { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
  { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
];

function scene(
  famille: Famille, nom: string, materiel: string, id: string, camera: [number, number],
  pieces: readonly Piece[], cles: readonly DescriptionPose[],
): Scene {
  return { nom, materiel, famille, sujet: { id, camera: { tour: camera[0], hauteur: camera[1] }, mainFermee: true, materiel: pieces, cles: cles.map(pose), valide: false } };
}
/** Fusion en profondeur de deux descriptions (les tableaux sont remplacés). */
function fusionner<T>(a: T, b: T): T {
  if (typeof a !== 'object' || a === null || Array.isArray(a) || typeof b !== 'object' || b === null || Array.isArray(b)) return b === undefined ? a : b;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) o[k] = fusionner(o[k], v);
  return o as T;
}
/** Deux poses clés qui ne diffèrent que par ce qu'on ajoute à une base commune. */
const deux = (base: DescriptionPose, depart: DescriptionPose, arrivee: DescriptionPose): DescriptionPose[] => [fusionner(base, depart), fusionner(base, arrivee)];

// Développé couché, incliné, décliné : bras verticaux (dans le repère du thorax), coudes ouverts.
const developpe = (haut: V3): DescriptionPose[] => [
  { bras: { cible: { repere: 'thorax', pos: haut, pole: [1, 0, -0.3] }, pronation: 90 } },
  { bras: { cible: { repere: 'thorax', pos: [27, 14, 14], pole: [1, 0.1, -0.7] }, pronation: 90 } },
];
const avec = (base: DescriptionPose, cles: DescriptionPose[]): DescriptionPose[] => cles.map((c) => fusionner(base, c));

export const SCENES: readonly Scene[] = [
  // --- Bancs et poids libres ---
  scene('libres', 'Développé couché haltères', 'Banc plat', 'bench_db', [62, 18],
    [{ type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 }, ...HALTERES],
    avec({ bassin: { pos: [0, 55, 14], bascule: -90 }, jambe: { cible: pied([24, 8, 62], [0.3, 0.8, 0.5]) } }, developpe([15, 17, 52]))),
  scene('libres', 'Développé incliné haltères', 'Banc incliné à 30°', 'bench_db_incl30', [60, 14],
    [{ type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 30 }, ...HALTERES],
    avec({ bassin: { pos: [0, 57, 2], bascule: -60 }, jambe: { cible: pied([24, 8, 50], [0.3, 0.6, 0.7]) } }, developpe([15, 47, 45]))),
  scene('libres', 'Développé décliné haltères', 'Banc décliné, rouleaux', 'bench_db_decl', [62, 14],
    [{ type: 'banc', pos: [0, 0, 0], tour: 0, dossier: -20 }, ...HALTERES],
    avec({ bassin: { pos: [0, 68, 2], bascule: -110 }, jambe: { cible: pied([10, 30.5, 50], [0, 1, 0.4]) } }, developpe([15, 3, 49]))),
  scene('libres', 'Curl à la barre', 'Barre olympique', 'bb_curl', [60, 10],
    [{ type: 'barre', repere: 'monde', centre: [0, 90, 14], trajet: [[0, 0, 0], [0, 26, 14], [0, 48, 4]] }],
    deux({ bassin: { pos: [0, 97.5, 0] }, ...piedsAuSol, bras: { cible: tient('barre', [18, 0, 0], [1, 0, 0], [0.2, -0.3, -1]), pronation: -90 } }, {}, {})),
  scene('libres', 'Curl pupitre', 'Pupitre, barre EZ', 'preacher_curl_bb', [55, 14],
    [{ type: 'pupitre', pos: [0, 0, 0], tour: 0 }, { type: 'barreEz', repere: 'monde', centre: [0, 84, 47], trajet: [[0, 0, 0], [0, 27, 5], [0, 44, -11]] }],
    deux({ bassin: { pos: [0, 74, -18] }, lombaires: { flex: 12 }, thorax: { flex: 22 }, cou: { flex: -10 }, jambe: { cible: pied([11, 8, 12], [0, 0.3, 1]) },
      bras: { cible: tient('barre', [15, 0, 0], [1, 0, 0], [0, -1, 0.4]), pronation: -90 } }, {}, {})),
  scene('libres', 'Soulevé de terre trap bar', 'Trap bar', 'deadlift_trap_bar', [40, 12],
    [{ type: 'trapBar', repere: 'monde', centre: [0, 24, 0], trajet: [[0, 0, 0], [0, 38, 0], [0, 63, 0]] }],
    deux({ jambe: { cible: piedAuSol(14, 8) }, bras: { cible: tient('barre', [27, 0, 0], [0, 0, 1], [0.3, 0, -1]) } },
      { bassin: { pos: [0, 50, -14], bascule: 58 }, cou: { flex: -20 } }, { bassin: { pos: [0, 97.5, 0] } })),
  scene('libres', 'Rowing T-bar', 'Landmine, poignée en V', 't_bar_row', [70, 14],
    [{ type: 'landmine', pos: [0, 0, -110], tour: 0, course: [32, 44] }],
    deux({ bassin: { pos: [0, 84, -26], bascule: 70 }, cou: { flex: -25 }, jambe: { cible: piedAuSol(20, 15) },
      bras: { cible: tient('poignee', [6, -9, -10], [0, 0, 1], [0.3, 0.5, -1]) } }, {}, {})),
  scene('libres', 'Roue abdominale', 'Roue', 'ab_wheel_rollout', [75, 12],
    [{ type: 'roueAbdo', pos: [0, 0, 0], tour: 0, course: [-2, 56] }],
    deux({ jambe: { cible: pied([12, 6, -92], [0, -1, 0.3]) }, bras: { cible: tient('poignee', [10, 0, 0], [1, 0, 0], [0.3, -0.2, -1]) } },
      { bassin: { pos: [0, 50, -48], bascule: 70 } }, { bassin: { pos: [0, 36, -40], bascule: 85 } })),

  // --- Postes ---
  scene('postes', 'Traction', 'Barre de traction', 'pullup', [35, 10],
    [{ type: 'barreTraction', pos: [0, 0, 0], tour: 0, hauteur: 215, largeur: 120 }],
    deux({ jambe: { hanche: { flex: 10, abd: 0, rot: 0 }, genou: 70 }, bras: { cible: tient('barre', [38, 0, 0], [1, 0, 0], [1, 0, -0.2]) } },
      { bassin: { pos: [0, 110, -6] } }, { bassin: { pos: [0, 150, -9] }, thorax: { flex: -10 } })),
  scene('postes', 'Dips', 'Barres parallèles', 'dips_chest', [60, 12],
    [{ type: 'barresParalleles', pos: [0, 0, 0], tour: 0, hauteur: 125, ecart: 56 }],
    deux({ jambe: { hanche: { flex: 0, abd: 0, rot: 0 }, genou: 80 }, bras: { cible: tient('barres', [28, 0, 2], [0, 0, 1], [0.2, 0, -1]) } },
      { bassin: { pos: [0, 131, -4], bascule: 6 } }, { bassin: { pos: [0, 100, -10], bascule: 18 } })),
  scene('postes', 'Hyperextension', 'Banc à lombaires à 45°', 'back_extension_45', [80, 10],
    [{ type: 'bancLombaires', pos: [0, 0, 0], tour: 0 }],
    deux({ bassin: { pos: [0, 81, 27] }, jambe: { cible: pied([10, 8, 0], [0, 0, 1], 'plateau') }, bras: { epaule: { flex: 20, abd: 30, rot: 0 }, coude: 120 } },
      { bassin: { bascule: 110 } }, { bassin: { bascule: 45 } })),
  scene('postes', 'Glute-ham raise', 'Banc à ischios', 'ghr', [80, 12],
    [{ type: 'ghr', pos: [0, 0, 0], tour: 0 }],
    deux({ jambe: { cible: pied([9, 8, 0], [0, 0, 1], 'plateau') }, bras: { epaule: { flex: 30, abd: 20, rot: 0 }, coude: 110 } },
      { bassin: { pos: [0, 143.5, -2.5] } }, { bassin: { pos: [0, 116, 32], bascule: 80 } })),
  scene('postes', 'Reverse hyper', 'Plateau, balancier, sangle', 'reverse_hyper', [80, 14],
    [{ type: 'reverseHyper', pos: [0, 0, 0], tour: 0, course: [0, 60] }],
    deux({ bassin: { pos: [0, 113, 2], bascule: 90 }, jambe: { cible: pied([10, 0, 6], [0, 0, 1], 'chevilles') }, bras: { cible: tient('monde', [24, 103, 67], [0, 0, 1], [1, 1, 0]) } }, {}, {})),

  // --- Poulies ---
  scene('poulies', 'Extension triceps à la corde', 'Poulie haute, corde', 'triceps_pushdown_rope', [70, 12],
    [{ type: 'poulie', pos: [0, 0, 48], tour: 180, hauteur: 200, prise: { type: 'corde' } }],
    deux({ bassin: { pos: [0, 97, -2], bascule: 6 }, thorax: { flex: 6 }, ...piedsAuSol },
      { bras: { epaule: { flex: 8, abd: 6, rot: 0 }, coude: 105 } }, { bras: { epaule: { flex: 14, abd: 6, rot: 0 }, coude: 8 } })),
  scene('poulies', 'Curl à la poulie basse', 'Poulie basse, barre droite', 'cable_curl', [65, 12],
    [{ type: 'poulie', pos: [0, 0, 52], tour: 180, hauteur: 15, prise: { type: 'barre', longueur: 50 } }],
    deux({ bassin: { pos: [0, 97.5, 0] }, ...piedsAuSol },
      { bras: { epaule: { flex: 4, abd: 8, rot: 0 }, coude: 8, pronation: -80 } }, { bras: { epaule: { flex: 14, abd: 8, rot: 0 }, coude: 130, pronation: -80 } })),
  scene('poulies', 'Élévation latérale à la poulie', 'Poulie basse, poignée', 'cable_lateral_raise', [15, 12],
    [{ type: 'poulie', pos: [-50, 0, 0], tour: 90, hauteur: 15, prise: { type: 'poignee', main: 'poignetG' } }],
    deux({ bassin: { pos: [0, 97.5, 0] }, ...piedsAuSol, brasD: { epaule: { flex: 0, abd: 12, rot: 0 }, coude: 10 } },
      { brasG: { epaule: { flex: 18, abd: -22, rot: 0 }, coude: 12 } }, { brasG: { clav: [1.5, 0], epaule: { flex: 18, abd: 82, rot: 0 }, coude: 14 } })),
  scene('poulies', 'Crossover', 'Vis-à-vis, deux poulies', 'cable_crossover_mid', [20, 14],
    [{ type: 'visAVis', pos: [0, 0, -10], tour: 0, ecart: 200, hauteur: 150 }],
    deux({ bassin: { pos: [0, 97, 4], bascule: 10 }, jambe: { cible: piedAuSol(14, 10, 4) } },
      { bras: { epaule: { flex: 25, abd: 70, rot: 0 }, coude: 20 } }, { bras: { epaule: { flex: 75, abd: 18, rot: 0 }, coude: 15 } })),
  scene('poulies', 'Tirage horizontal à la poulie', 'Poulie à hauteur du bas de la poitrine, banc, cale-pieds, barre large', 'cable_row', [75, 14],
    [{ type: 'tirageHorizontalPoulie', pos: [0, 0, 0], tour: 0, prise: { type: 'barre', longueur: 60 } }],
    deux({ jambe: { cible: pied([10, 8, 0], [0, 0, 1], 'plateau') } },
      { bassin: { pos: [0, 55, -20], bascule: 10 }, bras: { cible: tient('monde', [21, 79, 30], [1, 0, 0], [0.4, -1, 0]) } },
      { bassin: { pos: [0, 55, -20], bascule: -8 }, bras: { cible: tient('monde', [21, 81, -6], [1, 0, 0], [0.4, -0.4, -1]) } })),
  scene('poulies', 'Tirage vertical', 'Machine : siège, rouleaux, tour, barre coudée', 'lat_pulldown', [40, 12],
    [{ type: 'tirageVertical', pos: [0, 0, 0], tour: 0, course: [166, 124] }],
    deux({ jambe: { cible: pied([14, 8, 44], [0, 0.4, 1]) }, bras: { cible: tient('barre', [40, 0, 0], [1, 0, 0], [1, -0.2, -0.2]) } },
      { bassin: { pos: [0, 62, -4], bascule: -6 } }, { bassin: { pos: [0, 62, -4], bascule: -14 } })),

  // --- Machines, haut du corps ---
  scene('haut', 'Pec deck', 'Bras pivotants, poignées, bras presque tendus', 'pec_deck', [35, 14],
    [{ type: 'pecDeck', pos: [0, 0, 0], tour: 0, course: [85, 2] }],
    deux({ bassin: { pos: [0, 65.5, -1], bascule: -4 }, jambe: { cible: pied([11, 8, 42], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [0, 1, 0], [0.2, -1, -0.4]) } }, {}, {})),
  scene('haut', 'Développé machine', 'Leviers, poignées horizontales', 'chest_press_machine', [40, 14],
    [{ type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'couche', course: [0, 42] }],
    deux({ bassin: { pos: [0, 62, -4], bascule: -4 }, jambe: { cible: pied([11, 8, 40], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [1, 0, 0], [1, -0.6, -0.4]) } }, {}, {})),
  scene('haut', 'Développé incliné machine', 'Leviers, dossier incliné', 'chest_press_incl_machine', [45, 14],
    [{ type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'incline', course: [0, 36] }],
    deux({ bassin: { pos: [0, 62, -6], bascule: -14 }, jambe: { cible: pied([11, 8, 40], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [1, 0, 0], [1, -0.6, -0.4]) } }, {}, {})),
  scene('haut', 'Développé épaules machine', 'Leviers derrière le dos', 'machine_shoulder_press', [45, 14],
    [{ type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'epaules', course: [0, 40] }],
    deux({ bassin: { pos: [0, 62, -6], bascule: -4 }, jambe: { cible: pied([11, 8, 40], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [1, 0, 0], [1, -0.5, 0]) } }, {}, {})),
  scene('haut', 'Tirage horizontal machine', 'Appui contre la poitrine, leviers', 'seated_row_machine', [60, 14],
    [{ type: 'tirageHorizontalMachine', pos: [0, 0, 0], tour: 0, course: [0, 30] }],
    deux({ bassin: { pos: [0, 60, -2] }, thorax: { flex: 8 }, jambe: { cible: pied([11, 8, 30], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [0, 1, 0], [0.4, -1, -0.4]) } }, {}, {})),
  scene('haut', 'Élévations latérales machine', 'Leviers dans l’axe des épaules, coussins contre les bras', 'machine_lateral_raise', [30, 14],
    [{ type: 'elevationsMachine', pos: [0, 0, 0], tour: 0, course: [8, 82] }],
    deux({ bassin: { pos: [0, 64, -6] }, jambe: { cible: pied([11, 8, 34], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [0, 1, 0], [0, -1, 0]) } }, {}, {})),
  scene('haut', 'Curl machine', 'Pupitre large, coudes dans l’axe du levier', 'bicep_curl_machine', [60, 14],
    [{ type: 'curlMachine', pos: [0, 0, 0], tour: 0, variante: 'curl', course: [-20, 100] }],
    deux({ bassin: { pos: [0, 70, -22] }, thorax: { flex: 16 }, jambe: { cible: pied([11, 8, 14], [0, 0.3, 1]) }, bras: { cible: tient('barre', [14, 0, 0], [1, 0, 0], [0, 0, -1]), pronation: -90 } }, {}, {})),
  scene('haut', 'Extension triceps machine', 'Pupitre, deux poignées verticales (prise neutre)', 'tricep_extension_machine', [60, 14],
    [{ type: 'curlMachine', pos: [0, 0, 0], tour: 0, variante: 'triceps', course: [100, -15] }],
    deux({ bassin: { pos: [0, 70, -22] }, thorax: { flex: 16 }, jambe: { cible: pied([11, 8, 14], [0, 0.3, 1]) }, bras: { cible: tient('barre', [12, 0, 0], [0, 1, 0], [0, 0, -1]) } }, {}, {})),
  scene('haut', 'Pullover machine', 'Levier dans l’axe des épaules, bras presque tendus', 'pullover_machine', [60, 14],
    [{ type: 'pulloverMachine', pos: [0, 0, 0], tour: 0, course: [130, -30] }],
    deux({ bassin: { pos: [0, 64, -6] }, jambe: { cible: pied([11, 8, 36], [0, 0.3, 1]) }, bras: { cible: tient('barre', [16, 0, 0], [1, 0, 0], [1, 0, 0]) } }, {}, {})),
  scene('haut', 'Crunch machine', 'Levier à la taille, rouleaux contre la poitrine, poignées', 'crunch_machine', [60, 14],
    [{ type: 'crunchMachine', pos: [0, 0, 0], tour: 0, course: [0, 30] }],
    deux({ bassin: { pos: [0, 62, -8] }, jambe: { cible: pied([11, 8, 34], [0, 0.3, 1]) }, bras: { cible: tient('poigneeG', [0, 0, 0], [0, 1, 0], [1, -0.5, -0.3]) } },
      {}, { lombaires: { flex: 18 }, thorax: { flex: 12 } })),
  scene('haut', 'Traction assistée', 'Plateau des genoux sur un chariot, poignées', 'pullup_assisted', [40, 10],
    [{ type: 'assistee', pos: [0, 0, 0], tour: 0, course: [-12, 28] }],
    deux({ jambe: { hanche: { flex: 0, abd: 0, rot: 0 }, genou: 92 }, bras: { cible: tient('barre', [30, 0, 0], [1, 0, 0], [1, 0, -0.2]) } },
      { bassin: { pos: [0, 115.5, -2] } }, { bassin: { pos: [0, 154, -2] } })),

  // --- Machines, bas du corps ---
  scene('bas', 'Presse à cuisses', 'Assise, plaque verticale sur rails, jambes dans leur plan', 'leg_press_45', [70, 14],
    [{ type: 'presseCuisses', pos: [0, 0, 0], tour: 0, course: [0, 34] }],
    deux({ bassin: { pos: [0, 60, -8], bascule: -20 }, jambe: { cible: pied([10, 8, -4], [0, 0, 1], 'plateau') }, bras: { cible: tient('monde', [25, 54, 0], [0, 0, 1], [1, 0, 0]) } }, {}, {})),
  scene('bas', 'Hack squat', 'Traîneau, épaulières, poignées', 'hack_squat_machine', [70, 12],
    [{ type: 'hackSquat', pos: [0, 0, 0], tour: 0, course: [0, 48] }],
    deux({ jambe: { cible: pied([11, 8, 0], [0, 0.3, 1], 'plateau') }, bras: { cible: tient('traineau', [32, 6, 18], [0, 1, 0], [1, -1, 0]) } },
      { bassin: { pos: [0, 103, -7], bascule: -25 } }, { bassin: { pos: [0, 60, 13], bascule: -25 } })),
  scene('bas', 'Squat à la Smith', 'Smith machine', 'smith_squat', [48, 10],
    [{ type: 'smith', pos: [0, 0, -10], tour: 0, course: [148, 104] }],
    deux({ jambe: { cible: piedAuSol(16, 22) }, bras: { cible: tient('barre', [40, 0, 0], [1, 0, 0], [0.35, -1, -0.55]) } },
      { bassin: { pos: [0, 96.5, 0], bascule: 3 } }, { bassin: { pos: [0, 56, -16], bascule: 24 } })),
  scene('bas', 'Leg extension', 'Levier dans l’axe des genoux, rouleau devant les tibias', 'leg_extension', [70, 14],
    [{ type: 'legExtension', pos: [0, 0, 0], tour: 0, course: [90, 4] }],
    deux({ bassin: { pos: [0, 67, -22.5] }, jambe: { cible: pied([10, 0, -9], [0, 0, 1], 'rouleau') }, bras: { cible: tient('monde', [25, 62, -12], [0, 0, 1], [1, 0, 0]) } }, {}, {})),
  scene('bas', 'Leg curl assis', 'Rouleau sur les cuisses, rouleau derrière les chevilles', 'leg_curl_seated', [70, 14],
    [{ type: 'legCurlAssis', pos: [0, 0, 0], tour: 0, course: [4, 95] }],
    deux({ bassin: { pos: [0, 67, -22.5] }, jambe: { cible: pied([10, 0, 9], [0, 0, 1], 'rouleau') }, bras: { cible: tient('monde', [25, 62, -12], [0, 0, 1], [1, 0, 0]) } }, {}, {})),
  scene('bas', 'Leg curl couché', 'Banc coudé, levier dans l’axe des genoux', 'leg_curl_lying', [75, 16],
    [{ type: 'legCurlCouche', pos: [0, 0, 0], tour: 0, course: [4, 100] }],
    deux({ bassin: { pos: [0, 70, 2], bascule: 90 }, jambe: { cible: pied([10, 0, 9], [0, 0, 1], 'rouleau') }, bras: { cible: tient('monde', [24, 48, 100], [0, 1, 0], [1, 0, -0.5]) } }, {}, {})),
  scene('bas', 'Mollets debout', 'Épaulières, poignées, marche', 'calf_standing_machine', [70, 10],
    [{ type: 'molletsDebout', pos: [0, 0, 0], tour: 0, course: [0, 9] }],
    [
      { bassin: { pos: [0, 109.5, -6] }, jambe: { cible: pied([12, 8, 6], [0, 0, 1], 'marche') }, bras: { cible: tient('epaulieres', [20, 6, 18], [0, 1, 0], [1, -1, 0]) } },
      { bassin: { pos: [0, 118.5, -6] }, jambe: { cible: pied([12, 17, 6], [0, 0, 1], 'marche', 28) }, bras: { cible: tient('epaulieres', [20, 6, 18], [0, 1, 0], [1, -1, 0]) } },
    ]),
  scene('bas', 'Mollets assis', 'Coussin sur les genoux, levier chargé', 'calf_seated_machine', [70, 14],
    [{ type: 'molletsAssis', pos: [0, 0, 0], tour: 0, course: [0, 8] }],
    [
      { bassin: { pos: [0, 62, -12] }, jambe: { cible: pied([12, 8, 0], [0, 0.3, 1], 'marche') }, bras: { cible: tient('genoux', [16, 6, 0], [1, 0, 0], [1, 0, -1]) } },
      { bassin: { pos: [0, 62, -12] }, jambe: { cible: pied([12, 16, 0], [0, 0.3, 1], 'marche', 28) }, bras: { cible: tient('genoux', [16, 6, 0], [1, 0, 0], [1, 0, -1]) } },
    ]),
  scene('bas', 'Kickback fessiers', 'Appui de la poitrine, plateau sur levier', 'glute_kickback_machine', [80, 12],
    [{ type: 'kickbackMachine', pos: [0, 0, 0], tour: 0, course: [0, 70] }],
    deux({ bassin: { pos: [0, 96, -4], bascule: 35 }, jambeD: { cible: pied([-12, 14, 4], [0, 0, 1]) }, jambeG: { cible: pied([0, 8, 0], [0, 0, 1], 'plateau') },
      bras: { cible: tient('monde', [24, 106, 58], [0, 1, 0], [1, -1, 0]) } }, {}, {})),
  scene('bas', 'Abducteurs', 'Coussins contre l’extérieur des genoux', 'hip_abductor_machine', [10, 30],
    [{ type: 'abdAdducteurs', pos: [0, 0, 0], tour: 0, variante: 'abduction', course: [0, 32] }],
    deux({ bassin: { pos: [0, 64, -10], bascule: -10 }, jambe: { cible: pied([0, 8, 0], [0, 1, 0.3], 'piedG') }, bras: { cible: tient('monde', [27, 56, -6], [0, 0, 1], [1, 0, 0]) } }, {}, {})),
  scene('bas', 'Adducteurs', 'Coussins contre l’intérieur des genoux', 'hip_adductor_machine', [10, 30],
    [{ type: 'abdAdducteurs', pos: [0, 0, 0], tour: 0, variante: 'adduction', course: [38, 2] }],
    deux({ bassin: { pos: [0, 64, -10], bascule: -10 }, jambe: { cible: pied([0, 8, 0], [0, 1, 0.3], 'piedG') }, bras: { cible: tient('monde', [27, 56, -6], [0, 0, 1], [1, 0, 0]) } }, {}, {})),
  scene('bas', 'Hip thrust machine', 'Omoplates sur le dossier, rouleau sur les hanches', 'hip_thrust_machine', [75, 12],
    [{ type: 'hipThrustMachine', pos: [0, 0, 0], tour: 0, course: [-60, -77.5, -95] }],
    [[33.5, 4.44, -60], [47.4, 9.84, -77.5], [62.27, 10.81, -95]].map(([y, z, b]) => ({
      bassin: { pos: [0, y!, z!] as V3, bascule: b! },
      jambe: { cible: pied([11, 12, 42], [0, 1, 0.4]) },
      bras: { cible: tient('coussin', [22, 0, 0], [1, 0, 0], [1, 0, 0]) },
    }))),
];
