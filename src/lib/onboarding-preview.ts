/**
 * Helpers d'aperçu du récap d'onboarding (Conv #11b).
 *
 * Calculs **en mémoire**, sans écriture DB/store : volume hebdo par muscle
 * (brut + pondéré, pour les jauges du mode « à la main »), application de
 * variantes sur un template, delta musculaire d'un swap, estimation de durée
 * et détection de tensions. La construction du template lui-même se fait côté
 * OnboardingPage (squelette custom ou plan vide « à la main »).
 */

import type { Catalog } from '@/engine/catalog';
import {
  ExType,
  exercisePrimaires,
  type DayTemplate,
  type PlannedExercise,
  type WeeklyTemplate,
} from '@/engine/models';

// =============================================================================
// Récap volume hebdo par muscle primaire
// =============================================================================

/**
 * Somme le nb de séries de la semaine 1 (base_sets) par muscle primaire des
 * exos planifiés. Utilisé pour afficher le panneau "Volume hebdo par muscle"
 * du Step5 (transparence (a) : récap chiffré, pas de logique d'algo).
 */
export function weeklyVolumeByMuscle(
  template: WeeklyTemplate,
  catalog: Catalog,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of template.days) {
    for (const planned of day.exercises) {
      let primaires: readonly string[];
      try {
        primaires = exercisePrimaires(catalog.get(planned.exercise_id));
      } catch {
        continue;
      }
      for (const m of primaires) {
        out[m] = (out[m] ?? 0) + planned.base_sets;
      }
    }
  }
  return out;
}

/**
 * Bloc O — séries **pondérées** par muscle sur le plan (Σ coef × base_sets sur
 * TOUS les muscles de l'exo, primaires + synergistes), pas seulement les
 * primaires. C'est l'unité des bandes de volume (`effectiveVolumeBounds`),
 * donc la base des jauges « live » du mode « à la main ». Même logique que
 * `topUpMaintenance` (cycle_planner) / `sumMuscleSets` (progress).
 */
export function weightedWeeklyVolumeByMuscle(
  template: WeeklyTemplate,
  catalog: Catalog,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of template.days) {
    for (const planned of day.exercises) {
      if (!catalog.has(planned.exercise_id)) continue;
      const ex = catalog.get(planned.exercise_id);
      for (const [m, coef] of Object.entries(ex.muscles)) {
        if (coef <= 0) continue;
        out[m] = (out[m] ?? 0) + coef * planned.base_sets;
      }
    }
  }
  return out;
}

// =============================================================================
// Application des variantes choisies (en mémoire, sans muter l'original)
// =============================================================================

/** Une variante choisie par l'utilisateur sur un slot précis du plan. */
export interface VariantReplacement {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly newExerciseId: string;
}

/**
 * Retourne une copie du `WeeklyTemplate` avec les variantes appliquées sur les
 * slots concernés. Conserve `base_sets`, `progression`, `progression_rule`,
 * `role`, `intensity_scheme` — seule l'`exercise_id` change. Si un index est
 * hors plage, le replacement est silencieusement ignoré.
 */
export function applyVariantsToTemplate(
  template: WeeklyTemplate,
  replacements: ReadonlyArray<VariantReplacement>,
): WeeklyTemplate {
  if (replacements.length === 0) return template;
  const byDay: Map<number, Map<number, string>> = new Map();
  for (const r of replacements) {
    if (!byDay.has(r.dayIndex)) byDay.set(r.dayIndex, new Map());
    byDay.get(r.dayIndex)!.set(r.slotIndex, r.newExerciseId);
  }
  const newDays: DayTemplate[] = template.days.map((day, di) => {
    const dayReplacements = byDay.get(di);
    if (dayReplacements === undefined) return day;
    const newExos: PlannedExercise[] = day.exercises.map((p, pi) => {
      const newId = dayReplacements.get(pi);
      return newId === undefined ? p : { ...p, exercise_id: newId };
    });
    return { ...day, exercises: newExos };
  });
  return { ...template, days: newDays };
}

// =============================================================================
// Avertissement réequilibrage : muscles perdus / gagnés sur un swap
// =============================================================================

export interface MuscleDelta {
  /** Muscles primaires couverts par l'ancien exo, plus par le nouveau. */
  readonly lost: readonly string[];
  /** Muscles primaires couverts par le nouveau, pas par l'ancien. */
  readonly gained: readonly string[];
}

/**
 * Calcule la différence de profil musculaire entre 2 exos. Utilisé pour
 * afficher un avertissement non-bloquant dans le Step5 si le swap change
 * significativement la couverture musculaire (ex : traction → tirage vertical
 * ne couvre plus les biceps en primaire).
 */
export function muscleDeltaForSwap(
  oldExerciseId: string,
  newExerciseId: string,
  catalog: Catalog,
): MuscleDelta {
  let oldP: string[] = [];
  let newP: string[] = [];
  try {
    oldP = exercisePrimaires(catalog.get(oldExerciseId));
  } catch {
    /* exo inconnu — pas d'avertissement */
  }
  try {
    newP = exercisePrimaires(catalog.get(newExerciseId));
  } catch {
    /* idem */
  }
  const newSet = new Set(newP);
  const oldSet = new Set(oldP);
  return {
    lost: oldP.filter((m) => !newSet.has(m)),
    gained: newP.filter((m) => !oldSet.has(m)),
  };
}

// =============================================================================
// Estimation durée séance + détection tensions (Conv #11h)
// =============================================================================

/**
 * Heuristiques de durée — recalibrées Conv #19 sur observation Azur (4 exos /
 * 14 séries estimés 33 min vs réel 45 min, soit +36 %). Sous-estimation venait
 * de constantes trop optimistes (temps réel d'exécution incl. respiration entre
 * reps, repos qui dérive en pratique, setup réel avec warm-up) + absence de
 * transition entre exos.
 *
 * Composantes : setup (warm-up + ajustement matériel) + sets × (exécution +
 * repos) + transitions entre exos. Repos plus long sur compounds que sur
 * isolations.
 */
const SETUP_S = 75;
const SET_EXEC_S = 40;
const REST_COMPOUND_S = 150;
const REST_ISOLATION_S = 80;
/**
 * Transition d'un exo au suivant (rangement matériel, déplacement, première
 * série de warm-up). Comptée 1× par exo sauf le dernier — modélisé en ajoutant
 * `TRANSITION_S` à chaque exo et en soustrayant 1× au niveau du day.
 */
const TRANSITION_S = 60;

/** Seuil au-dessus duquel on alerte sur la durée d'une séance (minutes). */
export const SESSION_DURATION_WARN_MIN = 75;

export function estimateExerciseDurationMinutes(
  planned: Pick<PlannedExercise, 'base_sets'>,
  exType: ExType,
): number {
  const restS = exType === ExType.COMPOUND ? REST_COMPOUND_S : REST_ISOLATION_S;
  const totalS = SETUP_S + planned.base_sets * (SET_EXEC_S + restS) + TRANSITION_S;
  return totalS / 60;
}

export function estimateDayDurationMinutes(
  day: DayTemplate,
  catalog: Catalog,
): number {
  let total = 0;
  let counted = 0;
  for (const ex of day.exercises) {
    if (!catalog.has(ex.exercise_id)) continue;
    const e = catalog.get(ex.exercise_id);
    total += estimateExerciseDurationMinutes(ex, e.type);
    counted += 1;
  }
  // On compte une transition par exo dans `estimateExerciseDurationMinutes`,
  // mais le dernier exo n'a pas de transition derrière → on retire 1×.
  if (counted > 0) total -= TRANSITION_S / 60;
  return total;
}

export interface ProgramTension {
  /** Durée estimée par jour (min). */
  readonly durationsMin: ReadonlyArray<number>;
  /** Durée moyenne (min) sur les jours non vides. */
  readonly avgMin: number;
  /** Durée max (min). */
  readonly maxMin: number;
  /** true si au moins un jour dépasse le seuil de warning. */
  readonly tooLong: boolean;
}

/**
 * Analyse le `WeeklyTemplate` pour estimer la charge horaire des séances.
 * Sert au Step5 à afficher la durée estimée + un bandeau d'arbitrage si une
 * séance dépasse le seuil (suggérer plus de séances, moins d'exos, etc.).
 */
export function analyzeProgramTension(
  template: WeeklyTemplate,
  catalog: Catalog,
): ProgramTension {
  const durationsMin = template.days.map((d) => estimateDayDurationMinutes(d, catalog));
  const nonEmpty = durationsMin.filter((d) => d > 0);
  const avgMin = nonEmpty.length === 0
    ? 0
    : nonEmpty.reduce((a, b) => a + b, 0) / nonEmpty.length;
  const maxMin = durationsMin.length === 0 ? 0 : Math.max(...durationsMin);
  const tooLong = maxMin > SESSION_DURATION_WARN_MIN;
  return { durationsMin, avgMin, maxMin, tooLong };
}
