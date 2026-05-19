/**
 * Transactions multi-tables — atomicité blob `userState` ↔ tables dérivées.
 *
 * Toute mutation du moteur qui touche aussi des tables relationnelles
 * (sessions, feedbacks, snapshots, cycles) DOIT passer par une de ces
 * fonctions, jamais par les repos isolés. Garantit qu'on ne se retrouve pas
 * avec un blob mis à jour mais des dérivées désynchronisées (ou inverse).
 */

import type { CycleReview, SessionFeedback, SessionPlan, UserState } from '@/engine/models';
import { getDb } from './schema';
import { serializeUserState } from './serialize';

const SINGLETON_ID = 1 as const;

function nowIso(): string {
  return new Date().toISOString();
}

function putUserStateInTx(state: UserState): Promise<unknown> {
  return getDb().userState.put({
    id: SINGLETON_ID,
    state: serializeUserState(state),
    updated_at: nowIso(),
  });
}

function syncEquipmentOverridesInTx(state: UserState): Promise<unknown> {
  const rows = Object.entries(state.equipment_overrides).map(([exercise_id, ov]) => ({
    exercise_id,
    inc_kg: ov.inc_kg,
    min_load_kg: ov.min_load_kg,
    max_load_kg: ov.max_load_kg,
  }));
  return Promise.all([
    getDb().equipmentOverrides.clear(),
    rows.length === 0 ? Promise.resolve() : getDb().equipmentOverrides.bulkPut(rows),
  ]);
}

// =============================================================================
// Init utilisateur (Onboarding terminé)
// =============================================================================

export async function txInitUser(state: UserState, programmeId: string | null): Promise<void> {
  const db = getDb();
  await db.transaction(
    'rw',
    [db.userState, db.cycles, db.equipmentOverrides],
    async () => {
      await putUserStateInTx(state);
      await syncEquipmentOverridesInTx(state);
      await db.cycles.put({
        cycle_index: state.cycle_index,
        start_date: nowIso().slice(0, 10),
        end_date: null,
        programme_id: programmeId,
        review: null,
      });
    },
  );
}

// =============================================================================
// Insertion d'un plan de séance (au tap "préparer la séance")
// =============================================================================

export async function txSaveSessionPlan(
  plan: SessionPlan,
  state: UserState,
): Promise<number> {
  const db = getDb();
  return db.transaction('rw', [db.userState, db.sessions], async () => {
    const id = await db.sessions.add({
      seance_date: plan.seance_date,
      week_in_cycle: plan.week_in_cycle,
      cycle_index: plan.cycle_index,
      plan,
      status: 'planned',
      created_at: nowIso(),
    });
    await putUserStateInTx(state);
    return Number(id);
  });
}

// =============================================================================
// Mise à jour d'un SessionPlan déjà persisté (Conv #10d : remplacement d'exo
// en cours de séance).
// =============================================================================

export async function txUpdateSessionPlan(
  sessionId: number,
  plan: SessionPlan,
  state: UserState,
): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.userState, db.sessions], async () => {
    await db.sessions.update(sessionId, {
      plan,
      seance_date: plan.seance_date,
      week_in_cycle: plan.week_in_cycle,
      cycle_index: plan.cycle_index,
    });
    await putUserStateInTx(state);
  });
}

// =============================================================================
// Annulation d'une séance planifiée (Conv #10d).
// Supprime la ligne `sessions` correspondante. Pas d'effet sur le blob
// `userState` (les e1RM bootstrap éventuellement créés restent — bénins).
// =============================================================================

export async function txCancelSession(sessionId: number): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.sessions], async () => {
    await db.sessions.delete(sessionId);
  });
}

// =============================================================================
// Commit d'un feedback de séance (avec snapshot e1RM des exos touchés)
// =============================================================================

export interface CommitSessionFeedbackArgs {
  feedback: SessionFeedback;
  state: UserState;
  sessionId: number | null;
}

export async function txCommitSessionFeedback(args: CommitSessionFeedbackArgs): Promise<void> {
  const { feedback, state, sessionId } = args;
  const db = getDb();
  await db.transaction(
    'rw',
    [db.userState, db.sessions, db.feedbacks, db.e1rmSnapshots],
    async () => {
      await putUserStateInTx(state);
      await db.feedbacks.add({
        session_id: sessionId,
        seance_date: feedback.seance_date,
        cycle_index: feedback.cycle_index,
        week_in_cycle: feedback.week_in_cycle,
        feedback,
        created_at: nowIso(),
      });
      if (sessionId !== null) {
        await db.sessions.update(sessionId, { status: 'completed' });
      }
      const touchedExIds = new Set(feedback.sets.map((s) => s.exercise_id));
      const snapshots = [...touchedExIds]
        .filter((exId) => state.e1rm[exId] !== undefined)
        .map((exId) => ({
          date: feedback.seance_date,
          exercise_id: exId,
          e1rm: state.e1rm[exId]!,
          cycle_index: feedback.cycle_index,
          week_in_cycle: feedback.week_in_cycle,
        }));
      if (snapshots.length > 0) {
        await db.e1rmSnapshots.bulkAdd(snapshots);
      }
    },
  );
}

// =============================================================================
// Saisie manuelle d'un plafond e1RM (Conv #12b — option "Je connais mon plafond").
// Pose `state.e1rm[exo]` + insère un snapshot daté pour que la calibration
// passe en `'measured'` sans avoir besoin de feedback de séance.
// =============================================================================

export interface CommitManualE1rmArgs {
  state: UserState;
  exerciseId: string;
  e1rmTotal: number;
  date: string;
  cycleIndex: number;
  weekInCycle: number;
}

export async function txCommitManualE1rm(args: CommitManualE1rmArgs): Promise<void> {
  const { state, exerciseId, e1rmTotal, date, cycleIndex, weekInCycle } = args;
  const db = getDb();
  await db.transaction('rw', [db.userState, db.e1rmSnapshots], async () => {
    await putUserStateInTx(state);
    await db.e1rmSnapshots.add({
      date,
      exercise_id: exerciseId,
      e1rm: e1rmTotal,
      cycle_index: cycleIndex,
      week_in_cycle: weekInCycle,
    });
  });
}

// =============================================================================
// Fin de semaine (mute juste UserState)
// =============================================================================

export async function txEndOfWeek(state: UserState): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.userState], async () => {
    await putUserStateInTx(state);
  });
}

// =============================================================================
// Sauvegarde du seul UserState (post-onboarding : current_cycle_plan posé)
// =============================================================================

export async function txSaveUserStateOnly(state: UserState): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.userState], async () => {
    await putUserStateInTx(state);
  });
}

// =============================================================================
// Fin de cycle (sauve review + ferme cycle courant + ouvre suivant si avancé)
// =============================================================================

export interface EndOfCycleArgs {
  /** State *après* `endOfCycle()` du moteur (cycle_index peut avoir avancé). */
  state: UserState;
  review: CycleReview;
  /** cycle_index de celui qui se termine (peut différer de state.cycle_index). */
  closedCycleIndex: number;
  /** programme du nouveau cycle (null = pas encore choisi). */
  nextProgrammeId: string | null;
}

export async function txEndOfCycle(args: EndOfCycleArgs): Promise<void> {
  const { state, review, closedCycleIndex, nextProgrammeId } = args;
  const db = getDb();
  const today = nowIso().slice(0, 10);
  await db.transaction('rw', [db.userState, db.cycles], async () => {
    await putUserStateInTx(state);
    const closed = await db.cycles.get(closedCycleIndex);
    await db.cycles.put({
      cycle_index: closedCycleIndex,
      start_date: closed?.start_date ?? today,
      end_date: today,
      programme_id: closed?.programme_id ?? null,
      review,
    });
    if (state.cycle_index !== closedCycleIndex) {
      const existingNext = await db.cycles.get(state.cycle_index);
      if (existingNext === undefined) {
        await db.cycles.put({
          cycle_index: state.cycle_index,
          start_date: today,
          end_date: null,
          programme_id: nextProgrammeId,
          review: null,
        });
      }
    }
  });
}
