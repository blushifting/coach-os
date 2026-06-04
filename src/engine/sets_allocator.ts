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
  ExType,
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

/**
 * Constantes de durée alignées sur Conv #19 (`lib/onboarding-preview.ts`)
 * pour cohérence avec l'estimation présentée à l'user. Compound = repos long,
 * iso = repos court ; SET_EXEC = 40 s exec + thumbing du téléphone.
 */
const SECONDS_SETUP_PER_EXO = 75;
const SECONDS_SET_EXEC = 40;
const SECONDS_REST_COMPOUND = 150;
const SECONDS_REST_ISOLATION = 80;
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
    const restS =
      e.exercise.type === ExType.COMPOUND
        ? SECONDS_REST_COMPOUND
        : SECONDS_REST_ISOLATION;
    total += SECONDS_SETUP_PER_EXO + e.n_sets * (SECONDS_SET_EXEC + restS);
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
  /** Plafond V_max par muscle (sert à éviter le junk volume incident). */
  vmaxByMuscle: Map<string, number>;
  /** Muscles "couverts" par une priorité user (PRIORITAIRE ou SUGGERE).
   *  Les autres sont des incidents purs et plafonnés à V_min. */
  coveredMuscles: Set<string>;
}

function buildBumpContext(state: UserState, skeleton: SkeletonTemplate): BumpContext {
  const priorityTargets = new Map<string, number>();
  const vmaxByMuscle = new Map<string, number>();
  const coveredMuscles = new Set<string>();
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    const v = effectiveCycleTargetVolume(state, muscle);
    if (v > 0) priorityTargets.set(muscle, v);
    const [, vMax] = effectiveVolumeBounds(state, muscle);
    if (vMax > 0) vmaxByMuscle.set(muscle, vMax);
    if (goal.status !== undefined) coveredMuscles.add(muscle);
  }
  // Conv #22.4 (junk volume) — pour les muscles **non couverts** par
  // muscle_goals (= ni PRIORITAIRE ni SUGGERE), on plafonne le volume
  // incident à V_min (= seuil bénéfique sans junk volume). Sans ça,
  // les compounds quad/fessiers (back_squat, leg_press, walking_lunge,
  // tous quad:1 + fessiers:1 en primaire) gonflaient fessiers à 17
  // séries quand fessiers était non-prio.
  for (const muscle of Object.keys(state.volume_min)) {
    if (vmaxByMuscle.has(muscle)) continue;
    const vMinBase = state.volume_min[muscle];
    if (vMinBase !== undefined && vMinBase > 0) {
      vmaxByMuscle.set(muscle, vMinBase);
    }
  }
  const targetMin = TARGET_MINUTES_BY_CATEGORY[skeleton.duration_category] ?? 90;
  return {
    state,
    targetMaxSeconds: targetMin * 60 * DURATION_OVERSHOOT_TOLERANCE,
    priorityTargets,
    vmaxByMuscle,
    coveredMuscles,
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

      // Conv #22 (junk volume) — Refuser le bump s'il pousse un muscle
      // **non-prio** au-delà de son V_max. Pour les muscles non couverts
      // par muscle_goals, on plafonne à V_max_legacy (déjà calibré par
      // initialVolumeBounds). Évite le cas fessiers à 18 séries quand
      // l'user a pris pec/dos/quads/ischios mais pas fessiers.
      let pushesNonPrioOverMax = false;
      for (const [muscle, coef] of Object.entries(exo.exercise.muscles)) {
        if (ctx.priorityTargets.has(muscle)) continue; // muscle prio OK
        const vMax = ctx.vmaxByMuscle.get(muscle) ?? ctx.state.volume_max[muscle];
        if (vMax === undefined) continue;
        const next = (realized[muscle] ?? 0) + coef;
        if (next > vMax) {
          pushesNonPrioOverMax = true;
          break;
        }
      }
      if (pushesNonPrioOverMax) return;

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

  // Conv #22 (junk volume) — Post-pass : réduire le volume des exos qui
  // sursaturent un muscle non-prio. Évite le cas fessiers à 18 séries
  // incidentes en FB 4× quand l'user n'a pas pris fessiers en prio.
  reduceJunkVolume(days, ctx);

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

/**
 * Conv #22 — Post-pass anti-junk-volume.
 *
 * Identifie les muscles non-prio dont le volume incident hebdo dépasse
 * leur V_max effectif (zone "junk" sans bénéfice supplémentaire et avec
 * un coût en fatigue). Pour chaque, on réduit la série la plus "incidente"
 * sur ce muscle, sans descendre sous :
 *  - le plancher 3 séries / exo,
 *  - V_min des muscles prio (le primaire de l'exo reste couvert).
 *
 * Convention : on ne touche jamais à un exo dont le muscle primaire est
 * prioritaire — c'est l'esprit §3.4 du doc ("on ne rabote jamais un
 * compound prio pour un muscle Maintien"). On agit uniquement sur les
 * exos accessoires (isolation ou compound non-prio).
 */
function reduceJunkVolume(
  days: readonly AllocatedDay[],
  ctx: BumpContext,
): void {
  const MAX_PASSES = 30;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const realized = weeklyVolumeByMuscle(days);
    // Cherche le muscle non-prio le plus en surcharge.
    let worstMuscle: string | null = null;
    let worstExcess = 0;
    for (const [muscle, vMax] of ctx.vmaxByMuscle.entries()) {
      if (ctx.priorityTargets.has(muscle)) continue; // muscle prio = OK
      const got = realized[muscle] ?? 0;
      const excess = got - vMax;
      if (excess > worstExcess) {
        worstExcess = excess;
        worstMuscle = muscle;
      }
    }
    if (worstMuscle === null) return;

    // Cherche l'exo qui sur-sollicite le plus ce muscle et qui peut être
    // réduit (n_sets > plancher + primaire pas prioritaire).
    interface BestEntry { dayIdx: number; exoIdx: number; coef: number }
    let best: BestEntry | null = null;
    days.forEach((day, di) => {
      day.exos.forEach((exo, ei) => {
        if (exo.n_sets <= MIN_SETS_PER_EXERCISE) return;
        const primaries = exercisePrimaires(exo.exercise);
        const touchesPrioPrimary = primaries.some((m) =>
          ctx.priorityTargets.has(m),
        );
        if (touchesPrioPrimary) return;
        const coef = exo.exercise.muscles[worstMuscle!] ?? 0;
        if (coef <= 0) return;
        const current = best as BestEntry | null;
        if (current === null || coef > current.coef) {
          best = { dayIdx: di, exoIdx: ei, coef };
        }
      });
    });
    const picked = best as BestEntry | null;
    if (picked === null) return;
    days[picked.dayIdx]!.exos[picked.exoIdx]!.n_sets -= 1;
  }
}
