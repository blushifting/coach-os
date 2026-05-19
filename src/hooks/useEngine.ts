/**
 * `useEngine` — façade React entre l'UI et le moteur Coach OS.
 *
 * Pattern de chaque action :
 *   1. Cloner `userState` du store (structuredClone — gère Set/Map).
 *   2. Appeler la fonction du moteur (qui mute le clone).
 *   3. Persister atomiquement (tables blob + dérivées) via `db/transactions`.
 *   4. Mettre à jour le store + recharger les vues d'historique si pertinent.
 *
 * Ce hook est l'unique chemin d'écriture autorisé sur `userState`. L'UI ne
 * doit JAMAIS appeler `setUserState` directement.
 */

import { useMemo } from 'react';
import { Catalog } from '@/engine/catalog';
import * as engine from '@/engine/engine';
import { applyBalanceRules } from '@/engine/balance';
import { generateCyclePlan } from '@/engine/cycle_planner';
import { fitGuidedProgram, getGuidedProgram } from '@/engine/guided_programs';
import { initialVolumeBounds } from '@/engine/volume';
import type {
  MuscleGoal,
  Profile,
  SessionFeedback,
  SessionPlan,
  UserState,
} from '@/engine/models';
import { getDb, resetDbInstance } from '@/db';
import { loadUserState } from '@/db/repositories/userState.repo';
import {
  txCancelSession,
  txCommitManualE1rm,
  txCommitSessionFeedback,
  txEndOfCycle,
  txEndOfWeek,
  txInitUser,
  txSaveSessionPlan,
  txSaveUserStateOnly,
  txUpdateSessionPlan,
} from '@/db/transactions';
import { effectiveLoadForE1rm } from '@/engine/prescription';
import type { Exercise } from '@/engine/models';
import { importFromJsonString } from '@/io/import';
import { useCoachOsStore, type HistorySnapshot } from '@/store';

function cloneState(s: UserState): UserState {
  return structuredClone(s);
}

function requireUserState(): UserState {
  const s = useCoachOsStore.getState().userState;
  if (s === null) {
    throw new Error('userState non initialisé : appeler startUser() ou bootstrap() d\'abord.');
  }
  return cloneState(s);
}

function requireCatalog(): Catalog {
  const c = useCoachOsStore.getState().catalog;
  if (c === null) throw new Error('catalog non chargé : appeler bootstrap() d\'abord.');
  return c;
}

// =============================================================================
// Bootstrap (au démarrage de l'app)
// =============================================================================

async function loadHistorySnapshot(): Promise<HistorySnapshot> {
  const db = getDb();
  const [sessions, feedbacks, e1rmSnapshots, cycles] = await Promise.all([
    db.sessions.orderBy('seance_date').toArray(),
    db.feedbacks.orderBy('seance_date').toArray(),
    db.e1rmSnapshots.orderBy('date').toArray(),
    db.cycles.orderBy('cycle_index').toArray(),
  ]);
  return { sessions, feedbacks, e1rmSnapshots, cycles };
}

/**
 * À appeler au mount de l'app : charge le catalog, lit l'état persisté
 * (userState + history) et hydrate le store. Idempotent.
 */
export async function bootstrap(): Promise<void> {
  const store = useCoachOsStore.getState();
  if (store.bootstrapped) return;
  const catalog = new Catalog();
  const [userState, history] = await Promise.all([loadUserState(), loadHistorySnapshot()]);
  useCoachOsStore.setState({
    catalog,
    userState,
    history,
    bootstrapped: true,
  });
}

export async function refreshHistory(): Promise<void> {
  const history = await loadHistorySnapshot();
  useCoachOsStore.setState({ history });
}

// =============================================================================
// Init utilisateur (Onboarding terminé)
// =============================================================================

export interface StartUserArgs {
  profile: Profile;
  muscleGoals?: Record<string, MuscleGoal> | null;
  applyBalance?: boolean;
  programmeId?: string | null;
}

export async function startUser(args: StartUserArgs): Promise<UserState> {
  const catalog = requireCatalog();
  const newState = engine.startUser(args.profile, catalog, {
    muscleGoals: args.muscleGoals ?? null,
    applyBalance: args.applyBalance ?? true,
  });
  if (args.programmeId !== undefined && args.programmeId !== null) {
    newState.active_guided_program_id = args.programmeId;
  }
  await txInitUser(newState, args.programmeId ?? null);
  await refreshHistory();
  useCoachOsStore.setState({ userState: newState });
  return newState;
}

// =============================================================================
// Génération du WeeklyTemplate Cycle 1 (post-onboarding)
// =============================================================================

export interface InitialCyclePlanResult {
  /** `null` si un programme guidé est bloqué par l'équipement. */
  state: UserState | null;
  blocking: string[];
}

/**
 * Génère et persiste le `WeeklyTemplate` Cycle 1.
 *
 * Mode guidé : `fitGuidedProgram(program, profile, equipment, plafonds={}, catalog)`.
 * Mode custom : `generateCyclePlan(state, catalog)`.
 *
 * Les exos sans e1RM connu sont bootstrap heuristiquement à la 1re séance
 * via `bootstrapE1rmIfMissing` (engine.ts) et raffinés par feedback RPE
 * (calibration transparente, depuis le retrait de la Séance 0 — Conv #12).
 *
 * Idempotent : ne régénère pas si `state.current_cycle_plan` est déjà posé.
 */
export async function generateInitialCyclePlan(): Promise<InitialCyclePlanResult> {
  const catalog = requireCatalog();
  const next = requireUserState();
  if (next.current_cycle_plan !== null) {
    useCoachOsStore.setState({ userState: next });
    return { state: next, blocking: [] };
  }

  const programmeId = next.active_guided_program_id;
  if (programmeId !== null) {
    const program = getGuidedProgram(programmeId);
    if (program === null) {
      throw new Error(`Programme guidé inconnu : ${programmeId}`);
    }
    const equipment = new Set(next.profile.available_equip);
    const { weekly, blocking } = fitGuidedProgram(
      program,
      next.profile,
      equipment,
      next.e1rm,
      catalog,
      next.cycle_index,
    );
    if (weekly === null) {
      return { state: null, blocking };
    }
    next.current_cycle_plan = weekly;
  } else {
    next.current_cycle_plan = generateCyclePlan(next, catalog);
  }

  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return { state: next, blocking: [] };
}

export interface VariantReplacementInput {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly newExerciseId: string;
}

/**
 * Conv #11b — Applique les variantes choisies dans le Step5 d'onboarding sur
 * le `current_cycle_plan` posé. Préserve `base_sets`, `progression`,
 * `progression_rule`, `role`, `intensity_scheme` — seul `exercise_id` du slot
 * ciblé est remplacé.
 * Idempotent : si la liste est vide ou si le plan n'existe pas, no-op silencieux.
 */
export async function applyVariantReplacements(
  replacements: ReadonlyArray<VariantReplacementInput>,
): Promise<UserState> {
  const next = requireUserState();
  if (next.current_cycle_plan === null || replacements.length === 0) {
    useCoachOsStore.setState({ userState: next });
    return next;
  }
  for (const r of replacements) {
    const day = next.current_cycle_plan.days[r.dayIndex];
    if (day === undefined) continue;
    const slot = day.exercises[r.slotIndex];
    if (slot === undefined) continue;
    slot.exercise_id = r.newExerciseId;
  }
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

// =============================================================================
// Génération + stockage d'une séance
// =============================================================================

export interface GenerateSessionArgs {
  dayIndex: number;
  seanceDate: string;
}

/**
 * Crée le `SessionPlan` pour un jour du `current_cycle_plan` et le persiste en
 * DB (status='planned'). **Ne charge pas** la séance dans `currentSessionPlan` —
 * c'est pour ça qu'on a aussi `loadPlannedSessionForRunner` (cf. #10d : on
 * sépare programmation et démarrage).
 *
 * Idempotent côté `seance_date` : si une session existe déjà pour cette date,
 * on la remplace pour permettre la re-planification (mais on garde l'ancien id).
 */
export async function planSessionForDay(
  args: GenerateSessionArgs,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = engine.generateSession(next, catalog, args.dayIndex, args.seanceDate);
  const sessionId = await txSaveSessionPlan(plan, next);
  useCoachOsStore.setState({ userState: next });
  await refreshHistory();
  return { plan, sessionId };
}

/**
 * Charge une séance déjà planifiée (`status='planned'`) dans le runner. Refuse
 * si `seance_date` ≠ date du jour : on ne peut **pas** avancer dans une séance
 * un autre jour que celui pour lequel elle est prévue (cf. Conv #10d).
 *
 * Retourne `{plan, sessionId}` ; si la date diffère, lève une `Error` avec un
 * message FR clair pour qu'on puisse l'afficher dans l'UI si besoin.
 */
export async function loadPlannedSessionForRunner(
  sessionId: number,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const today = new Date();
  const todayKey =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0');
  const row = await getDb().sessions.get(sessionId);
  if (row === undefined) {
    throw new Error(`Séance ${sessionId} introuvable.`);
  }
  if (row.seance_date !== todayKey) {
    throw new Error(
      `Cette séance est prévue le ${row.seance_date}, on est le ${todayKey}. ` +
      `Tu pourras la démarrer le jour prévu.`,
    );
  }
  useCoachOsStore.setState({
    currentSessionPlan: row.plan,
    currentSessionId: sessionId,
  });
  return { plan: row.plan, sessionId };
}

/**
 * Compat : programme + démarre immédiatement (typiquement "commencer maintenant"
 * pour aujourd'hui). Combine `planSessionForDay` + `loadPlannedSessionForRunner`.
 */
export async function generateAndStoreSession(
  args: GenerateSessionArgs,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const { plan, sessionId } = await planSessionForDay(args);
  useCoachOsStore.setState({
    currentSessionPlan: plan,
    currentSessionId: sessionId,
  });
  return { plan, sessionId };
}

// =============================================================================
// Conv #10d — Remplacement d'un exo pendant la séance en cours.
// =============================================================================

export interface ReplaceSessionExerciseArgs {
  readonly itemIndex: number;
  readonly newExerciseId: string;
}

export async function replaceSessionExercise(
  args: ReplaceSessionExerciseArgs,
): Promise<SessionPlan> {
  const catalog = requireCatalog();
  const store = useCoachOsStore.getState();
  const plan = store.currentSessionPlan;
  const sessionId = store.currentSessionId;
  if (plan === null) {
    throw new Error('Aucune séance en cours : currentSessionPlan est null.');
  }
  const next = requireUserState();
  const newPlan = engine.replaceSessionItem(
    plan,
    args.itemIndex,
    args.newExerciseId,
    next,
    catalog,
  );
  if (sessionId !== null) {
    await txUpdateSessionPlan(sessionId, newPlan, next);
  } else {
    await txSaveUserStateOnly(next);
  }
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: newPlan,
  });
  await refreshHistory();
  return newPlan;
}

// =============================================================================
// Conv #10d — Annulation d'une séance planifiée (pas encore commencée).
// =============================================================================

export async function cancelPlannedSession(sessionId: number): Promise<void> {
  const store = useCoachOsStore.getState();
  await txCancelSession(sessionId);
  // Si on annule la séance actuellement en cours dans le store, on la déconnecte.
  if (store.currentSessionId === sessionId) {
    useCoachOsStore.setState({
      currentSessionPlan: null,
      currentSessionId: null,
    });
  }
  await refreshHistory();
}

// =============================================================================
// Saisie manuelle d'un plafond (Conv #12b)
// =============================================================================

export interface SetManualE1rmArgs {
  /** id de l'exo */
  readonly exerciseId: string;
  /** Exercice du catalog (pour effectiveLoadForE1rm — BW loaded/assisted). */
  readonly exercise: Exercise;
  /** Charge à 1 rep telle que saisie par l'user (interface externe : kg ajoutés). */
  readonly loadKg: number;
}

/**
 * Pose un plafond `e1rm[exoId]` à partir d'une charge à 1 rep saisie par
 * l'utilisateur (path "Je connais mon plafond" depuis le banner de calibration).
 *
 * Insère un snapshot daté pour que `e1rmConfidenceFor` bascule en `'measured'`
 * et que le banner disparaisse. Le 1RM = charge totale soulevée selon
 * `effectiveLoadForE1rm` (inclut le bodyweight pour BW loaded/assisted).
 */
export async function setManualE1rm(args: SetManualE1rmArgs): Promise<UserState> {
  const next = requireUserState();
  const e1rmTotal = effectiveLoadForE1rm(
    args.loadKg,
    args.exercise,
    next.profile.bodyweight_kg,
  );
  if (!Number.isFinite(e1rmTotal) || e1rmTotal <= 0) {
    throw new Error(`e1RM invalide : ${e1rmTotal}`);
  }
  next.e1rm[args.exerciseId] = e1rmTotal;
  const today = new Date();
  const dateStr =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0');
  await txCommitManualE1rm({
    state: next,
    exerciseId: args.exerciseId,
    e1rmTotal,
    date: dateStr,
    cycleIndex: next.cycle_index,
    weekInCycle: next.current_week_in_cycle,
  });
  await refreshHistory();
  useCoachOsStore.setState({ userState: next });
  return next;
}

// =============================================================================
// Enregistrement d'un feedback
// =============================================================================

export async function recordFeedbackAndCommit(
  feedback: SessionFeedback,
): Promise<engine.RecordFeedbackResult> {
  const catalog = requireCatalog();
  const next = requireUserState();
  // Conv #11a : on passe le plan courant pour que le moteur calcule la dette
  // de volume non réalisée et l'accumule dans `next.weekly_volume_debt`.
  const plan = useCoachOsStore.getState().currentSessionPlan;
  const summary = engine.recordFeedback(next, catalog, feedback, { plan });
  const sessionId = useCoachOsStore.getState().currentSessionId;
  await txCommitSessionFeedback({ feedback, state: next, sessionId });
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: null,
    currentSessionId: null,
  });
  await refreshHistory();
  return summary;
}

// =============================================================================
// Fin de semaine / fin de cycle
// =============================================================================

export async function endOfWeek(): Promise<engine.EndOfWeekResult> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const result = engine.endOfWeek(next, catalog);
  await txEndOfWeek(next);
  useCoachOsStore.setState({
    userState: next,
    lastEndOfWeekReview: { event: result.event, cycle_index: result.cycle_index },
  });
  return result;
}

export interface EndOfCycleArgs {
  nextProgrammeId?: string | null;
}

// =============================================================================
// Édition du profil (Conv #6c)
// =============================================================================

/**
 * Remplace le `Profile` courant.
 *
 * Recalcule `volume_min` / `volume_max` parce qu'ils dépendent de
 * sex / age / level (cf. `initialVolumeBounds`). Tout le reste (e1rm, history,
 * muscle_goals, current_cycle_plan, équipement overrides…) est conservé.
 *
 * Note : ne régénère pas `current_cycle_plan` — la régénération éventuelle
 * (changement de sessions_per_week / équipement qui invalide le plan) est
 * laissée au flux Cycle-Bilan (`endOfCycle` puis nouveau `generateInitialCyclePlan`).
 */
export async function updateProfile(profile: Profile): Promise<UserState> {
  const next = requireUserState();
  next.profile = profile;
  const [vMin, vMax] = initialVolumeBounds(profile);
  next.volume_min = vMin;
  next.volume_max = vMax;
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Remplace le `muscle_goals` courant et applique R1-R4 par-dessus.
 * `newGoals` doit contenir au minimum les PRIORITAIRE choisis par l'utilisateur ;
 * R1-R4 complète avec les SUGGERE manquants. Les NON_COUVERT explicites
 * fournis dans `newGoals` sont respectés (cf. contrat `applyBalanceRules`).
 */
export async function updateMuscleGoals(
  newGoals: Record<string, MuscleGoal>,
): Promise<UserState> {
  const next = requireUserState();
  const goals: Record<string, MuscleGoal> = { ...newGoals };
  for (const sg of applyBalanceRules(goals)) {
    if (goals[sg.muscle] === undefined) {
      goals[sg.muscle] = sg;
    }
  }
  next.muscle_goals = goals;
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

// =============================================================================
// Reset complet (Conv #6c — bouton "Réinitialiser l'app")
// =============================================================================

/**
 * Efface la DB IndexedDB de Coach OS + reset le store. Le catalogue reste
 * en mémoire pour pouvoir relancer l'onboarding immédiatement.
 *
 * Après appel, `useCoachOsStore.getState().userState === null` et
 * `bootstrapped === true` (DB en état propre et vide) — l'app peut router
 * vers `/welcome` sans repasser par le splash.
 *
 * Note (Conv #10a) : on garde volontairement `bootstrapped: true`. Mettre
 * `bootstrapped: false` ici déclenchait le `SplashScreen` d'`AppShell`,
 * mais `bootstrap()` n'y est appelé qu'au mount initial (deps `[]`) — donc
 * le splash restait figé jusqu'à un rafraîchissement complet de la page.
 */
export async function resetApp(): Promise<void> {
  await getDb().delete();
  resetDbInstance();
  const catalog = useCoachOsStore.getState().catalog;
  useCoachOsStore.setState({
    userState: null,
    currentSessionPlan: null,
    currentSessionId: null,
    history: { sessions: [], feedbacks: [], e1rmSnapshots: [], cycles: [] },
    bootstrapped: true,
    lastEndOfWeekReview: null,
    lastCycleReview: null,
    catalog,
  });
}

// =============================================================================
// Import JSON (Conv #6c — bouton "Importer mes données")
// =============================================================================

/**
 * Importe un fichier JSON d'export Coach OS, remplace toute la DB, puis
 * recharge le store depuis la DB. Lance `ImportValidationError` si invalide.
 */
export async function importDataFromJson(json: string): Promise<void> {
  await importFromJsonString(json);
  const [userState, history] = await Promise.all([loadUserState(), loadHistorySnapshot()]);
  useCoachOsStore.setState({
    userState,
    history,
    bootstrapped: true,
    currentSessionPlan: null,
    currentSessionId: null,
    lastEndOfWeekReview: null,
    lastCycleReview: null,
  });
}

export async function endOfCycle(args: EndOfCycleArgs = {}) {
  const catalog = requireCatalog();
  const before = useCoachOsStore.getState().userState;
  if (before === null) throw new Error('userState non initialisé');
  const closedCycleIndex = before.cycle_index;
  const next = cloneState(before);
  const review = engine.endOfCycle(next, catalog);
  await txEndOfCycle({
    state: next,
    review,
    closedCycleIndex,
    nextProgrammeId: args.nextProgrammeId ?? null,
  });
  await refreshHistory();
  useCoachOsStore.setState({
    userState: next,
    lastCycleReview: review,
  });
  return review;
}

// =============================================================================
// Hook (objet stable d'API) — pour usage dans composants React
// =============================================================================

export interface EngineApi {
  bootstrap: typeof bootstrap;
  refreshHistory: typeof refreshHistory;
  startUser: typeof startUser;
  generateInitialCyclePlan: typeof generateInitialCyclePlan;
  applyVariantReplacements: typeof applyVariantReplacements;
  setManualE1rm: typeof setManualE1rm;
  generateAndStoreSession: typeof generateAndStoreSession;
  planSessionForDay: typeof planSessionForDay;
  loadPlannedSessionForRunner: typeof loadPlannedSessionForRunner;
  replaceSessionExercise: typeof replaceSessionExercise;
  cancelPlannedSession: typeof cancelPlannedSession;
  recordFeedbackAndCommit: typeof recordFeedbackAndCommit;
  endOfWeek: typeof endOfWeek;
  endOfCycle: typeof endOfCycle;
  updateProfile: typeof updateProfile;
  updateMuscleGoals: typeof updateMuscleGoals;
  resetApp: typeof resetApp;
  importDataFromJson: typeof importDataFromJson;
}

export function useEngine(): EngineApi {
  return useMemo<EngineApi>(
    () => ({
      bootstrap,
      refreshHistory,
      startUser,
      generateInitialCyclePlan,
      applyVariantReplacements,
      setManualE1rm,
      generateAndStoreSession,
      planSessionForDay,
      loadPlannedSessionForRunner,
      replaceSessionExercise,
      cancelPlannedSession,
      recordFeedbackAndCommit,
      endOfWeek,
      endOfCycle,
      updateProfile,
      updateMuscleGoals,
      resetApp,
      importDataFromJson,
    }),
    [],
  );
}
