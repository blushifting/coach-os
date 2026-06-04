/**
 * Schéma Dexie v1 — Coach OS.
 *
 * Stratégie hybride :
 * - `userState` (singleton id=1) = blob JSON sérialisé du `UserState` complet,
 *   source de vérité du moteur (cf. `engine/engine.ts`). Permet à `useEngine`
 *   d'appeler les fonctions du moteur sans recomposer l'état depuis 7 tables.
 * - Tables relationnelles append-only / dérivées (`sessions`, `feedbacks`,
 *   `e1rmSnapshots`, `cycles`) = vues pour l'UI Progrès, écrites dans la même
 *   transaction que le blob.
 * - Tables d'input externalisées (`equipmentOverrides`, `userAddedExercises`)
 *   éditables depuis la page Profil sans recharger tout l'état.
 *
 * Toute mutation passe par les repositories (`db/repositories/*`) qui ouvrent
 * une transaction multi-tables pour garantir l'atomicité blob ↔ dérivées.
 */

import Dexie, { type Table } from 'dexie';
import type {
  CycleReview,
  EquipmentOverride,
  ExerciseDict,
  SessionFeedback,
  SessionPlan,
} from '@/engine/models';

// =============================================================================
// Forme sérialisable de UserState
// =============================================================================

/**
 * `Profile.available_equip` est un `Set<string>` (non sérialisable JSON).
 * À la sérialisation : `Set` → `string[]`. À la lecture : `string[]` → `Set`.
 * Tout le reste de UserState est déjà JSON-sérialisable.
 */
export interface SerializedProfile {
  sex: string;
  age: number;
  level: string;
  objective: string;
  sessions_per_week: number;
  bodyweight_kg: number;
  available_equip: string[];
  /** Conv #22 — durée MAX par séance (path co-construit). Absent sur anciens blobs. */
  duration_category?: string;
}

export interface SerializedUserState {
  profile: SerializedProfile;
  e1rm: Record<string, number>;
  k_user: Record<string, number>;
  reps_pr: Record<string, number>;
  volume_min: Record<string, number>;
  volume_max: Record<string, number>;
  current_week_in_cycle: number;
  cycle_index: number;
  plateau_counter: Record<string, number>;
  history: SessionFeedback[];
  last_used_for_muscle: Record<string, string>;
  muscle_goals: Record<
    string,
    { muscle: string; objective: string; status: string; priority_rank: number }
  >;
  current_cycle_plan: import('@/engine/models').WeeklyTemplate | null;
  active_guided_program_id: string | null;
  recovery_mode: boolean;
  recovery_weeks_remaining: number;
  equipment_overrides: Record<string, EquipmentOverride>;
  /** Dette de volume non réalisée cette semaine (Conv #11a). Absent sur les anciens blobs. */
  weekly_volume_debt?: Record<string, number>;
  /** Routine fixée par jour de la semaine (Conv #18). Absent sur les anciens blobs. */
  fixed_routine?: Record<string, number>;
  /** Conv #22 — squelette du cycle courant (path co-construit). Absent sur anciens blobs. */
  current_skeleton?: import('@/engine/models').SkeletonTemplate | null;
  /** Conv #22 — exos préférés par pattern. Absent sur anciens blobs. */
  favorite_exercise_per_pattern?: Record<string, string>;
  /** Conv #22 (H) — stratégie de déload pour la sem 5. Absent sur anciens blobs. */
  deload_strategy?: string | null;
}

// =============================================================================
// Lignes des tables Dexie
// =============================================================================

/** Singleton (id = 1). */
export interface UserStateRow {
  id: 1;
  state: SerializedUserState;
  updated_at: string;
}

export type SessionStatus = 'planned' | 'completed' | 'skipped';

export interface SessionRow {
  id?: number;
  seance_date: string;
  week_in_cycle: number;
  cycle_index: number;
  plan: SessionPlan;
  status: SessionStatus;
  created_at: string;
}

export interface FeedbackRow {
  id?: number;
  session_id: number | null;
  seance_date: string;
  cycle_index: number;
  week_in_cycle: number;
  feedback: SessionFeedback;
  created_at: string;
}

export interface E1rmSnapshotRow {
  id?: number;
  date: string;
  exercise_id: string;
  e1rm: number;
  cycle_index: number;
  week_in_cycle: number;
}

export interface CycleRow {
  cycle_index: number;
  start_date: string;
  end_date: string | null;
  programme_id: string | null;
  review: CycleReview | null;
}

export interface EquipmentOverrideRow {
  exercise_id: string;
  inc_kg: number | null;
  min_load_kg: number | null;
  max_load_kg: number | null;
  /** Conv #20 — mode "poids du corps seulement" pour exos BW_LOADED/ASSISTED. */
  pdc_only: boolean | null;
}

export interface UserAddedExerciseRow {
  exercise_id: string;
  exercise_dict: ExerciseDict;
  added_at: string;
}

// =============================================================================
// Base Dexie
// =============================================================================

export const DB_NAME = 'coach-os';
export const DB_VERSION = 1;

export class CoachOsDb extends Dexie {
  userState!: Table<UserStateRow, 1>;
  sessions!: Table<SessionRow, number>;
  feedbacks!: Table<FeedbackRow, number>;
  e1rmSnapshots!: Table<E1rmSnapshotRow, number>;
  cycles!: Table<CycleRow, number>;
  equipmentOverrides!: Table<EquipmentOverrideRow, string>;
  userAddedExercises!: Table<UserAddedExerciseRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores({
      userState: 'id',
      sessions: '++id, seance_date, cycle_index, [cycle_index+week_in_cycle], status',
      feedbacks: '++id, session_id, seance_date, cycle_index',
      e1rmSnapshots: '++id, date, exercise_id, [exercise_id+date], cycle_index',
      cycles: 'cycle_index, start_date',
      equipmentOverrides: 'exercise_id',
      userAddedExercises: 'exercise_id, added_at',
    });
  }
}

let _instance: CoachOsDb | null = null;

/** Instance singleton de la DB applicative (paresseuse). */
export function getDb(): CoachOsDb {
  if (_instance === null) {
    _instance = new CoachOsDb();
  }
  return _instance;
}

/** Réinitialise l'instance (réservé aux tests). */
export function resetDbInstance(): void {
  if (_instance !== null) {
    _instance.close();
    _instance = null;
  }
}
