/**
 * Dump 2.4, étape 5 — recalcul de l'historique des Plafonds depuis les séries.
 *
 * Quand le calcul du Plafond change (ici : pente par type d'exercice, fin de
 * l'adoption sans lissage), les Plafonds et instantanés enregistrés ne sont plus
 * comparables aux nouvelles mesures : la courbe aurait une marche à la date du
 * changement. Les séries, elles, sont intactes : on rejoue donc toutes les
 * séances, dans l'ordre, avec le calcul actuel. Rien n'est perdu, rien n'est
 * inventé.
 *
 * Choix du rejeu :
 *  - même règle que l'enregistrement d'une séance (`recordFeedback`) : première
 *    mesure sans lissage, séance trop facile qui ne fait que monter, semaine de
 *    récupération qui ne fait que monter ;
 *  - un Plafond saisi à la main (« Je connais mon plafond ») reste un point
 *    d'ancrage à sa date ;
 *  - les anciennes remises à zéro (changement d'objectif, avant la 2.3.1) ne
 *    sont pas rejouées : elles effaçaient un historique qui existe (invariant
 *    n° 1 du dump 2.4) ;
 *  - poids du corps : celui du profil actuel, le seul connu ;
 *  - un exercice absent du catalogue (exercice personnel supprimé) garde ses
 *    instantanés et son Plafond tels quels.
 */

import type { Catalog } from './catalog';
import { updateE1rmForExercise } from './feedback';
import type { SessionFeedback, SetFeedback, UserState } from './models';
import { e1rmObserved, effectiveLoadForE1rm, slopeFor } from './prescription';
import { DELOAD_WEEK_IN_CYCLE } from './volume';

export interface ReplayFeedbackRow {
  readonly seance_date: string;
  readonly cycle_index: number;
  readonly week_in_cycle: number;
  readonly feedback: SessionFeedback;
}

export interface ReplaySnapshot {
  readonly date: string;
  readonly exercise_id: string;
  readonly e1rm: number;
  readonly cycle_index: number;
  readonly week_in_cycle: number;
}

export interface ReplayCycle {
  readonly cycle_index: number;
  /** Présent = cycle clos. */
  readonly review: {
    readonly recovery_taken?: boolean;
    readonly plafonds_progression: Readonly<Record<string, number>>;
  } | null;
}

export interface ReplayResult {
  /** Plafond courant par exercice (les exercices non rejoués gardent le leur). */
  readonly e1rm: Record<string, number>;
  /** Tous les instantanés, triés par date. */
  readonly snapshots: ReplaySnapshot[];
  /** `plafonds_progression` recalculé, par cycle clos. */
  readonly plafondsProgression: Record<number, Record<string, number>>;
}

/** La séance tombe-t-elle dans une semaine de récupération prise ? */
function isRecoveryWeek(
  row: ReplayFeedbackRow,
  cycles: ReadonlyMap<number, ReplayCycle>,
  state: UserState,
): boolean {
  if (row.week_in_cycle !== DELOAD_WEEK_IN_CYCLE) return false;
  const review = cycles.get(row.cycle_index)?.review ?? null;
  // Cycle en cours : la décision est dans l'état.
  if (review === null) return state.deload_decision === 'accepted';
  // Cycle clos avant la 2.3.2 (décision non archivée) : on suppose la
  // récupération prise. Le cas inverse ne perd qu'une éventuelle baisse.
  return review.recovery_taken ?? true;
}

export function replayPlafonds(args: {
  state: UserState;
  catalog: Catalog;
  feedbacks: readonly ReplayFeedbackRow[];
  snapshots: readonly ReplaySnapshot[];
  cycles: readonly ReplayCycle[];
}): ReplayResult {
  const { state, catalog, feedbacks, snapshots, cycles } = args;
  const cycleById = new Map(cycles.map((c) => [c.cycle_index, c]));
  const bw = state.profile.bodyweight_kg;

  // Séances dans l'ordre (tri stable : deux séances le même jour gardent leur ordre).
  const rows = [...feedbacks].sort((a, b) =>
    a.seance_date < b.seance_date ? -1 : a.seance_date > b.seance_date ? 1 : 0,
  );

  // Exercices rejoués : faits au moins une fois et connus du catalogue.
  const replayed = new Set<string>();
  const doneOn = new Set<string>(); // « date|exercice »
  for (const r of rows) {
    for (const s of r.feedback.sets) {
      doneOn.add(`${r.seance_date}|${s.exercise_id}`);
      if (catalog.has(s.exercise_id)) replayed.add(s.exercise_id);
    }
  }

  // Plafonds saisis à la main : instantané sans séance de cet exercice ce jour-là.
  const anchors = snapshots
    .filter((s) => replayed.has(s.exercise_id) && !doneOn.has(`${s.date}|${s.exercise_id}`))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // État de travail : seuls `e1rm` et le profil sont lus par la mise à jour.
  const scratch: UserState = {
    ...state,
    e1rm: Object.fromEntries(Object.entries(state.e1rm).filter(([id]) => !replayed.has(id))),
  };
  const out: ReplaySnapshot[] = snapshots.filter((s) => !replayed.has(s.exercise_id));
  const calibrated = new Set<string>();
  const endOfCycle: Record<number, Record<string, number>> = {};
  const firstOfCycle: Record<number, Record<string, number>> = {};

  let a = 0;
  const applyAnchorsUpTo = (date: string) => {
    while (a < anchors.length && anchors[a]!.date <= date) {
      const anchor = anchors[a]!;
      scratch.e1rm[anchor.exercise_id] = anchor.e1rm;
      calibrated.add(anchor.exercise_id);
      out.push(anchor);
      a++;
    }
  };

  for (const row of rows) {
    applyAnchorsUpTo(row.seance_date);
    const recovery = isRecoveryWeek(row, cycleById, state);
    const byEx = new Map<string, SetFeedback[]>();
    for (const s of row.feedback.sets) {
      if (!replayed.has(s.exercise_id)) continue;
      byEx.set(s.exercise_id, [...(byEx.get(s.exercise_id) ?? []), s]);
    }
    for (const [exId, sets] of byEx) {
      const ex = catalog.get(exId);
      // Référence du bilan de cycle : première série du cycle, sans lissage
      // (même définition que `computeE1rmDeltaPerExercise`).
      const first = (firstOfCycle[row.cycle_index] ??= {});
      if (!(exId in first)) {
        try {
          const s0 = sets[0]!;
          first[exId] = e1rmObserved(
            effectiveLoadForE1rm(s0.load_kg, ex, bw),
            s0.reps_done,
            s0.rpe_perceived,
            slopeFor(ex),
          );
        } catch {
          // série hors plage : pas de référence
        }
      }
      const update = updateE1rmForExercise(scratch, ex, sets, {
        skipEma: !calibrated.has(exId) && !recovery,
        ratchetUpOnly: recovery,
      });
      if (update !== null && update.definitive) {
        calibrated.add(exId);
        out.push({
          date: row.seance_date,
          exercise_id: exId,
          e1rm: scratch.e1rm[exId]!,
          cycle_index: row.cycle_index,
          week_in_cycle: row.week_in_cycle,
        });
      }
      const value = scratch.e1rm[exId];
      if (value !== undefined) (endOfCycle[row.cycle_index] ??= {})[exId] = value;
    }
  }
  applyAnchorsUpTo('9999-12-31');

  // Bilans de cycle archivés : même définition qu'à la clôture (Plafond en fin
  // de cycle − première série du cycle), pour les exercices rejoués.
  const plafondsProgression: Record<number, Record<string, number>> = {};
  for (const c of cycles) {
    if (c.review === null) continue;
    const next: Record<string, number> = { ...c.review.plafonds_progression };
    for (const exId of Object.keys(next)) {
      const end = endOfCycle[c.cycle_index]?.[exId];
      const first = firstOfCycle[c.cycle_index]?.[exId];
      if (replayed.has(exId) && end !== undefined && first !== undefined) {
        next[exId] = end - first;
      }
    }
    plafondsProgression[c.cycle_index] = next;
  }

  out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  return { e1rm: { ...scratch.e1rm }, snapshots: out, plafondsProgression };
}
