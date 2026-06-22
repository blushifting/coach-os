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
    pdc_only: ov.pdc_only,
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
// Conv #14b-3 — Marquer une séance en cours comme sautée.
// Met `status='skipped'` au lieu de supprimer : la séance reste visible dans
// le calendrier (case "sautée", barrée), distincte d'une annulation muette.
// =============================================================================

export async function txSkipSession(sessionId: number): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.sessions], async () => {
    const row = await db.sessions.get(sessionId);
    if (row === undefined) return;
    await db.sessions.put({ ...row, status: 'skipped' });
  });
}

// =============================================================================
// Commit d'un feedback de séance (avec snapshot e1RM des exos touchés)
// =============================================================================

export interface CommitSessionFeedbackArgs {
  feedback: SessionFeedback;
  state: UserState;
  sessionId: number | null;
  /**
   * Conv #30 — si `true`, (ré)ancre `cycle.start_date` sur la date de ce
   * feedback : la grille du cycle démarre à la **1re séance réellement faite**,
   * pas à la date d'onboarding/bilan (calendrier glissant). Passé uniquement
   * pour le tout 1er feedback du cycle (cf. `recordFeedbackAndCommit`).
   */
  anchorStartDate?: boolean;
  /**
   * Bloc R — exos dont la MAJ e1RM de cette séance est DÉFINITIVE (≥ 1 série
   * informative, RPE > 4+). Seuls ceux-là reçoivent un snapshot daté (→ passent
   * en confidence 'measured'). Les MAJ provisoires (séance tout-4+) remontent
   * `state.e1rm` mais ne snapshotent pas → l'exo reste en calibration. Absent →
   * comportement legacy (snapshot de tous les exos touchés).
   */
  definitiveExoIds?: ReadonlySet<string>;
}

export async function txCommitSessionFeedback(args: CommitSessionFeedbackArgs): Promise<void> {
  const { feedback, state, sessionId, anchorStartDate = false, definitiveExoIds } = args;
  const db = getDb();
  await db.transaction(
    'rw',
    [db.userState, db.sessions, db.feedbacks, db.e1rmSnapshots, db.cycles],
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
      if (anchorStartDate) {
        const cycle = await db.cycles.get(feedback.cycle_index);
        if (cycle !== undefined) {
          await db.cycles.update(feedback.cycle_index, {
            start_date: feedback.seance_date,
          });
        }
      }
      if (sessionId !== null) {
        await db.sessions.update(sessionId, { status: 'completed' });
      }
      const touchedExIds = new Set(feedback.sets.map((s) => s.exercise_id));
      const snapshots = [...touchedExIds]
        .filter(
          (exId) =>
            state.e1rm[exId] !== undefined &&
            (definitiveExoIds?.has(exId) ?? true),
        )
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
// Bloc R — Reset d'un plafond e1RM (fiche catalogue). Le caller a déjà fait
// `delete state.e1rm[exerciseId]` : on persiste l'état nettoyé + on efface tous
// les snapshots de l'exo → il repart en calibration (bootstrap reseed), comme
// jamais fait.
// =============================================================================

export interface ResetE1rmArgs {
  state: UserState;
  exerciseId: string;
}

export async function txResetE1rm(args: ResetE1rmArgs): Promise<void> {
  const { state, exerciseId } = args;
  const db = getDb();
  await db.transaction('rw', [db.userState, db.e1rmSnapshots], async () => {
    await putUserStateInTx(state);
    await db.e1rmSnapshots.where('exercise_id').equals(exerciseId).delete();
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
  /**
   * Bloc R (A2) — exos dont le muscle a changé d'objectif au nouveau cycle :
   * on efface leurs snapshots e1RM (le caller a déjà retiré `state.e1rm[id]`)
   * pour qu'ils repartent en calibration de zéro, sans fuite d'info entre deux
   * cycles de modes différents.
   */
  resetSnapshotExoIds?: readonly string[];
}

export async function txEndOfCycle(args: EndOfCycleArgs): Promise<void> {
  const { state, review, closedCycleIndex, nextProgrammeId, resetSnapshotExoIds } = args;
  const db = getDb();
  const today = nowIso().slice(0, 10);
  await db.transaction(
    'rw',
    [db.userState, db.cycles, db.sessions, db.e1rmSnapshots],
    async () => {
    await putUserStateInTx(state);
    if (resetSnapshotExoIds && resetSnapshotExoIds.length > 0) {
      await db.e1rmSnapshots.where('exercise_id').anyOf([...resetSnapshotExoIds]).delete();
    }
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
    // Conv #18 — nettoie les séances `planned` du cycle qui se ferme : leur
    // plan est figé sur l'ancien WeeklyTemplate et ne correspond plus à
    // rien après régénération. On les supprime (vs `cancelled` : la séance
    // n'a jamais été jouée, pas de bilan à garder, et le calendrier reste
    // propre). Les séances `completed` / `skipped` du cycle clos sont
    // préservées (historique).
    await db.sessions
      .where('cycle_index')
      .equals(closedCycleIndex)
      .and((s) => s.status === 'planned')
      .delete();
  });
}
