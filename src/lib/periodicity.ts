/**
 * Détection de périodicité dans le programme (Conv #14b-4).
 *
 * Sur une fenêtre récente (par défaut 6 dernières semaines), on regarde
 * pour chaque "label de séance" (ex: "Upper A", "Lower A", "Full A") sur
 * quel jour de la semaine il est le plus souvent joué. Si un jour
 * domine clairement (≥2 occurrences ET ≥50 % des occurrences du label
 * dans la fenêtre), on l'expose comme suggestion.
 *
 * Aucune persistance / routine fixée : la suggestion sert uniquement de
 * nudge dans la `PlanDaySheet` du Programme.
 */

import { addDays, parseDateKey, type CalendarDay } from '@/lib/dashboard';
import type { FeedbackRow } from '@/db/schema';

const DEFAULT_WINDOW_WEEKS = 6;
const MIN_OCCURRENCES = 2;
const MIN_SHARE = 0.5;

/** Jour de la semaine, 0 = lundi … 6 = dimanche (aligné `CalendarDay.dayOfWeek`). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PeriodicitySuggestion {
  /** Libellé de séance détecté (ex: "Upper A"). */
  readonly label: string;
  /** Jour dominant de la semaine. */
  readonly dayOfWeek: DayOfWeek;
  /** Nombre d'occurrences de ce label sur ce jour, dans la fenêtre. */
  readonly occurrences: number;
  /** Nombre total d'occurrences de ce label dans la fenêtre. */
  readonly totalInWindow: number;
}

/** YYYY-MM-DD → jour de la semaine 0..6 (lundi-dimanche). */
function dayOfWeekFromKey(key: string): DayOfWeek {
  const d = parseDateKey(key);
  // JS : Date.getDay() → 0 dimanche, 1 lundi, ..., 6 samedi.
  // On normalise sur lundi=0 ... dimanche=6 (cf. CalendarDay.dayOfWeek).
  const js = d.getDay();
  const mondayBased = (js + 6) % 7;
  return mondayBased as DayOfWeek;
}

/**
 * Construit la liste des suggestions de périodicité à partir des feedbacks
 * récents. Une suggestion par `label`, sur le jour dominant si seuils OK.
 */
export function detectPeriodicity(
  feedbacks: ReadonlyArray<FeedbackRow>,
  now: Date = new Date(),
  windowWeeks: number = DEFAULT_WINDOW_WEEKS,
): ReadonlyArray<PeriodicitySuggestion> {
  const earliest = addDays(now, -windowWeeks * 7);
  const earliestKey =
    earliest.getFullYear() +
    '-' +
    String(earliest.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(earliest.getDate()).padStart(2, '0');

  // Map<label, Map<dayOfWeek, count>>
  const byLabel = new Map<string, Map<DayOfWeek, number>>();
  const totalByLabel = new Map<string, number>();

  for (const fb of feedbacks) {
    if (fb.feedback.seance_date < earliestKey) continue;
    const label = fb.feedback.label;
    const dow = dayOfWeekFromKey(fb.feedback.seance_date);
    let inner = byLabel.get(label);
    if (inner === undefined) {
      inner = new Map();
      byLabel.set(label, inner);
    }
    inner.set(dow, (inner.get(dow) ?? 0) + 1);
    totalByLabel.set(label, (totalByLabel.get(label) ?? 0) + 1);
  }

  const out: PeriodicitySuggestion[] = [];
  for (const [label, inner] of byLabel) {
    let bestDow: DayOfWeek = 0;
    let bestCount = 0;
    for (const [dow, c] of inner) {
      if (c > bestCount) {
        bestCount = c;
        bestDow = dow;
      }
    }
    const total = totalByLabel.get(label) ?? 0;
    if (
      bestCount >= MIN_OCCURRENCES &&
      total > 0 &&
      bestCount / total >= MIN_SHARE
    ) {
      out.push({
        label,
        dayOfWeek: bestDow,
        occurrences: bestCount,
        totalInWindow: total,
      });
    }
  }

  // Tri stable par label pour faciliter les tests.
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

const DAY_NAMES_FR: Readonly<Record<DayOfWeek, string>> = {
  0: 'lundi',
  1: 'mardi',
  2: 'mercredi',
  3: 'jeudi',
  4: 'vendredi',
  5: 'samedi',
  6: 'dimanche',
};

/** Libellé FR du jour de la semaine ("lundi", "mardi", …). */
export function dayOfWeekLabel(dow: DayOfWeek): string {
  return DAY_NAMES_FR[dow];
}

/**
 * Renvoie la suggestion à afficher dans la `PlanDaySheet` pour un jour donné
 * du calendrier, ou `null` si aucune ne correspond.
 *
 * On ne montre une suggestion que si le `dayOfWeek` du jour ouvert matche
 * exactement le jour dominant d'un label — sinon le nudge ne sert à rien
 * (l'utilisateur ne va pas être convaincu qu'il "fait X le mardi" alors
 * qu'il regarde un mercredi).
 */
export function suggestionForDay(
  day: Pick<CalendarDay, 'dayOfWeek' | 'status'>,
  suggestions: ReadonlyArray<PeriodicitySuggestion>,
): PeriodicitySuggestion | null {
  if (day.status !== 'free-future') return null;
  for (const s of suggestions) {
    if (s.dayOfWeek === day.dayOfWeek) return s;
  }
  return null;
}
