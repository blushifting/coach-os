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
