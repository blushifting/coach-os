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
  MUSCLES,
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
  targetRpe,
} from './prescription';
import { updateE1rmForExercise, type E1rmUpdate } from './feedback';
import {
  advanceWeek,
  aggregateForceIndex,
  DELOAD_WEEK_IN_CYCLE,
  initialVolumeBounds,
  targetVolume,
} from './volume';
import { applyBalanceRules } from './balance';
import {
  adjustVolumeBoundsAtCycleEnd,
  decrementRecoveryWeek,
  generateCycleReview,
} from './lifecycle';

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
  for (const m of MUSCLES) {
    state.plateau_counter[m] = 0;
  }

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
// 3. Dette de volume hebdo (Conv #11a)
// =============================================================================

/**
 * Cap de séries supplémentaires qu'on peut ajouter sur un exo pour rattraper
 * de la dette : 30 % du nb prescrit (arrondi supérieur, min 1).
 */
function debtCapForExo(baseSets: number): number {
  return Math.max(1, Math.ceil(baseSets * 0.3));
}

/**
 * Accumule dans `state.weekly_volume_debt` les séries non réalisées de la
 * séance terminée. Pour chaque exo, `missed = setsPrescris - setsFaits`, et
 * on ajoute `missed` à chacun de ses muscles primaires.
 *
 * Pas explicite côté utilisateur — c'est juste un report pour la séance
 * suivante de la même semaine (cf. Conv #11a). Reset par `endOfWeek`.
 */
export function applyMissedVolumeToDebt(
  state: UserState,
  catalog: Catalog,
  plan: SessionPlan,
  feedback: SessionFeedback,
): void {
  const doneByExo: Record<string, number> = {};
  for (const f of feedback.sets) {
    doneByExo[f.exercise_id] = (doneByExo[f.exercise_id] ?? 0) + 1;
  }
  for (const item of plan.items) {
    const prescribed = item.sets.length;
    const done = doneByExo[item.exercise_id] ?? 0;
    const missed = Math.max(0, prescribed - done);
    if (missed === 0) continue;
    let ex: Exercise;
    try {
      ex = catalog.get(item.exercise_id);
    } catch {
      continue;
    }
    for (const m of exercisePrimaires(ex)) {
      state.weekly_volume_debt[m] = (state.weekly_volume_debt[m] ?? 0) + missed;
    }
  }
}

/**
 * Consomme `state.weekly_volume_debt` sur le plan de séance en cours de
 * génération : pour chaque muscle avec dette, ajoute des séries supplémentaires
 * (capées à 30 % du base) sur les exos de la séance qui le couvrent en primaire.
 * Décrémente la dette de chaque muscle primaire des exos modifiés.
 *
 * Mute `plan.items[i].sets` (ajoute des copies de la prescription) et
 * `state.weekly_volume_debt` (décrémente, supprime les entrées à 0).
 */
function consumeWeeklyDebt(
  plan: SessionPlan,
  state: UserState,
  catalog: Catalog,
): void {
  const debt = state.weekly_volume_debt;
  if (Object.keys(debt).length === 0) return;
  const extras: number[] = plan.items.map(() => 0);
  const baseSets: number[] = plan.items.map((it) => it.sets.length);

  for (const m of Object.keys(debt)) {
    if ((debt[m] ?? 0) <= 0) continue;
    for (let i = 0; i < plan.items.length; i++) {
      if ((debt[m] ?? 0) <= 0) break;
      let ex: Exercise;
      try {
        ex = catalog.get(plan.items[i]!.exercise_id);
      } catch {
        continue;
      }
      if (!exercisePrimaires(ex).includes(m)) continue;
      const cap = debtCapForExo(baseSets[i]!);
      const remainingCap = cap - extras[i]!;
      if (remainingCap <= 0) continue;
      const toAdd = Math.min(debt[m]!, remainingCap);
      const template = plan.items[i]!.sets[0];
      if (template === undefined) continue;
      for (let k = 0; k < toAdd; k++) plan.items[i]!.sets.push(template);
      extras[i] = extras[i]! + toAdd;
      for (const m2 of exercisePrimaires(ex)) {
        debt[m2] = Math.max(0, (debt[m2] ?? 0) - toAdd);
      }
    }
  }

  for (const m of Object.keys(debt)) {
    if ((debt[m] ?? 0) <= 0) delete debt[m];
  }
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

  // Nb de séries par exo selon la phase du cycle (lit progression[])
  let weekIdx = state.current_week_in_cycle - 1;
  weekIdx = Math.max(0, Math.min(4, weekIdx));

  const rpeTargets: number[] = [];
  for (const planned of day.exercises) {
    const ex = catalog.get(planned.exercise_id);
    let nSets =
      planned.progression && planned.progression.length > weekIdx
        ? planned.progression[weekIdx]!
        : planned.base_sets;
    nSets = Math.max(1, nSets);

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
        recoveryMode: state.recovery_mode,
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

  // Conv #11a : injecte la dette de volume hebdo non réalisée. Mute `items[i].sets`
  // (ajoute des séries) et `state.weekly_volume_debt` (décrémente).
  consumeWeeklyDebt(planOut, state, catalog);

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
        recoveryMode: state.recovery_mode,
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
      recoveryMode: state.recovery_mode,
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
   * Plan d'origine de la séance — si fourni, on calcule la dette de volume
   * (séries non réalisées) et on l'accumule dans `state.weekly_volume_debt`
   * pour report sur la prochaine séance de la semaine (Conv #11a).
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
  // Catalogue afficherait une "régression" qui n'en est pas une. On skip
  // donc l'update e1RM pour la semaine 5. La courbe Force exclut aussi ces
  // points (cf. `computeE1rmHistory`).
  const skipE1rmEntirely = sessionFeedback.week_in_cycle === DELOAD_WEEK_IN_CYCLE;

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
    if (skipE1rmEntirely) {
      // On retourne null : pas de "tuple [old, new]" car aucune update.
      // Le bilan séance (`computeSessionSummary`) skip ces entrées.
      summary[exId] = null;
      continue;
    }
    const skipEma = calibrated !== null && !calibrated.has(exId);
    summary[exId] = updateE1rmForExercise(state, ex, fbs, undefined, {
      skipEma,
      prescribed: prescribedByExo.get(exId),
    });
  }

  if (options.plan) {
    applyMissedVolumeToDebt(state, catalog, options.plan, sessionFeedback);
  }

  state.history.push(sessionFeedback);
  return summary;
}

// =============================================================================
// 6. Fin de semaine
// =============================================================================

export interface EndOfWeekResult {
  event: string;
  plateau_detected: Record<string, boolean>;
  rpe_means: Record<string, number>;
  force_index: Record<string, number>;
  week_before: number;
  cycle_before: number;
  current_week: number;
  cycle_index: number;
}

export function endOfWeek(state: UserState, catalog: Catalog): EndOfWeekResult {
  const musclesOf: Record<string, Record<string, number>> = {};
  for (const x of catalog.all()) {
    musclesOf[x.id] = x.muscles;
  }

  const currentIndex: Record<string, number> = {};
  for (const m of MUSCLES) {
    currentIndex[m] = aggregateForceIndex(state, m, musclesOf);
  }

  const lastWeekSessions = state.history.filter(
    (s) =>
      s.cycle_index === state.cycle_index &&
      s.week_in_cycle === state.current_week_in_cycle,
  );

  const rpeMeansByMuscle: Record<string, number> = {};
  for (const m of MUSCLES) {
    const rpes: number[] = [];
    for (const s of lastWeekSessions) {
      for (const f of s.sets) {
        const coef = musclesOf[f.exercise_id]?.[m] ?? 0;
        if (coef >= 1.0) rpes.push(f.rpe_perceived);
      }
    }
    if (rpes.length > 0) {
      rpeMeansByMuscle[m] = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    }
  }

  const rpeTgt = targetRpe(state.profile.objective, state.current_week_in_cycle);
  const plateauNow: Record<string, boolean> = {};
  for (const m of MUSCLES) {
    const rpeObs = rpeMeansByMuscle[m];
    if (rpeObs === undefined) continue;
    if (rpeObs >= rpeTgt + 0.5) {
      state.plateau_counter[m] = (state.plateau_counter[m] ?? 0) + 1;
    } else {
      state.plateau_counter[m] = 0;
    }
    plateauNow[m] = (state.plateau_counter[m] ?? 0) >= 2;
  }

  const plateauAny = Object.values(plateauNow).some(Boolean);

  const hitVmaxOk: Record<string, boolean> = {};
  for (const m of MUSCLES) {
    const v = targetVolume(state, m);
    if (
      state.volume_max[m] !== undefined &&
      v >= state.volume_max[m]! - 0.001 &&
      (state.plateau_counter[m] ?? 0) === 0
    ) {
      hitVmaxOk[m] = true;
    }
  }

  const weekBefore = state.current_week_in_cycle;
  const cycleBefore = state.cycle_index;
  const event = advanceWeek(state, plateauAny, hitVmaxOk);

  decrementRecoveryWeek(state);

  // Conv #11a : la dette de volume ne traverse pas la frontière hebdo —
  // un manque ponctuel n'est pas grave en RPE-based, on repart propre.
  state.weekly_volume_debt = {};

  return {
    event,
    plateau_detected: plateauNow,
    rpe_means: rpeMeansByMuscle,
    force_index: currentIndex,
    week_before: weekBefore,
    cycle_before: cycleBefore,
    current_week: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
  };
}

// =============================================================================
// 7. Fin de cycle
// =============================================================================

export function endOfCycle(state: UserState, catalog: Catalog) {
  const review = generateCycleReview(state, catalog);
  adjustVolumeBoundsAtCycleEnd(state, review);
  return review;
}
