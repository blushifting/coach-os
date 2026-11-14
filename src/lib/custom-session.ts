/**
 * Séance libre (hors programme) et édition des programmes : outils partagés.
 * Les presets de groupes musculaires ont été retirés au dump 2.4 (n° 23) : la
 * séance libre se compose à partir des exercices favoris.
 */

import type { DayTemplate, SessionFeedback, SessionPlan } from '@/engine/models';

/**
 * Tri stable « favoris d'abord » (G4) : les exos favoris remontent en tête,
 * l'ordre interne de chaque groupe est préservé. S'applique par-dessus
 * n'importe quelle liste déjà triée par pertinence (ex. `candidatesForMuscle`).
 */
export function favoritesFirst<T extends { readonly id: string }>(
  exos: readonly T[],
  favoriteIds: ReadonlySet<string>,
): T[] {
  if (favoriteIds.size === 0) return [...exos];
  const fav: T[] = [];
  const rest: T[] = [];
  for (const e of exos) {
    if (favoriteIds.has(e.id)) fav.push(e);
    else rest.push(e);
  }
  return [...fav, ...rest];
}

export interface CustomSlot {
  readonly exerciseId: string;
  readonly nSets: number;
}

/**
 * Progression par défaut d'un exo ajouté manuellement à un
 * jour de cycle (G3). On calque la longueur de la progression d'un exo voisin
 * du jour (sinon 5 semaines), base = `nSets`, dernière semaine = déload léger
 * (~60 %). `generateSession` lit `progression[weekIdx]` pour le nb de séries.
 */
export function defaultProgressionForDay(
  day: DayTemplate | undefined,
  nSets: number,
): number[] {
  const sibling = day?.exercises[0]?.progression;
  const len = sibling !== undefined && sibling.length > 0 ? sibling.length : 5;
  const out = Array.from({ length: len }, () => nSets);
  // Plancher de 2 séries en récupération, comme `cycleSetProgression`
  // (un exo à 2 ou 3 séries tombait à 1). Borné par `nSets` : un exo à 1 série
  // reste à 1.
  out[len - 1] = Math.min(nSets, Math.max(2, Math.round(nSets * 0.6)));
  return out;
}

/**
 * Ensemble des muscles primaires (coef ≥ 1) travaillés un jour donné — séances
 * faites (feedbacks) + séances planifiées non faites. Sert à avertir, sans
 * bloquer, quand une séance custom retape un muscle entraîné la veille.
 */
export function musclesTrainedOn(
  date: string,
  feedbacks: readonly { readonly feedback: SessionFeedback }[],
  plannedSessions: readonly {
    readonly seance_date: string;
    readonly status: string;
    readonly plan: SessionPlan;
  }[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Set<string> {
  const out = new Set<string>();
  const addExo = (exerciseId: string) => {
    for (const [m, c] of Object.entries(musclesOf[exerciseId] ?? {})) {
      if (c >= 1) out.add(m);
    }
  };
  for (const f of feedbacks) {
    if (f.feedback.seance_date !== date) continue;
    for (const s of f.feedback.sets) addExo(s.exercise_id);
  }
  for (const s of plannedSessions) {
    if (s.seance_date !== date || s.status !== 'planned') continue;
    for (const it of s.plan.items) addExo(it.exercise_id);
  }
  return out;
}
