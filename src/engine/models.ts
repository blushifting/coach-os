/**
 * Types du domaine Coach OS — port 1:1 de prototype/coach_os/models.py.
 *
 * Tous les types métier sont ici. Les modules suivants (prescription, feedback,
 * volume, selection, engine, balance, split, cycle_planner, lifecycle,
 * guided_programs) consomment ces structures sans en définir.
 *
 * Convention de port :
 *   - Python `Enum(str, Enum)` → enum TS string-valued.
 *   - Python `@dataclass(frozen=True)` immuable → `interface` + factory `makeXxx`.
 *   - Python `@dataclass` mutable → `interface` + factory avec valeurs par défaut.
 *   - `tuple[...]` Python → `readonly [...]` TS si arité fixe, sinon `readonly T[]`.
 */

// =============================================================================
// Enums
// =============================================================================

export enum Sex {
  HOMME = 'homme',
  FEMME = 'femme',
}

export enum Level {
  DEBUTANT = 'debutant',
  INTERMEDIAIRE = 'intermediaire',
  AVANCE = 'avance',
}

/**
 * Objectif global du profil utilisateur (path "rapide" de l'onboarding).
 * Conservé pour rétrocompat. Pour les décisions algorithmiques fines (par muscle),
 * voir `MuscleObjective`. Puissance retirée en V1 (cf. 09 §3.5).
 */
export enum Objective {
  HYPERTROPHIE = 'hypertrophie',
  FORCE = 'force',
  ENDURANCE = 'endurance',
}

/**
 * Objectif appliqué à un muscle dans le nouveau modèle (cf. 09 §2.1).
 * MAINTIEN n'existe pas au niveau profil global (un user ne peut pas vouloir
 * "maintenir tous ses muscles" comme objectif principal — c'est un statut
 * par muscle).
 */
export enum MuscleObjective {
  FORCE = 'force',
  HYPERTROPHIE = 'hypertrophie',
  ENDURANCE = 'endurance',
  MAINTIEN = 'maintien',
}

/** Statut algorithmique d'un muscle dans le programme courant (cf. 09 §3.1). */
export enum MuscleStatus {
  PRIORITAIRE = 'prioritaire',
  SUGGERE = 'suggere',
  NON_COUVERT = 'non_couvert',
}

/** Règle de progression hebdo d'un PlannedExercise (cf. 09 §2.1). */
export enum ProgressionRule {
  LINEAR_2_5KG = 'linear_2_5kg',
  DOUBLE_PROGRESSION = 'double_progression',
  WAVE_5_3_1 = 'wave_5_3_1',
  AMRAP_LP = 'amrap_lp',
  ISRAETEL_VOLUME = 'israetel_volume',
}

/** Action suggérée en fin de cycle (cf. 09 §8.3). */
export enum SuggestedAction {
  CONTINUER_PAREIL = 'continuer',
  AJUSTER_OBJECTIFS = 'ajuster',
  TOURNER_EMPHASIS = 'tourner',
  CHANGER_PROGRAMME = 'changer',
}

export enum Pattern {
  SQUAT = 'squat',
  HINGE = 'hinge',
  LUNGE = 'lunge',
  PUSH_H = 'push_h',
  PUSH_V = 'push_v',
  PULL_H = 'pull_h',
  PULL_V = 'pull_v',
  ISOLATION = 'isolation',
  CORE = 'core',
}

export enum ExType {
  COMPOUND = 'compound',
  ISOLATION = 'isolation',
}

export enum ChargeType {
  BARBELL = 'barbell',
  DUMBBELL = 'dumbbell',
  MACHINE_STACK = 'machine_stack',
  CABLE = 'cable',
  BODYWEIGHT = 'bodyweight',
  BODYWEIGHT_LOADED = 'bodyweight_loaded',
  BODYWEIGHT_ASSISTED = 'bodyweight_assisted',
}

export enum E1RMApp {
  FULL = 'full',
  PARTIAL = 'partial',
  NON = 'non',
}

// Mapping legacy Objective → MuscleObjective (cf. 09 §2.7).
const LEGACY_TO_MUSCLE: Record<Objective, MuscleObjective> = {
  [Objective.FORCE]: MuscleObjective.FORCE,
  [Objective.HYPERTROPHIE]: MuscleObjective.HYPERTROPHIE,
  [Objective.ENDURANCE]: MuscleObjective.ENDURANCE,
};

/** Convertit un Objective global en MuscleObjective. */
export function objectiveToMuscleObjective(obj: Objective): MuscleObjective {
  return LEGACY_TO_MUSCLE[obj];
}

// Liste canonique des 15 muscles cibles (cf. 06 §1.3, 03 §8.1).
export const MUSCLES = [
  'pectoraux',
  'dos_largeur',
  'dos_epaisseur',
  'trapezes_hauts',
  'quadriceps',
  'ischios',
  'fessiers',
  'mollets',
  'deltos_lateraux',
  'deltos_posterieurs',
  'biceps',
  'triceps',
  'abdos',
  'obliques',
  'lombaires',
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const SYNERGISTES_SANS_QUOTA = ['deltos_anterieurs'] as const;

// =============================================================================
// Exercice (immuable, chargé depuis exercises.json)
// =============================================================================

export interface Exercise {
  readonly id: string;
  readonly nom_fr: string;
  readonly pattern: Pattern;
  readonly type: ExType;
  readonly charge: ChargeType;
  readonly equip: readonly string[];
  readonly uni: boolean;
  readonly muscles: Readonly<Record<string, number>>;
  readonly subst: string;
  readonly inc_kg: number;
  readonly reps_hyp: readonly [number, number];
  readonly reps_force: readonly [number, number] | null;
  readonly repos_s: number;
  readonly dif: string;
  readonly e1RM_app: E1RMApp;
  readonly tags: readonly string[];
  readonly note: string;
  readonly synonymes: readonly string[];
}

/** Forme brute d'un exo telle qu'on la lit dans exercises.json. */
export interface ExerciseDict {
  id: string;
  nom_fr: string;
  pattern: string;
  type: string;
  charge: string;
  equip?: string[] | null;
  uni?: boolean;
  muscles: Record<string, number>;
  subst: string;
  inc_kg: number;
  reps_hyp: [number, number] | number[];
  reps_force?: [number, number] | number[] | null;
  repos_s: number;
  dif: string;
  e1RM_app: string;
  tags?: string[] | null;
  note?: string | null;
  synonymes?: string[] | null;
}

/** Construit un Exercise validé à partir d'un dict brut JSON. */
export function exerciseFromDict(d: ExerciseDict): Exercise {
  const repsHyp = d.reps_hyp;
  if (repsHyp.length !== 2) {
    throw new Error(`reps_hyp doit avoir 2 entrées (id=${d.id})`);
  }
  let repsForce: readonly [number, number] | null = null;
  if (d.reps_force) {
    if (d.reps_force.length !== 2) {
      throw new Error(`reps_force doit avoir 2 entrées si présent (id=${d.id})`);
    }
    repsForce = [d.reps_force[0]!, d.reps_force[1]!] as const;
  }
  return {
    id: d.id,
    nom_fr: d.nom_fr,
    pattern: d.pattern as Pattern,
    type: d.type as ExType,
    charge: d.charge as ChargeType,
    equip: Object.freeze([...(d.equip ?? [])]),
    uni: Boolean(d.uni ?? false),
    muscles: Object.freeze({ ...d.muscles }),
    subst: d.subst,
    inc_kg: Number(d.inc_kg),
    reps_hyp: [repsHyp[0]!, repsHyp[1]!] as const,
    reps_force: repsForce,
    repos_s: Math.trunc(d.repos_s),
    dif: d.dif,
    e1RM_app: d.e1RM_app as E1RMApp,
    tags: Object.freeze([...(d.tags ?? [])]),
    note: d.note ?? '',
    synonymes: Object.freeze([...(d.synonymes ?? [])]),
  };
}

/** Muscles primaires (coefficient ≥ 1.0). */
export function exercisePrimaires(ex: Exercise): string[] {
  return Object.entries(ex.muscles)
    .filter(([, c]) => c >= 1.0)
    .map(([m]) => m);
}

/** Muscles synergistes (0 < coefficient < 1.0). */
export function exerciseSynergistes(ex: Exercise): string[] {
  return Object.entries(ex.muscles)
    .filter(([, c]) => c > 0 && c < 1.0)
    .map(([m]) => m);
}

// =============================================================================
// Profil utilisateur (statique, modifiable hors séance)
// =============================================================================

export interface Profile {
  sex: Sex;
  age: number;
  level: Level;
  objective: Objective;
  /** 2..6 */
  sessions_per_week: number;
  bodyweight_kg: number;
  available_equip: Set<string>;
}

export interface ProfileInput {
  sex: Sex;
  age: number;
  level: Level;
  objective: Objective;
  sessions_per_week: number;
  bodyweight_kg: number;
  available_equip?: Set<string> | Iterable<string>;
}

/** Construit un Profile en validant les invariants (port de `Profile.__post_init__`). */
export function makeProfile(input: ProfileInput): Profile {
  if (!(input.age >= 14 && input.age <= 100)) {
    throw new Error(`Âge hors plage : ${input.age}`);
  }
  if (!(input.sessions_per_week >= 2 && input.sessions_per_week <= 6)) {
    throw new Error(`Séances/sem hors plage : ${input.sessions_per_week}`);
  }
  if (input.bodyweight_kg <= 0) {
    throw new Error('Poids du corps doit être > 0');
  }
  return {
    sex: input.sex,
    age: input.age,
    level: input.level,
    objective: input.objective,
    sessions_per_week: input.sessions_per_week,
    bodyweight_kg: input.bodyweight_kg,
    available_equip: new Set(input.available_equip ?? []),
  };
}

// =============================================================================
// Prescription d'une série (output algo)
// =============================================================================

export interface SetPrescription {
  exercise_id: string;
  reps: number;
  load_kg: number;
  rpe_target: number;
  rest_s: number;
}

/** Un exercice planifié dans une séance, avec ses N séries prescrites. */
export interface SessionItem {
  exercise_id: string;
  sets: SetPrescription[];
}

export interface SessionPlan {
  /** Date ISO (YYYY-MM-DD) — port du `datetime.date` Python. */
  seance_date: string;
  week_in_cycle: number;
  cycle_index: number;
  rpe_target: number;
  items: SessionItem[];
  label: string;
}

// =============================================================================
// Feedback (input utilisateur)
// =============================================================================

export interface SetFeedback {
  exercise_id: string;
  reps_done: number;
  load_kg: number;
  rpe_perceived: number;
}

export interface SessionFeedback {
  seance_date: string;
  week_in_cycle: number;
  cycle_index: number;
  rpe_target: number;
  sets: SetFeedback[];
  label: string;
}

// =============================================================================
// Objectif par muscle (cf. 09 §2.2 et §3)
// =============================================================================

/**
 * Objectif appliqué à un muscle dans le programme courant.
 * `priority_rank` : 1 = plus haute priorité parmi les PRIORITAIRES.
 * SUGGERE et NON_COUVERT ont rank = 99 par convention.
 */
export interface MuscleGoal {
  muscle: string;
  objective: MuscleObjective;
  status: MuscleStatus;
  priority_rank: number;
}

export interface MuscleGoalInput {
  muscle: string;
  objective: MuscleObjective;
  status: MuscleStatus;
  priority_rank?: number;
}

export function makeMuscleGoal(input: MuscleGoalInput): MuscleGoal {
  return {
    muscle: input.muscle,
    objective: input.objective,
    status: input.status,
    priority_rank: input.priority_rank ?? 99,
  };
}

// =============================================================================
// Programme : WeeklyTemplate, DayTemplate, PlannedExercise (cf. 09 §2.3)
// =============================================================================

/**
 * Un exercice planifié sur 5 semaines.
 * `progression` : nb séries par semaine, longueur 5 ([w1, w2, w3, w4, w5_deload]).
 * `role` : non null pour exos de programmes guidés (ex. "main_squat").
 * `intensity_scheme` : non null si schéma d'intensité spécifique.
 */
export interface PlannedExercise {
  exercise_id: string;
  base_sets: number;
  progression: number[];
  role: string | null;
  intensity_scheme: string | null;
  progression_rule: ProgressionRule | null;
}

export interface PlannedExerciseInput {
  exercise_id: string;
  base_sets: number;
  progression: number[];
  role?: string | null;
  intensity_scheme?: string | null;
  progression_rule?: ProgressionRule | null;
}

export function makePlannedExercise(input: PlannedExerciseInput): PlannedExercise {
  return {
    exercise_id: input.exercise_id,
    base_sets: input.base_sets,
    progression: [...input.progression],
    role: input.role ?? null,
    intensity_scheme: input.intensity_scheme ?? null,
    progression_rule: input.progression_rule ?? null,
  };
}

export interface DayTemplate {
  day_index: number;
  label: string;
  target_muscles_focus: string[];
  exercises: PlannedExercise[];
}

/** Structure figée pour 1 cycle (4 progression + 1 déload) — cf. 09 §1.1. */
export interface WeeklyTemplate {
  cycle_index: number;
  rationale: string;
  days: DayTemplate[];
  requires_calibration: boolean;
  warnings: string[];
}

export interface WeeklyTemplateInput {
  cycle_index: number;
  rationale: string;
  days?: DayTemplate[];
  requires_calibration?: boolean;
  warnings?: string[];
}

export function makeWeeklyTemplate(input: WeeklyTemplateInput): WeeklyTemplate {
  return {
    cycle_index: input.cycle_index,
    rationale: input.rationale,
    days: input.days ?? [],
    requires_calibration: input.requires_calibration ?? false,
    warnings: input.warnings ?? [],
  };
}

/** Nb séances prévues sur les 5 semaines du cycle. */
export function weeklyTemplateSessionsPlanned(wt: WeeklyTemplate): number {
  return wt.days.length * 5;
}

// =============================================================================
// Programmes guidés (cf. 09 §2.4)
// =============================================================================

/**
 * Slot d'exercice dans un programme guidé.
 * `fallback_subst` : sous-ensemble strict du `groupe_substitution` du catalogue,
 *                    validé par les concepteurs du programme.
 * `is_replaceable` : false = exo structurel, programme non-adaptable si indispo.
 */
export interface CanonicalExercise {
  readonly role: string;
  readonly preferred_id: string;
  readonly fallback_subst: readonly string[];
  readonly sets: number;
  readonly reps_scheme: string;
  readonly intensity_scheme: string;
  readonly is_replaceable: boolean;
}

export interface CanonicalExerciseInput {
  role: string;
  preferred_id: string;
  fallback_subst: readonly string[] | string[];
  sets: number;
  reps_scheme: string;
  intensity_scheme: string;
  is_replaceable?: boolean;
}

export function makeCanonicalExercise(input: CanonicalExerciseInput): CanonicalExercise {
  return Object.freeze({
    role: input.role,
    preferred_id: input.preferred_id,
    fallback_subst: Object.freeze([...input.fallback_subst]),
    sets: input.sets,
    reps_scheme: input.reps_scheme,
    intensity_scheme: input.intensity_scheme,
    is_replaceable: input.is_replaceable ?? true,
  });
}

export interface GuidedDayTemplate {
  readonly label: string;
  readonly canonical_exercises: readonly CanonicalExercise[];
}

/** Programme guidé prefab (Starting Strength, 5/3/1, PPL Nippard, etc.). */
export interface GuidedProgram {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly source: string;
  readonly sessions_per_week: number;
  readonly public_cible: readonly Level[];
  readonly objectifs_principaux: readonly MuscleObjective[];
  readonly cycle_length_weeks: number;
  readonly days: readonly GuidedDayTemplate[];
  readonly progression_rule: ProgressionRule;
  readonly notes: string;
}

// =============================================================================
// Bilan de fin de cycle (cf. 09 §2.5)
// =============================================================================

export interface CycleReview {
  cycle_index: number;
  /** ex_id → Δe1RM kg sur le cycle */
  plafonds_progression: Record<string, number>;
  muscles_progresses: string[];
  muscles_plateau: string[];
  muscles_undertrained: string[];
  muscles_overshoot: string[];
  adherence_pct: number;
  volume_total_kg: number;
  PRs: Array<[string, number]>;
  suggested_action: SuggestedAction;
  warnings: string[];
}

export interface CycleReviewInput {
  cycle_index: number;
  plafonds_progression: Record<string, number>;
  muscles_progresses: string[];
  muscles_plateau: string[];
  muscles_undertrained: string[];
  muscles_overshoot: string[];
  adherence_pct: number;
  volume_total_kg: number;
  PRs: Array<[string, number]>;
  suggested_action: SuggestedAction;
  warnings?: string[];
}

export function makeCycleReview(input: CycleReviewInput): CycleReview {
  return {
    ...input,
    warnings: input.warnings ?? [],
  };
}

// =============================================================================
// Override équipement par utilisateur (incréments réels en salle)
// =============================================================================

/**
 * Surcharge des paramètres d'équipement par exo, propre à la salle de l'user.
 * Reflète les incréments réellement disponibles : machine qui incrémente
 * de 5 kg, haltères par paliers de 1 kg, pile de poids 4,5 kg, etc.
 * Si un champ est null, on retombe sur la valeur du catalogue.
 */
export interface EquipmentOverride {
  inc_kg: number | null;
  min_load_kg: number | null;
  max_load_kg: number | null;
}

export function makeEquipmentOverride(
  input: Partial<EquipmentOverride> = {},
): EquipmentOverride {
  return {
    inc_kg: input.inc_kg ?? null,
    min_load_kg: input.min_load_kg ?? null,
    max_load_kg: input.max_load_kg ?? null,
  };
}

// =============================================================================
// État utilisateur (dynamique, mis à jour après chaque séance)
// =============================================================================

export interface UserState {
  profile: Profile;
  /** par exercise_id */
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
  // --- algo de programmation (cf. 09 §2.6) ---
  muscle_goals: Record<string, MuscleGoal>;
  current_cycle_plan: WeeklyTemplate | null;
  active_guided_program_id: string | null;
  recovery_mode: boolean;
  recovery_weeks_remaining: number;
  // --- override équipement par exo ---
  equipment_overrides: Record<string, EquipmentOverride>;
}

export function makeUserState(profile: Profile): UserState {
  return {
    profile,
    e1rm: {},
    k_user: {},
    reps_pr: {},
    volume_min: {},
    volume_max: {},
    current_week_in_cycle: 1,
    cycle_index: 1,
    plateau_counter: {},
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {},
    current_cycle_plan: null,
    active_guided_program_id: null,
    recovery_mode: false,
    recovery_weeks_remaining: 0,
    equipment_overrides: {},
  };
}
