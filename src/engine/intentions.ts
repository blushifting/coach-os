/**
 * Dump 2.4, étape 2 — migration à la lecture des anciens réglages par muscle.
 *
 * Avant : un objectif (force, hypertrophie, endurance, maintien) et un statut
 * (prioritaire, suggéré, non couvert). Après : une intention (développer avec
 * un rang, entretenir) ou rien. Règle validée par Azur en conv #80 :
 *   - prioritaire hors maintien → développer (rang conservé, renuméroté 1, 2, 3…) ;
 *   - prioritaire en maintien, ou suggéré → entretenir ;
 *   - non couvert → rien (le muscle reste suivi, sans cible).
 *
 * Tout ce module ne sert qu'aux données antérieures : il lit l'ancien format,
 * il ne l'écrit jamais.
 */

import { MuscleIntention, type MuscleGoal } from './models';

/** Forme stockée d'un réglage de muscle : nouvelle ou ancienne. */
export interface StoredMuscleGoal {
  readonly muscle: string;
  readonly priority_rank: number;
  readonly intention?: string;
  /** Ancien format (avant la 2.4). */
  readonly objective?: string;
  /** Ancien format (avant la 2.4). */
  readonly status?: string;
}

/** Vrai si au moins un réglage est encore dans l'ancien format. */
export function hasLegacyMuscleGoals(
  raw: Readonly<Record<string, StoredMuscleGoal>>,
): boolean {
  return Object.values(raw).some((g) => g.intention === undefined);
}

function intentionOf(g: StoredMuscleGoal): MuscleIntention | null {
  if (g.intention === MuscleIntention.DEVELOPPER) return MuscleIntention.DEVELOPPER;
  if (g.intention === MuscleIntention.ENTRETENIR) return MuscleIntention.ENTRETENIR;
  if (g.intention !== undefined) return null; // valeur inconnue : on ne devine pas
  if (g.status === 'prioritaire') {
    return g.objective === 'maintien' ? MuscleIntention.ENTRETENIR : MuscleIntention.DEVELOPPER;
  }
  if (g.status === 'suggere') return MuscleIntention.ENTRETENIR;
  return null; // non couvert
}

/**
 * Convertit des réglages stockés (ancien ou nouveau format) vers le modèle
 * courant. Les muscles à développer sont renumérotés 1, 2, 3… dans l'ordre de
 * leur ancien rang (un ancien prioritaire en maintien laisse un trou).
 */
export function migrateMuscleGoals(
  raw: Readonly<Record<string, StoredMuscleGoal>>,
): Record<string, MuscleGoal> {
  const out: Record<string, MuscleGoal> = {};
  const toDevelop: StoredMuscleGoal[] = [];
  for (const g of Object.values(raw)) {
    const intention = intentionOf(g);
    if (intention === MuscleIntention.ENTRETENIR) {
      out[g.muscle] = { muscle: g.muscle, intention, priority_rank: 99 };
    } else if (intention === MuscleIntention.DEVELOPPER) {
      toDevelop.push(g);
    }
  }
  toDevelop
    .sort((a, b) => a.priority_rank - b.priority_rank)
    .forEach((g, i) => {
      out[g.muscle] = {
        muscle: g.muscle,
        intention: MuscleIntention.DEVELOPPER,
        priority_rank: i + 1,
      };
    });
  return out;
}

/**
 * Même migration pour une liste (instantané des réglages posé dans le bilan
 * d'un cycle clos). Un muscle anciennement « non couvert » disparaît.
 */
export function migrateMuscleGoalList(
  raw: ReadonlyArray<StoredMuscleGoal>,
): MuscleGoal[] {
  return Object.values(
    migrateMuscleGoals(Object.fromEntries(raw.map((g) => [g.muscle, g]))),
  );
}

// =============================================================================
// Reps : quels exercices changent de cible avec la table unique
// =============================================================================

/** Anciennes reps cibles (polyarticulaire / isolation) par objectif. */
const LEGACY_REPS: Readonly<Record<string, readonly [number, number]>> = {
  force: [5, 8],
  hypertrophie: [10, 12],
  endurance: [15, 20],
  maintien: [8, 10],
};

/**
 * Objectif qui fixait autrefois les reps d'un exercice : celui de son muscle
 * primaire (coefficient ≥ 1) de meilleur rang ; maintien si aucun muscle
 * primaire n'avait de réglage ; objectif global du profil si aucun muscle
 * n'avait de réglage du tout.
 */
function legacyObjectiveFor(
  muscles: Readonly<Record<string, number>>,
  raw: Readonly<Record<string, StoredMuscleGoal>>,
  profileObjective: string | undefined,
): string {
  if (Object.keys(raw).length === 0) return profileObjective ?? 'hypertrophie';
  const order = ['force', 'hypertrophie', 'endurance', 'maintien'];
  const candidates = Object.entries(muscles)
    .filter(([m, coef]) => coef >= 1 && raw[m] !== undefined && raw[m]!.status !== 'non_couvert')
    .map(([m]) => raw[m]!);
  if (candidates.length === 0) return 'maintien';
  candidates.sort(
    (a, b) =>
      a.priority_rank - b.priority_rank ||
      order.indexOf(a.objective ?? '') - order.indexOf(b.objective ?? ''),
  );
  return candidates[0]!.objective ?? 'hypertrophie';
}

/**
 * Exercices dont la cible de reps change avec la table unique (10 / 12, les
 * valeurs de l'ancien objectif hypertrophie). Leur plancher de charge avait été
 * semé pour d'autres reps : il doit être re-semé. Leur Plafond, lui, ne bouge
 * pas (D4 : le Plafond mesure, il ne dépend pas d'une cible).
 *
 * `musclesOf` renvoie les muscles d'un exercice, ou `null` s'il est inconnu
 * (exercice personnel absent du catalogue livré) : il est alors laissé tel quel.
 */
export function exercisesWithChangedReps(
  exerciseIds: Iterable<string>,
  raw: Readonly<Record<string, StoredMuscleGoal>>,
  profileObjective: string | undefined,
  musclesOf: (exerciseId: string) => Readonly<Record<string, number>> | null,
): string[] {
  const out: string[] = [];
  for (const id of exerciseIds) {
    const muscles = musclesOf(id);
    if (muscles === null) continue;
    const objective = legacyObjectiveFor(muscles, raw, profileObjective);
    const reps = LEGACY_REPS[objective];
    if (reps !== undefined && reps !== LEGACY_REPS.hypertrophie) out.push(id);
  }
  return out;
}
