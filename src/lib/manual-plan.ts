/**
 * Bloc O — plans « à la main ».
 *
 * Mode où l'utilisateur construit son programme lui-même : une grille de N
 * séances VIDES (N = séances/sem), non typées (jours nus, aucun focus muscle
 * suggéré), qu'il remplit via la machinerie d'ajout du récap (Step5Preview),
 * guidé par les jauges de volume. Aucun passage par le moteur de génération.
 */

import {
  makePlannedExercise,
  makeWeeklyTemplate,
  type DayTemplate,
  type WeeklyTemplate,
} from '@/engine/models';
import { defaultProgressionForDay } from '@/lib/custom-session';

/** Labels de rotation des jours nus (A, B, C, …). */
const DAY_LETTERS = 'ABCDEFGH';

/**
 * Construit un plan VIDE de `sessionsPerWeek` séances : jours nus labellisés
 * A/B/C…, sans focus muscle ni exercice. L'utilisateur le remplit ensuite.
 *
 * ⚠️ Ne JAMAIS router ce plan par `generateCyclePlan(V2)`/`renumberSessionLabels` :
 * la regex de relabellisation transformerait un label nu « A » en « A A ». Le
 * plan manuel est posé tel quel via `setCurrentCyclePlan`.
 */
export function buildEmptyManualPlan(
  sessionsPerWeek: number,
  cycleIndex = 1,
): WeeklyTemplate {
  const count = Math.max(
    1,
    Math.min(DAY_LETTERS.length, Math.round(sessionsPerWeek)),
  );
  const days: DayTemplate[] = Array.from({ length: count }, (_, i) => ({
    day_index: i,
    label: DAY_LETTERS[i]!,
    target_muscles_focus: [],
    exercises: [],
  }));
  return makeWeeklyTemplate({
    cycle_index: cycleIndex,
    rationale: 'Programme construit à la main.',
    days,
  });
}

/**
 * Reconduit un plan « à la main » pour le cycle suivant : mêmes jours / exos /
 * séries, progression recalculée (schéma 5 semaines + déload), `cycle_index`
 * mis à jour. Les charges montent via la recalibration moteur (fait à part),
 * pas ici. On ne régénère donc PAS la sélection d'exos — c'est le choix de
 * l'utilisateur, on le conserve.
 */
export function carryOverManualPlan(
  plan: WeeklyTemplate,
  cycleIndex: number,
): WeeklyTemplate {
  const days: DayTemplate[] = plan.days.map((day) => {
    const rebuilt: DayTemplate = {
      day_index: day.day_index,
      label: day.label,
      target_muscles_focus: [...day.target_muscles_focus],
      exercises: [],
      ...(day.custom_name !== undefined ? { custom_name: day.custom_name } : {}),
    };
    rebuilt.exercises = day.exercises.map((ex) =>
      makePlannedExercise({
        exercise_id: ex.exercise_id,
        base_sets: ex.base_sets,
        progression: defaultProgressionForDay(rebuilt, ex.base_sets),
        role: ex.role,
        intensity_scheme: ex.intensity_scheme,
        progression_rule: ex.progression_rule,
      }),
    );
    return rebuilt;
  });
  return makeWeeklyTemplate({
    cycle_index: cycleIndex,
    rationale: plan.rationale,
    days,
  });
}
