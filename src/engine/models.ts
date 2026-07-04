/**
 * Types du domaine Coach OS.
 *
 * Tous les types métier sont ici. Les modules suivants (prescription, feedback,
 * volume, selection, engine, balance, split, cycle_planner, lifecycle)
 * consomment ces structures sans en définir.
 */

// =============================================================================
// Enums
// =============================================================================

export enum Sex {
  HOMME = 'homme',
  FEMME = 'femme',
}

/**
 * @deprecated Conv #22 — Le niveau (Débutant/Inter/Avancé) est retiré du
 * nouveau modèle de programmation. L'enum est conservé pour rétrocompat
 * des UserStates persistés et tests legacy. Le nouveau path
 * (skeleton_builder + sets_allocator) ne lit jamais `profile.level` ;
 * il utilise des valeurs standards uniques et laisse l'auto-calibration
 * (`adjust_volume_bounds_at_cycle_end`) ajuster cycle après cycle.
 */
export enum Level {
  DEBUTANT = 'debutant',
  INTERMEDIAIRE = 'intermediaire',
  AVANCE = 'avance',
}

/**
 * Conv #22 — Catégorie de durée MAX par séance (input user, étape C de
 * l'onboarding). La valeur sert de **plafond** au choix du split et au
 * solveur de séries : on dimensionne sur la demande effective (Σ patterns
 * nécessaires aux prios + R1-R4), et on alerte si le programme tient
 * largement en dessous (sous-utilisation) pour proposer prio++ ou durée--.
 *
 * Mapping nb max patterns/séance (cf. estimation ~12 min/pattern, Conv #19) :
 *   SHORT  → 4 patterns (~50 min)
 *   MEDIUM → 6 patterns (~75 min)
 *   LONG   → 8 patterns (~100 min)
 */
export enum DurationCategory {
  SHORT = 'short',   // ≤ 1h
  MEDIUM = 'medium', // ≤ 1h30
  LONG = 'long',     // ≤ 2h
}

/** Plafond max patterns / séance par catégorie de durée. */
export const MAX_PATTERNS_PER_SESSION: Record<DurationCategory, number> = {
  [DurationCategory.SHORT]: 4,
  [DurationCategory.MEDIUM]: 6,
  [DurationCategory.LONG]: 8,
};

/**
 * Conv #22 / #29 — Préférence d'équipement de l'utilisateur. Les trois
 * premières valeurs sont des contraintes STRICTES (« uniquement ») : à
 * l'auto-sélection des exos, on ne pioche QUE dans le type de charge demandé
 * (cf. `chargesForPreference`). L'user reste libre de swap manuellement ensuite.
 *
 *   MACHINES        → machines guidées + poulies (câbles) uniquement.
 *   FREE_WEIGHTS    → haltères + barre uniquement.
 *   BODYWEIGHT      → poids du corps strict : aucun matériel (donc pas de
 *                     lesté/assisté qui requièrent barre/ceinture/machine).
 *   NO_PREFERENCE   → défaut, aucune restriction : l'app choisit la convention
 *                     salle classique (poids libres sur les compounds,
 *                     machines/câbles sur les isolations).
 */
export enum EquipmentPreference {
  MACHINES = 'machines',
  FREE_WEIGHTS = 'free_weights',
  BODYWEIGHT = 'bodyweight',
  NO_PREFERENCE = 'no_preference',
}

/**
 * Marque d'équipement de la salle de l'utilisateur (Conv #23, item O).
 *
 * Optionnelle, affecte uniquement les **intitulés affichés** des exos
 * machine (et indirectement la recherche fuzzy via les synonymes
 * existants). Aucun effet sur l'algo. `NONE` = libellés génériques FR
 * actuels (« Développé machine », « Tirage vertical poulie haute »…).
 *
 * Les marques retenues couvrent l'essentiel du marché FR :
 * - Technogym : Fitness Park (mixte), Keepcool, L'Orange Bleue, L'Appart
 *   Fitness, Magic Form (équipements complémentaires), CMG.
 * - Hammer Strength : Fitness Park (zone strength), salles premium.
 * - Matrix : Magic Form, certaines indé.
 * - Life Fitness : Basic-Fit, salles hôtels.
 * - Cybex : CMG, salles haut de gamme.
 * - Nautilus : historique, glute drive principalement.
 */
export enum GymBrand {
  NONE = 'none',
  TECHNOGYM = 'technogym',
  HAMMER_STRENGTH = 'hammer_strength',
  MATRIX = 'matrix',
  LIFE_FITNESS = 'life_fitness',
  CYBEX = 'cybex',
  NAUTILUS = 'nautilus',
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
  DOUBLE_PROGRESSION = 'double_progression',
  // Bloc O — LINEAR_2_5KG / WAVE_5_3_1 / AMRAP_LP retirés avec les programmes
  // tout faits (schémas non-RPE). Seul ISRAETEL_VOLUME alimente le custom.
  ISRAETEL_VOLUME = 'israetel_volume',
}

/** Action suggérée en fin de cycle (cf. 09 §8.3). */
export enum SuggestedAction {
  CONTINUER_PAREIL = 'continuer',
  AJUSTER_OBJECTIFS = 'ajuster',
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

/**
 * Conv #29 — Types de charge autorisés pour une préférence STRICTE.
 * Renvoie `null` pour NO_PREFERENCE/undefined (= aucune restriction).
 * Le poids du corps lesté/assisté (BODYWEIGHT_LOADED/ASSISTED) n'entre dans
 * aucune catégorie stricte : il requiert barre/ceinture/machine d'assistance.
 */
export function chargesForPreference(
  pref: EquipmentPreference | undefined,
): ReadonlySet<ChargeType> | null {
  switch (pref) {
    case EquipmentPreference.MACHINES:
      return new Set([ChargeType.MACHINE_STACK, ChargeType.CABLE]);
    case EquipmentPreference.FREE_WEIGHTS:
      return new Set([ChargeType.BARBELL, ChargeType.DUMBBELL]);
    case EquipmentPreference.BODYWEIGHT:
      return new Set([ChargeType.BODYWEIGHT]);
    default:
      return null;
  }
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
  /** @deprecated Conv #22 — non lu par le nouveau path, conservé pour rétrocompat. */
  level: Level;
  objective: Objective;
  /** 2..6 */
  sessions_per_week: number;
  bodyweight_kg: number;
  /**
   * @deprecated Conv #22 — l'équipement est retiré du nouveau path
   * (co-construction implicite via choix d'exos). Conservé pour rétrocompat
   * tant que l'UI legacy / programmes guidés legacy s'en servent.
   */
  available_equip: Set<string>;
  /**
   * Conv #22 — durée MAX par séance, input user étape C onboarding.
   * Optionnel pour rétrocompat (UserStates pre-Conv#22 n'en ont pas).
   */
  duration_category?: DurationCategory;
  /**
   * Conv #22 — Préférence machines / poids libres / aucune préférence.
   * Sert au tri auto des exos à l'onboarding. Optionnel pour rétrocompat.
   */
  equipment_preference?: EquipmentPreference;
  /**
   * Conv #23 — Marque dominante d'équipement de la salle. Affecte
   * uniquement l'affichage des intitulés (« Matrix Chest Press » au
   * lieu de « Développé machine »). Optionnel pour rétrocompat ;
   * `undefined` ou `NONE` = libellés génériques.
   */
  gym_brand?: GymBrand;
}

export interface ProfileInput {
  sex: Sex;
  age: number;
  level: Level;
  objective: Objective;
  sessions_per_week: number;
  bodyweight_kg: number;
  available_equip?: Set<string> | Iterable<string>;
  duration_category?: DurationCategory;
  equipment_preference?: EquipmentPreference;
  gym_brand?: GymBrand;
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
  const profile: Profile = {
    sex: input.sex,
    age: input.age,
    level: input.level,
    objective: input.objective,
    sessions_per_week: input.sessions_per_week,
    bodyweight_kg: input.bodyweight_kg,
    available_equip: new Set(input.available_equip ?? []),
  };
  if (input.duration_category !== undefined) {
    profile.duration_category = input.duration_category;
  }
  if (input.equipment_preference !== undefined) {
    profile.equipment_preference = input.equipment_preference;
  }
  if (input.gym_brand !== undefined) {
    profile.gym_brand = input.gym_brand;
  }
  return profile;
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
  /**
   * Bloc G (Conv #32) — nom affiché choisi par l'utilisateur. Découplé du
   * `label` (qui porte l'identité de rotation A/B/C). Si présent, il prime sur
   * `formatSessionLabel(label)` à l'affichage. Absent sur les anciens blobs.
   */
  custom_name?: string | null;
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
  /**
   * Bloc G (Conv #32) — nom affiché choisi, recopié du `SessionPlan` au commit,
   * pour que le bilan/calendrier gardent le nom custom. Absent sur anciens blobs.
   */
  custom_name?: string | null;
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
  /**
   * Bloc G (Conv #32) — nom affiché choisi par l'utilisateur pour ce jour de
   * cycle. `label` garde l'identité de rotation A/B/C ; `custom_name` prime à
   * l'affichage (cf. `sessionDisplayName`). Absent sur anciens blobs.
   */
  custom_name?: string | null;
}

/** Structure figée pour 1 cycle (4 progression + 1 déload) — cf. 09 §1.1. */
export interface WeeklyTemplate {
  cycle_index: number;
  rationale: string;
  days: DayTemplate[];
  warnings: string[];
}

export interface WeeklyTemplateInput {
  cycle_index: number;
  rationale: string;
  days?: DayTemplate[];
  warnings?: string[];
}

export function makeWeeklyTemplate(input: WeeklyTemplateInput): WeeklyTemplate {
  return {
    cycle_index: input.cycle_index,
    rationale: input.rationale,
    days: input.days ?? [],
    warnings: input.warnings ?? [],
  };
}

// =============================================================================
// Skeleton (Conv #22) — grille pattern × séance issue de l'étape D, remplie
// par l'user à l'étape E. Persiste à côté du WeeklyTemplate final pour
// permettre "Modifier la grille" et la régénération des séries (étape F).
// =============================================================================

/**
 * Hint sur le rôle attendu de l'exo qui remplira la case.
 * `compound` : 1er exo du pattern pour ce muscle prio (charge lourde, polyart).
 * `isolation` : exo accessoire d'angle complémentaire (souvent lengthened_bias).
 */
export type RoleHint = 'compound' | 'isolation';

/**
 * Une case de la grille : un pattern à réaliser pour un muscle prio donné
 * dans une séance donnée. À l'étape E, l'user choisit son exo préféré parmi
 * 3-4 variantes proposées. `chosen_exercise_id` reste null tant qu'elle
 * n'est pas remplie.
 */
export interface PatternCell {
  pattern: Pattern;
  /** Muscle prio que cette case vise en primaire. */
  primary_muscle: string;
  role_hint: RoleHint;
  chosen_exercise_id: string | null;
  /**
   * Refonte remplissage (recherche/09b) — séries planifiées pour cette case,
   * posées par le plan de volume (`buildSkeleton`). L'allocation lit ce champ
   * directement (plus de bump glouton). Optionnel : une case construite hors
   * nouveau path retombe sur le plancher `MIN_SETS_PER_EXERCISE`.
   */
  planned_sets?: number;
}

/** Un jour de la grille : N cases à remplir, plus métadonnées du jour. */
export interface SkeletonDay {
  day_index: number;
  /** Label du split pour ce jour : "Upper", "Push", "Full Body", "Lower", etc. */
  split_label: string;
  /** Muscles "focus" du jour (sert au nommage L et à l'ordre intra-séance). */
  focus_muscles: string[];
  cells: PatternCell[];
}

/**
 * Structure intermédiaire issue de skeleton_builder (étape D),
 * remplie par l'user (étape E), consommée par sets_allocator (étape F).
 */
export interface SkeletonTemplate {
  cycle_index: number;
  /** Nom lisible du split choisi : "Upper/Lower 4×", "Full Body 3× focus rotatif", etc. */
  split_name: string;
  duration_category: DurationCategory;
  days: SkeletonDay[];
  /** Warnings produits par l'algo (under-fill, sur-utilisation, etc.). */
  warnings: string[];
}

export interface SkeletonTemplateInput {
  cycle_index: number;
  split_name: string;
  duration_category: DurationCategory;
  days?: SkeletonDay[];
  warnings?: string[];
}

export function makeSkeletonTemplate(input: SkeletonTemplateInput): SkeletonTemplate {
  return {
    cycle_index: input.cycle_index,
    split_name: input.split_name,
    duration_category: input.duration_category,
    days: input.days ?? [],
    warnings: input.warnings ?? [],
  };
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
  /**
   * Conv #14c-7 — snapshot de `state.muscle_goals` posé au moment du bilan
   * (≈ état des objectifs en fin de cycle). Sert à afficher "visé vs fait"
   * dans l'historique des cycles. Optionnel : les anciens cycles clôturés
   * avant cette feature n'auront pas ce champ.
   */
  muscle_goals_snapshot?: MuscleGoal[];
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
  muscle_goals_snapshot?: MuscleGoal[];
}

export function makeCycleReview(input: CycleReviewInput): CycleReview {
  const out: CycleReview = {
    ...input,
    warnings: input.warnings ?? [],
  };
  if (input.muscle_goals_snapshot !== undefined) {
    out.muscle_goals_snapshot = input.muscle_goals_snapshot;
  }
  return out;
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
  /**
   * Conv #20 — Mode "Poids du corps seulement" (sticky).
   *  - `true`  : la prescription force load_kg = 0 et adapte les reps cibles
   *              pour atteindre le RPE cible (Epley étendu, cf.
   *              `buildPrescription`). N'a de sens que sur les exos
   *              `BODYWEIGHT_LOADED` / `BODYWEIGHT_ASSISTED`.
   *  - `false` / `null` : comportement par défaut (charge ajustée).
   */
  pdc_only: boolean | null;
}

export function makeEquipmentOverride(
  input: Partial<EquipmentOverride> = {},
): EquipmentOverride {
  return {
    inc_kg: input.inc_kg ?? null,
    min_load_kg: input.min_load_kg ?? null,
    max_load_kg: input.max_load_kg ?? null,
    pdc_only: input.pdc_only ?? null,
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
  volume_min: Record<string, number>;
  volume_max: Record<string, number>;
  current_week_in_cycle: number;
  cycle_index: number;
  history: SessionFeedback[];
  last_used_for_muscle: Record<string, string>;
  // --- algo de programmation (cf. 09 §2.6) ---
  muscle_goals: Record<string, MuscleGoal>;
  current_cycle_plan: WeeklyTemplate | null;
  /**
   * Bloc O — mode de construction du programme courant :
   *  - `'auto'`   : généré par le moteur (sur-mesure).
   *  - `'manual'` : grille remplie à la main par l'utilisateur. En fin de cycle,
   *    le plan manuel est reconduit (pas régénéré). Absent sur anciens blobs
   *    (default `'auto'` à la désérialisation).
   */
  build_mode?: 'auto' | 'manual';
  // --- override équipement par exo ---
  equipment_overrides: Record<string, EquipmentOverride>;
  /**
   * Dette de volume non réalisée sur la semaine en cours (Conv #11a).
   *
   * Mis à jour à chaque `recordFeedback` : pour chaque exo de la séance dont
   * il manque des séries, on accumule `setsManques` sur chacun de ses muscles
   * primaires. `generateSession` consomme cette dette en ajoutant des séries
   * (capées) aux exos de la séance suivante qui couvrent ces muscles.
   * `endOfWeek` reset à `{}` — la dette ne traverse pas la frontière hebdo.
   */
  weekly_volume_debt: Record<string, number>;
  /**
   * Refonte progression — plancher de charge prescrite par exercice (kg externes).
   *
   * C'est la SOURCE de la charge prescrite au jour le jour (et non plus l'e1RM ×
   * RPE) : `buildPrescription` lit ce plancher s'il existe, sinon il le SEED avec
   * la charge dérivée de l'e1RM. Le plancher monte d'un cran (cliquet) quand la
   * meilleure série atteint `R + GRADUATION_RESERVE` (cf. feedback.ts), persiste
   * d'un cycle à l'autre (jamais reset en fin de cycle), et est effacé quand on
   * réinitialise/repose l'e1RM de l'exo (reset catalogue, plafond manuel,
   * changement d'objectif). Exos sans charge externe additive (poids du corps,
   * assisté, PDC) exclus : ils gardent la voie e1RM. Absent sur anciens blobs.
   */
  prescribed_load_floor: Record<string, number>;
  /**
   * Conv #22 — squelette du cycle courant (grille pattern × séance) si on
   * est en mode custom co-construit. Persisté à côté de `current_cycle_plan`
   * pour permettre "Modifier la grille" et la re-distribution des séries
   * sans repartir de zéro. null pour les programmes guidés ou avant la
   * 1re génération.
   */
  current_skeleton?: SkeletonTemplate | null;
  /**
   * Conv #22 — exos préférés de l'user par pattern (mémorisés lors des
   * choix à l'étape E). Sert à proposer ces exos en tête de liste lors des
   * onboardings/restarts suivants. Clé = `Pattern` value (string).
   */
  favorite_exercise_per_pattern?: Record<string, string>;
  /**
   * Bloc F (Conv #31) — favoris **unifiés** de l'utilisateur (LA notion
   * « favori » visible dans l'UI). Alimenté par l'étoile du Catalogue ET la
   * prédilection choisie à l'onboarding. `favorite_exercise_per_pattern`
   * devient un cache de seeding interne au moteur (1 favori/pattern) ; ce set
   * plat est la source de vérité côté utilisateur. Absent sur anciens blobs
   * (migration depuis `favorite_exercise_per_pattern` à la désérialisation).
   */
  favorite_exercise_ids?: string[];
  /**
   * Bloc F (Conv #31) — nombre de fois où l'utilisateur a choisi un exo en
   * ajout ad-hoc / variante de remplacement en séance. Sert à proposer de
   * l'ajouter aux favoris à la 3ᵉ utilisation (s'il ne l'est pas déjà).
   * Clé = exercise_id. Absent sur anciens blobs.
   */
  exercise_pick_counts?: Record<string, number>;
  /**
   * Chantier B (plan 11) — décision de l'utilisateur sur la semaine de
   * récupération (déload opt-in) du cycle courant :
   *  - `'accepted'` : semaine 5 allégée (volume ÷2, charge ×0,9, RPE 6, aucune
   *    mesure) — cf. `isDeloadActive` (volume.ts).
   *  - `'declined'` : semaine 5 = semaine NORMALE (progression + mesures actives).
   *  - `null`       : pas encore décidé (défaut ; hors semaine 5, ou proposition
   *    pas encore présentée). Reset à `null` à chaque nouveau cycle.
   * Absent sur anciens blobs (default `null`).
   */
  deload_decision?: 'accepted' | 'declined' | null;
}

export function makeUserState(profile: Profile): UserState {
  return {
    profile,
    e1rm: {},
    k_user: {},
    volume_min: {},
    volume_max: {},
    current_week_in_cycle: 1,
    cycle_index: 1,
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {},
    current_cycle_plan: null,
    build_mode: 'auto',
    equipment_overrides: {},
    weekly_volume_debt: {},
    prescribed_load_floor: {},
    current_skeleton: null,
    favorite_exercise_per_pattern: {},
    favorite_exercise_ids: [],
    exercise_pick_counts: {},
    deload_decision: null,
  };
}
