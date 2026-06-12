/**
 * Schéma Zod du fichier d'export/import JSON.
 *
 * Stratégie : validation **structurelle stricte** au top-level (version,
 * sections, types de surface) + validation forte des enums du `Profile`.
 * Les blobs internes (history, current_cycle_plan, plan, feedback, review)
 * sont acceptés en objects génériques — le moteur les revalide à l'usage
 * via ses factories. Ça suffit pour rejeter un fichier non-Coach-OS sans
 * dupliquer toute la grammaire des types métier.
 */

import { z } from 'zod';
import { Level, MuscleObjective, MuscleStatus, Objective, Sex } from '@/engine/models';
import type {
  CycleRow,
  E1rmSnapshotRow,
  EquipmentOverrideRow,
  FeedbackRow,
  SerializedUserState,
  SessionRow,
  UserAddedExerciseRow,
} from '@/db/schema';

export const EXPORT_VERSION = 1 as const;
export const APP_NAME = 'coach-os' as const;

const profileSchema = z
  .object({
    sex: z.nativeEnum(Sex),
    age: z.number().int().min(14).max(100),
    level: z.nativeEnum(Level),
    objective: z.nativeEnum(Objective),
    sessions_per_week: z.number().int().min(2).max(6),
    bodyweight_kg: z.number().positive(),
    available_equip: z.array(z.string()),
    // Conv #22 — optionnels pour rétrocompat exports antérieurs.
    duration_category: z.string().optional(),
    equipment_preference: z.string().optional(),
    // Conv #23 — marque salle (libellés affichés des exos machine).
    gym_brand: z.string().optional(),
  })
  .strict();

const muscleGoalSchema = z
  .object({
    muscle: z.string(),
    objective: z.nativeEnum(MuscleObjective),
    status: z.nativeEnum(MuscleStatus),
    priority_rank: z.number().int(),
  })
  .strict();

const recordOfNumber = z.record(z.string(), z.number());
const recordOfString = z.record(z.string(), z.string());

const userStateSchema = z
  .object({
    profile: profileSchema,
    e1rm: recordOfNumber,
    k_user: recordOfNumber,
    reps_pr: recordOfNumber,
    volume_min: recordOfNumber,
    volume_max: recordOfNumber,
    current_week_in_cycle: z.number().int().min(1).max(5),
    cycle_index: z.number().int().min(1),
    plateau_counter: recordOfNumber,
    history: z.array(z.object({}).passthrough()),
    last_used_for_muscle: recordOfString,
    muscle_goals: z.record(z.string(), muscleGoalSchema),
    current_cycle_plan: z.union([z.null(), z.object({}).passthrough()]),
    active_guided_program_id: z.union([z.null(), z.string()]),
    recovery_mode: z.boolean(),
    recovery_weeks_remaining: z.number().int().min(0),
    equipment_overrides: z.record(
      z.string(),
      z
        .object({
          inc_kg: z.number().nullable(),
          min_load_kg: z.number().nullable(),
          max_load_kg: z.number().nullable(),
          // Conv #20 — optionnel pour rétrocompat exports antérieurs.
          pdc_only: z.boolean().nullable().optional(),
        })
        .strict(),
    ),
    // Conv #11a : optionnel pour rétrocompat avec exports antérieurs.
    weekly_volume_debt: recordOfNumber.optional(),
    // Conv #22 — optionnels pour rétrocompat exports antérieurs.
    current_skeleton: z.union([z.null(), z.object({}).passthrough()]).optional(),
    favorite_exercise_per_pattern: recordOfString.optional(),
    deload_strategy: z.union([z.null(), z.string()]).optional(),
  })
  .strict();

const sessionStatusSchema = z.enum(['planned', 'completed', 'skipped']);

const sessionRowSchema = z.object({
  id: z.number().int().optional(),
  seance_date: z.string(),
  week_in_cycle: z.number().int(),
  cycle_index: z.number().int(),
  plan: z.object({}).passthrough(),
  status: sessionStatusSchema,
  created_at: z.string(),
});

const feedbackRowSchema = z.object({
  id: z.number().int().optional(),
  session_id: z.number().int().nullable(),
  seance_date: z.string(),
  cycle_index: z.number().int(),
  week_in_cycle: z.number().int(),
  feedback: z.object({}).passthrough(),
  created_at: z.string(),
});

const e1rmSnapshotRowSchema = z.object({
  id: z.number().int().optional(),
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
  review: z.union([z.null(), z.object({}).passthrough()]),
});

const equipmentOverrideRowSchema = z.object({
  exercise_id: z.string(),
  inc_kg: z.number().nullable(),
  min_load_kg: z.number().nullable(),
  max_load_kg: z.number().nullable(),
  pdc_only: z.boolean().nullable().optional(),
});

const userAddedExerciseRowSchema = z.object({
  exercise_id: z.string(),
  exercise_dict: z.object({}).passthrough(),
  added_at: z.string(),
});

export const exportSchema = z
  .object({
    version: z.literal(EXPORT_VERSION),
    appName: z.literal(APP_NAME),
    exportedAt: z.string(),
    data: z
      .object({
        userState: userStateSchema.nullable(),
        sessions: z.array(sessionRowSchema),
        feedbacks: z.array(feedbackRowSchema),
        e1rmSnapshots: z.array(e1rmSnapshotRowSchema),
        cycles: z.array(cycleRowSchema),
        equipmentOverrides: z.array(equipmentOverrideRowSchema),
        userAddedExercises: z.array(userAddedExerciseRowSchema),
      })
      .strict(),
  })
  .strict();

/**
 * Type *produit* (forme runtime). Les blobs internes (history,
 * current_cycle_plan, plan, feedback, review, exercise_dict) sont validés
 * structurellement par Zod en `passthrough`, mais le type exposé reflète
 * leur vraie forme métier — le cast après `parseExportPayload` est sûr.
 */
export interface ExportPayload {
  version: typeof EXPORT_VERSION;
  appName: typeof APP_NAME;
  exportedAt: string;
  data: {
    userState: SerializedUserState | null;
    sessions: SessionRow[];
    feedbacks: FeedbackRow[];
    e1rmSnapshots: E1rmSnapshotRow[];
    cycles: CycleRow[];
    equipmentOverrides: EquipmentOverrideRow[];
    userAddedExercises: UserAddedExerciseRow[];
  };
}
