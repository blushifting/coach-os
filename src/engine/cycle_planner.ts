/**
 * Planification du cycle (custom) : génère un WeeklyTemplate à partir des MuscleGoals.
 * Port 1:1 de prototype/coach_os/cycle_planner.py.
 *
 * Référence : recherche/09_programmation.md §5, §6, §9.
 *
 * Pipeline :
 *   1. selectSplit → SplitTemplate
 *   2. parameterizeSplit → DayMeta[] (muscles attribués à chaque jour)
 *   3. composeSession par jour → DayTemplate (exos choisis, séries, progression)
 *   4. resolveCapacityConflict → caps par séance respectés
 *   5. WeeklyTemplate retourné
 *
 * L'algo NE calcule PAS les charges live ; ça reste à `buildPrescription` à
 * chaque instanciation de séance.
 */

import type {
  Catalog,
} from './catalog';
import type {
  DayTemplate,
  Exercise,
  MuscleGoal,
  PlannedExercise,
  UserState,
  WeeklyTemplate,
} from './models';
import {
  ExType,
  Level,
  MuscleObjective,
  MuscleStatus,
  ProgressionRule,
  exercisePrimaires,
  makePlannedExercise,
  makeWeeklyTemplate,
} from './models';
import {
  selectSplit,
  muscleBelongsToSlot,
  type SlotKind,
  type SplitTemplate,
} from './split';
import {
  effectiveVolumeBounds,
  targetFrequency,
  MAINTENANCE_MIN_SETS,
  MAX_SETS_PER_SESSION_PER_MUSCLE,
  DELOAD_FACTOR,
} from './volume';
import {
  pickCompoundsForMuscle,
  pickIsolationsForMuscle,
  orderSession,
  totalSets,
  MAX_TOTAL_SETS_PER_SESSION,
} from './selection';
import { pythonRound } from './prescription';
import { rebalanceCycleDurations } from './rebalance';

// =============================================================================
// Types intermédiaires
// =============================================================================

/** Métadonnées d'un jour avant choix des exos (sortie de parameterizeSplit). */
export interface DayMeta {
  day_index: number;
  label: string;
  slot_kind: SlotKind;
  target_muscles_focus: string[];
}

// =============================================================================
// 1. Composition exos par muscle selon V_cible (cf. 09 §6.1)
// =============================================================================

/**
 * Nombre d'exos à programmer par muscle selon le volume hebdo cible.
 * Cf. 09 §6.1 :
 *   - V ≤ 6  → 1 exo
 *   - V 7-12 → 2 exos
 *   - V 13-18 → 3 exos
 *   - V > 18 → 4 exos
 */
export function exosCountForVolume(vSession: number): number {
  if (vSession <= 6) return 1;
  if (vSession <= 12) return 2;
  if (vSession <= 18) return 3;
  return 4;
}

/** Nb de compounds selon ratio par objectif (cf. 09 §6.2). */
export function compoundCountForObjective(
  nTotal: number,
  objective: MuscleObjective,
): number {
  if (objective === MuscleObjective.FORCE) return nTotal;
  if (objective === MuscleObjective.HYPERTROPHIE) {
    // Banker's rounding pour parité Python (round(n*0.6)).
    return Math.max(1, bankersRound(nTotal * 0.6));
  }
  if (objective === MuscleObjective.ENDURANCE) {
    return Math.max(1, Math.trunc(nTotal / 2));
  }
  // MAINTIEN : sécurité.
  return nTotal;
}

function bankersRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // exact .5 → arrondi vers le pair
  return floor % 2 === 0 ? floor : floor + 1;
}

// =============================================================================
// 2. Progression Israetel (cf. 09 §2.1, §3.3)
// =============================================================================

/**
 * Progression hebdo en séries pour 1 exo, sur 5 semaines (4 + déload).
 *   - w1 : baseSets
 *   - w2-w4 : +1 série / sem, plafonné à vMaxPerExo
 *   - w5 : déload, environ 50 % de base
 */
export function israetelProgression(
  baseSets: number,
  vMaxPerExo: number = MAX_SETS_PER_SESSION_PER_MUSCLE,
): number[] {
  const progression: number[] = [];
  for (let w = 1; w <= 4; w += 1) {
    progression.push(Math.min(vMaxPerExo, baseSets + (w - 1)));
  }
  const deload = Math.max(1, Math.trunc(baseSets * DELOAD_FACTOR));
  progression.push(deload);
  return progression;
}

// =============================================================================
// 3. Paramétrisation : distribuer muscles sur jours du split (cf. 09 §9.2)
// =============================================================================

const STATUS_ORDER: Record<MuscleStatus, number> = {
  [MuscleStatus.PRIORITAIRE]: 0,
  [MuscleStatus.SUGGERE]: 1,
  [MuscleStatus.NON_COUVERT]: 99,
};

/**
 * Distribue les muscles prioritaires + suggérés sur les jours du split.
 * Ordre de placement (cf. 09 §4.6) : statut PRIORITAIRE avant SUGGERE,
 * puis priority_rank ascendant.
 */
/**
 * Coût estimé (≈ nb d'exos) qu'un muscle ajoutera à un jour, basé sur
 * son volume cible et sa fréquence. Sert au tri d'équilibrage de
 * `parameterizeSplit` (Conv #15-11) — auparavant on comptait juste le
 * nombre de muscles, ce qui sous-estimait les muscles prioritaires
 * hypertrophie (3-4 exos) face aux MAINTIEN (1 exo).
 */
function expectedExosForMuscle(
  muscle: string,
  goal: MuscleGoal,
  state: UserState,
): number {
  if (goal.status === MuscleStatus.NON_COUVERT) return 0;
  const freq =
    goal.status === MuscleStatus.PRIORITAIRE ? targetFrequency(muscle, state) : 1;
  if (freq === 0) return 0;
  const [vMin] = effectiveVolumeBounds(state, muscle);
  const vSession = freq > 0 ? vMin / freq : vMin;
  return exosCountForVolume(vSession);
}

export function parameterizeSplit(
  split: SplitTemplate,
  muscleGoals: Record<string, MuscleGoal>,
  state: UserState,
): DayMeta[] {
  const daysMeta: DayMeta[] = split.slots.map((slot, i) => ({
    day_index: i,
    label: slot.label,
    slot_kind: slot.kind,
    target_muscles_focus: [],
  }));

  // Conv #15-11 — coût accumulé par jour (≈ nb d'exos attendus). On place
  // chaque muscle sur le(s) jour(s) le(s) moins chargé(s) plutôt que le(s)
  // jour(s) avec le moins de muscles. Évite que le jour 1 récupère tous
  // les muscles prioritaires hypertrophie (3-4 exos chacun) pendant que
  // les autres jours ramassent les maintiens (1 exo).
  const costByDay: number[] = daysMeta.map(() => 0);

  // Pré-calcul du coût attendu par muscle (utilisé pour MAJ costByDay au
  // placement et pour ordre "first-fit decreasing").
  const muscleCost = new Map<string, number>();
  for (const [muscle, goal] of Object.entries(muscleGoals)) {
    muscleCost.set(muscle, expectedExosForMuscle(muscle, goal, state));
  }

  const sortedGoals = Object.entries(muscleGoals).slice().sort((a, b) => {
    const sa = STATUS_ORDER[a[1].status];
    const sb = STATUS_ORDER[b[1].status];
    if (sa !== sb) return sa - sb;
    if (a[1].priority_rank !== b[1].priority_rank) {
      return a[1].priority_rank - b[1].priority_rank;
    }
    // Conv #15-11 — départage par coût décroissant pour placer d'abord
    // les muscles les plus coûteux (heuristique first-fit decreasing).
    const ca = muscleCost.get(a[0]) ?? 0;
    const cb = muscleCost.get(b[0]) ?? 0;
    return cb - ca;
  });

  for (const [muscle, goal] of sortedGoals) {
    if (goal.status === MuscleStatus.NON_COUVERT) continue;
    const freq =
      goal.status === MuscleStatus.PRIORITAIRE ? targetFrequency(muscle, state) : 1;
    if (freq === 0) continue;

    const eligibleIndices = daysMeta
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => muscleBelongsToSlot(muscle, d.slot_kind));
    if (eligibleIndices.length === 0) continue;
    // Conv #15-11 — tri par coût croissant des jours (vs. ancien
    // tri par nb de muscles). Départage stable par day_index pour rester
    // déterministe.
    eligibleIndices.sort((a, b) => {
      const ca = costByDay[a.i] ?? 0;
      const cb = costByDay[b.i] ?? 0;
      if (ca !== cb) return ca - cb;
      return a.i - b.i;
    });

    const cost = muscleCost.get(muscle) ?? 0;
    let placed = 0;
    for (const { d, i } of eligibleIndices) {
      if (placed >= freq) break;
      if (!d.target_muscles_focus.includes(muscle)) {
        d.target_muscles_focus.push(muscle);
        costByDay[i] = (costByDay[i] ?? 0) + cost;
        placed += 1;
      }
    }
  }

  return daysMeta;
}

// =============================================================================
// 4. Composition d'une séance (cf. 09 §6, §9.2)
// =============================================================================

const ANGLE_KEYWORDS: ReadonlySet<string> = new Set([
  'incline',
  'decline',
  'flat',
  'vertical',
  'horizontal',
  'overhead',
  'neutral',
  'pronated',
  'supinated',
  'lengthened_bias',
  'shortened_bias',
]);

function angleTags(ex: Exercise): Set<string> {
  const out = new Set<string>();
  for (const t of ex.tags) if (ANGLE_KEYWORDS.has(t)) out.add(t);
  return out;
}

function topPriorityMuscleIn(
  dayMeta: DayMeta,
  state: UserState,
): string | null {
  const candidates: Array<readonly [number, string]> = [];
  for (const m of dayMeta.target_muscles_focus) {
    const g = state.muscle_goals[m];
    if (g && g.status === MuscleStatus.PRIORITAIRE) {
      candidates.push([g.priority_rank, m]);
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a[0] - b[0]);
  return candidates[0]![1];
}

/**
 * Choisit les exos pour ce jour selon les muscles focus.
 * Pour chaque muscle focus :
 *   - Calcul du nb d'exos selon V_session
 *   - Sélection compounds + isolations selon ratio par objectif
 *   - Application lengthened_bias si Hypertrophie + 2+ exos
 *   - Diversification d'angles
 */
export function composeSession(
  dayMeta: DayMeta,
  state: UserState,
  catalog: Catalog,
): import('./models').DayTemplate {
  const chosenPlanned: PlannedExercise[] = [];
  const chosenIds = new Set<string>();

  for (const muscle of dayMeta.target_muscles_focus) {
    const goal = state.muscle_goals[muscle];
    if (!goal || goal.status === MuscleStatus.NON_COUVERT) continue;

    const [vMin] = effectiveVolumeBounds(state, muscle);
    const freq =
      goal.status === MuscleStatus.PRIORITAIRE
        ? Math.max(1, targetFrequency(muscle, state))
        : 1;
    const vSession = freq > 0 ? vMin / freq : vMin;
    const nExos = exosCountForVolume(vSession);

    // MAINTIEN ou SUGGERE : pas d'iso dédiée (cf. 09 §3.4).
    const nCompounds =
      goal.objective === MuscleObjective.MAINTIEN ||
      goal.status === MuscleStatus.SUGGERE
        ? nExos
        : compoundCountForObjective(nExos, goal.objective);

    const compounds = pickCompoundsForMuscle(muscle, nCompounds, state, catalog, {
      excludeIds: chosenIds,
    });

    const nIsoNeeded = nExos - compounds.length;
    const avoidAngles = new Set<string>();
    for (const c of compounds) {
      for (const t of angleTags(c)) avoidAngles.add(t);
    }
    const preferLengthened =
      goal.objective === MuscleObjective.HYPERTROPHIE && nExos >= 2;
    const isolations =
      nIsoNeeded > 0
        ? pickIsolationsForMuscle(muscle, nIsoNeeded, state, catalog, {
            preferLengthened,
            avoidAngles,
            excludeIds: chosenIds,
          })
        : [];

    const allForMuscle: Exercise[] = [...compounds, ...isolations];
    if (allForMuscle.length === 0) continue;

    // base_sets par exo : V_session / nb d'exos, arrondi >= 2
    let setsPerExo = Math.max(
      2,
      pythonRound(vSession / Math.max(1, allForMuscle.length)),
    );
    setsPerExo = Math.min(setsPerExo, MAX_SETS_PER_SESSION_PER_MUSCLE);

    for (const ex of allForMuscle) {
      chosenPlanned.push(
        makePlannedExercise({
          exercise_id: ex.id,
          base_sets: setsPerExo,
          progression: israetelProgression(setsPerExo),
          progression_rule: ProgressionRule.ISRAETEL_VOLUME,
        }),
      );
      chosenIds.add(ex.id);
    }
  }

  // Ordre dans la séance.
  const exObjects = chosenPlanned.map((p) => catalog.get(p.exercise_id));
  const priorityMuscle = topPriorityMuscleIn(dayMeta, state);
  const orderedEx = orderSession(exObjects, priorityMuscle);
  const idToPlanned = new Map<string, PlannedExercise>();
  for (const p of chosenPlanned) idToPlanned.set(p.exercise_id, p);
  const reordered = orderedEx.map((e) => idToPlanned.get(e.id)!);

  return {
    day_index: dayMeta.day_index,
    label: dayMeta.label,
    target_muscles_focus: [...dayMeta.target_muscles_focus],
    exercises: reordered,
  };
}

// =============================================================================
// 5. Top-up maintenance (cf. 09 §3.4)
// =============================================================================

/**
 * Pour chaque muscle SUGGERE, vérifie si volume incident suffit.
 * Si pas, ajoute 1 exo isolation léger (base_sets=2) sur le 1er jour qui l'accepte.
 */
export function topUpMaintenance(
  weeklyTemplate: WeeklyTemplate,
  state: UserState,
  catalog: Catalog,
): void {
  const incident: Record<string, number> = {};
  for (const day of weeklyTemplate.days) {
    for (const planned of day.exercises) {
      const ex = catalog.get(planned.exercise_id);
      for (const [muscle, coef] of Object.entries(ex.muscles)) {
        incident[muscle] = (incident[muscle] ?? 0) + coef * planned.base_sets;
      }
    }
  }

  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (goal.status !== MuscleStatus.SUGGERE) continue;
    const vTarget = effectiveVolumeBounds(state, muscle)[0];
    if ((incident[muscle] ?? 0) >= vTarget) continue;

    for (const day of weeklyTemplate.days) {
      const excludeIds = new Set(day.exercises.map((p) => p.exercise_id));
      const iso = pickIsolationsForMuscle(muscle, 1, state, catalog, { excludeIds });
      if (iso.length === 0) continue;
      const baseSets = Math.trunc(MAINTENANCE_MIN_SETS);
      day.exercises.push(
        makePlannedExercise({
          exercise_id: iso[0]!.id,
          base_sets: baseSets,
          progression: israetelProgression(baseSets),
          progression_rule: ProgressionRule.ISRAETEL_VOLUME,
        }),
      );
      if (!day.target_muscles_focus.includes(muscle)) {
        day.target_muscles_focus.push(muscle);
      }
      incident[muscle] = (incident[muscle] ?? 0) + baseSets;
      break;
    }
  }
}

// =============================================================================
// 6. Résolution conflits capacité (cf. 09 §5.6)
// =============================================================================

/**
 * Si un jour dépasse le cap par séance, tronque en gardant les 1ers exos
 * (ordre = compounds prioritaires d'abord). Sinon, ajoute warning.
 */
export function resolveCapacityConflict(
  weeklyTemplate: WeeklyTemplate,
  level: Level,
  _state: UserState,
): void {
  const cap = MAX_TOTAL_SETS_PER_SESSION[level];
  for (const day of weeklyTemplate.days) {
    if (totalSets(day.exercises) <= cap) continue;
    const kept: PlannedExercise[] = [];
    let running = 0;
    for (const p of day.exercises) {
      if (running + p.base_sets > cap) continue;
      kept.push(p);
      running += p.base_sets;
    }
    if (running > cap || kept.length < day.exercises.length) {
      day.exercises = kept;
    }
    if (totalSets(day.exercises) > cap) {
      weeklyTemplate.warnings.push(
        `Jour ${day.label} : volume cible > capacité (${totalSets(day.exercises)}>${cap}). ` +
          `Ajouter une séance ou réduire les priorités.`,
      );
    }
  }
}

// =============================================================================
// 6b. Garantie lengthened_bias cycle-level (cf. 09 §6.4, D2 Conv #7)
// =============================================================================

/**
 * Post-pass cycle-level : pour chaque muscle Hypertrophie ayant ≥2 exos sur
 * le cycle, garantit qu'au moins un porte le tag `lengthened_bias` si le
 * catalogue en propose pour ce muscle (cf. 09 §6.4).
 *
 * Substitution : remplace en priorité une isolation, sinon le dernier
 * compound. Préserve `base_sets`/`progression` pour ne pas perturber le
 * volume hebdo cible. Recalcule la cartographie à chaque itération car les
 * compounds partagés (ex. deadlift_conv = fessiers + ischios) peuvent voir
 * leur position consommée par un muscle traité précédemment.
 */
export function enforceLengthenedBias(
  weeklyTemplate: WeeklyTemplate,
  state: UserState,
  catalog: Catalog,
): void {
  const hypMuscles: string[] = [];
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (
      goal.objective === MuscleObjective.HYPERTROPHIE &&
      !hypMuscles.includes(muscle)
    ) {
      hypMuscles.push(muscle);
    }
  }

  const cartography = (m: string): Array<[number, number, Exercise]> => {
    const out: Array<[number, number, Exercise]> = [];
    weeklyTemplate.days.forEach((day, di) => {
      day.exercises.forEach((planned, pi) => {
        const ex = catalog.get(planned.exercise_id);
        if (exercisePrimaires(ex).includes(m)) {
          out.push([di, pi, ex]);
        }
      });
    });
    return out;
  };

  for (const muscle of hypMuscles) {
    const occurrences = cartography(muscle);
    if (occurrences.length < 2) continue;
    if (occurrences.some(([, , ex]) => ex.tags.includes('lengthened_bias'))) {
      continue;
    }
    const allChosenIds = new Set<string>();
    for (const day of weeklyTemplate.days) {
      for (const p of day.exercises) allChosenIds.add(p.exercise_id);
    }
    const lbCands = pickIsolationsForMuscle(muscle, 1, state, catalog, {
      preferLengthened: true,
      excludeIds: allChosenIds,
    }).filter((x) => x.tags.includes('lengthened_bias'));
    if (lbCands.length === 0) continue;
    const replacement = lbCands[0]!;
    const isoOcc = occurrences.filter(([, , ex]) => ex.type === ExType.ISOLATION);
    const target = isoOcc.length > 0 ? isoOcc[isoOcc.length - 1]! : occurrences[occurrences.length - 1]!;
    const [di, pi] = target;
    const old = weeklyTemplate.days[di]!.exercises[pi]!;
    weeklyTemplate.days[di]!.exercises[pi] = makePlannedExercise({
      exercise_id: replacement.id,
      base_sets: old.base_sets,
      progression: old.progression,
      progression_rule: old.progression_rule,
    });
  }
}

// =============================================================================
// 7. Rotation d'emphasis (cf. 09 §8.4)
// =============================================================================

export const EMPHASIS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['pectoraux', 'dos_largeur'],
  ['pectoraux', 'dos_epaisseur'],
  ['quadriceps', 'ischios'],
  ['biceps', 'triceps'],
  ['deltos_lateraux', 'deltos_posterieurs'],
];

/**
 * Permute les rangs des PRIORITAIRES par paires antagonistes.
 * Modifie `muscleGoals` in-place ET le retourne.
 */
export function rotateEmphasis(
  muscleGoals: Record<string, MuscleGoal>,
): Record<string, MuscleGoal> {
  for (const [m1, m2] of EMPHASIS_PAIRS) {
    const g1 = muscleGoals[m1];
    const g2 = muscleGoals[m2];
    if (
      g1 &&
      g2 &&
      g1.status === MuscleStatus.PRIORITAIRE &&
      g2.status === MuscleStatus.PRIORITAIRE
    ) {
      const tmp = g1.priority_rank;
      g1.priority_rank = g2.priority_rank;
      g2.priority_rank = tmp;
    }
  }
  return muscleGoals;
}

// =============================================================================
// 7.5 Fusion d'exercices équivalents (Conv #19)
// =============================================================================

/**
 * Clé d'équivalence pour la fusion d'exos après choix de variantes.
 * Deux exos sont équivalents s'ils partagent :
 *  - le même `pattern` (mouvement de base)
 *  - les mêmes muscles primaires (coef ≥ 1.0), set comparé par contenu
 *  - le même `charge` type (DUMBBELL vs BARBELL etc. restent distincts)
 *
 * Validé par Azur (Conv #19) — strict pour éviter des fusions douteuses
 * (bench barre vs haltère restent séparés car charge différente).
 */
function equivalenceKey(ex: Exercise): string {
  const primaries = exercisePrimaires(ex).slice().sort().join(',');
  return `${ex.pattern}|${primaries}|${ex.charge}`;
}

/**
 * Fusionne dans un jour les exos équivalents (cf. `equivalenceKey`) en
 * additionnant `base_sets` et `progression`. Le 1er exo rencontré sert d'ancre
 * (conserve son `exercise_id`, `role`, `intensity_scheme`, `progression_rule`).
 *
 * Cas typique : après `applyVariantReplacements` (Step5 onboarding), 2 slots
 * d'une même séance peuvent pointer vers le même `exercise_id` ou vers 2 exos
 * équivalents (ex: compound + isolation choisis par l'algo se retrouvent en
 * 2× bench_db si l'user remplace l'isolation par un compound équivalent).
 *
 * Cap : la somme de `base_sets` et chaque point de `progression` est cappée à
 * `MAX_SETS_PER_SESSION_PER_MUSCLE` pour éviter d'exploser le volume.
 */
export function mergeEquivalentExercises(
  day: DayTemplate,
  catalog: Catalog,
): DayTemplate {
  const byKey = new Map<string, number>(); // key → index dans `exercises`
  const merged: PlannedExercise[] = [];
  for (const planned of day.exercises) {
    if (!catalog.has(planned.exercise_id)) {
      merged.push(planned);
      continue;
    }
    const ex = catalog.get(planned.exercise_id);
    const key = equivalenceKey(ex);
    const existingIdx = byKey.get(key);
    if (existingIdx === undefined) {
      byKey.set(key, merged.length);
      merged.push(planned);
      continue;
    }
    const existing = merged[existingIdx]!;
    const cap = MAX_SETS_PER_SESSION_PER_MUSCLE;
    const fusedSets = Math.min(cap, existing.base_sets + planned.base_sets);
    const len = Math.max(existing.progression.length, planned.progression.length);
    const fusedProg: number[] = [];
    for (let i = 0; i < len; i++) {
      const a = existing.progression[i] ?? existing.base_sets;
      const b = planned.progression[i] ?? planned.base_sets;
      fusedProg.push(Math.min(cap, a + b));
    }
    merged[existingIdx] = {
      ...existing,
      base_sets: fusedSets,
      progression: fusedProg,
      role: existing.role ?? planned.role,
      intensity_scheme: existing.intensity_scheme ?? planned.intensity_scheme,
      progression_rule: existing.progression_rule ?? planned.progression_rule,
    };
  }
  return { ...day, exercises: merged };
}

/**
 * Variante WeeklyTemplate : applique `mergeEquivalentExercises` à chaque jour.
 * Mute le `WeeklyTemplate` (remplace `days` par les jours fusionnés).
 */
export function mergeEquivalentExercisesInPlan(
  weekly: WeeklyTemplate,
  catalog: Catalog,
): void {
  weekly.days = weekly.days.map((d) => mergeEquivalentExercises(d, catalog));
}

// =============================================================================
// 8. Point d'entrée : generateCyclePlan (cf. 09 §9.2)
// =============================================================================

/**
 * Génère un WeeklyTemplate pour 1 cycle complet à partir des MuscleGoals.
 * Pré-requis : `state.muscle_goals` doit être posé (par l'onboarding ou via
 * Profile.objective + applyBalanceRules).
 */
export function generateCyclePlan(
  state: UserState,
  catalog: Catalog,
): WeeklyTemplate {
  const split = selectSplit(
    state.profile.sessions_per_week,
    state.muscle_goals,
    state.profile.level,
  );

  const daysMeta = parameterizeSplit(split, state.muscle_goals, state);

  const weekly = makeWeeklyTemplate({
    cycle_index: state.cycle_index,
    rationale: `Custom ${split.name}`,
    days: [],
  });

  for (const dm of daysMeta) {
    weekly.days.push(composeSession(dm, state, catalog));
  }

  topUpMaintenance(weekly, state, catalog);
  enforceLengthenedBias(weekly, state, catalog);
  resolveCapacityConflict(weekly, state.profile.level, state);

  // Conv #16-2 — rééquilibrage des durées de séance. Opère intra-groupe
  // par slot_kind (UPPER avec UPPER, LOWER avec LOWER, FULLBODY entre
  // eux, etc.) → préserve l'esprit du split. N'altère pas si les jours
  // sont déjà équilibrés ou si les contraintes (fréquence muscle, jour
  // non vide) bloquent les opérations.
  const slotKinds = daysMeta.map((dm) => dm.slot_kind);
  const { template: rebalanced } = rebalanceCycleDurations(
    weekly,
    slotKinds,
    state,
    catalog,
  );

  // Conv #19 — Fusion d'exos équivalents (même pattern + primaires + charge).
  // Évite d'avoir 2 slots "même exo" après que composeSession + lengthened
  // bias + top-up maintenance ont sélectionné des doublons fonctionnels.
  // Sera aussi rappelée après `applyVariantReplacements`.
  mergeEquivalentExercisesInPlan(rebalanced, catalog);

  // Conv #21b (J) — Tri des jours par coût neuro décroissant. Logique :
  // si une séance saute, autant que ce soit la moins "chargée" → on place
  // les plus coûteuses en début de cycle/semaine pour les sécuriser.
  // Le tri est intra-cycle : il modifie l'ordre des `days[]` mais ne touche
  // pas leur contenu. `day_index` est conservé tel quel (id stable, sert
  // au lookup historique des feedbacks). L'UI lit toujours
  // `cyclePlan.days[i]` donc l'index passé à `generateSession` reste valide.
  orderDaysByNeuralCost(rebalanced, catalog);
  // Conv #23 — réassigne les suffixes A/B/C après le tri neuro pour que
  // le 1er jour soit toujours « X A », le 2e « X B », etc.
  renumberSessionLabels(rebalanced);

  return rebalanced;
}

// =============================================================================
// 9. Conv #22 — Nouveau path co-construit (skeleton + sets_allocator)
// =============================================================================

import { buildSkeleton } from './skeleton_builder';
import { allocateSets } from './sets_allocator';
import { DurationCategory } from './models';

/**
 * Conv #22 — Génère un cycle via le nouveau path en 2 temps :
 *  1. `buildSkeleton(state, durationCategory)` → grille (pattern × séance)
 *     vide, présentée à l'user à l'étape D.
 *  2. L'user remplit la grille à l'étape E (chosen_exercise_id par cell).
 *  3. `allocateSets(skeleton, state, catalog)` → DayTemplate[] avec n_sets.
 *
 * Cette fonction est l'orchestration finale **une fois la grille remplie**.
 * Si tu veux juste générer le squelette pour présentation, appelle
 * `buildSkeleton` directement.
 *
 * @param filledSkeleton skeleton avec `chosen_exercise_id` posé sur toutes
 *   les cases (sinon les cases vides sont signalées en warnings).
 */
export function generateCyclePlanV2(
  filledSkeleton: import('./models').SkeletonTemplate,
  state: UserState,
  catalog: Catalog,
): WeeklyTemplate {
  const alloc = allocateSets(filledSkeleton, state, catalog);
  const weekly = makeWeeklyTemplate({
    cycle_index: state.cycle_index,
    rationale: `Custom co-construit · ${filledSkeleton.split_name}`,
    days: alloc.days,
    warnings: [...filledSkeleton.warnings, ...alloc.warnings],
  });
  // Post-pass : merge équivalents, enforce lengthened bias, rééquilibrage
  // durée (Conv #16-2, branché Conv #22 dans le path V2 pour atténuer
  // l'écart entre séances en FB 5×), order neuro.
  enforceLengthenedBias(weekly, state, catalog);
  mergeEquivalentExercisesInPlan(weekly, catalog);
  // Rééquilibrage durée par groupes slot_kind. En path V2, tous les jours
  // d'un FB sont kind FULL, donc rééquilibrés entre eux.
  try {
    const slotKinds = inferSlotKindsFromSplitName(
      filledSkeleton.split_name,
      filledSkeleton.days.length,
    );
    if (slotKinds.length === weekly.days.length) {
      const { template: rebalanced } = rebalanceCycleDurations(
        weekly,
        slotKinds,
        state,
        catalog,
      );
      weekly.days = rebalanced.days;
      weekly.warnings = rebalanced.warnings;
    }
  } catch {
    // best-effort : si le rééquilibrage échoue, on garde la version brute.
  }
  orderDaysByNeuralCost(weekly, catalog);
  renumberSessionLabels(weekly);
  return weekly;
}

/**
 * Conv #22 — Heuristique pour inférer les `SlotKind` à partir du nom du
 * split du squelette. Sert au rééquilibrage durée qui rebalance intra-
 * groupe slot_kind (cf. `rebalanceCycleDurations`).
 */
function inferSlotKindsFromSplitName(
  splitName: string,
  nDays: number,
): import('./split').SlotKind[] {
  const name = splitName.toLowerCase();
  const result: import('./split').SlotKind[] = [];
  if (/full body/i.test(name)) {
    for (let i = 0; i < nDays; i += 1) {
      result.push('full' as import('./split').SlotKind);
    }
    return result;
  }
  if (/upper\/lower|u\/l/i.test(name)) {
    for (let i = 0; i < nDays; i += 1) {
      result.push(
        (i % 2 === 0 ? 'upper' : 'lower') as import('./split').SlotKind,
      );
    }
    return result;
  }
  if (/ppl/i.test(name)) {
    const kinds = ['push', 'pull', 'legs'] as const;
    for (let i = 0; i < nDays; i += 1) {
      result.push(kinds[i % 3]! as import('./split').SlotKind);
    }
    return result;
  }
  // Inconnu : on traite tout comme full → rebalance global.
  for (let i = 0; i < nDays; i += 1) {
    result.push('full' as import('./split').SlotKind);
  }
  return result;
}

/**
 * Conv #22 — Helper : génère squelette + alloue séries d'une traite,
 * pour les cas où on veut un cycle "tout fait" sans étape E manuelle
 * (ex. tests, migration, mode démo). L'auto-fill des variantes utilise
 * le 1er candidat de chaque case (= compound canonique).
 */
export function autoGenerateCyclePlanV2(
  state: UserState,
  catalog: Catalog,
  durationCategory: DurationCategory = DurationCategory.MEDIUM,
): WeeklyTemplate {
  const skeleton = buildSkeleton(state, durationCategory);
  // Auto-fill : 1er candidat de chaque case.
  for (const day of skeleton.days) {
    for (const cell of day.cells) {
      const cands = catalog.filter({ muscle_primary: cell.primary_muscle });
      const sameSeen = new Set<string>();
      for (const day2 of skeleton.days) {
        for (const c2 of day2.cells) {
          if (c2.chosen_exercise_id) sameSeen.add(c2.chosen_exercise_id);
        }
      }
      const fit = cands.find(
        (c) => c.pattern === cell.pattern && !sameSeen.has(c.id),
      );
      cell.chosen_exercise_id = fit?.id ?? cands[0]?.id ?? null;
    }
  }
  return generateCyclePlanV2(skeleton, state, catalog);
}

/**
 * Conv #21b — Coût neuro d'un jour-type = somme des séries pondérées par
 * un bonus "polyarticulaire". Compound × 1.5 reflète le coût neuro-musculaire
 * supérieur d'un squat / soulevé / développé vs. une élévation latérale.
 *
 * Hors-cible : on ne tient PAS compte du RPE (qui dépend de la phase du
 * cycle, pas du day-type). Pour un Push/Pull/Legs où chaque day a un
 * volume similaire, le tri sera principalement guidé par le compoundBonus.
 */
function dayNeuralCost(day: DayTemplate, catalog: Catalog): number {
  let score = 0;
  for (const ex of day.exercises) {
    let compoundBonus = 1.0;
    try {
      const meta = catalog.get(ex.exercise_id);
      if (meta.type === 'compound') compoundBonus = 1.5;
    } catch {
      // Exo inconnu (custom retiré entre temps ?) — on garde le score brut.
    }
    score += ex.base_sets * compoundBonus;
  }
  return score;
}

/**
 * Trie `template.days[]` IN PLACE par coût neuro décroissant. Départage
 * stable par `day_index` ascendant (pour garder un ordre déterministe
 * quand deux jours ont le même coût — ex. Upper A vs Upper B).
 */
export function orderDaysByNeuralCost(
  template: WeeklyTemplate,
  catalog: Catalog,
): void {
  template.days.sort((a, b) => {
    const ca = dayNeuralCost(a, catalog);
    const cb = dayNeuralCost(b, catalog);
    if (cb !== ca) return cb - ca; // décroissant
    return a.day_index - b.day_index; // tie-break stable
  });
}

/**
 * Conv #23 — Renomme les suffixes A/B/C des labels de séances selon
 * leur position dans `template.days[]`, regroupés par préfixe.
 *
 * Pourquoi : `orderDaysByNeuralCost` réordonne les days par coût neuro
 * décroissant mais conserve `day_index` (id stable pour le lookup
 * historique). Les labels générés par `buildSessionLabel` ou les
 * splits eux-mêmes dépendaient de cet index ; après tri on pouvait
 * obtenir « Full Body B » → « Full Body A » → « Full Body C », ce qui
 * cassait la lecture user (« mon programme commence par B ?! »).
 *
 * Comportement :
 *  - Pour chaque day, on détecte un suffixe `\s+[A-F]$`.
 *  - On regroupe les days par leur préfixe (« Full Body », « Upper »,
 *    « Push »…).
 *  - Au sein de chaque groupe, on réassigne A, B, C… dans l'ordre du
 *    tableau (= ordre du tri neuro).
 *  - Les labels sans suffixe lettre (« Bonus », labels guidés du genre
 *    « Workout A2 ») sont laissés intacts.
 */
export function renumberSessionLabels(template: WeeklyTemplate): void {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const counters: Record<string, number> = {};
  for (const day of template.days) {
    const m = day.label.match(/^(.+?)\s+[A-F]$/);
    if (m === null) continue;
    const prefix = m[1]!;
    const idx = counters[prefix] ?? 0;
    counters[prefix] = idx + 1;
    day.label = `${prefix} ${LETTERS[idx] ?? String(idx + 1)}`;
  }
}
