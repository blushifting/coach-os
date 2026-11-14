/**
 * Sélection et substitution d'exercices.
 *
 * Référence :
 *   - 05_exercices_selection.md (compound/iso, ordre, lengthened bias, caps)
 *   - 09_programmation.md §6 (composition d'une séance)
 */

import type { Exercise, Profile, UserState, PlannedExercise } from './models';
import { ExType, Level } from './models';
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
  // Fix : un set vide ne court-circuite plus le filtre. On passe
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



// =============================================================================
// 2. Substitution dynamique
// =============================================================================





// =============================================================================
// 3. Distribution du volume hebdo en N séances
// =============================================================================



// =============================================================================
// 4. Composition fine — compounds + isolations + lengthened bias (cf. 09 §6)
// =============================================================================



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
