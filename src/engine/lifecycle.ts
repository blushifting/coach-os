/**
 * Lifecycle de cycle : bilan, suggestion d'action, ajustement V, recovery mode.
 *
 * Port 1:1 de prototype/coach_os/lifecycle.py (cf. 09_programmation.md §8).
 *
 * Pipeline en fin de cycle (semaine 5 = déload terminée) :
 *   1. generateCycleReview → CycleReview (progression, plateaux, adhérence, PRs)
 *   2. adjustVolumeBoundsAtCycleEnd → modifie state.volume_min/max in-place
 *   3. suggestNextAction → SuggestedAction (continuer / ajuster / tourner / changer)
 *   4. applyUserActionAfterCycle (après choix utilisateur) → re-génère plan
 */

import type { Catalog } from './catalog';
import type {
  CycleReview,
  SessionFeedback,
  UserState,
} from './models';
import {
  SuggestedAction,
  exercisePrimaires,
  makeCycleReview,
  weeklyTemplateSessionsPlanned,
} from './models';
import { e1rmObserved } from './prescription';
import {
  VMAX_DOWN_DELTA,
  VMAX_UP_DELTA,
  countWeeklyVolume,
} from './volume';
import { generateCyclePlan, rotateEmphasis } from './cycle_planner';

// =============================================================================
// Constantes recovery mode (cf. 09 §8.6)
// =============================================================================

export const RECOVERY_VOLUME_FACTOR = 0.5;
export const RECOVERY_RPE_CAP = 7.0;
export const RECOVERY_DURATION_WEEKS = 2;

// =============================================================================
// 1. Helpers d'analyse
// =============================================================================

function computeE1rmDeltaPerExercise(
  state: UserState,
  cycleSessions: readonly SessionFeedback[],
): Record<string, number> {
  const firstE1rm: Record<string, number> = {};
  for (const s of cycleSessions) {
    for (const f of s.sets) {
      if (!(f.exercise_id in firstE1rm)) {
        try {
          const baseline = e1rmObserved(f.load_kg, f.reps_done, f.rpe_perceived);
          firstE1rm[f.exercise_id] = baseline;
        } catch {
          // reps/rpe hors plage : on ignore
        }
      }
    }
  }
  const deltas: Record<string, number> = {};
  for (const [exId, baseline] of Object.entries(firstE1rm)) {
    const current = state.e1rm[exId];
    if (current !== undefined) {
      deltas[exId] = current - baseline;
    }
  }
  return deltas;
}

interface MusclesOutcome {
  progresses: string[];
  plateau: string[];
  undertrained: string[];
  overshoot: string[];
}

function classifyMusclesOutcome(
  state: UserState,
  cycleSessions: readonly SessionFeedback[],
  catalog: Catalog,
  plafondsProgression: Record<string, number>,
): MusclesOutcome {
  const progresses: string[] = [];
  const plateau: string[] = [];
  const undertrained: string[] = [];
  const overshoot: string[] = [];

  // Index : muscle → liste des Δe1RM pour ses exos primaires
  const byMuscle: Record<string, number[]> = {};
  for (const [exId, delta] of Object.entries(plafondsProgression)) {
    if (!catalog.has(exId)) continue;
    const ex = catalog.get(exId);
    for (const m of exercisePrimaires(ex)) {
      (byMuscle[m] ??= []).push(delta);
    }
  }

  // Volume réalisé par muscle sur le cycle (toutes semaines)
  const musclesOf: Record<string, Record<string, number>> = {};
  for (const x of catalog.all()) {
    musclesOf[x.id] = x.muscles;
  }
  const volumesReal = countWeeklyVolume(cycleSessions, musclesOf, 99);

  for (const [muscle, deltas] of Object.entries(byMuscle)) {
    const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    if (avg > 0.5) {
      progresses.push(muscle);
    } else if (avg < -0.5) {
      plateau.push(muscle);
    }
    const vReal = volumesReal[muscle] ?? 0;
    if (muscle in state.volume_min && vReal < state.volume_min[muscle]! * 0.7) {
      if (!undertrained.includes(muscle)) undertrained.push(muscle);
    }
    if (muscle in state.volume_max && vReal > state.volume_max[muscle]! * 1.1) {
      if (!overshoot.includes(muscle)) overshoot.push(muscle);
    }
  }

  // Plateau marqué : muscles avec plateau_counter ≥ 2
  for (const [muscle, count] of Object.entries(state.plateau_counter)) {
    if (count >= 2 && !plateau.includes(muscle)) {
      plateau.push(muscle);
    }
  }

  return { progresses, plateau, undertrained, overshoot };
}

function detectPrs(
  state: UserState,
  cycleSessions: readonly SessionFeedback[],
): Array<[string, number]> {
  const seen = new Set<string>();
  const prs: Array<[string, number]> = [];
  for (const s of cycleSessions) {
    for (const f of s.sets) {
      if (seen.has(f.exercise_id)) continue;
      seen.add(f.exercise_id);
      const current = state.e1rm[f.exercise_id];
      if (current !== undefined && current > 0) {
        prs.push([f.exercise_id, current]);
      }
    }
  }
  return prs;
}

function sumVolumeKg(cycleSessions: readonly SessionFeedback[]): number {
  let total = 0;
  for (const s of cycleSessions) {
    for (const f of s.sets) {
      total += f.load_kg * f.reps_done;
    }
  }
  return total;
}

// =============================================================================
// 2. generateCycleReview (cf. 09 §8.1)
// =============================================================================

export function generateCycleReview(state: UserState, catalog: Catalog): CycleReview {
  const cycleSessions = state.history.filter(
    (s) => s.cycle_index === state.cycle_index,
  );

  const plafondsProgression = computeE1rmDeltaPerExercise(state, cycleSessions);
  const { progresses, plateau, undertrained, overshoot } = classifyMusclesOutcome(
    state, cycleSessions, catalog, plafondsProgression,
  );

  const sessionsPlanned = state.current_cycle_plan
    ? weeklyTemplateSessionsPlanned(state.current_cycle_plan)
    : 0;
  const adherence = sessionsPlanned > 0 ? cycleSessions.length / sessionsPlanned : 0;

  const prs = detectPrs(state, cycleSessions);
  const volumeTotal = sumVolumeKg(cycleSessions);

  const action = suggestNextAction(progresses, plateau, undertrained, adherence);

  // Conv #14c-7 — snapshot des objectifs muscle au moment du bilan pour
  // pouvoir afficher "visé vs fait" dans l'historique des cycles.
  const muscleGoalsSnapshot = Object.values(state.muscle_goals).map((g) => ({
    muscle: g.muscle,
    objective: g.objective,
    status: g.status,
    priority_rank: g.priority_rank,
  }));

  const review = makeCycleReview({
    cycle_index: state.cycle_index,
    plafonds_progression: plafondsProgression,
    muscles_progresses: progresses,
    muscles_plateau: plateau,
    muscles_undertrained: undertrained,
    muscles_overshoot: overshoot,
    adherence_pct: adherence,
    volume_total_kg: volumeTotal,
    PRs: prs,
    suggested_action: action,
    warnings: [],
    muscle_goals_snapshot: muscleGoalsSnapshot,
  });

  // Vigilance : plafond chute > 5 % sur le cycle
  for (const [exId, delta] of Object.entries(plafondsProgression)) {
    const current = state.e1rm[exId] ?? 0;
    if (current > 0 && delta / current < -0.05) {
      if (catalog.has(exId)) {
        const ex = catalog.get(exId);
        review.warnings.push(
          `Plafond ${ex.nom_fr} en baisse, vérifier récupération/sommeil`,
        );
      }
    }
  }

  return review;
}

// =============================================================================
// 3. Suggestion d'action (cf. 09 §8.3)
// =============================================================================

export function suggestNextAction(
  musclesProgresses: readonly string[],
  musclesPlateau: readonly string[],
  _musclesUndertrained: readonly string[],
  adherence: number,
): SuggestedAction {
  if (adherence < 0.6) return SuggestedAction.AJUSTER_OBJECTIFS;
  if (musclesPlateau.length >= 3) return SuggestedAction.CHANGER_PROGRAMME;
  if (musclesProgresses.length >= musclesPlateau.length + 2 && adherence > 0.85) {
    return SuggestedAction.TOURNER_EMPHASIS;
  }
  return SuggestedAction.CONTINUER_PAREIL;
}

// =============================================================================
// 4. Ajustement V_min/V_max (cf. 09 §8.2)
// =============================================================================

export function adjustVolumeBoundsAtCycleEnd(
  state: UserState,
  review: CycleReview,
): void {
  for (const muscle of review.muscles_overshoot) {
    if (muscle in state.volume_max) {
      state.volume_max[muscle] = state.volume_max[muscle]! + VMAX_UP_DELTA;
    }
  }

  for (const muscle of review.muscles_plateau) {
    if (muscle in state.volume_max) {
      state.volume_max[muscle] = Math.max(
        state.volume_min[muscle] ?? 0,
        state.volume_max[muscle]! - VMAX_DOWN_DELTA,
      );
    }
  }

  for (const muscle of review.muscles_undertrained) {
    if (muscle in state.volume_min) {
      state.volume_min[muscle] = Math.max(2, state.volume_min[muscle]! - 1);
      review.warnings.push(
        `V_min(${muscle}) ajusté à la baisse, sessions trop courtes ?`,
      );
    }
  }
}

// =============================================================================
// 5. Recovery mode (cf. 09 §8.6)
// =============================================================================

export function enterRecoveryMode(
  state: UserState,
  weeks: number = RECOVERY_DURATION_WEEKS,
): void {
  state.recovery_mode = true;
  state.recovery_weeks_remaining = weeks;
}

export function maybeExitRecoveryMode(state: UserState): boolean {
  if (state.recovery_mode && state.recovery_weeks_remaining <= 0) {
    state.recovery_mode = false;
    return true;
  }
  return false;
}

export function decrementRecoveryWeek(state: UserState): void {
  if (state.recovery_mode) {
    state.recovery_weeks_remaining = Math.max(0, state.recovery_weeks_remaining - 1);
  }
  maybeExitRecoveryMode(state);
}

// =============================================================================
// 6. applyUserActionAfterCycle (cf. 09 §9.2)
// =============================================================================

export function applyUserActionAfterCycle(
  state: UserState,
  catalog: Catalog,
  action: SuggestedAction,
): void {
  if (action === SuggestedAction.CONTINUER_PAREIL) {
    state.current_cycle_plan = generateCyclePlan(state, catalog);
  } else if (action === SuggestedAction.TOURNER_EMPHASIS) {
    rotateEmphasis(state.muscle_goals);
    state.current_cycle_plan = generateCyclePlan(state, catalog);
  }
  // AJUSTER_OBJECTIFS et CHANGER_PROGRAMME : interaction UX, regen plan plus tard.

  state.cycle_index += 1;
  state.current_week_in_cycle = 1;
  maybeExitRecoveryMode(state);
}
