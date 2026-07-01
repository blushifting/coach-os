/**
 * Skeleton builder — refonte « plan de volume » (recherche/09b_refonte_remplissage.md).
 *
 * On raisonne PAR SÉANCE, le volume/muscle est la variable maîtresse, et les
 * séries sont le produit direct d'un plan de volume (matrice muscle × séance).
 * Le compound/isolation n'apparaît qu'à la réalisation.
 *
 * Pipeline :
 *   1. `computeMuscleDemands` — V_cible + fréquence provisoire par muscle.
 *   2. `selectBestSplit` — choix de structure (séances/sem + pas de séance vide
 *      + alternance). Plus de capacité (retirée : prouvé sans effet sur le choix).
 *   3. `buildVolumePlan` — matrice `[séance][muscle] = séries`, répartition
 *      égale sur les séances éligibles les moins chargées + règle d'espacement.
 *   4. `realizeSession` — chaque colonne devient des cases (pattern × muscle ×
 *      role × séries), avec **crédit du volume incident** (un compound nourrit
 *      ses synergistes à 0,5/série → pas d'iso dédiée à un muscle déjà servi).
 *
 * Sortie : `SkeletonTemplate` — cases `chosen_exercise_id = null` (l'user/
 * l'auto-fill choisit la variante) mais `planned_sets` déjà posé.
 */

import type {
  MuscleGoal,
  PatternCell,
  RoleHint,
  SkeletonDay,
  SkeletonTemplate,
  UserState,
} from './models';
import {
  DurationCategory,
  MuscleStatus,
  Pattern,
  makeSkeletonTemplate,
} from './models';
import { effectiveCycleTargetVolume } from './volume';
import {
  ALL_SPLITS,
  SlotKind,
  muscleBelongsToSlot,
  type SplitTemplate,
} from './split';
import {
  PATTERN_SYNERGISTS,
  distributeSetsForDose,
  exosForSessionDose,
  getMusclePatterns,
  isCompoundPattern,
  REALIZE_MIN_SETS,
} from './pattern_grid';

// =============================================================================
// Types intermédiaires
// =============================================================================

/** Demande d'un muscle : volume cible + fréquence provisoire (scoring split). */
export interface MuscleDemand {
  muscle: string;
  goal: MuscleGoal;
  /** Volume cible hebdo (séries pondérées, cf. `effectiveCycleTargetVolume`). */
  v_target: number;
  /** Fréquence hebdo « provisoire » = floor(V/3) capée aux séances/sem. */
  target_frequency: number;
}

interface SplitScoreResult {
  split: SplitTemplate;
  score: number;
  /** Au moins une séance sans aucun muscle éligible. */
  empty: boolean;
  warnings: string[];
}

// =============================================================================
// 1. Demande par muscle
// =============================================================================

/** Fréquence dérivée : au plus 1 exo « plein » (3 séries) par séance. */
function frequencyFor(vTarget: number, cap: number): number {
  if (vTarget <= 0) return 0;
  return Math.max(1, Math.min(cap, Math.floor(vTarget / REALIZE_MIN_SETS)));
}

export function computeMuscleDemands(state: UserState): MuscleDemand[] {
  const demands: MuscleDemand[] = [];
  const cap = state.profile.sessions_per_week;
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (goal.status === MuscleStatus.NON_COUVERT) continue;
    const vTarget = effectiveCycleTargetVolume(state, muscle);
    if (vTarget <= 0) continue;
    demands.push({
      muscle,
      goal,
      v_target: vTarget,
      target_frequency: frequencyFor(vTarget, cap),
    });
  }
  // Tri : prioritaires d'abord, puis priority_rank (maintien en dernier).
  demands.sort((a, b) => {
    const sa = a.goal.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
    const sb = b.goal.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.goal.priority_rank - b.goal.priority_rank;
  });
  return demands;
}

/** Somme des fréquences cibles (indicateur grossier de charge du programme). */
export function totalCellDemand(demands: readonly MuscleDemand[]): number {
  return demands.reduce((acc, d) => acc + d.target_frequency, 0);
}

// =============================================================================
// 2. Score & sélection de split (sans capacité)
// =============================================================================

const SCORE_FREQ_HIT = 5;
const SCORE_FREQ_MISS = -3;
/** Séance sans muscle éligible = structure inadaptée (malus dominant). */
const SCORE_EMPTY_SESSION = -25;
/** Bonus des splits canoniques bien lus. `ul_5x_spec` retiré (09b). */
const SCORE_CANONICAL_BONUS: Record<string, number> = {
  ul_4x: 2,
  ppl_6x: 2,
  fb_3x: 1,
  fb_2x: 0,
  ppl_3x: 0,
  push_pull_2x: 1,
  push_pull_4x: 2,
  push_pull_6x: 2,
  ulf_3x: 0,
  ppl_ul_5x: 2,
  ul_6x: 1,
  // Filets Full : bonus faible → gagnent seulement si aucune spécialisée valide.
  fb_4x: 0,
  fb_5x: 0,
  fb_6x: 0,
};

/** Nb de séances du split dont le type peut héberger ce muscle. */
function eligibleCount(muscle: string, split: SplitTemplate): number {
  let n = 0;
  for (const slot of split.slots) {
    if (muscleBelongsToSlot(muscle, slot.kind)) n += 1;
  }
  return n;
}

function scoreSplit(
  split: SplitTemplate,
  demands: readonly MuscleDemand[],
): SplitScoreResult {
  let score = SCORE_CANONICAL_BONUS[split.id] ?? 0;
  const warnings: string[] = [];
  let empty = false;

  // Séance vide = aucun muscle couvert éligible à ce type de séance.
  for (const slot of split.slots) {
    const hosted = demands.some((d) => muscleBelongsToSlot(d.muscle, slot.kind));
    if (!hosted) {
      score += SCORE_EMPTY_SESSION;
      empty = true;
      warnings.push(`${slot.label} : séance vide (aucun muscle éligible)`);
    }
  }

  // Fréquence : la structure offre-t-elle assez de séances éligibles ?
  for (const d of demands) {
    const eligible = eligibleCount(d.muscle, split);
    const achieved = Math.min(d.target_frequency, eligible);
    if (achieved >= d.target_frequency) score += SCORE_FREQ_HIT;
    else score += SCORE_FREQ_MISS * (d.target_frequency - achieved);
  }

  return { split, score, empty, warnings };
}

/** Filets Full Body — choisis seulement si aucune spécialisée n'est valide. */
const FILET_SPLIT_IDS: ReadonlySet<string> = new Set(['fb_4x', 'fb_5x', 'fb_6x']);

/**
 * Invariant d'alternance : deux séances consécutives ne partagent pas le même
 * `SlotKind` non-FULL (sinon mêmes muscles deux jours d'affilée). FULL exempté
 * (un full body répète volontairement tout ; récup par calendrier).
 */
export function splitAlternationOk(split: SplitTemplate): boolean {
  for (let i = 1; i < split.slots.length; i += 1) {
    const prev = split.slots[i - 1]!.kind;
    const cur = split.slots[i]!.kind;
    if (prev === cur && cur !== SlotKind.FULL) return false;
  }
  return true;
}

/**
 * Choisit la meilleure structure pour `sessionsPerWeek` séances : score tous les
 * candidats, retient la 1re structure SPÉCIALISÉE valide (aucune séance vide +
 * alternance) ; filet Full Body en dernier recours ; sinon meilleure au score.
 */
export function selectBestSplit(
  demands: readonly MuscleDemand[],
  sessionsPerWeek: number,
): SplitScoreResult {
  const candidates = ALL_SPLITS.filter(
    (s) => s.sessions_per_week === sessionsPerWeek,
  );
  if (candidates.length === 0) {
    throw new RangeError(
      `Aucune structure pour sessions_per_week=${sessionsPerWeek}`,
    );
  }
  const scored = candidates
    .map((split) => scoreSplit(split, demands))
    .sort((a, b) => b.score - a.score);
  const valid = scored.filter((r) => !r.empty && splitAlternationOk(r.split));
  const specialized = valid.find((r) => !FILET_SPLIT_IDS.has(r.split.id));
  return specialized ?? valid[0] ?? scored[0]!;
}

// =============================================================================
// 3. Plan de volume (matrice séance × muscle)
// =============================================================================

interface VolumePlan {
  /** columns[dayIdx] = Map<muscle, séries cibles> pour cette séance. */
  columns: Array<Map<string, number>>;
  warnings: string[];
}

/**
 * Choisit `freq` séances parmi `eligible`, les moins chargées, en évitant deux
 * séances calendairement consécutives (sauf split full body, exempté).
 */
function pickSessions(
  eligible: readonly number[],
  freq: number,
  loads: readonly number[],
  isFullSplit: boolean,
): number[] {
  const sorted = [...eligible].sort((a, b) => loads[a]! - loads[b]! || a - b);
  const picked: number[] = [];
  for (const c of sorted) {
    if (picked.length >= freq) break;
    if (!isFullSplit && picked.some((p) => Math.abs(p - c) === 1)) continue;
    picked.push(c);
  }
  // Relâche l'espacement si on n'a pas pu atteindre la fréquence.
  if (picked.length < freq) {
    for (const c of sorted) {
      if (picked.length >= freq) break;
      if (!picked.includes(c)) picked.push(c);
    }
  }
  return picked;
}

function buildVolumePlan(
  demands: readonly MuscleDemand[],
  split: SplitTemplate,
): VolumePlan {
  const nDays = split.slots.length;
  const columns: Array<Map<string, number>> = Array.from(
    { length: nDays },
    () => new Map<string, number>(),
  );
  const loads = new Array<number>(nDays).fill(0);
  const isFullSplit = split.slots.every((s) => s.kind === SlotKind.FULL);
  const warnings: string[] = [];

  // Demands déjà triés prio-first : les prios se posent sur les séances vides,
  // le maintien (core inclus) remplit ensuite les moins chargées.
  for (const d of demands) {
    const eligible: number[] = [];
    for (let i = 0; i < nDays; i += 1) {
      if (muscleBelongsToSlot(d.muscle, split.slots[i]!.kind)) eligible.push(i);
    }
    if (eligible.length === 0) {
      warnings.push(`${d.muscle} : aucune séance compatible dans ${split.name}`);
      continue;
    }
    const freq = Math.max(1, Math.min(eligible.length, Math.floor(d.v_target / REALIZE_MIN_SETS)));
    const picked = pickSessions(eligible, freq, loads, isFullSplit);
    const per = d.v_target / picked.length;
    for (const s of picked) {
      columns[s]!.set(d.muscle, per);
      loads[s]! += per;
    }
  }

  return { columns, warnings };
}

// =============================================================================
// 4. Réalisation d'une séance
// =============================================================================

interface RealizedSession {
  cells: PatternCell[];
  focus_muscles: string[];
}

/**
 * Convertit la colonne de volume d'une séance en cases concrètes.
 * Une seule passe, muscles par priorité : chaque muscle avec résidu ≥ 3 reçoit
 * ses exos (compound naturel d'abord), et chaque compound **crédite ses
 * synergistes** (0,5/série) → un muscle déjà servi par l'incident (résidu < 3)
 * ne reçoit pas d'exo dédié.
 */
function realizeSession(
  columnVolumes: Map<string, number>,
  priorityOf: (muscle: string) => number,
  goalOf: (muscle: string) => MuscleGoal | undefined,
): RealizedSession {
  const residual = new Map(columnVolumes);
  const muscles = [...columnVolumes.keys()].sort(
    (a, b) => priorityOf(a) - priorityOf(b),
  );
  const cells: PatternCell[] = [];
  const focus: string[] = [];

  for (const m of muscles) {
    const target = residual.get(m) ?? 0;
    const isPrio = goalOf(m)?.status === MuscleStatus.PRIORITAIRE;
    // Un muscle de MAINTIEN déjà couvert par l'incident (résidu < 3) ne reçoit
    // pas d'exo dédié. Un muscle PRIORITAIRE, si : on lui garantit ≥ 1 exo dédié
    // (l'user l'a explicitement priorisé → il doit le voir travaillé en direct).
    if (target < REALIZE_MIN_SETS && !isPrio) continue;
    const dose = Math.max(target, REALIZE_MIN_SETS);
    const n = exosForSessionDose(dose);
    const setsList = distributeSetsForDose(dose, n);
    const map = getMusclePatterns(m);
    const compoundPat = map.compoundPatterns[0] ?? Pattern.ISOLATION;
    const isoPat = map.isolationPatterns[0] ?? Pattern.ISOLATION;

    setsList.forEach((sets, k) => {
      const useCompound = k === 0 && isCompoundPattern(compoundPat);
      const pattern = useCompound ? compoundPat : isoPat;
      const role: RoleHint = useCompound ? 'compound' : 'isolation';
      cells.push({
        pattern,
        primary_muscle: m,
        role_hint: role,
        chosen_exercise_id: null,
        planned_sets: sets,
      });
      if (useCompound) {
        for (const [g, coef] of Object.entries(PATTERN_SYNERGISTS[pattern])) {
          if (g === m) continue;
          if (residual.has(g)) residual.set(g, (residual.get(g) ?? 0) - coef * sets);
        }
      }
    });

    if (isPrio && !focus.includes(m)) focus.push(m);
  }

  // Compounds d'abord (tri stable : préserve l'ordre de priorité intra-rôle).
  cells.sort((a, b) => {
    const ra = a.role_hint === 'compound' ? 0 : 1;
    const rb = b.role_hint === 'compound' ? 0 : 1;
    return ra - rb;
  });

  return { cells, focus_muscles: focus };
}

// =============================================================================
// 5. Assemblage du SkeletonTemplate
// =============================================================================

export function buildSkeleton(
  state: UserState,
  durationCategory: DurationCategory = DurationCategory.MEDIUM,
): SkeletonTemplate {
  const demands = computeMuscleDemands(state);
  const best = selectBestSplit(demands, state.profile.sessions_per_week);
  const plan = buildVolumePlan(demands, best.split);

  const priorityIndex = new Map<string, number>();
  demands.forEach((d, i) => priorityIndex.set(d.muscle, i));
  const priorityOf = (m: string): number => priorityIndex.get(m) ?? 999;
  const goalOf = (m: string): MuscleGoal | undefined => state.muscle_goals[m];

  const days: SkeletonDay[] = best.split.slots.map((slot, i) => {
    const { cells, focus_muscles } = realizeSession(
      plan.columns[i] ?? new Map(),
      priorityOf,
      goalOf,
    );
    return {
      day_index: i,
      split_label: slot.label,
      focus_muscles,
      cells,
    };
  });

  const warnings: string[] = [...best.warnings, ...plan.warnings];

  return makeSkeletonTemplate({
    cycle_index: state.cycle_index,
    split_name: best.split.name,
    duration_category: durationCategory,
    days,
    warnings,
  });
}

// =============================================================================
// 6. Label d'affichage d'une séance
// =============================================================================

/**
 * Label final d'une séance (Conv #22.5, refonte 09b : « Full Body » → « Full »).
 *  - PPL / U/L / Push-Pull : le label du split est déjà distinctif (A/B…).
 *  - Full : « Full A / Full B / Full C… » par day_index.
 */
export function buildSessionLabel(day: SkeletonDay): string {
  const split_lower = day.split_label.toLowerCase();
  if (/full/i.test(split_lower)) {
    return `Full ${letterTag(day.day_index)}`;
  }
  return day.split_label;
}

/** A/B/C/D/E/F (jusqu'à 6 séances). */
function letterTag(dayIndex: number): string {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return letters[dayIndex] ?? String(dayIndex + 1);
}
