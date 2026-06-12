/**
 * Sélection et substitution d'exercices.
 *
 * Référence :
 *   - 05_exercices_selection.md (compound/iso, ordre, lengthened bias, caps)
 *   - 09_programmation.md §6 (composition d'une séance)
 */

import type { Exercise, Profile, UserState, PlannedExercise } from './models';
import { ExType, Level, ChargeType, exercisePrimaires } from './models';
import type { Catalog } from './catalog';

// =============================================================================
// 1. Choix d'un exo pour un muscle donné — voie legacy
// =============================================================================

export interface CandidatesOptions {
  preferCompound?: boolean;
  excludeIds?: ReadonlySet<string>;
}

/** Liste d'exos primaires sur ce muscle, compatibles avec l'équipement. */
export function candidatesForMuscle(
  catalog: Catalog,
  muscle: string,
  profile: Profile,
  options: CandidatesOptions = {},
): Exercise[] {
  const preferCompound = options.preferCompound ?? true;
  const excludeIds = options.excludeIds ?? new Set<string>();
  const eq = profile.available_equip;
  // Conv #15 — fix : un set vide ne court-circuite plus le filtre. On passe
  // toujours `equip_available` (même vide) : seuls les exos bodyweight purs
  // (`equip.length === 0`) sont retenus si l'utilisateur ne coche rien.
  let candidates = catalog.filter({
    muscle_primary: muscle,
    equip_available: eq,
  });
  candidates = candidates.filter((x) => !excludeIds.has(x.id));
  candidates.sort((a, b) => {
    const aIso = a.type === ExType.ISOLATION;
    const bIso = b.type === ExType.ISOLATION;
    const aKey0 = preferCompound && aIso ? 1 : 0;
    const bKey0 = preferCompound && bIso ? 1 : 0;
    if (aKey0 !== bKey0) return aKey0 - bKey0;
    // -len(muscles) : plus de muscles touchés = plus tôt
    return Object.keys(b.muscles).length - Object.keys(a.muscles).length;
  });
  return candidates;
}

/** Sélectionne un exo pour ce muscle. Évite l'exo précédent (rotation simple). */
export function pickForMuscle(
  catalog: Catalog,
  muscle: string,
  state: UserState,
  options: CandidatesOptions = {},
): Exercise | null {
  const last = state.last_used_for_muscle[muscle];
  const cands = candidatesForMuscle(catalog, muscle, state.profile, options);
  if (cands.length === 0) {
    return null;
  }
  if (last && cands.length > 1) {
    const nonLast = cands.filter((x) => x.id !== last);
    if (nonLast.length > 0) {
      return nonLast[0]!;
    }
  }
  return cands[0]!;
}

// =============================================================================
// 2. Substitution dynamique
// =============================================================================

export interface SubstituteOptions {
  avoidIds?: ReadonlySet<string>;
}

/** Propose un exo du même groupe `subst`, compatible avec l'équipement. */
export function substitute(
  catalog: Catalog,
  current: Exercise,
  profile: Profile,
  options: SubstituteOptions = {},
): Exercise | null {
  const avoid = new Set<string>(options.avoidIds ?? []);
  avoid.add(current.id);
  const eq = profile.available_equip;
  const group = catalog.in_substitution_group(current.subst);
  const candidates: Exercise[] = [];
  for (const x of group) {
    if (avoid.has(x.id)) continue;
    // Conv #15 — fix : filtre strict même si set vide (bodyweight uniquement).
    if (x.equip.length > 0) {
      let ok = true;
      for (const e of x.equip) {
        if (!eq.has(e)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    candidates.push(x);
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    // (x.type == current.type, -len(x.muscles))
    // En Python, True > False ; en TS, on convertit en 1/0.
    // Tri ascendant : plus petit = plus tôt. Python sort ascending par défaut.
    // (False = 0) vient avant (True = 1) : étrange. On reproduit fidèlement.
    const aSame = a.type === current.type ? 1 : 0;
    const bSame = b.type === current.type ? 1 : 0;
    if (aSame !== bSame) return aSame - bSame;
    return Object.keys(b.muscles).length - Object.keys(a.muscles).length;
  });
  return candidates[0]!;
}

// =============================================================================
// 3. Distribution du volume hebdo en N séances
// =============================================================================

/** Répartit `targetSets` séries sur `nSessions` séances en entiers. */
export function splitVolumeIntoSessions(
  targetSets: number,
  nSessions: number,
): number[] {
  if (nSessions <= 0) {
    return [];
  }
  const base = Math.trunc(Math.trunc(targetSets) / nSessions);
  const rest = Math.round(targetSets) - base * nSessions;
  return Array.from({ length: nSessions }, (_, i) => base + (i < rest ? 1 : 0));
}

// =============================================================================
// 4. Composition fine — compounds + isolations + lengthened bias (cf. 09 §6)
// =============================================================================

export interface PickCompoundsOptions {
  excludeIds?: ReadonlySet<string>;
}

/**
 * Sélectionne `n` compounds primaires sur ce muscle.
 * Priorise : compatibilité équipement, puis nombre de muscles touchés
 * (les plus polyarticulaires d'abord).
 */
export function pickCompoundsForMuscle(
  muscle: string,
  n: number,
  state: UserState,
  catalog: Catalog,
  options: PickCompoundsOptions = {},
): Exercise[] {
  const exclude = options.excludeIds ?? new Set<string>();
  const eq = state.profile.available_equip;
  const cands = catalog
    .filter({
      muscle_primary: muscle,
      equip_available: eq,
      compound_only: true,
    })
    .filter((x) => !exclude.has(x.id));
  // Tri : nb muscles touchés desc puis difficulté asc.
  cands.sort((a, b) => {
    const lenDiff = Object.keys(b.muscles).length - Object.keys(a.muscles).length;
    if (lenDiff !== 0) return lenDiff;
    return a.dif < b.dif ? -1 : a.dif > b.dif ? 1 : 0;
  });
  return cands.slice(0, n);
}

export interface PickIsolationsOptions {
  preferLengthened?: boolean;
  avoidAngles?: ReadonlySet<string>;
  excludeIds?: ReadonlySet<string>;
}

/**
 * Sélectionne `n` isolations sur ce muscle.
 * Si `preferLengthened=true`, priorise les exos avec tag `lengthened_bias`.
 * `avoidAngles` : set de tags d'angle à éviter pour diversifier.
 */
export function pickIsolationsForMuscle(
  muscle: string,
  n: number,
  state: UserState,
  catalog: Catalog,
  options: PickIsolationsOptions = {},
): Exercise[] {
  const preferLengthened = options.preferLengthened ?? false;
  const avoidAngles = options.avoidAngles ?? new Set<string>();
  const exclude = options.excludeIds ?? new Set<string>();
  const eq = state.profile.available_equip;
  const cands = catalog
    .filter({
      muscle_primary: muscle,
      equip_available: eq,
      isolation_only: true,
    })
    .filter((x) => !exclude.has(x.id));

  const sortKey = (x: Exercise): readonly [number, number, string] => {
    const hasLengthened = x.tags.includes('lengthened_bias');
    const lengthenedScore = preferLengthened && hasLengthened ? 0 : 1;
    const angleClash = x.tags.some((t) => avoidAngles.has(t)) ? 1 : 0;
    return [lengthenedScore, angleClash, x.dif];
  };
  cands.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  });
  return cands.slice(0, n);
}

// =============================================================================
// 5. Ordre dans la séance (cf. 09 §6.5)
// =============================================================================

// Petits muscles (placement en fin de séance pour iso).
const SMALL_MUSCLES: ReadonlySet<string> = new Set([
  'biceps',
  'triceps',
  'deltos_lateraux',
  'deltos_posterieurs',
  'mollets',
  'abdos',
  'obliques',
  'lombaires',
]);

/** Score pour ordonner. Plus petit = plus tôt dans la séance. */
function exerciseOrderScore(ex: Exercise): readonly [number, number] {
  const isCompound = ex.type === ExType.COMPOUND;
  const nMuscles = Object.keys(ex.muscles).length;
  const isBarbell = ex.charge === ChargeType.BARBELL;

  let level: number;
  if (isCompound && isBarbell && nMuscles >= 3) {
    level = 1;
  } else if (isCompound) {
    level = 2;
  } else if (!exercisePrimaires(ex).some((m) => SMALL_MUSCLES.has(m))) {
    level = 3;
  } else {
    level = 4;
  }
  return [level, -nMuscles];
}

/**
 * Ordonne les exos d'une séance selon les 4 niveaux + exception priorité.
 * `priorityMuscle` : si fourni, le 1er exo qui touche ce muscle peut
 * remonter d'un niveau (cf. 09 §6.5 exception).
 */
export function orderSession(
  exercises: readonly Exercise[],
  priorityMuscle: string | null = null,
): Exercise[] {
  const sortedEx = [...exercises].sort((a, b) => {
    const ka = exerciseOrderScore(a);
    const kb = exerciseOrderScore(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1] - kb[1];
  });

  if (priorityMuscle) {
    for (let i = 0; i < sortedEx.length; i++) {
      const ex = sortedEx[i]!;
      if (i > 0 && exercisePrimaires(ex).includes(priorityMuscle)) {
        // Trouve la dernière position niveau 1.
        let lastL1 = -1;
        for (let j = 0; j < i; j++) {
          if (exerciseOrderScore(sortedEx[j]!)[0] === 1) {
            lastL1 = j;
          }
        }
        const insertAt = lastL1 + 1;
        if (insertAt < i) {
          const [moved] = sortedEx.splice(i, 1);
          sortedEx.splice(insertAt, 0, moved!);
        }
        break;
      }
    }
  }
  return sortedEx;
}

// =============================================================================
// 6. Caps par séance (cf. 05 §7.3, 09 §6.7)
// =============================================================================

export const MAX_TOTAL_SETS_PER_SESSION: Record<Level, number> = {
  [Level.DEBUTANT]: 25,
  [Level.INTERMEDIAIRE]: 30,
  [Level.AVANCE]: 40,
};

/** Somme des `base_sets` sur une liste de PlannedExercise. */
export function totalSets(plannedExercises: readonly PlannedExercise[]): number {
  return plannedExercises.reduce((acc, p) => acc + p.base_sets, 0);
}
