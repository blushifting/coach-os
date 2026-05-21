/**
 * Rééquilibrage des durées de séance dans un cycle (Conv #16-2).
 *
 * Une fois `composeSession` exécuté pour chaque jour, on obtient un
 * `WeeklyTemplate` dont les jours ont des durées potentiellement très
 * inégales (cas classique : full-body 3j où jour 1 hérite de tous les
 * compounds lourds et jour 3 finit avec quelques isolations).
 *
 * Algorithme : pour chaque **groupe de jours partageant le même
 * `slot_kind`** (esprit du split préservé — on ne migre jamais un exo
 * UPPER sur un jour LOWER), on tente itérativement des opérations qui
 * réduisent l'écart de durée du groupe :
 *
 *  - **Move** : déplacer un exo du jour le plus long vers le plus court.
 *  - **Swap** : échanger un exo entre les deux jours.
 *
 * On retient l'opération qui maximise le gain (réduction `max-min`),
 * sous réserve de respecter les **invariants** :
 *
 *  1. **Fréquence muscle préservée** : aucun muscle prioritaire ne passe
 *     sous sa `targetFrequency` après l'opération.
 *  2. **Jour non vide** : aucun jour ne se retrouve avec 0 exo.
 *  3. **Pas de doublon** : un Move ne crée pas 2 fois le même `exercise_id`
 *     sur le receveur.
 *
 * Limites : 10 itérations max par groupe, gain minimum de 3 min pour
 * accepter une opération (évite les micro-swaps). On s'arrête dès qu'il
 * n'y a plus d'opération valide qui gagne ≥ 3 min — pas de seuil
 * "objectif" à atteindre, on fait juste autant de swaps que les
 * contraintes permettent.
 *
 * Le `target_muscles_focus` n'est volontairement pas recalculé après
 * coup (métadonnée historique, n'impacte plus la simulation).
 */

import type { Catalog } from './catalog';
import {
  exercisePrimaires,
  MuscleStatus,
  type DayTemplate,
  type PlannedExercise,
  type UserState,
  type WeeklyTemplate,
} from './models';
import { targetFrequency } from './volume';
import { estimateExerciseDurationMinutes } from '@/lib/onboarding-preview';

/** Nb max d'itérations par groupe de jours (= par slot_kind). */
export const MAX_REBALANCE_ITERATIONS = 10;
/** Gain minimum en minutes pour accepter une opération. */
export const MIN_REBALANCE_GAIN_MIN = 3;

export type RebalanceOpType = 'move' | 'swap';

interface CandidateOperation {
  readonly type: RebalanceOpType;
  readonly longDayIdx: number;
  readonly shortDayIdx: number;
  readonly longExoIdx: number;
  readonly shortExoIdx: number | null;
  readonly expectedGain: number;
}

export interface RebalanceTrace {
  readonly initialDurationsMin: ReadonlyArray<number>;
  readonly finalDurationsMin: ReadonlyArray<number>;
  readonly operations: ReadonlyArray<{
    readonly type: RebalanceOpType;
    readonly longDayIdx: number;
    readonly shortDayIdx: number;
    readonly gainMin: number;
  }>;
  /** Variation `max-min` du groupe le plus déséquilibré, avant → après. */
  readonly maxSpreadBefore: number;
  readonly maxSpreadAfter: number;
}

/**
 * Point d'entrée. Retourne un nouveau `WeeklyTemplate` rééquilibré +
 * une trace (utile pour tests + debug en dev). Le template d'entrée
 * n'est pas muté.
 *
 * @param slotKinds — slot_kind de chaque jour (= sortie de
 *   `parameterizeSplit`, indexé pareil que `template.days`).
 */
export function rebalanceCycleDurations(
  template: WeeklyTemplate,
  slotKinds: ReadonlyArray<string>,
  state: UserState,
  catalog: Catalog,
): { readonly template: WeeklyTemplate; readonly trace: RebalanceTrace } {
  if (slotKinds.length !== template.days.length) {
    throw new Error(
      `rebalanceCycleDurations: slotKinds.length (${slotKinds.length}) ≠ days.length (${template.days.length})`,
    );
  }

  let days: DayTemplate[] = template.days.map(cloneDay);
  const initialDurationsMin = days.map((d) => dayDurationMin(d, catalog));

  // Groupage par slot_kind. On rebalance seulement intra-groupe.
  const byKind = new Map<string, number[]>();
  for (let i = 0; i < days.length; i++) {
    const arr = byKind.get(slotKinds[i]!) ?? [];
    arr.push(i);
    byKind.set(slotKinds[i]!, arr);
  }

  const operations: RebalanceTrace['operations'] = [];
  let maxSpreadBefore = 0;
  for (const indices of byKind.values()) {
    if (indices.length < 2) continue;
    const groupDurs = indices.map((i) => initialDurationsMin[i]!);
    const spread = Math.max(...groupDurs) - Math.min(...groupDurs);
    if (spread > maxSpreadBefore) maxSpreadBefore = spread;
  }

  for (const indices of byKind.values()) {
    if (indices.length < 2) continue;

    for (let iter = 0; iter < MAX_REBALANCE_ITERATIONS; iter++) {
      const durs = indices.map((i) => ({ i, d: dayDurationMin(days[i]!, catalog) }));
      durs.sort((a, b) => b.d - a.d);
      const longIdx = durs[0]!.i;
      const shortIdx = durs[durs.length - 1]!.i;
      const gap = durs[0]!.d - durs[durs.length - 1]!.d;
      if (gap < MIN_REBALANCE_GAIN_MIN) break;

      const best = findBestOperation(days, longIdx, shortIdx, state, catalog);
      if (best === null) break;

      days = applyOperation(days, best);
      const opGainMin = Math.round(best.expectedGain * 10) / 10;
      const operationsMut = operations as Array<
        RebalanceTrace['operations'][number]
      >;
      operationsMut.push({
        type: best.type,
        longDayIdx: best.longDayIdx,
        shortDayIdx: best.shortDayIdx,
        gainMin: opGainMin,
      });
    }
  }

  const finalDurationsMin = days.map((d) => dayDurationMin(d, catalog));
  let maxSpreadAfter = 0;
  for (const indices of byKind.values()) {
    if (indices.length < 2) continue;
    const groupDurs = indices.map((i) => finalDurationsMin[i]!);
    const spread = Math.max(...groupDurs) - Math.min(...groupDurs);
    if (spread > maxSpreadAfter) maxSpreadAfter = spread;
  }

  return {
    template: { ...template, days },
    trace: {
      initialDurationsMin,
      finalDurationsMin,
      operations,
      maxSpreadBefore,
      maxSpreadAfter,
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function cloneDay(d: DayTemplate): DayTemplate {
  return {
    ...d,
    target_muscles_focus: [...d.target_muscles_focus],
    exercises: d.exercises.map((e) => ({ ...e, progression: [...e.progression] })),
  };
}

function dayDurationMin(day: DayTemplate, catalog: Catalog): number {
  let total = 0;
  for (const ex of day.exercises) {
    if (!catalog.has(ex.exercise_id)) continue;
    total += estimateExerciseDurationMinutes(ex, catalog.get(ex.exercise_id).type);
  }
  return total;
}

function exoDurationMin(ex: PlannedExercise, catalog: Catalog): number {
  if (!catalog.has(ex.exercise_id)) return 0;
  return estimateExerciseDurationMinutes(ex, catalog.get(ex.exercise_id).type);
}

/**
 * Énumère toutes les opérations candidates pour la paire (long, short)
 * et retourne celle qui maximise le gain en respectant les invariants.
 * `null` si aucune opération valide ne dépasse `MIN_REBALANCE_GAIN_MIN`.
 */
function findBestOperation(
  days: DayTemplate[],
  longIdx: number,
  shortIdx: number,
  state: UserState,
  catalog: Catalog,
): CandidateOperation | null {
  const long = days[longIdx]!;
  const short = days[shortIdx]!;
  const longDur = dayDurationMin(long, catalog);
  const shortDur = dayDurationMin(short, catalog);
  const currentGap = longDur - shortDur;

  let best: CandidateOperation | null = null;

  // 1. Move
  for (let i = 0; i < long.exercises.length; i++) {
    const ex = long.exercises[i]!;
    const exDur = exoDurationMin(ex, catalog);
    const newLong = longDur - exDur;
    const newShort = shortDur + exDur;
    const newGap = Math.abs(newLong - newShort);
    const gain = currentGap - newGap;
    if (gain < MIN_REBALANCE_GAIN_MIN) continue;

    const op: CandidateOperation = {
      type: 'move',
      longDayIdx: longIdx,
      shortDayIdx: shortIdx,
      longExoIdx: i,
      shortExoIdx: null,
      expectedGain: gain,
    };
    if (!isOperationValid(days, op, state, catalog)) continue;
    if (best === null || gain > best.expectedGain) best = op;
  }

  // 2. Swap
  for (let i = 0; i < long.exercises.length; i++) {
    const exL = long.exercises[i]!;
    const durL = exoDurationMin(exL, catalog);
    for (let j = 0; j < short.exercises.length; j++) {
      const exS = short.exercises[j]!;
      const durS = exoDurationMin(exS, catalog);
      const diff = durL - durS;
      const newLong = longDur - diff;
      const newShort = shortDur + diff;
      const newGap = Math.abs(newLong - newShort);
      const gain = currentGap - newGap;
      if (gain < MIN_REBALANCE_GAIN_MIN) continue;

      const op: CandidateOperation = {
        type: 'swap',
        longDayIdx: longIdx,
        shortDayIdx: shortIdx,
        longExoIdx: i,
        shortExoIdx: j,
        expectedGain: gain,
      };
      if (!isOperationValid(days, op, state, catalog)) continue;
      if (best === null || gain > best.expectedGain) best = op;
    }
  }

  return best;
}

function applyOperation(
  days: DayTemplate[],
  op: CandidateOperation,
): DayTemplate[] {
  const newDays = days.map(cloneDay);
  const longExos = newDays[op.longDayIdx]!.exercises;
  const shortExos = newDays[op.shortDayIdx]!.exercises;

  if (op.type === 'move') {
    const ex = longExos[op.longExoIdx]!;
    newDays[op.longDayIdx] = {
      ...newDays[op.longDayIdx]!,
      exercises: longExos.filter((_, i) => i !== op.longExoIdx),
    };
    newDays[op.shortDayIdx] = {
      ...newDays[op.shortDayIdx]!,
      exercises: [...shortExos, ex],
    };
  } else {
    // swap
    const exL = longExos[op.longExoIdx]!;
    const exS = shortExos[op.shortExoIdx!]!;
    const newLong = [...longExos];
    newLong[op.longExoIdx] = exS;
    const newShort = [...shortExos];
    newShort[op.shortExoIdx!] = exL;
    newDays[op.longDayIdx] = { ...newDays[op.longDayIdx]!, exercises: newLong };
    newDays[op.shortDayIdx] = { ...newDays[op.shortDayIdx]!, exercises: newShort };
  }

  return newDays;
}

function isOperationValid(
  days: DayTemplate[],
  op: CandidateOperation,
  state: UserState,
  catalog: Catalog,
): boolean {
  const newDays = applyOperation(days, op);

  // 1. Jour non vide
  for (const d of newDays) {
    if (d.exercises.length === 0) return false;
  }

  // 2. Pas de doublon exercise_id par jour
  for (const d of newDays) {
    const ids = d.exercises.map((e) => e.exercise_id);
    if (new Set(ids).size !== ids.length) return false;
  }

  // 3. Fréquence muscle prioritaire préservée
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (goal.status !== MuscleStatus.PRIORITAIRE) continue;
    const target = targetFrequency(muscle, state);
    if (target === 0) continue;
    if (countMuscleFrequency(newDays, muscle, catalog) < target) return false;
  }

  return true;
}

function countMuscleFrequency(
  days: DayTemplate[],
  muscle: string,
  catalog: Catalog,
): number {
  let count = 0;
  for (const d of days) {
    const present = d.exercises.some((ex) => {
      if (!catalog.has(ex.exercise_id)) return false;
      return exercisePrimaires(catalog.get(ex.exercise_id)).includes(muscle);
    });
    if (present) count++;
  }
  return count;
}
