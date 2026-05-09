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
import type {
  MuscleGoal,
  Profile,
  SessionFeedback,
  SessionPlan,
  UserState,
} from '@/engine/models';
import { getDb } from '@/db';
import { loadUserState } from '@/db/repositories/userState.repo';
import {
  txCommitSessionFeedback,
  txEndOfCycle,
  txEndOfWeek,
  txInitUser,
  txSaveSessionPlan,
} from '@/db/transactions';
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
// Génération + stockage d'une séance
// =============================================================================

export interface GenerateSessionArgs {
  dayIndex: number;
  seanceDate: string;
}

export async function generateAndStoreSession(
  args: GenerateSessionArgs,
): Promise<{ plan: SessionPlan; sessionId: number }> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const plan = engine.generateSession(next, catalog, args.dayIndex, args.seanceDate);
  const sessionId = await txSaveSessionPlan(plan, next);
  useCoachOsStore.setState({
    userState: next,
    currentSessionPlan: plan,
    currentSessionId: sessionId,
  });
  await refreshHistory();
  return { plan, sessionId };
}

// =============================================================================
// Enregistrement d'un feedback
// =============================================================================

export async function recordFeedbackAndCommit(
  feedback: SessionFeedback,
): Promise<engine.RecordFeedbackResult> {
  const catalog = requireCatalog();
  const next = requireUserState();
  const summary = engine.recordFeedback(next, catalog, feedback);
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
  generateAndStoreSession: typeof generateAndStoreSession;
  recordFeedbackAndCommit: typeof recordFeedbackAndCommit;
  endOfWeek: typeof endOfWeek;
  endOfCycle: typeof endOfCycle;
}

export function useEngine(): EngineApi {
  return useMemo<EngineApi>(
    () => ({
      bootstrap,
      refreshHistory,
      startUser,
      generateAndStoreSession,
      recordFeedbackAndCommit,
      endOfWeek,
      endOfCycle,
    }),
    [],
  );
}
