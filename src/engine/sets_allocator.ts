/**
 * Sets allocator (Conv #22, étape F du nouveau onboarding).
 *
 * Une fois l'user a rempli la grille à l'étape E (chaque PatternCell a son
 * `chosen_exercise_id`), ce module distribue les séries (n_sets) par exo
 * pour respecter, dans l'ordre de priorité :
 *   1. Volume hebdo cible par muscle prio (V_cible ≥ V_min, viser V_target)
 *   2. Durée séance ≤ cible utilisateur
 *   3. Plafonds (3-6 séries/exo, ≤10 séries/muscle/séance, ≤30 total/séance)
 *   4. Équilibre durée inter-séances (soft)
 *
 * Algo : heuristique gloutonne en 2 passes.
 *   - Init : 3 séries/exo (plancher).
 *   - Bump : tant qu'un muscle prio est sous V_cible et qu'une amélioration
 *     ne viole aucune contrainte hard, ajouter +1 à l'exo qui maximise
 *     l'avancement (compound > iso, primaire > secondaire).
 *
 * Sortie : DayTemplate[] (compatible structure existante du moteur).
 *
 * Référence : 09_programmation.md §3.3, §6.1, §6.7.
 */

import type {
  DayTemplate,
  Exercise,
  PlannedExercise,
  SkeletonTemplate,
  UserState,
} from './models';
import {
  ProgressionRule,
  exercisePrimaires,
  makePlannedExercise,
} from './models';
import type { Catalog } from './catalog';
import {
  effectiveCycleTargetVolume,
  effectiveVolumeBounds,
  MAX_SETS_PER_SESSION_PER_MUSCLE,
  MAX_TOTAL_SETS_PER_SESSION_V2,
} from './volume';

// =============================================================================
// Constantes solveur
// =============================================================================

/** Plancher séries/exo : en dessous, ce n'est pas un vrai exo. */
export const MIN_SETS_PER_EXERCISE = 3;
/** Plafond séries/exo : au-dessus, rendement décroissant (Schoenfeld 2017). */
export const MAX_SETS_PER_EXERCISE = 6;

/** Estimation grossière de durée par série (cf. Conv #19 calibration). */
const SECONDS_PER_SET = 90;     // exec + transition + repos moyen
const SECONDS_SETUP_PER_EXO = 75;
const SECONDS_TRANSITION = 60;

/** Durée cible (minutes) selon DurationCategory. Sert au check soft. */
const TARGET_MINUTES_BY_CATEGORY: Record<string, number> = {
  short: 60,
  medium: 90,
  long: 120,
};

/** Tolérance overshoot durée séance (+10 %). */
const DURATION_OVERSHOOT_TOLERANCE = 1.1;

// =============================================================================
// Types intermédiaires
// =============================================================================

interface AllocatedExo {
  exercise_id: string;
  exercise: Exercise;
  n_sets: number;
}

interface AllocatedDay {
  day_index: number;
  label: string;
  focus_muscles: string[];
  exos: AllocatedExo[];
}

// =============================================================================
// Helpers calcul
// =============================================================================

function estimateDurationSec(exos: readonly AllocatedExo[]): number {
  if (exos.length === 0) return 0;
  let total = 0;
  for (const e of exos) {
    total += SECONDS_SETUP_PER_EXO + e.n_sets * SECONDS_PER_SET;
  }
  total += (exos.length - 1) * SECONDS_TRANSITION;
  return total;
}

function weeklyVolumeByMuscle(
  days: readonly AllocatedDay[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) {
    for (const e of d.exos) {
      for (const [muscle, coef] of Object.entries(e.exercise.muscles)) {
        out[muscle] = (out[muscle] ?? 0) + e.n_sets * coef;
      }
    }
  }
  return out;
}

function setsByMuscleInDay(
  day: AllocatedDay,
  muscle: string,
): number {
  let s = 0;
  for (const e of day.exos) {
    const coef = e.exercise.muscles[muscle] ?? 0;
    if (coef > 0) s += e.n_sets * coef;
  }
  return s;
}

function totalSetsInDay(day: AllocatedDay): number {
  return day.exos.reduce((acc, e) => acc + e.n_sets, 0);
}

// =============================================================================
// 1. Initialisation à 3 séries/exo
// =============================================================================

function initializeAllocation(
  skeleton: SkeletonTemplate,
  catalog: Catalog,
): { days: AllocatedDay[]; warnings: string[] } {
  const warnings: string[] = [];
  const days: AllocatedDay[] = skeleton.days.map((sd) => {
    const exos: AllocatedExo[] = [];
    for (const cell of sd.cells) {
      if (cell.chosen_exercise_id === null) {
        warnings.push(
          `${sd.split_label}: case ${cell.pattern}/${cell.primary_muscle} non remplie`,
        );
        continue;
      }
      if (!catalog.has(cell.chosen_exercise_id)) {
        warnings.push(
          `${sd.split_label}: exo inconnu ${cell.chosen_exercise_id} ignoré`,
        );
        continue;
      }
      exos.push({
        exercise_id: cell.chosen_exercise_id,
        exercise: catalog.get(cell.chosen_exercise_id),
        n_sets: MIN_SETS_PER_EXERCISE,
      });
    }
    return {
      day_index: sd.day_index,
      label: sd.split_label,
      focus_muscles: [...sd.focus_muscles],
      exos,
    };
  });
  return { days, warnings };
}

// =============================================================================
// 2. Bump glouton : ajouter des séries jusqu'à V_cible des prios
// =============================================================================

interface BumpContext {
  state: UserState;
  targetMaxSeconds: number;
  /** Muscles prio avec V_cible : ce qu'on essaie d'atteindre. */
  priorityTargets: Map<string, number>;
}

function buildBumpContext(state: UserState, skeleton: SkeletonTemplate): BumpContext {
  const priorityTargets = new Map<string, number>();
  for (const muscle of Object.keys(state.muscle_goals)) {
    const v = effectiveCycleTargetVolume(state, muscle);
    if (v > 0) priorityTargets.set(muscle, v);
  }
  const targetMin = TARGET_MINUTES_BY_CATEGORY[skeleton.duration_category] ?? 90;
  return {
    state,
    targetMaxSeconds: targetMin * 60 * DURATION_OVERSHOOT_TOLERANCE,
    priorityTargets,
  };
}

/**
 * Pour chaque exo candidat à un bump, calcule un score reflétant à quel
 * point ajouter +1 série fait avancer vers V_cible des muscles sous-pourvus.
 * Score = Σ (deficit_muscle × coef) pour chaque muscle touché par l'exo,
 * où deficit = max(0, V_cible - V_realisé).
 *
 * Retourne null si aucun bump n'est valide (toutes contraintes hard saturées).
 */
function pickBestBump(
  days: readonly AllocatedDay[],
  ctx: BumpContext,
): { dayIdx: number; exoIdx: number } | null {
  const realized = weeklyVolumeByMuscle(days);
  let bestScore = 0;
  let bestPick: { dayIdx: number; exoIdx: number } | null = null;

  days.forEach((day, di) => {
    day.exos.forEach((exo, ei) => {
      // Contraintes hard.
      if (exo.n_sets >= MAX_SETS_PER_EXERCISE) return;
      if (totalSetsInDay(day) + 1 > MAX_TOTAL_SETS_PER_SESSION_V2) return;
      // Contrainte ≤ 10 séries pondérées par muscle / séance pour les primaires.
      const primaries = exercisePrimaires(exo.exercise);
      for (const m of primaries) {
        if (setsByMuscleInDay(day, m) + (exo.exercise.muscles[m] ?? 1.0) >
            MAX_SETS_PER_SESSION_PER_MUSCLE) {
          return;
        }
      }
      // Contrainte durée séance.
      const newDuration = estimateDurationSec(day.exos.map((e, i) =>
        i === ei ? { ...e, n_sets: e.n_sets + 1 } : e,
      ));
      if (newDuration > ctx.targetMaxSeconds) return;

      // Calcul du score = avancement vers V_cible des muscles touchés.
      let score = 0;
      for (const [muscle, coef] of Object.entries(exo.exercise.muscles)) {
        const target = ctx.priorityTargets.get(muscle);
        if (target === undefined) continue;
        const deficit = Math.max(0, target - (realized[muscle] ?? 0));
        if (deficit > 0) {
          score += deficit * coef;
        }
      }
      // Pénalité légère : moins bumper les exos déjà bien chargés.
      score -= 0.01 * exo.n_sets;

      if (score > bestScore) {
        bestScore = score;
        bestPick = { dayIdx: di, exoIdx: ei };
      }
    });
  });

  return bestPick;
}

// =============================================================================
// 3. Conversion vers DayTemplate (avec progression Israetel)
// =============================================================================

import { israetelProgression } from './cycle_planner';

function toPlannedExercises(day: AllocatedDay): PlannedExercise[] {
  return day.exos.map((e) =>
    makePlannedExercise({
      exercise_id: e.exercise_id,
      base_sets: e.n_sets,
      progression: israetelProgression(e.n_sets),
      progression_rule: ProgressionRule.ISRAETEL_VOLUME,
    }),
  );
}

function toDayTemplate(day: AllocatedDay, label: string): DayTemplate {
  return {
    day_index: day.day_index,
    label,
    target_muscles_focus: [...day.focus_muscles],
    exercises: toPlannedExercises(day),
  };
}

// =============================================================================
// 4. Point d'entrée : allocateSets
// =============================================================================

export interface AllocateSetsResult {
  days: DayTemplate[];
  warnings: string[];
  /** Volume hebdo réalisé par muscle après allocation. */
  realized_volume: Record<string, number>;
  /** Muscles prio dont V_cible n'a pas pu être atteint. */
  undershoot_muscles: string[];
}

/**
 * Distribue les séries sur les exos choisis du skeleton.
 *
 * Itère le bump glouton jusqu'à atteindre V_cible des prios OU jusqu'à
 * blocage par contraintes. Construit les labels finaux via
 * `buildSessionLabel` (importé de skeleton_builder).
 */
export function allocateSets(
  skeleton: SkeletonTemplate,
  state: UserState,
  catalog: Catalog,
): AllocateSetsResult {
  const { days, warnings } = initializeAllocation(skeleton, catalog);
  const ctx = buildBumpContext(state, skeleton);

  // Boucle de bump avec garde-fou itérations max (sécurité).
  const MAX_ITER = 200;
  for (let i = 0; i < MAX_ITER; i += 1) {
    const pick = pickBestBump(days, ctx);
    if (pick === null) break;
    days[pick.dayIdx]!.exos[pick.exoIdx]!.n_sets += 1;
  }

  // Diagnostic : muscles sous V_cible après convergence.
  const realized = weeklyVolumeByMuscle(days);
  const undershoot: string[] = [];
  for (const [muscle, target] of ctx.priorityTargets.entries()) {
    const [vMin] = effectiveVolumeBounds(state, muscle);
    const got = realized[muscle] ?? 0;
    if (got < vMin) {
      undershoot.push(muscle);
      warnings.push(
        `${muscle}: ${got.toFixed(1)} séries vs V_min ${vMin.toFixed(1)}. ` +
          `Contraintes durée/plafond bloquent. Envisage +1 séance ou durée plus longue.`,
      );
    } else if (got < target) {
      // Pas d'alerte si on est entre V_min et V_target — c'est juste sous-cible.
    }
  }

  // Construction labels finaux via skeleton_builder.
  const labeled = skeleton.days.map((sd, i) =>
    toDayTemplate(days[i]!, buildLabelForSkeletonDay(sd)),
  );

  return {
    days: labeled,
    warnings,
    realized_volume: realized,
    undershoot_muscles: undershoot,
  };
}

// Re-export local pour éviter import circulaire avec skeleton_builder
// (skeleton_builder exporte buildSessionLabel, mais notre input est
// SkeletonDay, pas un AllocatedDay).
import { buildSessionLabel } from './skeleton_builder';
function buildLabelForSkeletonDay(
  sd: SkeletonTemplate['days'][number],
): string {
  return buildSessionLabel(sd);
}
