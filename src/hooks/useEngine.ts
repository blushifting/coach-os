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
import { Catalog, loadExercises } from '@/engine/catalog';
import { exerciseFromDict, type ExerciseDict, type Exercise } from '@/engine/models';
import {
  addUserExercise as dbAddUserExercise,
  deleteUserExercise as dbDeleteUserExercise,
  listUserExercises,
} from '@/db/repositories/userAddedExercises.repo';
import * as engine from '@/engine/engine';
import { applyBalanceRules } from '@/engine/balance';
import {
  generateCyclePlan,
  mergeEquivalentExercisesInPlan,
  rotateEmphasis,
} from '@/engine/cycle_planner';
import { fitGuidedProgram, getGuidedProgram } from '@/engine/guided_programs';
import { initialVolumeBounds } from '@/engine/volume';
import { SuggestedAction } from '@/engine/models';
import type {
  EquipmentOverride,
  MuscleGoal,
  Profile,
  SessionFeedback,
  SessionPlan,
  UserState,
} from '@/engine/models';
import {
  deleteOverride as dbDeleteOverride,
  upsertOverride as dbUpsertOverride,
} from '@/db/repositories/equipmentOverrides.repo';
import { getDb, resetDbInstance } from '@/db';
import { loadUserState } from '@/db/repositories/userState.repo';
import {
  txCancelSession,
  txSkipSession,
  txCommitManualE1rm,
  txCommitSessionFeedback,
  txEndOfCycle,
  txEndOfWeek,
  txInitUser,
  txSaveSessionPlan,
  txSaveUserStateOnly,
  txUpdateSessionPlan,
} from '@/db/transactions';
import { buildPrescription, effectiveLoadForE1rm } from '@/engine/prescription';
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
 * Conv #21b — Construit un `Catalog` qui fusionne le catalogue par défaut
 * (JSON embarqué) et les exos custom ajoutés par l'utilisateur (table
 * `userAddedExercises`). Sans cette fusion, les exos custom n'existeraient
 * que dans la DB et seraient invisibles pour `selection`, `buildPrescription`,
 * `computeCoverageThisWeek`, etc.
 *
 * Idempotent côté Catalog (le constructeur reconstruit les index) — on
 * peut appeler ce helper à chaque ajout/suppression d'un exo custom.
 */
async function buildFullCatalog(): Promise<{
  catalog: Catalog;
  customIds: ReadonlySet<string>;
}> {
  const defaults = loadExercises();
  const customRows = await listUserExercises();
  const customs: Exercise[] = customRows.map((r) =>
    exerciseFromDict(r.exercise_dict),
  );
  // On filtre les éventuels customs dont l'id collisionne avec le catalogue
  // par défaut (cas d'import JSON migré, ou exo défaut renommé) — priorité
  // au défaut, l'user devra renommer son custom pour le récupérer.
  const defaultIds = new Set(defaults.map((e) => e.id));
  const filteredCustoms = customs.filter((e) => !defaultIds.has(e.id));
  const customIds = new Set(filteredCustoms.map((e) => e.id));
  return {
    catalog: new Catalog([...defaults, ...filteredCustoms]),
    customIds,
  };
}

/**
 * À appeler au mount de l'app : charge le catalog, lit l'état persisté
 * (userState + history) et hydrate le store. Idempotent.
 *
 * Conv #21 — appelle aussi `tickWeekIfNeeded` après l'hydratation pour
 * rattraper les transitions de semaine quand l'app n'a pas été ouverte
 * pendant ≥ 7 jours. Sans ça, `current_week_in_cycle` reste figé sur la
 * semaine de la dernière session active, et tous les compteurs hebdo
 * (séances, volume, dette) ne se réinitialisent jamais.
 *
 * Conv #21b — charge aussi les exos custom (userAddedExercises) et les
 * fusionne dans le Catalog en mémoire.
 */
export async function bootstrap(): Promise<void> {
  const store = useCoachOsStore.getState();
  if (store.bootstrapped) return;
  const [{ catalog, customIds }, userState, history] = await Promise.all([
    buildFullCatalog(),
    loadUserState(),
    loadHistorySnapshot(),
  ]);
  useCoachOsStore.setState({
    catalog,
    customExerciseIds: customIds,
    userState,
    history,
    bootstrapped: true,
  });
  await tickWeekIfNeeded();
}

/**
 * Conv #21b — Ajoute un exo custom (créé via le formulaire UI) à la table
 * `userAddedExercises` et reconstruit le Catalog en store pour qu'il soit
 * immédiatement disponible partout (Catalogue, sélecteur séance, etc.).
 */
export async function addCustomExercise(dict: ExerciseDict): Promise<void> {
  await dbAddUserExercise(dict);
  const { catalog, customIds } = await buildFullCatalog();
  useCoachOsStore.setState({ catalog, customExerciseIds: customIds });
}

/**
 * Conv #21b — Supprime un exo custom et reconstruit le Catalog. Note : si
 * des feedbacks référencent cet exo, les `nom_fr` afficheront l'id brut
 * (catalog.get jette). C'est acceptable : on ne va pas supprimer
 * rétroactivement les feedbacks historiques.
 */
export async function removeCustomExercise(exerciseId: string): Promise<void> {
  await dbDeleteUserExercise(exerciseId);
  const { catalog, customIds } = await buildFullCatalog();
  useCoachOsStore.setState({ catalog, customExerciseIds: customIds });
}

/**
 * Conv #21 — Rattrape les transitions hebdo manquées depuis la dernière
 * session active. Si `now` correspond à la semaine N du cycle alors que
 * `current_week_in_cycle` est resté à K < N, on déclenche `endOfWeek()`
 * autant de fois que nécessaire pour arriver à `min(N, 5)`.
 *
 * Plafonne à la semaine 5 : la transition S5 → cycle suivant reste manuelle
 * via le flux Bilan de cycle (sinon on régénérerait un cycle plan sans le
 * consentement explicite du user).
 *
 * Idempotent : ne fait rien si `state.current_week_in_cycle` est déjà à
 * la bonne valeur ou plus avancé. Skip aussi en mode démo (la démo a son
 * propre snapshot temporel figé).
 */
export async function tickWeekIfNeeded(now: Date = new Date()): Promise<void> {
  const store = useCoachOsStore.getState();
  if (store.demoMode) return;
  const state = store.userState;
  if (state === null) return;
  const cycle = store.history.cycles.find(
    (c) => c.cycle_index === state.cycle_index,
  );
  if (cycle === undefined) return;
  const start = new Date(cycle.start_date + 'T00:00:00');
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const diffDays = Math.round(
    (today.getTime() - start.getTime()) / 86_400_000,
  );
  if (diffDays < 0) return;
  const expectedWeek = Math.min(5, Math.floor(diffDays / 7) + 1);
  let safety = 0;
  while (safety < 5) {
    const cur = useCoachOsStore.getState().userState;
    if (cur === null) return;
    if (cur.current_week_in_cycle >= expectedWeek) return;
    await endOfWeek();
    safety += 1;
  }
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
  // Conv #19 — Après remplacement de variantes, deux slots peuvent maintenant
  // pointer vers des exos équivalents (même pattern + primaires + charge).
  // On fusionne en additionnant les séries.
  const catalog = requireCatalog();
  mergeEquivalentExercisesInPlan(next.current_cycle_plan, catalog);
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
  // Conv #15 vague 2 — si on rouvre la session déjà en cours, ne pas
  // ré-écrire le plan (sinon la ref change et SeancePage re-init les entries
  // via son useEffect, perdant les coches en cours).
  const store = useCoachOsStore.getState();
  if (store.currentSessionId !== sessionId || store.currentSessionPlan === null) {
    useCoachOsStore.setState({
      currentSessionPlan: row.plan,
      currentSessionId: sessionId,
    });
  }
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
      currentSessionEntries: null,
    });
  }
  await refreshHistory();
}

/**
 * Conv #14b-3 — Marque la séance actuellement en cours comme sautée. La ligne
 * session passe en `status='skipped'` (vs delete pour `cancel`), et le store
 * libère `currentSessionPlan` / `currentSessionId`. La case calendrier
 * correspondante apparaîtra alors comme "sautée".
 */
export async function skipCurrentSession(): Promise<void> {
  const store = useCoachOsStore.getState();
  const sessionId = store.currentSessionId;
  if (sessionId === null) {
    throw new Error('Aucune séance en cours à sauter.');
  }
  await txSkipSession(sessionId);
  useCoachOsStore.setState({
    currentSessionPlan: null,
    currentSessionId: null,
    currentSessionEntries: null,
  });
  await refreshHistory();
}

// =============================================================================
// Conv #21b — Ajout/retrait d'un exo en cours de séance + séance libre
// =============================================================================

/**
 * Ajoute un exo à la séance en cours. `nSets` par défaut = 3 séries, valeurs
 * pré-remplies par `buildPrescription` à partir du plafond connu (ou bootstrap
 * heuristique si pas encore mesuré).
 *
 * Effets : étend `currentSessionPlan.items` ET `currentSessionEntries` de la
 * même longueur (sinon les indices se désynchronisent dans le runner).
 *
 * Cas d'usage : envie d'un exo bonus, machine prise donc on bascule sur un
 * substitut, ou complétion d'une séance libre.
 */
export async function addExerciseToCurrentSession(
  exerciseId: string,
  nSets: number = 3,
): Promise<void> {
  const catalog = requireCatalog();
  const store = useCoachOsStore.getState();
  const plan = store.currentSessionPlan;
  const sessionId = store.currentSessionId;
  const entries = store.currentSessionEntries;
  if (plan === null || sessionId === null) {
    throw new Error('Pas de séance en cours.');
  }
  const next = requireUserState();
  const exercise = catalog.get(exerciseId);
  // bootstrap transitoire (cf. Conv #20.2 — pas de persistance), juste pour
  // poser une prescription cohérente sur le nouvel exo.
  const e1rmTotal = engine.bootstrapE1rmIfMissing(next, exercise);
  const prescription = buildPrescription(
    exercise,
    e1rmTotal,
    next.profile,
    next.current_week_in_cycle,
    {
      muscleGoals:
        Object.keys(next.muscle_goals).length > 0 ? next.muscle_goals : null,
      recoveryMode: next.recovery_mode,
      state: next,
    },
  );
  const safeSets = Math.max(1, Math.min(10, nSets));
  const newItem = {
    exercise_id: exerciseId,
    sets: Array.from({ length: safeSets }, () => ({ ...prescription })),
  };
  const newPlan: SessionPlan = { ...plan, items: [...plan.items, newItem] };
  const newRow = Array.from({ length: safeSets }, () => ({
    reps: prescription.reps,
    load_kg: prescription.load_kg,
    rpe: null,
    done: false,
  }));
  const newEntries =
    entries === null ? null : [...entries, newRow];
  await txUpdateSessionPlan(sessionId, newPlan, next);
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: newPlan,
    currentSessionEntries: newEntries,
  });
}

/**
 * Retire un exo de la séance en cours (par son `itemIndex` dans
 * `plan.items`). Met à jour `currentSessionEntries` du même indice. Si
 * aucun item ne reste, le plan devient vide mais la session reste — l'user
 * peut soit ajouter un nouvel exo, soit annuler/terminer.
 */
export async function removeExerciseFromCurrentSession(
  itemIndex: number,
): Promise<void> {
  const store = useCoachOsStore.getState();
  const plan = store.currentSessionPlan;
  const sessionId = store.currentSessionId;
  const entries = store.currentSessionEntries;
  if (plan === null || sessionId === null) {
    throw new Error('Pas de séance en cours.');
  }
  if (itemIndex < 0 || itemIndex >= plan.items.length) {
    throw new Error(`Index ${itemIndex} hors plan (${plan.items.length} items).`);
  }
  const next = requireUserState();
  const newItems = plan.items.filter((_, i) => i !== itemIndex);
  const newPlan: SessionPlan = { ...plan, items: newItems };
  const newEntries =
    entries === null ? null : entries.filter((_, i) => i !== itemIndex);
  await txUpdateSessionPlan(sessionId, newPlan, next);
  useCoachOsStore.setState({
    currentSessionPlan: newPlan,
    currentSessionEntries: newEntries,
  });
}

/**
 * Démarre une "séance libre" hors programme à la date donnée. Crée un
 * `SessionPlan` vide avec `label='Séance libre'`, persiste en DB, et la
 * monte directement dans le runner. L'user peuple ensuite la séance via
 * `addExerciseToCurrentSession`.
 *
 * Distinct de `planSessionForDay` (qui génère un plan à partir du cycle).
 * Pas de `dayIndex` (la séance n'appartient à aucun jour-type du cycle).
 */
export async function startFreeSession(
  seanceDate: string,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const next = requireUserState();
  const plan: SessionPlan = {
    seance_date: seanceDate,
    week_in_cycle: next.current_week_in_cycle,
    cycle_index: next.cycle_index,
    rpe_target: 8,
    items: [],
    label: 'Séance libre',
  };
  const sessionId = await txSaveSessionPlan(plan, next);
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: plan,
    currentSessionId: sessionId,
    currentSessionEntries: [],
  });
  await refreshHistory();
  return { plan, sessionId };
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

  // Conv #19 — Si une séance est en cours et contient cet exo, recale les
  // charges des sets non-cochés à partir du nouveau plafond. Sinon l'exo
  // reste "coincé" sur les charges issues du bootstrap heuristique alors
  // que la confidence est passée à 'measured' (banner disparu mais charges
  // pas mises à jour → impression d'état intermédiaire).
  const store = useCoachOsStore.getState();
  const plan = store.currentSessionPlan;
  const sessionId = store.currentSessionId;
  const touched =
    plan !== null && plan.items.some((it) => it.exercise_id === args.exerciseId);
  if (plan !== null && sessionId !== null && touched) {
    const prescription = buildPrescription(
      args.exercise,
      e1rmTotal,
      next.profile,
      next.current_week_in_cycle,
      {
        muscleGoals:
          Object.keys(next.muscle_goals).length > 0 ? next.muscle_goals : null,
        recoveryMode: next.recovery_mode,
        state: next,
      },
    );
    const newItems = plan.items.map((it) =>
      it.exercise_id === args.exerciseId
        ? { exercise_id: it.exercise_id, sets: it.sets.map(() => prescription) }
        : it,
    );
    const newPlan: SessionPlan = { ...plan, items: newItems };
    await txUpdateSessionPlan(sessionId, newPlan, next);

    const entries = store.currentSessionEntries;
    const newEntries =
      entries === null
        ? entries
        : entries.map((row, i) => {
            const item = newItems[i];
            if (!item || item.exercise_id !== args.exerciseId) return row;
            return row.map((s, j) => {
              if (s.done) return s;
              const planSet = item.sets[j];
              if (!planSet) return s;
              const nextReps = s.reps === null ? planSet.reps : s.reps;
              return { ...s, load_kg: planSet.load_kg, reps: nextReps };
            });
          });
    useCoachOsStore.setState({
      userState: next,
      currentSessionPlan: newPlan,
      currentSessionEntries: newEntries,
    });
  } else {
    useCoachOsStore.setState({ userState: next });
  }
  await refreshHistory();
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
  // Conv #16 : on identifie les exos déjà calibrés (= au moins un snapshot
  // e1RM en BDD avant cette séance) pour distinguer "1re séance" (skipEma)
  // de "séances suivantes" (EMA standard).
  const snapshots = useCoachOsStore.getState().history.e1rmSnapshots;
  const calibratedExoIds = new Set(snapshots.map((s) => s.exercise_id));
  const summary = engine.recordFeedback(next, catalog, feedback, {
    plan,
    calibratedExoIds,
  });
  const sessionId = useCoachOsStore.getState().currentSessionId;
  await txCommitSessionFeedback({ feedback, state: next, sessionId });
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: null,
    currentSessionId: null,
    currentSessionEntries: null,
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
  /**
   * Action choisie par l'utilisateur sur le bilan (ou imposée par un flux
   * "fin prématurée"). Défaut : `CONTINUER_PAREIL` (rétro-compat Conv #5a).
   */
  action?: SuggestedAction;
  /**
   * Pour `CHANGER_PROGRAMME` : id du nouveau programme guidé (ou `null` pour
   * basculer en custom). Sinon ignoré (le mode reste celui en cours).
   */
  nextProgrammeId?: string | null;
  /**
   * Pour `AJUSTER_OBJECTIFS` : nouveaux `muscle_goals` (les SUGGERE seront
   * recomposés via R1-R4). Si omis, on garde les goals actuels.
   */
  newMuscleGoals?: Record<string, MuscleGoal> | null;
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
// Override d'équipement par exo (Conv #18)
// =============================================================================

/**
 * Pose ou met à jour un `EquipmentOverride` pour un exercice (inc_kg /
 * min_load_kg / max_load_kg). Utilisé quand le matériel local diffère du
 * catalogue (haltères qui s'incrémentent par 2 kg au lieu de 2.5,
 * cable stack capé à 80 kg…). Mis en cache dans `state.equipment_overrides`
 * ET persisté dans la table dédiée (idempotent).
 */
export async function setEquipmentOverride(
  exerciseId: string,
  override: EquipmentOverride,
): Promise<UserState> {
  const next = requireUserState();
  next.equipment_overrides[exerciseId] = override;
  await txSaveUserStateOnly(next);
  await dbUpsertOverride(exerciseId, override);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/** Supprime l'override pour un exo (retour au catalogue par défaut). */
export async function clearEquipmentOverride(exerciseId: string): Promise<UserState> {
  const next = requireUserState();
  delete next.equipment_overrides[exerciseId];
  await txSaveUserStateOnly(next);
  await dbDeleteOverride(exerciseId);
  useCoachOsStore.setState({ userState: next });
  return next;
}

// =============================================================================
// Routine fixée par jour de la semaine (Conv #18)
// =============================================================================

/**
 * Pose ou retire une routine fixée pour un jour-of-week donné (lundi=0,
 * dimanche=6). `dayIndex` est l'index du day_template dans
 * `current_cycle_plan.days` ; `null` retire la routine pour ce jour.
 *
 * La routine persiste à travers les cycles : si un nouveau cycle plan est
 * généré, l'index peut pointer sur un jour qui n'existe plus — l'UI
 * ignore proprement (cf. `fixed_routine` dans `models.ts`).
 */
export async function setFixedRoutine(
  dayOfWeek: number,
  dayIndex: number | null,
): Promise<UserState> {
  const next = requireUserState();
  const key = String(dayOfWeek);
  if (dayIndex === null) {
    delete next.fixed_routine[key];
  } else {
    next.fixed_routine[key] = dayIndex;
  }
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
    currentSessionEntries: null,
    history: { sessions: [], feedbacks: [], e1rmSnapshots: [], cycles: [] },
    bootstrapped: true,
    lastEndOfWeekReview: null,
    lastCycleReview: null,
    catalog,
  });
  // Conv #16 — reset des dismissals LS de la démo. Sans ça, un user
  // qui reset l'app après avoir déjà vu la welcome overlay (via Profil >
  // Aide) skiperait l'intro lors du prochain onboarding auto-launch.
  try {
    localStorage.removeItem('coach-os.demo-welcome-seen');
    localStorage.removeItem('coach-os.welcome-dismissed');
  } catch {
    /* ignore */
  }
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
    currentSessionEntries: null,
    lastEndOfWeekReview: null,
    lastCycleReview: null,
  });
}

/**
 * Termine le cycle en cours et démarre le suivant.
 *
 * Étapes :
 *   1. Génère le `CycleReview` du cycle clos + ajuste V_min/V_max
 *      (`engine.endOfCycle`).
 *   2. Applique les changements liés à `args.action` :
 *      - `AJUSTER_OBJECTIFS` : remplace `muscle_goals` (R1-R4 par-dessus).
 *      - `CHANGER_PROGRAMME` : pose `active_guided_program_id`.
 *      - `TOURNER_EMPHASIS` : permute les emphasis sur les priorités.
 *      - `CONTINUER_PAREIL` (défaut) : rien à modifier.
 *   3. Bump `cycle_index += 1`, reset `current_week_in_cycle = 1`,
 *      vide `plateau_counter`.
 *   4. Régénère `current_cycle_plan` :
 *      - guidé : `fitGuidedProgram` (throw si équipement insuffisant).
 *      - custom : `generateCyclePlan`.
 *   5. Persiste (cycle clos archivé avec end_date=today, nouveau cycle créé).
 *
 * Utilisable aussi pour une **fin prématurée** (item Conv #18) : on archive
 * le cycle en cours même s'il n'a pas toutes ses séances faites, et on
 * démarre un nouveau cycle avec les paramètres modifiés.
 */
export async function endOfCycle(args: EndOfCycleArgs = {}) {
  const catalog = requireCatalog();
  const before = useCoachOsStore.getState().userState;
  if (before === null) throw new Error('userState non initialisé');
  const closedCycleIndex = before.cycle_index;
  const next = cloneState(before);
  const action = args.action ?? SuggestedAction.CONTINUER_PAREIL;

  // 1. Bilan + ajustement V_min/V_max sur le cycle qui se ferme.
  const review = engine.endOfCycle(next, catalog);

  // 2. Applique les changements demandés AVANT régénération du plan.
  // Conv #18 — `newMuscleGoals` est appliqué dès qu'il est fourni, quelle
  // que soit l'action. Cas typique : l'onboarding partiel peut changer
  // les priorités musculaires ET le programme guidé en un seul flux ;
  // on déduit l'action principale côté UI mais les deux modifs doivent
  // tomber dans l'état.
  if (args.newMuscleGoals) {
    const goals: Record<string, MuscleGoal> = { ...args.newMuscleGoals };
    for (const sg of applyBalanceRules(goals)) {
      if (goals[sg.muscle] === undefined) goals[sg.muscle] = sg;
    }
    next.muscle_goals = goals;
  }
  if (action === SuggestedAction.CHANGER_PROGRAMME) {
    next.active_guided_program_id = args.nextProgrammeId ?? null;
  }
  if (action === SuggestedAction.TOURNER_EMPHASIS) {
    rotateEmphasis(next.muscle_goals);
  }

  // 3. Bump cycle_index + reset state hebdo. On bump explicitement à
  //    `closedCycleIndex+1` plutôt que `+= 1` pour rester robuste si un
  //    bump avait déjà eu lieu côté `advanceWeek` (cas semaine 5 finie).
  next.cycle_index = closedCycleIndex + 1;
  next.current_week_in_cycle = 1;
  next.plateau_counter = {};
  next.weekly_volume_debt = {};

  // 4. Régénère le plan du nouveau cycle.
  const programmeId = next.active_guided_program_id;
  if (programmeId !== null) {
    const program = getGuidedProgram(programmeId);
    if (program === null) {
      throw new Error(`Programme guidé inconnu : ${programmeId}`);
    }
    const { weekly, blocking } = fitGuidedProgram(
      program,
      next.profile,
      new Set(next.profile.available_equip),
      next.e1rm,
      catalog,
      next.cycle_index,
    );
    if (weekly === null) {
      throw new Error(
        `Équipement insuffisant pour ${program.name} : ${blocking.join(', ')}`,
      );
    }
    next.current_cycle_plan = weekly;
  } else {
    next.current_cycle_plan = generateCyclePlan(next, catalog);
  }

  // 5. Persiste (cycle clos + nouveau cycle).
  await txEndOfCycle({
    state: next,
    review,
    closedCycleIndex,
    nextProgrammeId: next.active_guided_program_id,
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
  skipCurrentSession: typeof skipCurrentSession;
  recordFeedbackAndCommit: typeof recordFeedbackAndCommit;
  endOfWeek: typeof endOfWeek;
  endOfCycle: typeof endOfCycle;
  updateProfile: typeof updateProfile;
  updateMuscleGoals: typeof updateMuscleGoals;
  setEquipmentOverride: typeof setEquipmentOverride;
  clearEquipmentOverride: typeof clearEquipmentOverride;
  setFixedRoutine: typeof setFixedRoutine;
  resetApp: typeof resetApp;
  importDataFromJson: typeof importDataFromJson;
  /** Conv #21b — gestion des exos custom (table userAddedExercises). */
  addCustomExercise: typeof addCustomExercise;
  removeCustomExercise: typeof removeCustomExercise;
  /** Conv #21b — flexibilité runtime (ajout/retrait exos en séance, séance libre). */
  addExerciseToCurrentSession: typeof addExerciseToCurrentSession;
  removeExerciseFromCurrentSession: typeof removeExerciseFromCurrentSession;
  startFreeSession: typeof startFreeSession;
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
      skipCurrentSession,
      recordFeedbackAndCommit,
      endOfWeek,
      endOfCycle,
      updateProfile,
      updateMuscleGoals,
      setEquipmentOverride,
      clearEquipmentOverride,
      setFixedRoutine,
      resetApp,
      importDataFromJson,
      addCustomExercise,
      removeCustomExercise,
      addExerciseToCurrentSession,
      removeExerciseFromCurrentSession,
      startFreeSession,
    }),
    [],
  );
}
