/**
 * Schéma Zod du snapshot démo (persona Alex).
 *
 * Le snapshot est généré offline par `scripts/generate-alex-demo.mts` et commité
 * dans `public/demo/alex.json`. Il est rechargé à l'exécution en mode démo
 * (cf. `lib/demo.ts` Conv #13b) pour peupler le store sans toucher la vraie DB.
 *
 * On valide à la lecture parce que le fichier est un artefact (build TS → JSON) :
 * si quelqu'un modifie les types `UserState` / `SessionRow` / … en laissant
 * `alex.json` non régénéré, on veut planter franchement plutôt que d'injecter
 * une forme cassée dans le store et debugger 10 selectors plus tard.
 *
 * Les schémas reproduisent **strictement** les types lus par `selectors.ts` :
 * - `SerializedUserState` (cf. `db/schema.ts`)
 * - `SessionRow`, `FeedbackRow`, `E1rmSnapshotRow`, `CycleRow`
 */

import { z } from 'zod';

// =============================================================================
// Sous-schémas : modèles métier
// =============================================================================

const muscleGoalSchema = z.object({
  muscle: z.string(),
  objective: z.enum(['force', 'hypertrophie', 'endurance', 'maintien']),
  status: z.enum(['prioritaire', 'suggere', 'non_couvert']),
  priority_rank: z.number().int(),
});

const setPrescriptionSchema = z.object({
  exercise_id: z.string(),
  reps: z.number().int().nonnegative(),
  load_kg: z.number(),
  rpe_target: z.number(),
  rest_s: z.number().int().nonnegative(),
});

const sessionItemSchema = z.object({
  exercise_id: z.string(),
  sets: z.array(setPrescriptionSchema),
});

const sessionPlanSchema = z.object({
  seance_date: z.string(),
  week_in_cycle: z.number().int(),
  cycle_index: z.number().int(),
  rpe_target: z.number(),
  items: z.array(sessionItemSchema),
  label: z.string(),
});

const setFeedbackSchema = z.object({
  exercise_id: z.string(),
  reps_done: z.number().int().nonnegative(),
  load_kg: z.number(),
  rpe_perceived: z.number(),
});

const sessionFeedbackSchema = z.object({
  seance_date: z.string(),
  week_in_cycle: z.number().int(),
  cycle_index: z.number().int(),
  rpe_target: z.number(),
  sets: z.array(setFeedbackSchema),
  label: z.string(),
});

const plannedExerciseSchema = z.object({
  exercise_id: z.string(),
  base_sets: z.number().int(),
  progression: z.array(z.number().int()),
  role: z.string().nullable(),
  intensity_scheme: z.string().nullable(),
  progression_rule: z
    .enum([
      'linear_2_5kg',
      'double_progression',
      'wave_5_3_1',
      'amrap_lp',
      'israetel_volume',
    ])
    .nullable(),
});

const dayTemplateSchema = z.object({
  day_index: z.number().int(),
  label: z.string(),
  target_muscles_focus: z.array(z.string()),
  exercises: z.array(plannedExerciseSchema),
});

const weeklyTemplateSchema = z.object({
  cycle_index: z.number().int(),
  rationale: z.string(),
  days: z.array(dayTemplateSchema),
  warnings: z.array(z.string()),
});

const cycleReviewSchema = z.object({
  cycle_index: z.number().int(),
  plafonds_progression: z.record(z.string(), z.number()),
  muscles_progresses: z.array(z.string()),
  muscles_plateau: z.array(z.string()),
  muscles_undertrained: z.array(z.string()),
  muscles_overshoot: z.array(z.string()),
  adherence_pct: z.number(),
  volume_total_kg: z.number(),
  PRs: z.array(z.tuple([z.string(), z.number()])),
  suggested_action: z.enum(['continuer', 'ajuster', 'tourner', 'changer']),
  warnings: z.array(z.string()),
});

const equipmentOverrideSchema = z.object({
  inc_kg: z.number().nullable(),
  min_load_kg: z.number().nullable(),
  max_load_kg: z.number().nullable(),
});

// =============================================================================
// UserState sérialisé (SerializedUserState)
// =============================================================================

const serializedProfileSchema = z.object({
  sex: z.string(),
  age: z.number().int(),
  level: z.string(),
  objective: z.string(),
  sessions_per_week: z.number().int(),
  bodyweight_kg: z.number(),
  available_equip: z.array(z.string()),
});

const serializedUserStateSchema = z.object({
  profile: serializedProfileSchema,
  e1rm: z.record(z.string(), z.number()),
  k_user: z.record(z.string(), z.number()),
  reps_pr: z.record(z.string(), z.number()),
  volume_min: z.record(z.string(), z.number()),
  volume_max: z.record(z.string(), z.number()),
  current_week_in_cycle: z.number().int(),
  cycle_index: z.number().int(),
  plateau_counter: z.record(z.string(), z.number()),
  history: z.array(sessionFeedbackSchema),
  last_used_for_muscle: z.record(z.string(), z.string()),
  muscle_goals: z.record(z.string(), muscleGoalSchema),
  current_cycle_plan: weeklyTemplateSchema.nullable(),
  active_guided_program_id: z.string().nullable(),
  recovery_mode: z.boolean(),
  recovery_weeks_remaining: z.number().int(),
  equipment_overrides: z.record(z.string(), equipmentOverrideSchema),
  weekly_volume_debt: z.record(z.string(), z.number()).optional(),
});

// =============================================================================
// Lignes des tables history (vues dérivées DB)
// =============================================================================

const sessionRowSchema = z.object({
  id: z.number().int(),
  seance_date: z.string(),
  week_in_cycle: z.number().int(),
  cycle_index: z.number().int(),
  plan: sessionPlanSchema,
  status: z.enum(['planned', 'completed', 'skipped']),
  created_at: z.string(),
});

const feedbackRowSchema = z.object({
  id: z.number().int(),
  session_id: z.number().int().nullable(),
  seance_date: z.string(),
  cycle_index: z.number().int(),
  week_in_cycle: z.number().int(),
  feedback: sessionFeedbackSchema,
  created_at: z.string(),
});

const e1rmSnapshotRowSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  exercise_id: z.string(),
  e1rm: z.number(),
  cycle_index: z.number().int(),
  week_in_cycle: z.number().int(),
});

const cycleRowSchema = z.object({
  cycle_index: z.number().int(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  programme_id: z.string().nullable(),
  review: cycleReviewSchema.nullable(),
});

// =============================================================================
// Snapshot global
// =============================================================================

export const demoSnapshotSchema = z.object({
  /** Persona affiché dans la welcome overlay et la checklist. */
  persona: z.object({
    id: z.literal('alex'),
    label: z.string(),
    summary: z.string(),
  }),
  generated_at: z.string(),
  user_state: serializedUserStateSchema,
  history: z.object({
    sessions: z.array(sessionRowSchema),
    feedbacks: z.array(feedbackRowSchema),
    e1rmSnapshots: z.array(e1rmSnapshotRowSchema),
    cycles: z.array(cycleRowSchema),
  }),
});

export type DemoSnapshot = z.infer<typeof demoSnapshotSchema>;

/**
 * Parse + valide le JSON démo. Plante de façon explicite si la forme a dérivé.
 * À utiliser uniquement via `lib/demo.ts` (jamais en composant React directement).
 */
export function parseDemoSnapshot(raw: unknown): DemoSnapshot {
  return demoSnapshotSchema.parse(raw);
}
