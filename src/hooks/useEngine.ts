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
import {
  exerciseFromDict,
  makePlannedExercise,
  type ExerciseDict,
  type Exercise,
} from '@/engine/models';
import { defaultProgressionForDay } from '@/lib/custom-session';
import {
  addUserExercise as dbAddUserExercise,
  deleteUserExercise as dbDeleteUserExercise,
  listUserExercises,
} from '@/db/repositories/userAddedExercises.repo';
import * as engine from '@/engine/engine';
import { applyBalanceRules } from '@/engine/balance';
import {
  autoGenerateCyclePlanV3,
  generateCyclePlanV3,
  mergeEquivalentExercisesInPlan,
  rotateEmphasis,
} from '@/engine/cycle_planner';
import { carryOverManualPlan } from '@/lib/manual-plan';
import {
  DELOAD_WEEK_IN_CYCLE,
  initialVolumeBounds,
  isDeloadActive,
} from '@/engine/volume';
import { SuggestedAction, DurationCategory } from '@/engine/models';
import type {
  EquipmentOverride,
  MuscleGoal,
  Profile,
  SessionFeedback,
  SessionPlan,
  SkeletonTemplate,
  UserState,
  WeeklyTemplate,
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
  txResetE1rm,
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
  // Conv #30 — tant qu'aucune séance n'a été faite dans ce cycle, la grille
  // n'a pas vraiment démarré : on n'avance pas les semaines (start_date est
  // encore le placeholder onboarding/bilan, ré-ancré sur la 1re séance via
  // `recordFeedbackAndCommit`). Évite de « perdre » des jours si l'utilisateur
  // lance l'app plusieurs jours avant sa 1re séance.
  const cycleStarted = store.history.feedbacks.some(
    (f) => f.cycle_index === state.cycle_index,
  );
  if (!cycleStarted) return;
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
  /** Bloc O — 'auto' (moteur) ou 'manual' (grille à la main). Default 'auto'. */
  buildMode?: 'auto' | 'manual';
}

export async function startUser(args: StartUserArgs): Promise<UserState> {
  const catalog = requireCatalog();
  const newState = engine.startUser(args.profile, catalog, {
    muscleGoals: args.muscleGoals ?? null,
    applyBalance: args.applyBalance ?? true,
  });
  newState.build_mode = args.buildMode ?? 'auto';
  await txInitUser(newState);
  await refreshHistory();
  useCoachOsStore.setState({ userState: newState });
  return newState;
}

// =============================================================================
// Génération du WeeklyTemplate Cycle 1 (post-onboarding)
// =============================================================================

/**
 * Génère et persiste le `WeeklyTemplate` Cycle 1 (custom).
 *
 * Bloc O — plus de programmes tout faits : génération via
 * `autoGenerateCyclePlanV3` (path co-construit). Le mode « à la main » ne passe
 * pas par ici (plan vide posé directement par OnboardingPage).
 *
 * Les exos sans e1RM connu sont bootstrap heuristiquement à la 1re séance
 * via `bootstrapE1rmIfMissing` (engine.ts) et raffinés par feedback RPE
 * (calibration transparente, depuis le retrait de la Séance 0 — Conv #12).
 *
 * Idempotent : ne régénère pas si `state.current_cycle_plan` est déjà posé.
 */
export async function generateInitialCyclePlan(): Promise<void> {
  const catalog = requireCatalog();
  const next = requireUserState();
  if (next.current_cycle_plan !== null) {
    useCoachOsStore.setState({ userState: next });
    return;
  }

  // Bloc O — plus de programmes guidés : génération custom uniquement.
  // (Le mode « à la main » ne passe pas par ici : OnboardingPage pose le plan
  // vide directement via setCurrentCyclePlan.)
  // Conv #39 — voie unique : génération via autoGenerateCyclePlanV3
  // (skeleton_builder + sets_allocator). Fallback MEDIUM pour les états
  // antérieurs à la `duration_category` (pré-Conv #22).
  next.current_cycle_plan = autoGenerateCyclePlanV3(
    next,
    catalog,
    next.profile.duration_category ?? DurationCategory.MEDIUM,
  );

  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
}

/**
 * Conv #22 — Génère le plan à partir d'un `SkeletonTemplate` déjà rempli
 * (étape E du wizard onboarding). Court-circuite l'auto-fill par défaut de
 * `autoGenerateCyclePlanV3` et utilise directement les choix de l'user.
 *
 * Persiste aussi le squelette dans `state.current_skeleton` pour permettre
 * "Modifier la grille" ultérieurement.
 */
export async function generateInitialCyclePlanFromSkeleton(
  skeleton: SkeletonTemplate,
): Promise<void> {
  const catalog = requireCatalog();
  const next = requireUserState();
  if (next.current_cycle_plan !== null) {
    useCoachOsStore.setState({ userState: next });
    return;
  }
  next.current_cycle_plan = generateCyclePlanV3(skeleton, next, catalog);
  next.current_skeleton = skeleton;
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
}

/**
 * Conv #22 — Mémorise l'exo préféré de l'user pour un pattern donné. Sert
 * à pré-cocher ses choix dans les onboardings/restarts suivants
 * (cf. `candidatesForCell` favoriteId).
 */
export async function addFavoriteForPattern(
  pattern: string,
  exerciseId: string,
): Promise<UserState> {
  const next = requireUserState();
  next.favorite_exercise_per_pattern = {
    ...(next.favorite_exercise_per_pattern ?? {}),
    [pattern]: exerciseId,
  };
  // Bloc F (Conv #31) — la prédilection onboarding alimente aussi le set
  // unifié, pour qu'elle apparaisse comme favori dans le Catalogue.
  const ids = next.favorite_exercise_ids ?? [];
  if (!ids.includes(exerciseId)) {
    next.favorite_exercise_ids = [...ids, exerciseId];
  }
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Bloc F (Conv #31) — Bascule un exo dans/hors des favoris unifiés
 * (`favorite_exercise_ids`). Source : l'étoile du Catalogue / de la fiche exo.
 * N'altère PAS `favorite_exercise_per_pattern` (cache de seeding moteur) :
 * l'influence des favoris catalogue sur l'auto-génération est un chantier F2
 * séparé.
 */
export async function toggleFavorite(exerciseId: string): Promise<UserState> {
  const next = requireUserState();
  const ids = next.favorite_exercise_ids ?? [];
  next.favorite_exercise_ids = ids.includes(exerciseId)
    ? ids.filter((id) => id !== exerciseId)
    : [...ids, exerciseId];
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Bloc F (Conv #31) — seuil d'ajouts ad-hoc/variante au-delà duquel on propose
 * d'ajouter l'exo aux favoris.
 */
export const FAVORITE_SUGGEST_THRESHOLD = 3;

/** Incrémente le compteur d'utilisations ad-hoc/variante d'un exo (mute `next`). */
function bumpExercisePickCount(next: UserState, exerciseId: string): void {
  const counts = next.exercise_pick_counts ?? {};
  next.exercise_pick_counts = {
    ...counts,
    [exerciseId]: (counts[exerciseId] ?? 0) + 1,
  };
}

/**
 * Bloc F (Conv #31) — l'exo vient-il d'atteindre le seuil de propositions
 * favoris (et n'est pas déjà favori) ? À appeler côté UI APRÈS l'ajout/variante
 * (le store est déjà à jour). `=== seuil` ⇒ on ne propose qu'une seule fois.
 */
export function shouldSuggestFavorite(exerciseId: string): boolean {
  const s = useCoachOsStore.getState().userState;
  if (s === null) return false;
  if ((s.favorite_exercise_ids ?? []).includes(exerciseId)) return false;
  return (s.exercise_pick_counts?.[exerciseId] ?? 0) === FAVORITE_SUGGEST_THRESHOLD;
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
  // Bloc F (Conv #31) — la variante choisie compte pour le prompt favoris (3×).
  bumpExercisePickCount(next, args.newExerciseId);
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
      deloadActive: isDeloadActive(next),
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
  // Bloc F (Conv #31) — compteur d'utilisations (prompt favoris à la 3ᵉ fois).
  bumpExercisePickCount(next, exerciseId);
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
// Bloc G (Conv #32) — Séance custom (hors-programme, assistée par presets)
// =============================================================================

export interface CustomSessionArgs {
  readonly seanceDate: string;
  /** Slots finaux (base preset + ajouts/retraits faits dans l'UI). */
  readonly slots: readonly { readonly exerciseId: string; readonly nSets: number }[];
  readonly displayName?: string | null;
}

/** Construit les `currentSessionEntries` (coches) à la bonne forme depuis un plan. */
function entriesFromPlan(plan: SessionPlan) {
  return plan.items.map((it) =>
    it.sets.map((s) => ({ reps: s.reps, load_kg: s.load_kg, rpe: null, done: false })),
  );
}

/**
 * Démarre une séance custom **aujourd'hui** : construit le plan (base + édits),
 * le persiste (`planned`) et le monte directement dans le runner. Pendant de
 * `generateAndStoreSession`, mais hors-rotation (cf. `engine.buildCustomSessionPlan`).
 */
export async function startCustomSession(
  args: CustomSessionArgs,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = engine.buildCustomSessionPlan(next, catalog, args);
  const sessionId = await txSaveSessionPlan(plan, next);
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: plan,
    currentSessionId: sessionId,
    currentSessionEntries: entriesFromPlan(plan),
  });
  await refreshHistory();
  return { plan, sessionId };
}

/**
 * Planifie une séance custom pour un **jour futur** (status `planned`), sans la
 * charger dans le runner. Démarrable seulement le jour J — le verrou de date de
 * `loadPlannedSessionForRunner` s'en charge déjà.
 */
export async function planCustomSessionForDay(
  args: CustomSessionArgs,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = engine.buildCustomSessionPlan(next, catalog, args);
  const sessionId = await txSaveSessionPlan(plan, next);
  useCoachOsStore.setState({ userState: next });
  await refreshHistory();
  return { plan, sessionId };
}

// =============================================================================
// Bloc G (Conv #32) — Édition chirurgicale du cycle EN COURS (juste les exos /
// le nom, JAMAIS la progression). On patche `current_cycle_plan` en place et on
// persiste, sans rappeler `generateCyclePlan` : e1RM / historique intacts.
// =============================================================================

/** Renomme un jour du cycle en cours (nom affiché). `label` (rotation) inchangé. */
export async function renameCycleDay(dayIndex: number, name: string): Promise<UserState> {
  const next = requireUserState();
  const plan = next.current_cycle_plan;
  if (plan === null) throw new Error('Aucun programme en cours.');
  const day = plan.days[dayIndex];
  if (day === undefined) throw new Error(`Jour ${dayIndex} introuvable.`);
  const trimmed = name.trim();
  day.custom_name = trimmed.length > 0 ? trimmed : null;
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Ajoute un exo à un jour du cycle en cours. Pose une `progression` par défaut
 * (calquée sur les voisins), puis fusionne d'éventuels doublons équivalents
 * (Conv #19). Avertit-mais-ne-contraint-pas : aucune validation d'équilibre ici.
 */
export async function addExerciseToCycleDay(
  dayIndex: number,
  exerciseId: string,
  nSets = 3,
): Promise<UserState> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = next.current_cycle_plan;
  if (plan === null) throw new Error('Aucun programme en cours.');
  const day = plan.days[dayIndex];
  if (day === undefined) throw new Error(`Jour ${dayIndex} introuvable.`);
  const n = Math.max(1, Math.min(10, Math.round(nSets)));
  day.exercises.push(
    makePlannedExercise({
      exercise_id: exerciseId,
      base_sets: n,
      progression: defaultProgressionForDay(day, n),
    }),
  );
  mergeEquivalentExercisesInPlan(plan, catalog);
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/** Retire un exo d'un jour du cycle en cours (par index de slot). */
export async function removeExerciseFromCycleDay(
  dayIndex: number,
  slotIndex: number,
): Promise<UserState> {
  const next = requireUserState();
  const plan = next.current_cycle_plan;
  if (plan === null) throw new Error('Aucun programme en cours.');
  const day = plan.days[dayIndex];
  if (day === undefined) throw new Error(`Jour ${dayIndex} introuvable.`);
  if (slotIndex < 0 || slotIndex >= day.exercises.length) {
    throw new Error(`Slot ${slotIndex} hors plage (${day.exercises.length}).`);
  }
  day.exercises.splice(slotIndex, 1);
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Bloc I (Conv #34) — change le nombre de séries d'un exo d'un jour du cycle en
 * cours (édition chirurgicale ; progression hebdo recalculée, historique
 * conservé). Bornes 1–10, identiques à l'ajout.
 */
export async function setCycleDayExerciseSets(
  dayIndex: number,
  slotIndex: number,
  nSets: number,
): Promise<UserState> {
  const next = requireUserState();
  const plan = next.current_cycle_plan;
  if (plan === null) throw new Error('Aucun programme en cours.');
  const day = plan.days[dayIndex];
  if (day === undefined) throw new Error(`Jour ${dayIndex} introuvable.`);
  const planned = day.exercises[slotIndex];
  if (planned === undefined) {
    throw new Error(`Slot ${slotIndex} hors plage (${day.exercises.length}).`);
  }
  const n = Math.max(1, Math.min(10, Math.round(nSets)));
  planned.base_sets = n;
  planned.progression = defaultProgressionForDay(day, n);
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
}

/**
 * Chantier B — persiste la décision de récupération (déload opt-in) du cycle
 * courant. À appeler AVANT de générer la séance de semaine 5 : la prescription
 * (RPE, charge, nombre de séries) dépend de cette décision.
 */
export async function setDeloadDecision(
  decision: 'accepted' | 'declined',
): Promise<UserState> {
  const catalog = requireCatalog();
  const next = requireUserState();
  next.deload_decision = decision;
  await txSaveUserStateOnly(next);

  // Chantier B — les séances de la semaine de récupération déjà PLANIFIÉES (non
  // démarrées) ont pu être générées AVANT cette décision (numéros de séries/
  // charges/RPE figés « semaine normale »). On régénère leur prescription pour
  // qu'elle reflète le choix : déload accepté → allégé (÷2 séries, ×0,9, RPE 6),
  // refusé → normal. Les séances non issues d'un jour du cycle (custom) sont
  // laissées intactes. Une séance planifiée n'est jamais éditée avant démarrage,
  // donc rien à préserver.
  const plan = next.current_cycle_plan;
  if (plan !== null) {
    const db = getDb();
    const planned = await db.sessions
      .where('[cycle_index+week_in_cycle]')
      .equals([next.cycle_index, DELOAD_WEEK_IN_CYCLE])
      .and((s) => s.status === 'planned')
      .toArray();
    for (const row of planned) {
      if (row.id === undefined) continue;
      const dayIndex = plan.days.findIndex((d) => d.label === row.plan.label);
      if (dayIndex < 0) continue;
      const fresh = engine.generateSession(next, catalog, dayIndex, row.seance_date);
      await txUpdateSessionPlan(row.id, fresh, next);
    }
  }

  useCoachOsStore.setState({ userState: next });
  await refreshHistory();
  return next;
}

/**
 * Bloc G (Conv #32) — Remplace `current_cycle_plan` par un template déjà édité
 * (récap d'onboarding : swaps + ajouts/retraits + renommages appliqués sur un
 * snapshot). Fusionne les doublons équivalents avant de persister, pour qu'on
 * enregistre exactement ce que l'utilisateur a vu et validé.
 */
export async function setCurrentCyclePlan(template: WeeklyTemplate): Promise<UserState> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = structuredClone(template);
  mergeEquivalentExercisesInPlan(plan, catalog);
  next.current_cycle_plan = plan;
  await txSaveUserStateOnly(next);
  useCoachOsStore.setState({ userState: next });
  return next;
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
  // Refonte progression — un plafond posé à la main réamorce la charge : on
  // efface le plancher du cliquet pour qu'il soit re-seedé depuis ce nouvel e1RM.
  delete next.prescribed_load_floor[args.exerciseId];
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
        deloadActive: isDeloadActive(next),
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

/**
 * Bloc R — Réinitialise le plafond d'un exo : efface `state.e1rm[exo]` + tous
 * ses snapshots → l'exo repart en calibration (bootstrap reseed à la prochaine
 * séance), comme jamais fait. Déclenché depuis la fiche catalogue, et réutilisé
 * au changement d'objectif inter-cycle (cf. `endOfCycle`).
 */
export async function resetE1rm(exerciseId: string): Promise<UserState> {
  const next = requireUserState();
  delete next.e1rm[exerciseId];
  // Refonte progression — reset du plafond ⇒ reset du plancher de charge
  // (l'exo repart en calibration, re-seedé au bootstrap).
  delete next.prescribed_load_floor[exerciseId];
  await txResetE1rm({ state: next, exerciseId });
  useCoachOsStore.setState({ userState: next });
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
  // Conv #30 — 1re séance réelle du cycle ? (avant commit, l'historique reflète
  // encore l'état pré-feedback). Si oui, on (ré)ancre cycle.start_date dessus.
  const isFirstFeedbackOfCycle = !useCoachOsStore
    .getState()
    .history.feedbacks.some((f) => f.cycle_index === feedback.cycle_index);
  const summary = engine.recordFeedback(next, catalog, feedback, {
    plan,
    calibratedExoIds,
  });
  // Bloc R — ne snapshote (→ confidence 'measured') que les MAJ DÉFINITIVES :
  // une séance tout-4+ remonte l'e1RM (provisoire) mais ne marque pas l'exo
  // comme calibré (sinon le bandeau de calibration disparaîtrait à tort).
  const definitiveExoIds = new Set(
    Object.entries(summary)
      .filter(([, u]) => u !== null && u.definitive)
      .map(([id]) => id),
  );
  const sessionId = useCoachOsStore.getState().currentSessionId;
  await txCommitSessionFeedback({
    feedback,
    state: next,
    sessionId,
    anchorStartDate: isFirstFeedbackOfCycle,
    definitiveExoIds,
  });
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
  const next = requireUserState();
  const result = engine.endOfWeek(next);
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
   * Bloc O — mode de construction du nouveau cycle ('auto'|'manual'). Utilisé
   * par le restart d'onboarding. Si omis, on garde le mode courant.
   */
  nextBuildMode?: 'auto' | 'manual';
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
 *      - `TOURNER_EMPHASIS` : permute les emphasis sur les priorités.
 *      - `CONTINUER_PAREIL` (défaut) : rien à modifier.
 *   3. Bump `cycle_index += 1`, reset `current_week_in_cycle = 1`,
 *      remet `deload_decision` à null.
 *   4. Régénère `current_cycle_plan` :
 *      - « à la main » : reconduit le plan manuel (`carryOverManualPlan`).
 *      - custom : `autoGenerateCyclePlanV3`.
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
  // les priorités musculaires ET le mode de construction en un seul flux ;
  // les deux modifs doivent tomber dans l'état.
  if (args.newMuscleGoals) {
    const goals: Record<string, MuscleGoal> = { ...args.newMuscleGoals };
    for (const sg of applyBalanceRules(goals)) {
      if (goals[sg.muscle] === undefined) goals[sg.muscle] = sg;
    }
    next.muscle_goals = goals;
  }

  // Bloc R (A2) — un muscle qui change d'objectif change les reps cibles de ses
  // exos → leur plafond "faux mais cohérent" (biaisé par les reps) devient
  // incohérent. Décision Azur : on remet ces exos à zéro (bootstrap, comme
  // jamais faits) plutôt que de laisser fuiter l'info entre deux cycles de modes
  // différents. La courbe de force de l'exo repart à zéro (assumé).
  const resetExoIds: string[] = [];
  if (args.newMuscleGoals) {
    const changedMuscles = new Set<string>();
    for (const m of new Set([
      ...Object.keys(before.muscle_goals),
      ...Object.keys(next.muscle_goals),
    ])) {
      if (before.muscle_goals[m]?.objective !== next.muscle_goals[m]?.objective) {
        changedMuscles.add(m);
      }
    }
    if (changedMuscles.size > 0) {
      for (const exId of Object.keys(next.e1rm)) {
        let ex;
        try {
          ex = catalog.get(exId);
        } catch {
          continue;
        }
        const primaryChanged = Object.entries(ex.muscles).some(
          ([m, coef]) => coef >= 1.0 && changedMuscles.has(m),
        );
        if (primaryChanged) {
          delete next.e1rm[exId];
          // Refonte progression — l'objectif change ⇒ R change ⇒ le plancher
          // (lié à R) devient incohérent : on le remet à zéro avec l'e1RM.
          delete next.prescribed_load_floor[exId];
          resetExoIds.push(exId);
        }
      }
    }
  }
  if (args.nextBuildMode !== undefined) {
    next.build_mode = args.nextBuildMode;
  }
  if (action === SuggestedAction.TOURNER_EMPHASIS) {
    rotateEmphasis(next.muscle_goals);
  }

  // 3. Bump cycle_index + reset state hebdo. On bump explicitement à
  //    `closedCycleIndex+1` (plutôt que `+= 1`) : la bascule de cycle passe
  //    exclusivement par ici — `advanceWeek` ne touche plus jamais au
  //    `cycle_index` (Conv A, plan 11 : branche w=5 retirée).
  next.cycle_index = closedCycleIndex + 1;
  next.current_week_in_cycle = 1;
  // Chantier B — nouveau cycle : la décision de récupération (déload opt-in)
  // repart à zéro (re-proposée en semaine 5 du nouveau cycle si l'assiduité est haute).
  next.deload_decision = null;
  next.weekly_volume_debt = {};

  // 4. Régénère le plan du nouveau cycle.
  // Bloc O — plus de programmes tout faits. En mode « à la main », on reconduit
  // le plan manuel du cycle précédent (mêmes exos/séries, progression
  // recalculée) au lieu de régénérer ; les charges montent via la
  // recalibration appliquée à l'étape 1.
  if (next.build_mode === 'manual' && before.current_cycle_plan !== null) {
    next.current_cycle_plan = carryOverManualPlan(
      before.current_cycle_plan,
      next.cycle_index,
    );
  } else {
    // Conv #39 — fin de cycle régénérée par la MÊME voie que l'onboarding
    // (V3). `duration_category` est persisté sur le profil ; fallback MEDIUM.
    next.current_cycle_plan = autoGenerateCyclePlanV3(
      next,
      catalog,
      next.profile.duration_category ?? DurationCategory.MEDIUM,
    );
  }

  // 5. Persiste (cycle clos + nouveau cycle).
  await txEndOfCycle({
    state: next,
    review,
    closedCycleIndex,
    resetSnapshotExoIds: resetExoIds,
  });
  await refreshHistory();
  useCoachOsStore.setState({
    userState: next,
    lastCycleReview: review,
    // 1.17 (D7) — un nouveau cycle invalide toute séance en cours : sa ligne
    // DB `planned` vient d'être supprimée par `txEndOfCycle`, mais le store
    // gardait le `currentSessionPlan` → une séance « commencée » résiduelle
    // s'affichait sur aujourd'hui au lieu de laisser l'user planifier sa 1re
    // séance du cycle. On vide l'état de séance en cours.
    currentSessionPlan: null,
    currentSessionId: null,
    currentSessionEntries: null,
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
  /** Conv #22 — alt de generateInitialCyclePlan avec squelette pré-rempli. */
  generateInitialCyclePlanFromSkeleton: typeof generateInitialCyclePlanFromSkeleton;
  /** Conv #22 — mémorise l'exo préféré user pour un pattern. */
  addFavoriteForPattern: typeof addFavoriteForPattern;
  /** Bloc F (Conv #31) — bascule un favori unifié (étoile catalogue/fiche). */
  toggleFavorite: typeof toggleFavorite;
  /** Bloc F (Conv #31) — l'exo atteint-il le seuil de proposition favoris ? */
  shouldSuggestFavorite: typeof shouldSuggestFavorite;
  applyVariantReplacements: typeof applyVariantReplacements;
  setManualE1rm: typeof setManualE1rm;
  resetE1rm: typeof resetE1rm;
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
  resetApp: typeof resetApp;
  importDataFromJson: typeof importDataFromJson;
  /** Conv #21b — gestion des exos custom (table userAddedExercises). */
  addCustomExercise: typeof addCustomExercise;
  removeCustomExercise: typeof removeCustomExercise;
  /** Conv #21b — flexibilité runtime (ajout/retrait exos en séance, séance libre). */
  addExerciseToCurrentSession: typeof addExerciseToCurrentSession;
  removeExerciseFromCurrentSession: typeof removeExerciseFromCurrentSession;
  startFreeSession: typeof startFreeSession;
  /** Bloc G (Conv #32) — séance custom assistée (presets → moteur). */
  startCustomSession: typeof startCustomSession;
  planCustomSessionForDay: typeof planCustomSessionForDay;
  /** Bloc G (Conv #32) — édition chirurgicale du cycle en cours (exos / nom). */
  renameCycleDay: typeof renameCycleDay;
  addExerciseToCycleDay: typeof addExerciseToCycleDay;
  removeExerciseFromCycleDay: typeof removeExerciseFromCycleDay;
  /** Bloc I (Conv #34) — change le nombre de séries d'un exo du cycle en cours. */
  setCycleDayExerciseSets: typeof setCycleDayExerciseSets;
  /** Chantier B — persiste la décision de récupération (déload opt-in) du cycle. */
  setDeloadDecision: typeof setDeloadDecision;
  /** Bloc G (Conv #32) — persiste le template édité du récap d'onboarding. */
  setCurrentCyclePlan: typeof setCurrentCyclePlan;
}

export function useEngine(): EngineApi {
  return useMemo<EngineApi>(
    () => ({
      bootstrap,
      refreshHistory,
      startUser,
      generateInitialCyclePlan,
      generateInitialCyclePlanFromSkeleton,
      addFavoriteForPattern,
      toggleFavorite,
      shouldSuggestFavorite,
      applyVariantReplacements,
      setManualE1rm,
      resetE1rm,
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
      resetApp,
      importDataFromJson,
      addCustomExercise,
      removeCustomExercise,
      addExerciseToCurrentSession,
      removeExerciseFromCurrentSession,
      startFreeSession,
      startCustomSession,
      planCustomSessionForDay,
      renameCycleDay,
      addExerciseToCycleDay,
      removeExerciseFromCycleDay,
      setCycleDayExerciseSets,
      setDeloadDecision,
      setCurrentCyclePlan,
    }),
    [],
  );
}
