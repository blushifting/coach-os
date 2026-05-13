/**
 * Sélecteurs purs pour le Dashboard Programme (Conv #5a).
 *
 * Source de vérité :
 * - `recherche/08_ux_decisions.md §3 Onglet Programme` — calendrier 4-5 sem,
 *   statut par jour, tuile dashboard, pas de streak punitif.
 * - `recherche/09_programmation.md §1.1` — cycle = 5 semaines (4 progression
 *   + 1 déload), `WeeklyTemplate.days` = jours d'entraînement de la semaine.
 * - `recherche/10_plan_claude_code.md §3 Conv #5` — widgets streak / séances
 *   cette sem / % cycle / prochain bilan, calendrier condensé 1 ligne/sem,
 *   badges intégrés (pas de bloc d'avancement séparé).
 *
 * Tout est pur : aucune dépendance au store ni à la DB. Les composants UI
 * lisent l'état via les sélecteurs Zustand puis appellent ces fonctions.
 */

import type { UserState, WeeklyTemplate } from '@/engine/models';
import type { CycleRow, FeedbackRow, SessionRow } from '@/db/schema';

export const CYCLE_LENGTH_WEEKS = 5;
export const DELOAD_WEEK_INDEX = 5;

// =============================================================================
// Helpers date (purs, sans dépendance externe)
// =============================================================================

/** YYYY-MM-DD à partir d'une `Date` locale. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD vers Date locale (minuit). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Lundi (00:00) de la semaine contenant `d`. Lun = 0, Dim = 6. */
export function startOfWeekMonday(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 0 = lun, 6 = dim
  r.setDate(r.getDate() - dow);
  return r;
}

/** Clé semaine ISO simplifiée — utilisée uniquement pour comparer des semaines
 *  entre elles (égalité / précédent). Format `YYYY-MM-DD` du lundi. */
export function weekKey(d: Date): string {
  return dateKey(startOfWeekMonday(d));
}

// =============================================================================
// Widgets
// =============================================================================

/**
 * Nombre de semaines consécutives avec ≥1 feedback enregistré, se terminant
 * par la semaine en cours (si ≥1 feedback dedans) ou la précédente.
 *
 * "Doux" : si la semaine en cours est vide mais la précédente non, le streak
 * reste positif (on n'a pas encore "perdu" la série). cf. 08 §207 "pas de
 * streak punitif".
 */
export function computeStreak(
  feedbacks: ReadonlyArray<{ readonly seance_date: string }>,
  now: Date = new Date(),
): number {
  if (feedbacks.length === 0) return 0;
  const weeks = new Set<string>();
  for (const f of feedbacks) {
    weeks.add(weekKey(parseDateKey(f.seance_date)));
  }
  const thisWeek = weekKey(now);
  let cursor: string;
  if (weeks.has(thisWeek)) {
    cursor = thisWeek;
  } else {
    cursor = weekKey(addDays(parseDateKey(thisWeek), -7));
    if (!weeks.has(cursor)) return 0;
  }
  let count = 0;
  let probe = cursor;
  while (weeks.has(probe)) {
    count++;
    probe = weekKey(addDays(parseDateKey(probe), -7));
  }
  return count;
}

export interface CycleProgress {
  readonly done: number;
  readonly planned: number;
  readonly pct: number;
}

/** Avancement global du cycle courant : séances faites / planifiées × 100. */
export function computeCycleProgress(
  state: Pick<UserState, 'cycle_index' | 'current_cycle_plan'>,
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index'>>,
): CycleProgress {
  const planned = plannedSessionsForCycle(state.current_cycle_plan);
  const done = feedbacks.filter((f) => f.cycle_index === state.cycle_index).length;
  const pct = planned === 0 ? 0 : Math.round((done / planned) * 100);
  return { done, planned, pct };
}

export interface WeekSessions {
  readonly done: number;
  readonly planned: number;
}

/** Séances faites cette semaine du cycle. */
export function computeWeekSessions(
  state: Pick<
    UserState,
    'cycle_index' | 'current_week_in_cycle' | 'current_cycle_plan'
  >,
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'week_in_cycle'>>,
): WeekSessions {
  const done = feedbacks.filter(
    (f) =>
      f.cycle_index === state.cycle_index &&
      f.week_in_cycle === state.current_week_in_cycle,
  ).length;
  const planned = state.current_cycle_plan?.days.length ?? 0;
  return { done, planned };
}

/** Date estimée du prochain bilan de cycle : `cycle.start_date + 5 sem - 1j`. */
export function nextCycleReviewDate(
  state: Pick<UserState, 'cycle_index'>,
  cycles: ReadonlyArray<Pick<CycleRow, 'cycle_index' | 'start_date'>>,
): string | null {
  const cycle = cycles.find((c) => c.cycle_index === state.cycle_index);
  if (cycle === undefined) return null;
  const start = parseDateKey(cycle.start_date);
  return dateKey(addDays(start, CYCLE_LENGTH_WEEKS * 7 - 1));
}

export function isDeloadWeek(weekInCycle: number): boolean {
  return weekInCycle === DELOAD_WEEK_INDEX;
}

export function plannedSessionsForCycle(plan: WeeklyTemplate | null): number {
  if (plan === null) return 0;
  return plan.days.length * CYCLE_LENGTH_WEEKS;
}

// =============================================================================
// Calendrier condensé (5 sem × 7 jours)
// =============================================================================

export type DayStatus =
  /** Jour passé avec feedback enregistré. */
  | 'completed'
  /** Jour avec session générée mais pas encore de feedback (à venir). */
  | 'planned'
  /** Jour avec session marquée skipped. */
  | 'skipped'
  /** Jour passé sans séance prévue ni faite. */
  | 'rest-past'
  /** Jour à venir sans séance encore planifiée (slot libre). */
  | 'free-future';

export interface CalendarDay {
  readonly date: string; // YYYY-MM-DD
  readonly weekInCycle: number; // 1..5
  readonly dayOfWeek: number; // 0 = lun, 6 = dim
  readonly status: DayStatus;
  readonly isToday: boolean;
  readonly isDeload: boolean;
  readonly sessionLabel: string | null;
  readonly sessionId: number | null;
}

export interface CalendarMatrix {
  readonly weeks: ReadonlyArray<ReadonlyArray<CalendarDay>>;
  readonly cycleStart: string; // YYYY-MM-DD (lundi d'ancrage)
  readonly cycleEnd: string; // YYYY-MM-DD (dimanche fin de S5)
  readonly cycleIndex: number;
}

/**
 * Construit la grille 5 sem × 7 jours du cycle courant. La grille s'ancre au
 * **lundi de la semaine de `cycle.start_date`** — c'est l'origine visuelle ;
 * les jours antérieurs au start_date apparaissent en `rest-past`.
 *
 * Retourne `null` si aucun `CycleRow` pour `state.cycle_index` (cas typique :
 * juste après onboarding, le moteur n'a pas encore créé la ligne cycle).
 */
export function buildCalendarMatrix(
  state: Pick<UserState, 'cycle_index'>,
  cycles: ReadonlyArray<Pick<CycleRow, 'cycle_index' | 'start_date'>>,
  sessions: ReadonlyArray<Pick<SessionRow, 'seance_date' | 'status' | 'plan' | 'id'>>,
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'seance_date'>>,
  now: Date = new Date(),
): CalendarMatrix | null {
  const cycle = cycles.find((c) => c.cycle_index === state.cycle_index);
  if (cycle === undefined) return null;

  const anchor = startOfWeekMonday(parseDateKey(cycle.start_date));
  const todayKey = dateKey(now);

  // Index rapides par date.
  const feedbackDates = new Set<string>();
  for (const f of feedbacks) feedbackDates.add(f.seance_date);
  const sessionByDate = new Map<
    string,
    { status: string; label: string; id: number | null }
  >();
  for (const s of sessions) {
    sessionByDate.set(s.seance_date, {
      status: s.status,
      label: s.plan.label,
      id: s.id ?? null,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < CYCLE_LENGTH_WEEKS; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(anchor, w * 7 + d);
      const key = dateKey(date);
      const sess = sessionByDate.get(key);
      const hasFeedback = feedbackDates.has(key);
      const isPast = key < todayKey;

      let status: DayStatus;
      let sessionLabel: string | null = null;
      let sessionId: number | null = null;
      if (sess !== undefined) {
        sessionLabel = sess.label;
        sessionId = sess.id;
        if (sess.status === 'completed' || hasFeedback) status = 'completed';
        else if (sess.status === 'skipped') status = 'skipped';
        else status = isPast ? 'rest-past' : 'planned';
      } else {
        status = isPast ? 'rest-past' : 'free-future';
      }

      row.push({
        date: key,
        weekInCycle: w + 1,
        dayOfWeek: d,
        status,
        isToday: key === todayKey,
        isDeload: w + 1 === DELOAD_WEEK_INDEX,
        sessionLabel,
        sessionId,
      });
    }
    weeks.push(row);
  }

  return {
    weeks,
    cycleStart: dateKey(anchor),
    cycleEnd: dateKey(addDays(anchor, CYCLE_LENGTH_WEEKS * 7 - 1)),
    cycleIndex: state.cycle_index,
  };
}

// =============================================================================
// État de fin de cycle
// =============================================================================

/**
 * Le cycle est considéré "terminé" quand toutes ses séances ont un feedback
 * **ou** que `current_week_in_cycle` dépasse 5 (cas où `endOfWeek` a fait
 * avancer mais `endOfCycle` n'a pas encore été appelé).
 */
export function isCycleFinished(
  state: Pick<UserState, 'cycle_index' | 'current_week_in_cycle' | 'current_cycle_plan'>,
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index'>>,
): boolean {
  if (state.current_week_in_cycle > CYCLE_LENGTH_WEEKS) return true;
  const planned = plannedSessionsForCycle(state.current_cycle_plan);
  if (planned === 0) return false;
  const done = feedbacks.filter((f) => f.cycle_index === state.cycle_index).length;
  return done >= planned;
}
