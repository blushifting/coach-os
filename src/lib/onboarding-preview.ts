/**
 * Aperçu du programme avant validation finale de l'onboarding (Conv #11b).
 *
 * Tout est calculé **en mémoire** : on construit un `UserState` temporaire,
 * on génère le `WeeklyTemplate` via `fitGuidedProgram` (guidé) ou
 * `generateCyclePlan` (custom), et on retourne un résumé exploitable par le
 * Step5 d'OnboardingPage. **Aucune écriture en DB / dans le store** — tant
 * que l'utilisateur n'a pas validé Step5, rien n'est persisté.
 */

import type { Catalog } from '@/engine/catalog';
import {
  exercisePrimaires,
  type DayTemplate,
  type PlannedExercise,
  type Profile,
  type MuscleGoal,
  type WeeklyTemplate,
} from '@/engine/models';
import { startUser as engineStartUser } from '@/engine/engine';
import { fitGuidedProgram, getGuidedProgram } from '@/engine/guided_programs';
import { generateCyclePlan } from '@/engine/cycle_planner';

/** Resultat d'une preview. */
export interface PreviewResult {
  readonly template: WeeklyTemplate | null;
  /** Liste des blocages (équipement manquant pour un programme guidé). */
  readonly blocking: readonly string[];
}

/**
 * Construit la `WeeklyTemplate` qui sera posée à la fin de l'onboarding,
 * sans toucher au store ni à la DB. Si `programmeId` est non null on
 * utilise `fitGuidedProgram` (e1RM vides → `requires_calibration` posé),
 * sinon on appelle `generateCyclePlan` sur un state temporaire.
 */
export function buildPreviewTemplate(
  profile: Profile,
  muscleGoals: Record<string, MuscleGoal>,
  programmeId: string | null,
  catalog: Catalog,
): PreviewResult {
  // State temporaire — `engineStartUser` ne touche pas le store.
  const tmpState = engineStartUser(profile, catalog, {
    muscleGoals,
    applyBalance: false,
  });

  if (programmeId !== null) {
    const program = getGuidedProgram(programmeId);
    if (program === null) {
      return { template: null, blocking: [`Programme inconnu : ${programmeId}`] };
    }
    const { weekly, blocking } = fitGuidedProgram(
      program,
      profile,
      new Set(profile.available_equip),
      {}, // plafonds vides — la preview ne calcule pas les charges
      catalog,
      1,
    );
    return { template: weekly, blocking };
  }

  return { template: generateCyclePlan(tmpState, catalog), blocking: [] };
}

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
