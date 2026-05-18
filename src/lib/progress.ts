/**
 * Sélecteurs purs pour l'onglet Progrès (Conv #6a).
 *
 * Source de vérité :
 * - `recherche/10_plan_claude_code.md §3 Conv #6a` — Couverture (heatmap
 *   muscles travaillés cette semaine), Volume (barres hebdo par muscle avec
 *   bandes V_min/V_max grises), Cycles (historique nommé par programme + dates).
 * - `recherche/08_ux_decisions.md §527-532` — silhouette propre refonte
 *   Conv #8, ici on livre la couverture en grille de chips colorés.
 * - `recherche/09_programmation.md §3.3, §5.1` — V_min/V_max effectifs,
 *   séries pondérées par muscle.
 *
 * Tout est pur : aucune dépendance au store ni à la DB. Les composants UI
 * lisent l'état via les sélecteurs Zustand puis appellent ces fonctions.
 */

import type { Catalog } from '@/engine/catalog';
import type { CycleRow, FeedbackRow } from '@/db/schema';
import type {
  GuidedProgram,
  SessionFeedback,
  UserState,
} from '@/engine/models';
import { exercisePrimaires } from '@/engine/models';
import { e1rmObserved } from '@/engine/prescription';
import { effectiveVolumeBounds } from '@/engine/volume';
import {
  addDays,
  dateKey,
  parseDateKey,
  weekKeyFor,
  weekStartFor,
} from '@/lib/dashboard';

// =============================================================================
// Helpers communs
// =============================================================================

/**
 * Construit le mapping `exercise_id → { muscle: coef }` exploité par les
 * sélecteurs de volume. Équivalent du dict transmis à `countWeeklyVolume`.
 */
export function buildMusclesOf(
  catalog: Catalog,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const out: Record<string, Record<string, number>> = {};
  for (const ex of catalog.all()) {
    out[ex.id] = { ...ex.muscles };
  }
  return out;
}

/**
 * Sommes par muscle des coefficients sur un sous-ensemble de feedbacks.
 * Une série compte autant que `muscles[m]` (1.0 si primaire, 0.5 si synergiste).
 */
function sumMuscleSets(
  feedbacks: readonly SessionFeedback[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fb of feedbacks) {
    for (const set of fb.sets) {
      const muscles = musclesOf[set.exercise_id] ?? {};
      for (const [m, c] of Object.entries(muscles)) {
        out[m] = (out[m] ?? 0) + c;
      }
    }
  }
  return out;
}

// =============================================================================
// 1. Couverture (heatmap semaine en cours)
// =============================================================================

/**
 * Statut d'un muscle pour la semaine en cours.
 * - `non_travaille` : 0 série pondérée.
 * - `sous_min` : < V_min effectif (sous-dosé).
 * - `ok` : V_min ≤ x ≤ V_max.
 * - `depassement` : > V_max (sur-volume).
 * - `hors_scope` : muscle non couvert par les objectifs (V_min = 0).
 */
export type CoverageStatus =
  | 'non_travaille'
  | 'sous_min'
  | 'ok'
  | 'depassement'
  | 'hors_scope';

export interface MuscleCoverage {
  readonly muscle: string;
  readonly sets: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly status: CoverageStatus;
  /** Intensité 0..1 pour la heatmap (sets / V_max, clampé). */
  readonly intensity: number;
}

/**
 * Calcule la couverture par muscle pour la semaine **du programme** contenant
 * `now` (Conv #11h — alignée sur `cycleStart` plutôt que sur le lundi ISO,
 * pour être cohérente avec le calendrier visuel). Si `cycleStart` est null
 * (pas de cycle posé), fallback sur la semaine ISO.
 * On considère uniquement les feedbacks (séances réalisées).
 */
export function computeCoverageThisWeek(
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
  feedbacks: readonly FeedbackRow[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  now: Date = new Date(),
  cycleStart: string | null = null,
): MuscleCoverage[] {
  const weekStart = dateKey(weekStartFor(now, cycleStart));
  const weekEnd = dateKey(addDays(parseDateKey(weekStart), 7));
  const inWeek = feedbacks.filter(
    (f) => f.seance_date >= weekStart && f.seance_date < weekEnd,
  );
  const counts = sumMuscleSets(
    inWeek.map((f) => f.feedback),
    musclesOf,
  );

  const muscles = new Set<string>([
    ...Object.keys(state.volume_min),
    ...Object.keys(counts),
  ]);

  const out: MuscleCoverage[] = [];
  for (const muscle of muscles) {
    const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    const sets = counts[muscle] ?? 0;
    let status: CoverageStatus;
    if (vMin === 0 && vMax === 0) {
      status = 'hors_scope';
    } else if (sets === 0) {
      status = 'non_travaille';
    } else if (sets < vMin) {
      status = 'sous_min';
    } else if (sets > vMax) {
      status = 'depassement';
    } else {
      status = 'ok';
    }
    const denom = vMax > 0 ? vMax : Math.max(1, sets);
    const intensity = Math.min(1, sets / denom);
    out.push({ muscle, sets, vMin, vMax, status, intensity });
  }
  // Tri stable : par ordre canonique MUSCLES si possible, sinon alpha.
  out.sort((a, b) => a.muscle.localeCompare(b.muscle));
  return out;
}

// =============================================================================
// 2. Volume hebdo par muscle (N dernières semaines)
// =============================================================================

export interface WeeklyVolumePoint {
  /** Lundi YYYY-MM-DD de la semaine. */
  readonly weekStart: string;
  readonly sets: number;
}

export interface MuscleVolumeSeries {
  readonly muscle: string;
  readonly vMin: number;
  readonly vMax: number;
  /** Séries pondérées par semaine, ordre chronologique ancien → récent. */
  readonly points: ReadonlyArray<WeeklyVolumePoint>;
}

/**
 * Pour chaque muscle, renvoie le volume hebdo des `weeks` dernières semaines
 * calendaires (du lundi de la semaine la plus ancienne au lundi de la semaine
 * courante). Inclut les semaines vides (`sets = 0`).
 */
export function computeVolumeHistory(
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
  feedbacks: readonly FeedbackRow[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  weeks: number = 8,
  now: Date = new Date(),
  cycleStart: string | null = null,
): MuscleVolumeSeries[] {
  if (weeks <= 0) return [];
  // Conv #11h — fenêtre glissante sur les `weeks` dernières semaines de
  // programme (alignées sur cycleStart), pas semaines ISO. Cohérent avec
  // le calendrier visuel.
  const thisWeekStart = weekStartFor(now, cycleStart);
  const weekStarts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    weekStarts.push(dateKey(addDays(thisWeekStart, -i * 7)));
  }

  const byWeek = new Map<string, SessionFeedback[]>();
  for (const f of feedbacks) {
    const wk = weekKeyFor(parseDateKey(f.seance_date), cycleStart);
    const list = byWeek.get(wk) ?? [];
    list.push(f.feedback);
    byWeek.set(wk, list);
  }

  // Muscles à afficher : ceux du profil (V_min connu).
  const muscles = Object.keys(state.volume_min).sort((a, b) =>
    a.localeCompare(b),
  );

  return muscles.map((muscle) => {
    const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    const points: WeeklyVolumePoint[] = weekStarts.map((ws) => {
      const fbs = byWeek.get(ws) ?? [];
      const sums = sumMuscleSets(fbs, musclesOf);
      return { weekStart: ws, sets: sums[muscle] ?? 0 };
    });
    return { muscle, vMin, vMax, points };
  });
}

// =============================================================================
// 3. Historique des cycles
// =============================================================================

export interface CycleHistoryItem {
  readonly cycleIndex: number;
  /** Nom du programme suivi pendant ce cycle, ou null si inconnu. */
  readonly programName: string | null;
  readonly programId: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Volume total kg (somme du cycle), 0 si pas de review. */
  readonly volumeTotalKg: number;
  /** Top 3 progressions e1RM (exId, Δkg) du cycle, ordre décroissant. */
  readonly plafondsTop: ReadonlyArray<readonly [string, number]>;
  /** Δ volume total vs cycle précédent (en kg), null si pas de précédent. */
  readonly deltaVolumeKg: number | null;
  /** Δ progression moyenne des plafonds vs cycle précédent (kg), null si N/A. */
  readonly deltaTopPlafondKg: number | null;
}

/**
 * Construit l'historique lisible des cycles, du plus récent au plus ancien.
 * On ne garde que les cycles ayant `review` non-null (cycles terminés) — un
 * cycle en cours n'a pas encore de bilan à afficher.
 */
export function buildCycleHistory(
  cycles: readonly CycleRow[],
  programs: readonly GuidedProgram[],
): CycleHistoryItem[] {
  const programById = new Map<string, GuidedProgram>();
  for (const p of programs) programById.set(p.id, p);

  // Tri chronologique ascendant (cycle_index = ordre naturel).
  const sorted = [...cycles].sort((a, b) => a.cycle_index - b.cycle_index);

  const items: CycleHistoryItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const review = c.review;
    if (review === null) continue;

    const plafondsAll = Object.entries(review.plafonds_progression);
    const plafondsTop = plafondsAll
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, d]) => [id, d] as const);

    const programName = c.programme_id
      ? programById.get(c.programme_id)?.name ?? null
      : null;

    // Δ vs cycle précédent (le précédent ayant aussi une review).
    let deltaVolumeKg: number | null = null;
    let deltaTopPlafondKg: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j]!;
      if (prev.review === null) continue;
      deltaVolumeKg = review.volume_total_kg - prev.review.volume_total_kg;
      const topNow = plafondsTop[0]?.[1] ?? 0;
      const prevTops = Object.values(prev.review.plafonds_progression).sort(
        (a, b) => b - a,
      );
      const topPrev = prevTops[0] ?? 0;
      deltaTopPlafondKg = topNow - topPrev;
      break;
    }

    items.push({
      cycleIndex: c.cycle_index,
      programName,
      programId: c.programme_id,
      startDate: c.start_date,
      endDate: c.end_date,
      volumeTotalKg: review.volume_total_kg,
      plafondsTop,
      deltaVolumeKg,
      deltaTopPlafondKg,
    });
  }

  // Retour du plus récent au plus ancien pour l'UI.
  return items.reverse();
}

// =============================================================================
// 4. Formatages utilitaires (purs)
// =============================================================================

/** "12 avr. – 17 mai 2026" à partir de deux YYYY-MM-DD. */
export function formatCycleDates(start: string, end: string | null): string {
  const startD = parseDateKey(start);
  const startStr = startD.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  if (end === null) {
    return `depuis le ${startStr}`;
  }
  const endD = parseDateKey(end);
  const endStr = endD.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

/** "lun. 11 mai" pour un YYYY-MM-DD. */
export function formatWeekLabel(weekStart: string): string {
  return parseDateKey(weekStart).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/** Libellé court FR pour un muscle (capitalisé, _ remplacés par espaces). */
export function muscleLabel(muscle: string): string {
  return muscle
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Libellé court FR d'un exercice depuis le catalogue (ou l'id si introuvable). */
export function exerciseLabel(exerciseId: string, catalog: Catalog | null): string {
  if (catalog === null || !catalog.has(exerciseId)) return exerciseId;
  return catalog.get(exerciseId).nom_fr;
}

/** Liste des muscles primaires d'un exercice — pour info-bulles cycles. */
export function exerciseMusclesLabel(
  exerciseId: string,
  catalog: Catalog | null,
): string {
  if (catalog === null || !catalog.has(exerciseId)) return '';
  return exercisePrimaires(catalog.get(exerciseId))
    .map(muscleLabel)
    .join(', ');
}

// =============================================================================
// Historique des plafonds (Conv #11g — onglet Progrès / Force)
// =============================================================================

export interface E1rmPoint {
  /** seance_date au format YYYY-MM-DD (clé d'agrégation). */
  readonly date: string;
  /** Plafond estimé sur la meilleure série de cette date pour cet exo. */
  readonly e1rm: number;
}

export interface ExerciseE1rmSeries {
  readonly exercise_id: string;
  readonly nom_fr: string;
  readonly points: ReadonlyArray<E1rmPoint>;
  /** Plafond actuel = dernier point. */
  readonly current: number;
  /** Plafond initial = premier point. Sert au calcul du delta %. */
  readonly initial: number;
  /** Pourcentage d'évolution (current/initial − 1) × 100. */
  readonly deltaPct: number;
}

/**
 * Construit l'historique d'e1RM par exercice à partir des feedbacks réalisés
 * Pour chaque exo et
 * chaque date de séance, on garde le plus haut e1RM calculé via Epley
 * (`e1rmObserved`) sur les sets de cette date. Ne renvoie que les exos avec
 * **≥ 2 points** (sinon pas de courbe à tracer). Tri par nombre de points
 * décroissant (les exos les plus suivis remontent en haut), limité à `topN`.
 */
export function computeE1rmHistory(
  feedbacks: ReadonlyArray<FeedbackRow>,
  catalog: Catalog,
  topN: number = 8,
): ExerciseE1rmSeries[] {
  const byExo = new Map<string, Map<string, number>>();
  for (const fb of feedbacks) {
    const date = fb.feedback.seance_date;
    for (const s of fb.feedback.sets) {
      if (s.reps_done <= 0) continue;
      let e: number;
      try {
        e = e1rmObserved(s.load_kg, s.reps_done, s.rpe_perceived);
      } catch {
        continue;
      }
      if (!Number.isFinite(e) || e <= 0) continue;
      let inner = byExo.get(s.exercise_id);
      if (inner === undefined) {
        inner = new Map<string, number>();
        byExo.set(s.exercise_id, inner);
      }
      const cur = inner.get(date);
      if (cur === undefined || e > cur) inner.set(date, e);
    }
  }

  const result: ExerciseE1rmSeries[] = [];
  for (const [exId, dateMap] of byExo) {
    if (dateMap.size < 2) continue;
    if (!catalog.has(exId)) continue;
    const points: E1rmPoint[] = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ date, e1rm }));
    const initial = points[0]!.e1rm;
    const current = points[points.length - 1]!.e1rm;
    const deltaPct = initial > 0 ? (current / initial - 1) * 100 : 0;
    result.push({
      exercise_id: exId,
      nom_fr: catalog.get(exId).nom_fr,
      points,
      current,
      initial,
      deltaPct,
    });
  }

  result.sort((a, b) => {
    if (b.points.length !== a.points.length) return b.points.length - a.points.length;
    return b.current - a.current;
  });
  return result.slice(0, topN);
}
