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
import { exercisePrimaires } from '@/engine/models';
import type { Catalog } from '@/engine/catalog';
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

/**
 * Début de la semaine de programme (Conv #11h) : bloc de 7 jours qui démarre
 * à `cycleStart + 7×k` et contient `date`. Si `cycleStart` est `null`
 * (pas de cycle posé), fallback sur la semaine ISO lundi-dim.
 *
 * Une "semaine du programme" matche la grille du calendrier cycle-aligned :
 * semaine 1 = jours 1-7 depuis le démarrage, semaine 5 = J29-J35, etc. Les
 * trackings (couverture, volume hebdo, streak) suivent cette grille pour
 * rester cohérents avec le calendrier visuel.
 */
export function weekStartFor(date: Date, cycleStart: string | null): Date {
  if (cycleStart === null) return startOfWeekMonday(date);
  const startD = parseDateKey(cycleStart);
  const diffDays = Math.round((date.getTime() - startD.getTime()) / 86_400_000);
  const k = Math.floor(diffDays / 7);
  return addDays(startD, k * 7);
}

/** Clé YYYY-MM-DD du début de la semaine de programme (cf. `weekStartFor`). */
export function weekKeyFor(date: Date, cycleStart: string | null): string {
  return dateKey(weekStartFor(date, cycleStart));
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
  cycleStart: string | null = null,
): number {
  if (feedbacks.length === 0) return 0;
  const weeks = new Set<string>();
  for (const f of feedbacks) {
    weeks.add(weekKeyFor(parseDateKey(f.seance_date), cycleStart));
  }
  const thisWeek = weekKeyFor(now, cycleStart);
  let cursor: string;
  if (weeks.has(thisWeek)) {
    cursor = thisWeek;
  } else {
    cursor = weekKeyFor(addDays(parseDateKey(thisWeek), -7), cycleStart);
    if (!weeks.has(cursor)) return 0;
  }
  let count = 0;
  let probe = cursor;
  while (weeks.has(probe)) {
    count++;
    probe = weekKeyFor(addDays(parseDateKey(probe), -7), cycleStart);
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
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'feedback'>>,
): CycleProgress {
  const planned = plannedSessionsForCycle(state.current_cycle_plan);
  const done = feedbacks.filter(
    (f) => f.cycle_index === state.cycle_index,
  ).length;
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
  feedbacks: ReadonlyArray<
    Pick<FeedbackRow, 'cycle_index' | 'week_in_cycle' | 'feedback'>
  >,
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

export interface CycleTimeProgress {
  /** Durée totale du cycle, en jours (= 35). */
  readonly daysTotal: number;
  /** Jours écoulés depuis le début du cycle (saturé à [0, daysTotal]). */
  readonly daysElapsed: number;
  /** Jours restants jusqu'au bilan (saturé à [0, daysTotal]). */
  readonly daysLeft: number;
  /** Avancement temporel arrondi à l'entier (0..100). */
  readonly pct: number;
}

/**
 * Avancement temporel du cycle courant (Conv #14a) — sert au widget
 * "Prochain bilan" pour matérialiser visuellement combien de temps s'est
 * écoulé / combien il en reste. Distinct de `computeCycleProgress`, qui
 * compte les séances faites (avancement *en travail*, pas *dans le temps*).
 */
export function computeCycleTimeProgress(
  state: Pick<UserState, 'cycle_index'>,
  cycles: ReadonlyArray<Pick<CycleRow, 'cycle_index' | 'start_date'>>,
  now: Date = new Date(),
): CycleTimeProgress | null {
  const cycle = cycles.find((c) => c.cycle_index === state.cycle_index);
  if (cycle === undefined) return null;
  const start = parseDateKey(cycle.start_date);
  // Normalise "now" en minuit local pour aligner sur les start_date stockés.
  const today = parseDateKey(dateKey(now));
  const daysTotal = CYCLE_LENGTH_WEEKS * 7;
  const rawElapsed = Math.round(
    (today.getTime() - start.getTime()) / 86400000,
  );
  const daysElapsed = Math.max(0, Math.min(daysTotal, rawElapsed));
  const daysLeft = Math.max(0, daysTotal - daysElapsed);
  const pct = Math.round((daysElapsed / daysTotal) * 100);
  return { daysTotal, daysElapsed, daysLeft, pct };
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
  /**
   * `true` si la veille (J-1) contient une séance planifiée ou faite. Sert
   * d'indicateur "repos recommandé" sur la vue semainière (Conv #10d). Seuls
   * les jours `free-future` exposent cet indicateur visuellement.
   */
  readonly restSuggested: boolean;
  /**
   * Muscles primaires travaillés la veille (J-1), si une séance y existe et
   * que le catalog est fourni à `buildCalendarMatrix`. Vide sinon. Permet à
   * `PlanDaySheet` d'afficher un avertissement "tu as travaillé X hier" et
   * de suggérer une séance ciblant d'autres muscles.
   */
  readonly recentMuscles: readonly string[];
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
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'seance_date' | 'feedback'>>,
  now: Date = new Date(),
  catalog: Catalog | null = null,
): CalendarMatrix | null {
  const cycle = cycles.find((c) => c.cycle_index === state.cycle_index);
  if (cycle === undefined) return null;

  // Conv #11h — anchor sur cycle.start_date (= S1J1) plutôt que sur le lundi
  // ISO de la semaine du start. Cela assure que le déload (5e ligne) tombe
  // strictement 4 semaines × 7 jours après le démarrage, même si le cycle
  // ne démarre pas un lundi. Le `dayOfWeek` de chaque case devient le vrai
  // jour calendaire (calculé via getDay), pas l'index de colonne — donc la
  // 1re colonne porte l'étiquette du jour de démarrage (mer/jeu/... si
  // démarrage hors lundi).
  const anchor = parseDateKey(cycle.start_date);
  const todayKey = dateKey(now);

  const feedbackDates = new Set<string>();
  for (const f of feedbacks) {
    feedbackDates.add(f.seance_date);
  }
  const sessionByDate = new Map<
    string,
    { status: string; label: string; id: number | null; plan: SessionRow['plan'] }
  >();
  for (const s of sessions) {
    sessionByDate.set(s.seance_date, {
      status: s.status,
      label: s.plan.label,
      id: s.id ?? null,
      plan: s.plan,
    });
  }

  function musclesOfSession(plan: SessionRow['plan']): string[] {
    if (catalog === null) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of plan.items) {
      if (!catalog.has(item.exercise_id)) continue;
      for (const m of exercisePrimaires(catalog.get(item.exercise_id))) {
        if (seen.has(m)) continue;
        seen.add(m);
        out.push(m);
      }
    }
    return out;
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

      // Repos recommandé : si la veille a une séance prévue ou faite.
      // Conv #15 vague 3 — une séance `skipped` (sautée) ne crée PAS de
      // fatigue à reposer le lendemain : on filtre explicitement. Même
      // chose pour les muscles "récents" du sheet d'avertissement.
      const prevDate = dateKey(addDays(date, -1));
      const prevSess = sessionByDate.get(prevDate);
      const prevHasFeedback = feedbackDates.has(prevDate);
      const prevWasSkipped = prevSess?.status === 'skipped';
      const prevIsActive =
        !prevWasSkipped &&
        prevSess !== undefined &&
        (prevSess.status === 'planned' ||
          prevSess.status === 'completed' ||
          prevHasFeedback);
      const restSuggested = prevIsActive && status === 'free-future';
      const recentMuscles =
        prevIsActive && prevSess !== undefined ? musclesOfSession(prevSess.plan) : [];

      row.push({
        date: key,
        weekInCycle: w + 1,
        // Jour calendaire réel (0 = lundi, 6 = dimanche), pas l'index de
        // colonne, depuis qu'on aligne sur cycle.start_date (Conv #11h).
        dayOfWeek: (date.getDay() + 6) % 7,
        status,
        isToday: key === todayKey,
        isDeload: w + 1 === DELOAD_WEEK_INDEX,
        sessionLabel,
        sessionId,
        restSuggested,
        recentMuscles,
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
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'feedback'>>,
): boolean {
  if (state.current_week_in_cycle > CYCLE_LENGTH_WEEKS) return true;
  const planned = plannedSessionsForCycle(state.current_cycle_plan);
  if (planned === 0) return false;
  const done = feedbacks.filter(
    (f) => f.cycle_index === state.cycle_index,
  ).length;
  return done >= planned;
}
