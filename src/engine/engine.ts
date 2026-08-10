/**
 * Orchestrateur Coach OS — API stable.
 *
 * `generateSession(state, catalog, day_index, date)` lit
 * `state.current_cycle_plan.days[day_index]` et calcule les charges live via
 * `buildPrescription` (muscle_goals + state).
 */

import type { Catalog } from './catalog';
import type {
  DayTemplate,
  Exercise,
  MuscleGoal,
  Profile,
  SessionFeedback,
  SessionItem,
  SessionPlan,
  SetFeedback,
  SetPrescription,
  UserState,
} from './models';
import {
  ChargeType,
  ExType,
  MuscleStatus,
  exercisePrimaires,
  makeMuscleGoal,
  makeUserState,
  objectiveToMuscleObjective,
} from './models';
import {
  buildPrescription,
  e1rmObserved,
  effectiveLoadForE1rm,
} from './prescription';
import {
  updateE1rmForExercise,
  updatePrescribedLoadFloorForExercise,
  updatePrescribedRepsFloorForExercise,
  type E1rmUpdate,
} from './feedback';
import {
  advanceWeek,
  DELOAD_WEEK_IN_CYCLE,
  initialVolumeBounds,
  isDeloadActive,
} from './volume';
import { applyBalanceRules } from './balance';
import { generateCycleReview } from './lifecycle';

// =============================================================================
// 1. Initialisation utilisateur
// =============================================================================

export interface StartUserOptions {
  muscleGoals?: Record<string, MuscleGoal> | null;
  applyBalance?: boolean;
}

export function startUser(
  profile: Profile,
  _catalog?: Catalog | null,
  options: StartUserOptions = {},
): UserState {
  const muscleGoals = options.muscleGoals ?? null;
  const applyBalance = options.applyBalance ?? true;

  const [vMin, vMax] = initialVolumeBounds(profile);
  const state = makeUserState(profile);
  state.volume_min = vMin;
  state.volume_max = vMax;

  if (muscleGoals && Object.keys(muscleGoals).length > 0) {
    state.muscle_goals = { ...muscleGoals };
    if (applyBalance) {
      for (const sg of applyBalanceRules(state.muscle_goals)) {
        state.muscle_goals[sg.muscle] = sg;
      }
    }
  }

  return state;
}

export function bootstrapMuscleGoalsFromProfile(
  profile: Profile,
  priorityMuscles: readonly string[],
): Record<string, MuscleGoal> {
  const targetObj = objectiveToMuscleObjective(profile.objective);
  const goals: Record<string, MuscleGoal> = {};
  priorityMuscles.forEach((m, i) => {
    goals[m] = makeMuscleGoal({
      muscle: m,
      objective: targetObj,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });
  return goals;
}

export function calibrateInitialE1rm(
  state: UserState,
  catalog: Catalog,
  testResults: readonly SetFeedback[],
): Record<string, number> {
  const setE1rms: Record<string, number[]> = {};
  const bw = state.profile.bodyweight_kg;
  for (const fb of testResults) {
    const ex = catalog.get(fb.exercise_id);
    const totalLoad = effectiveLoadForE1rm(fb.load_kg, ex, bw);
    const e1rmO = e1rmObserved(totalLoad, fb.reps_done, fb.rpe_perceived);
    (setE1rms[fb.exercise_id] ??= []).push(e1rmO);
  }
  for (const [exId, vals] of Object.entries(setE1rms)) {
    state.e1rm[exId] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return { ...state.e1rm };
}

// =============================================================================
// 2. Bootstrap heuristique d'e1RM
// =============================================================================

const BOOTSTRAP_PCT: Record<string, number> = {
  pectoraux: 0.7, quadriceps: 1.0, ischios: 1.2, fessiers: 1.5,
  dos_largeur: 0.6, dos_epaisseur: 0.7, trapezes_hauts: 1.0,
  deltos_lateraux: 0.4, deltos_posterieurs: 0.2,
  biceps: 0.4, triceps: 0.5, abdos: 0.3,
  obliques: 0.2, lombaires: 0.5, mollets: 1.0,
};

/**
 * Conv #20 — Facteur d'ajustement bootstrap pour DUMBBELL.
 *
 * Convention catalogue Coach OS : pour les exos haltères, le `load_kg` saisi
 * (et donc l'e1RM stocké) est exprimé **par haltère**. Pour un bilateral
 * comme bench_db, ce per-haltère vaut ≈ moitié du barbell-équivalent total
 * (chaque DB ne porte que la moitié du travail). Le `BOOTSTRAP_PCT` ci-dessus
 * est calibré sur les ratios barbell totaux → on divise par 2 pour les
 * DUMBBELL. Pour les unilatéraux (concentration_curl, bulgarian_split…),
 * l'approximation reste correcte au premier ordre — la calibration
 * intra-séance corrige en 1-2 séries fiables. Cf. Conv #17b
 * (`ALEX_SWAP_E1RM.ohp_db_seated = 20 kg/haltère` posé manuellement parce
 * que le bootstrap retournait ~34 kg).
 */
const BOOTSTRAP_DUMBBELL_FACTOR = 0.5;

/**
 * Bloc R — Facteur d'ajustement bootstrap pour les ISOLATIONS.
 *
 * `BOOTSTRAP_PCT` est calé sur la force d'un muscle dans son mouvement
 * principal (polyarticulaire), pas sur une isolation : `deltos_lateraux 0,4`
 * × 75 kg = 30 kg d'« e1RM » d'élévation latérale = aberrant. On divise donc
 * par 2 pour les exos d'isolation (cumulable avec le facteur DUMBBELL). La
 * recalibration intra-séance corrige le reste en 1-2 séries.
 */
const BOOTSTRAP_ISOLATION_FACTOR = 0.5;

export function bootstrapE1rmIfMissing(state: UserState, exercise: Exercise): number {
  if (exercise.id in state.e1rm) return state.e1rm[exercise.id]!;
  const bw = state.profile.bodyweight_kg;
  const primaires = exercisePrimaires(exercise);
  let pct: number;
  if (primaires.length > 0) {
    pct = primaires.reduce((acc, m) => acc + (BOOTSTRAP_PCT[m] ?? 0.5), 0) / primaires.length;
  } else {
    pct = 0.5;
  }
  // Bloc R — plus de plancher : `Math.max(20, …)` forçait ≥ 20 kg d'e1RM sur
  // tout (pour passer dessous il faudrait peser comme un enfant) → absurde sur
  // les petites isolations. On garde juste `bw × pct`, modulé par les facteurs.
  let load = bw * pct;
  if (exercise.charge === ChargeType.DUMBBELL) load *= BOOTSTRAP_DUMBBELL_FACTOR;
  if (exercise.type === ExType.ISOLATION) load *= BOOTSTRAP_ISOLATION_FACTOR;
  return load;
}


// =============================================================================
// 4. Génération d'une séance — voie nouvelle (lit current_cycle_plan)
// =============================================================================

export function generateSession(
  state: UserState,
  catalog: Catalog,
  dayIndex: number,
  seanceDate: string,
): SessionPlan {
  if (state.current_cycle_plan === null) {
    throw new Error(
      'state.current_cycle_plan est null — appelle autoGenerateCyclePlanV3 ' +
      'avant generateSession.',
    );
  }
  const days = state.current_cycle_plan.days;
  if (dayIndex < 0 || dayIndex >= days.length) {
    throw new Error(`day_index=${dayIndex} hors plage [0, ${days.length})`);
  }

  const day: DayTemplate = days[dayIndex]!;
  const items: SessionItem[] = [];

  // Nb de séries par exo selon la phase du cycle (lit progression[]).
  // Chantier B — semaine 5 REFUSÉE (déload non actif) = semaine NORMALE : on
  // retombe sur le compte de séries de la semaine 4 (progression[3]) au lieu du
  // compte déload (progression[4], ÷2). Semaine 5 acceptée → compte déload.
  let weekIdx = state.current_week_in_cycle - 1;
  weekIdx = Math.max(0, Math.min(4, weekIdx));
  const effWeekIdx = weekIdx === 4 && !isDeloadActive(state) ? 3 : weekIdx;

  const rpeTargets: number[] = [];
  for (const planned of day.exercises) {
    const ex = catalog.get(planned.exercise_id);
    let nSets =
      planned.progression && planned.progression.length > effWeekIdx
        ? planned.progression[effWeekIdx]!
        : planned.base_sets;
    nSets = Math.max(1, nSets);
    // A-2 (#73) — plancher de 2 séries en récupération appliqué aussi à la
    // LECTURE du plan : les cycles générés avant le correctif portent encore un
    // `progression[4]` à 1 série et ne se régénèrent qu'au cycle suivant. On ne
    // remonte jamais au-dessus du compte de semaine normale (un exo
    // volontairement à 1 série reste à 1).
    if (effWeekIdx === 4) {
      const normalSets = planned.progression?.[3] ?? planned.base_sets;
      nSets = Math.max(nSets, Math.min(2, Math.max(1, normalSets)));
    }

    // Conv #20 — bootstrap purement transitoire. Avant : on persistait le
    // résultat dans state.e1rm[ex.id], ce qui faisait apparaître un "plafond
    // enregistré" dans le Catalogue pour des exos jamais réellement faits.
    // Décision : state.e1rm ne contient QUE des valeurs mesurées
    // (issues de `updateE1rmForExercise` après feedback réel). Le bootstrap
    // n'est utilisé que pour la prescription en cours et recalculé à chaque
    // génération.
    const e1rmTotal = bootstrapE1rmIfMissing(state, ex);

    const prescription: SetPrescription = buildPrescription(
      ex, e1rmTotal, state.profile, state.current_week_in_cycle,
      {
        muscleGoals:
          Object.keys(state.muscle_goals).length > 0 ? state.muscle_goals : null,
        deloadActive: isDeloadActive(state),
        state,
      },
    );
    const sets: SetPrescription[] = [];
    for (let i = 0; i < nSets; i++) sets.push(prescription);
    items.push({ exercise_id: ex.id, sets });
    rpeTargets.push(prescription.rpe_target);

    for (const m of exercisePrimaires(ex)) {
      state.last_used_for_muscle[m] = ex.id;
    }
  }

  const rpeAvg = rpeTargets.length > 0
    ? rpeTargets.reduce((a, b) => a + b, 0) / rpeTargets.length
    : 7.0;

  const planOut: SessionPlan = {
    seance_date: seanceDate,
    week_in_cycle: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
    rpe_target: rpeAvg,
    items,
    label: day.label,
    // Bloc G — la séance générée hérite du nom custom du jour de cycle (la
    // rotation reste portée par `label`).
    custom_name: day.custom_name ?? null,
  };

  return planOut;
}

export interface BuildCustomSessionArgs {
  readonly seanceDate: string;
  /** Slots (exo + nb de séries) déjà choisis par l'UI (base preset + édits). */
  readonly slots: readonly { readonly exerciseId: string; readonly nSets: number }[];
  /** Nom affiché choisi par l'user (sinon `null`). */
  readonly displayName?: string | null;
}

/**
 * Bloc G (Conv #32) — Construit le `SessionPlan` d'une séance custom
 * (hors-rotation) à partir de slots déjà choisis. Pose une prescription par
 * série via `buildPrescription` (+ bootstrap e1RM transitoire NON persisté,
 * comme `generateSession`/`replaceSessionItem`).
 *
 * `label` reste `'Séance libre'` : une séance custom n'entre jamais dans la
 * rotation A/B/C (cf. `suggestNextSession`). Le nom lisible vit dans
 * `custom_name`.
 */
export function buildCustomSessionPlan(
  state: UserState,
  catalog: Catalog,
  args: BuildCustomSessionArgs,
): SessionPlan {
  const items: SessionItem[] = [];
  for (const slot of args.slots) {
    const ex = catalog.get(slot.exerciseId);
    const e1rmTotal = bootstrapE1rmIfMissing(state, ex);
    const prescription = buildPrescription(
      ex,
      e1rmTotal,
      state.profile,
      state.current_week_in_cycle,
      {
        muscleGoals:
          Object.keys(state.muscle_goals).length > 0 ? state.muscle_goals : null,
        deloadActive: isDeloadActive(state),
        state,
      },
    );
    const n = Math.max(1, Math.min(10, Math.round(slot.nSets)));
    const sets: SetPrescription[] = [];
    for (let i = 0; i < n; i++) sets.push({ ...prescription });
    items.push({ exercise_id: slot.exerciseId, sets });
  }
  const name = args.displayName?.trim();
  return {
    seance_date: args.seanceDate,
    week_in_cycle: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
    rpe_target: 8,
    items,
    label: 'Séance libre',
    custom_name: name !== undefined && name.length > 0 ? name : null,
  };
}

/**
 * Remplace l'exo à `itemIndex` d'un `SessionPlan` existant par `newExerciseId`,
 * en recalculant la prescription (charges / reps / RPE) avec `buildPrescription`
 * pour le nouvel exo et en conservant le nombre de séries.
 *
 * Mute `state` pour bootstrapper `state.e1rm[newExerciseId]` si absent (même
 * logique que `generateSession`). Retourne un NOUVEAU `SessionPlan` — l'appelant
 * persiste l'ancien `sessionId` avec ce nouveau plan.
 *
 * Origine Conv #10d : Azur veut pouvoir remplacer un exo pendant la séance
 * si une machine n'est pas dispo. Plus permissif que la sélection initiale —
 * le candidat peut venir d'un autre pattern (cf. `alternativeVariantsFor`
 * mode `expand=true`).
 */
export function replaceSessionItem(
  plan: SessionPlan,
  itemIndex: number,
  newExerciseId: string,
  state: UserState,
  catalog: Catalog,
): SessionPlan {
  if (itemIndex < 0 || itemIndex >= plan.items.length) {
    throw new Error(`item_index=${itemIndex} hors plage [0, ${plan.items.length})`);
  }
  const newEx = catalog.get(newExerciseId);
  const oldItem = plan.items[itemIndex]!;
  const nSets = Math.max(1, oldItem.sets.length);

  // Conv #20 — bootstrap transitoire, pas de persistance (cf. generateSession).
  const e1rmTotal = bootstrapE1rmIfMissing(state, newEx);
  const prescription: SetPrescription = buildPrescription(
    newEx, e1rmTotal, state.profile, state.current_week_in_cycle,
    {
      muscleGoals:
        Object.keys(state.muscle_goals).length > 0 ? state.muscle_goals : null,
      deloadActive: isDeloadActive(state),
      state,
    },
  );
  const newSets: SetPrescription[] = [];
  for (let i = 0; i < nSets; i++) newSets.push(prescription);

  const newItems = plan.items.map((it, i) =>
    i === itemIndex ? { exercise_id: newEx.id, sets: newSets } : it,
  );

  // RPE moyen ré-agrégé (en cas de cible RPE différente entre exos).
  const rpeAvg = newItems.length === 0
    ? plan.rpe_target
    : newItems.reduce((acc, it) => acc + (it.sets[0]?.rpe_target ?? plan.rpe_target), 0) /
      newItems.length;

  for (const m of exercisePrimaires(newEx)) {
    state.last_used_for_muscle[m] = newEx.id;
  }

  return {
    ...plan,
    items: newItems,
    rpe_target: rpeAvg,
  };
}

// =============================================================================
// 5. Enregistrement du feedback d'une séance
// =============================================================================

export type RecordFeedbackResult = Record<string, E1rmUpdate | null>;

export interface RecordFeedbackOptions {
  /**
   * Plan d'origine de la séance — si fourni, sert à détecter qu'une charge a été
   * soulevée plus lourd que la prescription (Bloc L, `prescribed` de
   * `updateE1rmForExercise`).
   */
  plan?: SessionPlan | null;
  /**
   * Ensemble des exos qui étaient déjà calibrés *avant* cette séance (= un
   * snapshot e1RM existait pour eux en BDD). Les exos absents sont en
   * première vraie mesure : on saute le filtre EMA pour ne pas mélanger
   * l'agrégation fiable avec un éventuel bootstrap heuristique. Cf. décision
   * conv #16 — calibration série-par-série uniquement à la 1re séance d'un exo.
   *
   * Si non fourni, fallback comportement historique (EMA partout).
   */
  calibratedExoIds?: ReadonlySet<string> | null;
}

export function recordFeedback(
  state: UserState,
  catalog: Catalog,
  sessionFeedback: SessionFeedback,
  options: RecordFeedbackOptions = {},
): RecordFeedbackResult {
  const byEx: Record<string, SetFeedback[]> = {};
  for (const f of sessionFeedback.sets) {
    (byEx[f.exercise_id] ??= []).push(f);
  }

  // Conv #21bis — Une semaine de déload (S5) ne mesure pas un plafond :
  // l'utilisateur travaille volontairement à charge réduite et RPE ~6 pour
  // décharger la fatigue (Israetel). Mécaniquement, Epley donnerait un e1RM
  // plus bas (charge basse × peu de reps × RPE peu informatif) ; passer
  // cette valeur dans l'EMA tire `state.e1rm` vers le bas → la prescription
  // post-déload partirait d'un plafond artificiellement réduit, et le
  // Catalogue afficherait une "régression" qui n'en est pas une.
  // Chantier B — déload opt-in : ce régime ne s'applique QUE si la récup a été
  // ACCEPTÉE. Une semaine 5 refusée est une semaine normale.
  // A-3 (#73) — on ne saute plus tout : la récup passe en cliquet MONTANT.
  // Le plafond ne peut pas baisser à cause d'une charge allégée, mais s'il monte
  // (l'user a chargé de son propre chef), le gain est mesuré, enregistré
  // (snapshot → courbe Force) et affiché au bilan. S'il ne bouge pas, il reste
  // affiché à Δ 0 au lieu de disparaître du bilan.
  const recoveryWeek =
    sessionFeedback.week_in_cycle === DELOAD_WEEK_IN_CYCLE &&
    state.deload_decision === 'accepted';

  const calibrated = options.calibratedExoIds ?? null;

  // Bloc L — charge/reps préconisées par exo (1re série, toutes identiques),
  // pour détecter une charge volontairement plus lourde que la prescription.
  const prescribedByExo = new Map<
    string,
    { load_kg: number; target_reps: number }
  >();
  if (options.plan) {
    for (const item of options.plan.items) {
      const first = item.sets[0];
      if (first) {
        prescribedByExo.set(item.exercise_id, {
          load_kg: first.load_kg,
          target_reps: first.reps,
        });
      }
    }
  }

  const summary: RecordFeedbackResult = {};
  for (const [exId, fbs] of Object.entries(byEx)) {
    const ex = catalog.get(exId);
    // En récup, un exo jamais mesuré n'est pas calibré par une séance allégée :
    // `updateE1rmForExercise` renvoie `null` et le bilan saute l'entrée.
    const skipEma = calibrated !== null && !calibrated.has(exId);
    const e1rmUpdate = updateE1rmForExercise(state, ex, fbs, undefined, {
      skipEma: skipEma && !recoveryWeek,
      ratchetUpOnly: recoveryWeek,
      prescribed: prescribedByExo.get(exId),
    });
    summary[exId] = e1rmUpdate;
    // #63 — à la 1re VRAIE mesure d'un exo (calibration : `skipEma` = pas encore
    // de snapshot, et update DÉFINITIVE), le plancher de charge avait été semé
    // sur un e1RM bootstrap sans rapport avec la capacité réelle (plafond mesuré
    // à 58 kg mais prescription bloquée à ~28 kg, car l'anti-régression du cliquet
    // n'adopte pas une série de calibration menée à effort élevé). On efface ce
    // plancher bootstrap ; `updatePrescribedLoadFloorForExercise` juste après le
    // re-sème depuis la charge réellement effectuée à la calibration.
    if (skipEma && !recoveryWeek && e1rmUpdate !== null && e1rmUpdate.definitive) {
      delete state.prescribed_load_floor[exId];
    }
    // Refonte progression — cliquet de charge : graduation R+3 / anti-régression /
    // descente sur `prescribed_load_floor`. En récup (A-3, #73), seule
    // l'anti-régression tourne — cf. `UpdateLoadFloorOptions.adoptionOnly`.
    updatePrescribedLoadFloorForExercise(state, ex, fbs, { adoptionOnly: recoveryWeek });
    // Chantier D — cliquet de reps (exos poids du corps pur + PDC). Mut. excl.
    // avec le cliquet de charge : chaque fonction no-op hors de son périmètre.
    // Gelé en récup (comme avant #73) : le RPE cible à 6 gonfle `n_équiv` et
    // ferait grimper le plancher de reps sans effort réel.
    if (!recoveryWeek) updatePrescribedRepsFloorForExercise(state, ex, fbs);
  }

  state.history.push(sessionFeedback);
  return summary;
}

// =============================================================================
// 6. Fin de semaine
// =============================================================================

export interface EndOfWeekResult {
  event: string;
  week_before: number;
  cycle_before: number;
  current_week: number;
  cycle_index: number;
}

/**
 * Passe à la semaine suivante du cycle. Chantier B — plus de détection de
 * plateau ni de mode récupération : la bascule est un simple `advanceWeek`
 * (le plateau est indicatif, calculé au bilan de cycle).
 */
export function endOfWeek(state: UserState): EndOfWeekResult {
  const weekBefore = state.current_week_in_cycle;
  const cycleBefore = state.cycle_index;
  const event = advanceWeek(state);

  return {
    event,
    week_before: weekBefore,
    cycle_before: cycleBefore,
    current_week: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
  };
}

// =============================================================================
// 7. Fin de cycle
// =============================================================================

/**
 * Conv #76 — ne mute plus rien. `adjustVolumeBoundsAtCycleEnd` a été supprimé
 * (cf. `lifecycle.ts` §4) : une fin de cycle produit un bilan, elle ne touche
 * plus aux bornes de volume. La fonction reste le point d'entrée du bilan pour
 * ne pas disperser l'API du moteur.
 */
export function endOfCycle(state: UserState, catalog: Catalog) {
  return generateCycleReview(state, catalog);
}
