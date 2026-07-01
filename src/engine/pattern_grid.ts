/**
 * Taxonomie patterns × muscles pour la grille de programme (Conv #22).
 *
 * À l'étape D, l'algo construit une grille (pattern × séance) où chaque case
 * = un mouvement à réaliser, ciblant un muscle prio en primaire. À l'étape E,
 * l'user choisit la variante d'exo. À l'étape F, sets_allocator alloue les
 * séries.
 *
 * Ce module fournit :
 *   - Pour chaque muscle, les patterns naturels pour l'attaquer (compound
 *     + iso complémentaire).
 *   - Pour chaque case, la liste des exos catalogue candidats à proposer à
 *     l'user (3-5 variantes canoniques + bouton "voir plus").
 *   - Le mapping pattern → muscles attendus (pour le scoring split).
 *
 * Référence : recherche/09_programmation.md §6 (composition de séance).
 */

import type { Catalog } from './catalog';
import type { Exercise, PatternCell, RoleHint } from './models';
import {
  ChargeType,
  EquipmentPreference,
  ExType,
  Pattern,
  chargesForPreference,
  exercisePrimaires,
} from './models';

// =============================================================================
// Mapping muscle → patterns naturels (ordre = préférence compound puis iso)
// =============================================================================

/**
 * Pour chaque muscle, le pattern "compound principal" (1er choix) + le
 * pattern d'isolation complémentaire (2e choix, pour diversifier angles).
 * Cf. 09 §6.1 (nb exos par muscle) + §6.3 (diversification d'angles).
 */
export interface MusclePatternMap {
  /** Pattern compound principal (porte la majorité du volume). */
  compoundPatterns: Pattern[];
  /** Patterns d'isolation pour compléter le volume / diversifier les angles. */
  isolationPatterns: Pattern[];
}

/**
 * Mapping muscle → patterns validés contre le catalogue réel
 * (`exercises.json`). Conv #22 fix : on évite les patterns théoriquement
 * cohérents mais qui n'ont AUCUN exo primaire au catalogue
 * (biceps → PULL_V, deltos_posterieurs → PULL_H, etc. n'existaient pas
 * et créaient des cases "non remplissables").
 *
 * Petits muscles dont aucun compound dédié n'existe → tout en ISOLATION.
 * Le volume incident des compounds d'autres muscles complète naturellement
 * (cf. §3.4 doc : volume incident OK pour ces muscles).
 */
const MUSCLE_PATTERNS: Record<string, MusclePatternMap> = {
  pectoraux: {
    compoundPatterns: [Pattern.PUSH_H],
    isolationPatterns: [Pattern.ISOLATION],
  },
  dos_largeur: {
    compoundPatterns: [Pattern.PULL_V],
    isolationPatterns: [Pattern.ISOLATION],
  },
  dos_epaisseur: {
    compoundPatterns: [Pattern.PULL_H],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Catalogue : trapezes_hauts primaire sur isolation (shrugs) + push_v
  // (upright row). Pas de PULL_H/PULL_V primaire.
  trapezes_hauts: {
    compoundPatterns: [Pattern.PUSH_V, Pattern.ISOLATION],
    isolationPatterns: [Pattern.ISOLATION],
  },
  quadriceps: {
    compoundPatterns: [Pattern.SQUAT, Pattern.LUNGE],
    isolationPatterns: [Pattern.ISOLATION],
  },
  ischios: {
    compoundPatterns: [Pattern.HINGE],
    isolationPatterns: [Pattern.ISOLATION],
  },
  fessiers: {
    compoundPatterns: [Pattern.HINGE, Pattern.LUNGE, Pattern.SQUAT],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Mollets : aucun compound dédié, tout en ISOLATION.
  mollets: {
    compoundPatterns: [Pattern.ISOLATION],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Deltos latéraux : push_v primaire (OHP), iso (élévations latérales).
  deltos_lateraux: {
    compoundPatterns: [Pattern.PUSH_V],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Deltos postérieurs : aucun PULL_H avec deltos_post primaire au
  // catalogue (les face_pull/rear_delt_fly sont pattern=isolation).
  // Tout en ISOLATION pour éviter les cases non remplissables.
  deltos_posterieurs: {
    compoundPatterns: [Pattern.ISOLATION],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Biceps : aucun PULL_V/PULL_H primaire au catalogue (les tractions
  // sont primaires dos_largeur, biceps secondaire). Tout en ISOLATION.
  biceps: {
    compoundPatterns: [Pattern.ISOLATION],
    isolationPatterns: [Pattern.ISOLATION],
  },
  // Triceps : push_h primaire (close grip bench), iso (extensions).
  triceps: {
    compoundPatterns: [Pattern.PUSH_H, Pattern.ISOLATION],
    isolationPatterns: [Pattern.ISOLATION],
  },
  abdos: {
    compoundPatterns: [Pattern.CORE],
    isolationPatterns: [Pattern.CORE],
  },
  obliques: {
    compoundPatterns: [Pattern.CORE],
    isolationPatterns: [Pattern.CORE],
  },
  lombaires: {
    compoundPatterns: [Pattern.HINGE, Pattern.CORE],
    isolationPatterns: [Pattern.CORE],
  },
};

/** Retourne le mapping pattern pour ce muscle (ou un défaut isolation seul). */
export function getMusclePatterns(muscle: string): MusclePatternMap {
  return (
    MUSCLE_PATTERNS[muscle] ?? {
      compoundPatterns: [Pattern.ISOLATION],
      isolationPatterns: [Pattern.ISOLATION],
    }
  );
}

// =============================================================================
// Refonte remplissage (recherche/09b) — crédit de volume incident + dose→exos
// =============================================================================

/** Un pattern est un « vrai » compound (crédite des synergistes) hors iso/core. */
export function isCompoundPattern(p: Pattern): boolean {
  return p !== Pattern.ISOLATION && p !== Pattern.CORE;
}

/**
 * Muscles synergistes crédités (à 0,5/série) par un compound de ce pattern.
 * Approximation biomécanique au niveau PATTERN (indépendante de l'exo choisi),
 * qui reflète les coef `ex.muscles` typiques du catalogue. Sert au **crédit
 * incident** pendant la réalisation : un pressing nourrit déjà les triceps, un
 * tirage les biceps, etc. → on n'ajoute pas d'iso dédiée à un muscle déjà servi.
 * Le muscle primaire de la case est exclu au moment du crédit (cf. réalisation).
 * (deltoïdes antérieurs non trackés → absents ; cf. 09b §11.)
 */
// ⚠️ CONSERVATEUR : ne créditer QUE les synergistes que les exos du catalogue
// délivrent FIABLEMENT pour ce pattern. Sur-créditer = skipper à tort un exo
// dédié → le muscle finit à 0 (cas rear delts : les rowings ne les touchent pas,
// c'est le face pull). Sous-créditer est sûr (au pire léger surplus = bonus net).
//   - Pressing (H/V) → triceps (tout pressing les sollicite).
//   - Tirage (V/H)   → biceps (toute traction les sollicite).
//   - Squat/hinge/fente → fessiers (chaîne postérieure).
// PAS crédités : deltos postérieurs (→ face pull dédié), deltos latéraux
// (= primaire de l'OHP, pas un synergiste à re-créditer).
export const PATTERN_SYNERGISTS: Readonly<Record<Pattern, Readonly<Record<string, number>>>> = {
  [Pattern.PUSH_H]: { triceps: 0.5 },
  [Pattern.PUSH_V]: { triceps: 0.5 },
  [Pattern.PULL_V]: { biceps: 0.5 },
  [Pattern.PULL_H]: { biceps: 0.5 },
  [Pattern.SQUAT]: { fessiers: 0.5 },
  [Pattern.HINGE]: { fessiers: 0.5, lombaires: 0.5 },
  [Pattern.LUNGE]: { fessiers: 0.5 },
  [Pattern.ISOLATION]: {},
  [Pattern.CORE]: {},
};

/** Plancher / plafond de séries par exo (rappel, alignés sur volume.ts). */
export const REALIZE_MIN_SETS = 3;
export const REALIZE_MAX_SETS = 5;
/** Cible séries/exo → nb d'exos pour une dose (recherche/09b §7). */
export const SETS_PER_EXO = 4;

/**
 * Nombre d'exos pour une dose de séries dans UNE séance (remplace
 * `exosCountForCycleTargetVolume`, qui raisonnait sur le volume HEBDO).
 *   dose ≤ 5 → 1 · 6-10 → 2 · > 10 → 3.
 * Garde-fou : jamais moins que `ceil(dose / plafond)` — sinon un seul exo
 * plafonné à 5 séries « perdrait » le surplus (ex. dose 5,8 → 2 exos, pas 1).
 */
export function exosForSessionDose(dose: number): number {
  const byTarget = Math.round(dose / SETS_PER_EXO);
  const byCap = Math.ceil(dose / REALIZE_MAX_SETS);
  return Math.max(1, Math.min(3, Math.max(byTarget, byCap)));
}

/**
 * Répartit une dose de séries sur `n` exos, chacun borné à [3, 5] séries.
 * Entiers, somme ≈ dose (arrondi par exo). Ex. 6/2 → [3,3] · 8/2 → [4,4] ·
 * 12/3 → [4,4,4] · 5/1 → [5].
 */
export function distributeSetsForDose(dose: number, n: number): number[] {
  const per = dose / n;
  const sets: number[] = [];
  for (let i = 0; i < n; i += 1) {
    sets.push(Math.max(REALIZE_MIN_SETS, Math.min(REALIZE_MAX_SETS, Math.round(per))));
  }
  return sets;
}

// =============================================================================
// Sélection des patterns pour un muscle prio selon V_cible
// =============================================================================

/**
 * Nombre d'exos à programmer par muscle selon V_cible hebdo (cf. 09 §6.1).
 *   V ≤ 6  → 1 exo
 *   V 7-12 → 2 exos
 *   V 13-18 → 3 exos
 *   V > 18 → 4 exos
 */
export function exosCountForCycleTargetVolume(vTarget: number): number {
  if (vTarget <= 6) return 1;
  if (vTarget <= 12) return 2;
  if (vTarget <= 18) return 3;
  return 4;
}

/**
 * Liste les patterns à programmer pour un muscle prio donné, avec leur role
 * hint. Sortie : (Pattern, RoleHint)[] — l'ordre reflète la priorité de
 * placement (compound d'abord, puis iso).
 *
 * Cas particulier : si le muscle n'a qu'un seul pattern naturel (ex. ischios
 * → HINGE), on programme N occurrences du même pattern avec hints distincts
 * (compound + iso) ; le sélecteur d'exos étape E proposera des variantes
 * différentes (RDL barbell vs nordic curl par exemple).
 */
export function patternsForMusclePrio(
  muscle: string,
  vTarget: number,
): Array<{ pattern: Pattern; role_hint: RoleHint }> {
  const map = getMusclePatterns(muscle);
  const nExos = exosCountForCycleTargetVolume(vTarget);
  const result: Array<{ pattern: Pattern; role_hint: RoleHint }> = [];

  // 1er exo = compound principal du muscle.
  result.push({
    pattern: map.compoundPatterns[0] ?? Pattern.ISOLATION,
    role_hint: 'compound',
  });

  // 2e exo = pattern compound alternatif si dispo, sinon isolation.
  if (nExos >= 2) {
    if (map.compoundPatterns.length >= 2) {
      result.push({
        pattern: map.compoundPatterns[1]!,
        role_hint: 'compound',
      });
    } else {
      result.push({
        pattern: map.isolationPatterns[0] ?? Pattern.ISOLATION,
        role_hint: 'isolation',
      });
    }
  }

  // 3e+ exos = isolation pour diversifier.
  for (let i = 2; i < nExos; i += 1) {
    result.push({
      pattern: map.isolationPatterns[0] ?? Pattern.ISOLATION,
      role_hint: 'isolation',
    });
  }

  return result;
}

// =============================================================================
// Listing exos candidats pour une case (étape E)
// =============================================================================

/**
 * Pour une case (pattern × muscle × role_hint), retourne la liste ordonnée
 * d'exos catalogue candidats à proposer à l'user à l'étape E.
 *
 * Critères de tri (du plus suggéré au moins) :
 *   1. Favori user pour ce pattern (s'il existe).
 *   2. Exo dont `pattern` matche ET muscle en primaire (coef ≥ 1.0).
 *   3. Type d'exo cohérent avec role_hint (compound pour 'compound', etc.).
 *   4. Nb de muscles touchés (les plus polyarticulaires d'abord pour
 *      compounds, les moins pour isolation).
 *   5. Difficulté ascendante.
 *
 * Hors filtre équipement (retiré Conv #22 — l'user voit toutes les variantes).
 */
export interface CandidatesForCellOptions {
  /** Exo préféré de l'user pour ce pattern (issu de UserState). */
  favoriteId?: string;
  /** Exos déjà choisis ailleurs dans le cycle (pour éviter doublons stricts). */
  excludeIds?: ReadonlySet<string>;
  /** Tags d'angle à éviter (diversification, cf. case sœur d'un même muscle). */
  avoidAngles?: ReadonlySet<string>;
  /**
   * Conv #22 — Préférence d'équipement utilisateur. Sert au tri auto :
   *  - MACHINES → trie en privilégiant machines guidées et câbles.
   *  - FREE_WEIGHTS → trie en privilégiant haltères / barre / poids du corps.
   *  - NO_PREFERENCE ou undefined → convention salle classique :
   *    poids libres sur compounds, machines/câbles sur isolations.
   */
  equipmentPreference?: EquipmentPreference;
}

export function candidatesForCell(
  cell: PatternCell,
  catalog: Catalog,
  options: CandidatesForCellOptions = {},
): Exercise[] {
  const favoriteId = options.favoriteId;
  const excludeIds = options.excludeIds ?? new Set<string>();
  const avoidAngles = options.avoidAngles ?? new Set<string>();

  const all = catalog.all();
  const matchPatternMuscle = (ex: Exercise) =>
    ex.pattern === cell.pattern &&
    exercisePrimaires(ex).includes(cell.primary_muscle);

  let filtered = all.filter(
    (ex) => !excludeIds.has(ex.id) && matchPatternMuscle(ex),
  );
  // Fallback : si l'exclusion (cycle déjà rempli) vide la liste, on retry
  // sans excludeIds — vaut mieux un doublon qu'une case impossible à
  // remplir (cf. retour Conv #22 d'Azur : "case non remplissable").
  if (filtered.length === 0) {
    filtered = all.filter(matchPatternMuscle);
  }

  // Conv #29 — Préférence d'équipement STRICTE (« uniquement ») : filtre dur
  // par type de charge. Pour MACHINES / FREE_WEIGHTS (user en salle), on
  // retombe sur l'ensemble non filtré si la case devient vide — mieux qu'une
  // case impossible. Pour BODYWEIGHT (PdC strict, aucun matériel), pas de
  // fallback : on laisse la case vide plutôt que d'imposer du matériel.
  const allowedCharges = chargesForPreference(options.equipmentPreference);
  if (allowedCharges) {
    const strict = filtered.filter((ex) => allowedCharges.has(ex.charge));
    if (
      strict.length > 0 ||
      options.equipmentPreference === EquipmentPreference.BODYWEIGHT
    ) {
      filtered = strict;
    }
  }

  // Refonte 09b — ordre validé Azur : cohérence de rôle en n°1 (« un compound
  // dans un slot compound, forcément »), le favori descend en n°4 (nudge, plus
  // un dictateur : il ne passe jamais par-dessus rôle/équipement/angle).
  filtered.sort((a, b) => {
    // 1. Cohérence du rôle (compound ↔ slot compound). Priorité absolue.
    const aRole = matchesRoleHint(a, cell.role_hint) ? 0 : 1;
    const bRole = matchesRoleHint(b, cell.role_hint) ? 0 : 1;
    if (aRole !== bRole) return aRole - bRole;
    // 2. Préférence d'équipement (plus bas = colle mieux à la préférence).
    const pA = preferenceScore(a, cell, options.equipmentPreference);
    const pB = preferenceScore(b, cell, options.equipmentPreference);
    if (pA !== pB) return pA - pB;
    // 3. Éviter conflit d'angles (diversification vs case sœur).
    const aClash = a.tags.some((t) => avoidAngles.has(t)) ? 1 : 0;
    const bClash = b.tags.some((t) => avoidAngles.has(t)) ? 1 : 0;
    if (aClash !== bClash) return aClash - bClash;
    // 4. Favori — départage seulement des exos déjà tous pertinents.
    if (favoriteId) {
      if (a.id === favoriteId && b.id !== favoriteId) return -1;
      if (b.id === favoriteId && a.id !== favoriteId) return 1;
    }
    // 5. Polyarticularité (selon role_hint).
    const aN = Object.keys(a.muscles).length;
    const bN = Object.keys(b.muscles).length;
    if (cell.role_hint === 'compound') {
      if (aN !== bN) return bN - aN; // plus de muscles = mieux pour compound
    } else {
      if (aN !== bN) return aN - bN; // moins = mieux pour iso
    }
    // 6. Difficulté ascendante (défaut = accessible d'abord).
    return a.dif < b.dif ? -1 : a.dif > b.dif ? 1 : 0;
  });

  return filtered;
}

/**
 * Conv #22 — Score de "guidage" d'un exo : plus la valeur est basse, plus
 * l'exo est guidé/accessible (idéal pour débutants).
 *  0 = machine guidée (trajectoire fixe, pas de stabilisation requise)
 *  1 = câbles / bw assisté
 *  2 = haltères
 *  3 = barre (technique + stabilisation)
 *  4 = poids du corps libre (tractions, dips… exigent un ratio force/poids)
 */
function guidanceLevel(ex: Exercise): number {
  switch (ex.charge) {
    case ChargeType.MACHINE_STACK:
      return 0;
    case ChargeType.CABLE:
    case ChargeType.BODYWEIGHT_ASSISTED:
      return 1;
    case ChargeType.DUMBBELL:
      return 2;
    case ChargeType.BARBELL:
      return 3;
    case ChargeType.BODYWEIGHT:
    case ChargeType.BODYWEIGHT_LOADED:
      return 4;
    default:
      return 2;
  }
}

/**
 * Conv #22 — Score d'adéquation d'un exo à la préférence utilisateur. Plus
 * la valeur est basse, plus l'exo colle à la préférence (donc passe en tête
 * dans le tri).
 *
 *   - MACHINES → guidance 0-1 = score 0, sinon 1.
 *   - FREE_WEIGHTS → guidance 2-4 = score 0, sinon 1.
 *   - NO_PREFERENCE (ou undefined) → convention salle classique :
 *     - compound → poids libre (haltères / barre / BW) en tête (score 0).
 *     - isolation → machines / câbles en tête (score 0).
 *     Donne au final un programme "naturel" : squat barbell, bench DB,
 *     pec deck, leg curl. Pas le plus guidé partout, pas le plus libre partout.
 */
function preferenceScore(
  ex: Exercise,
  cell: PatternCell,
  preference: EquipmentPreference | undefined,
): number {
  const g = guidanceLevel(ex);
  if (preference === EquipmentPreference.MACHINES) {
    return g <= 1 ? 0 : 1 + (g - 1);
  }
  if (preference === EquipmentPreference.FREE_WEIGHTS) {
    return g >= 2 ? 0 : 1 + (2 - g);
  }
  // NO_PREFERENCE / undefined : convention salle.
  if (cell.role_hint === 'compound') {
    // Compound → poids libre privilégié : guidance ≥ 2 = score 0.
    return g >= 2 ? 0 : 1 + (2 - g);
  }
  // Isolation → machines/câbles privilégiés : guidance ≤ 1 = score 0.
  return g <= 1 ? 0 : 1 + (g - 1);
}

function matchesRoleHint(ex: Exercise, hint: RoleHint): boolean {
  if (hint === 'compound') return ex.type === ExType.COMPOUND;
  return ex.type === ExType.ISOLATION;
}

/**
 * Variantes "canoniques" à proposer en 1er à l'user pour cette case
 * (top N = 3 par défaut). Le reste est accessible via "Voir plus".
 */
export function canonicalVariantsForCell(
  cell: PatternCell,
  catalog: Catalog,
  options: CandidatesForCellOptions = {},
  n = 3,
): Exercise[] {
  return candidatesForCell(cell, catalog, options).slice(0, n);
}
