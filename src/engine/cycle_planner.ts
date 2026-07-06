/**
 * Planification du cycle — post-passes + point d'entrée V3.
 *
 * Référence : recherche/09_programmation.md §5, §6, §9.
 *
 * Génération exclusivement via `generateCyclePlanV3` / `autoGenerateCyclePlanV3`
 * (skeleton_builder → sets_allocator), suivis des post-passes ci-dessous
 * (lengthened bias, fusion d'équivalents, rééquilibrage durées, préférence
 * d'équipement, étiquetage A/B/C). L'algo NE calcule PAS les charges live ;
 * ça reste à `buildPrescription` à chaque instanciation de séance.
 */

import type {
  Catalog,
} from './catalog';
import type {
  DayTemplate,
  Exercise,
  PlannedExercise,
  SkeletonTemplate,
  UserState,
  WeeklyTemplate,
} from './models';
import {
  EquipmentPreference,
  ExType,
  MuscleObjective,
  chargesForPreference,
  exercisePrimaires,
  makePlannedExercise,
  makeWeeklyTemplate,
} from './models';
import {
  MAX_SETS_PER_EXERCISE_PER_SESSION,
  DELOAD_FACTOR,
} from './volume';
import { pickIsolationsForMuscle } from './selection';

// =============================================================================
// 2. Progression de séries sur le cycle (Bloc L — séries fixes)
// =============================================================================

/**
 * Nombre de séries par semaine pour 1 exo, sur 5 semaines (4 + déload).
 *
 * Bloc L (Conv #37) — **séries FIXES** sur les 4 semaines de travail, puis
 * déload. On a abandonné l'ancien bump hebdo « +1 série/sem/exo » (algo Coach OS
 * custom, infidèle aux sources : Israetel ajoute des séries par MUSCLE et SI
 * l'user progresse — synthèse experte, évidence faible — pas par exo et pas
 * inconditionnellement ; et au-delà de 5-6 séries/exo le rendement décroît,
 * Schoenfeld 2017). La progression intra-cycle passe désormais par l'intensité
 * (charge via recalibration e1RM + RPE cible qui monte) et les reps ; le volume
 * monte d'un cycle à l'autre via la recalibration de fin de cycle.
 *
 *   - w1-w4 : baseSets (plafonné au plafond DUR par-exo, 5)
 *   - w5    : déload, environ 50 % de base
 */
export function cycleSetProgression(
  baseSets: number,
  vMaxPerExo: number = MAX_SETS_PER_EXERCISE_PER_SESSION,
): number[] {
  // Plafond DUR par-exo uniquement (pas de plancher ici : le maintien à 2
  // séries doit pouvoir descendre sous 3 ; le plancher 3 des muscles travaillés
  // est garanti en amont, au moment où `baseSets` est déterminé).
  const sets = Math.min(vMaxPerExo, baseSets);
  const progression: number[] = [sets, sets, sets, sets];
  // #18 (E-3) — plancher de 2 séries : on ne prescrit jamais moins de 2 séries,
  // même en récupération (un exo à 3 séries tombait à 1). Le déload reste réel
  // via la charge (×0,9) et le RPE 6, pas seulement via le nombre de séries.
  const deload = Math.max(2, Math.trunc(sets * DELOAD_FACTOR));
  progression.push(deload);
  return progression;
}

// =============================================================================
// 6b. Garantie lengthened_bias cycle-level (cf. 09 §6.4, D2 Conv #7)
// =============================================================================

/**
 * Post-pass cycle-level : pour chaque muscle Hypertrophie ayant ≥2 exos sur
 * le cycle, garantit qu'au moins un porte le tag `lengthened_bias` si le
 * catalogue en propose pour ce muscle (cf. 09 §6.4).
 *
 * Substitution : remplace en priorité une isolation, sinon le dernier
 * compound. Préserve `base_sets`/`progression` pour ne pas perturber le
 * volume hebdo cible. Recalcule la cartographie à chaque itération car les
 * compounds partagés (ex. deadlift_conv = fessiers + ischios) peuvent voir
 * leur position consommée par un muscle traité précédemment.
 */
export function enforceLengthenedBias(
  weeklyTemplate: WeeklyTemplate,
  state: UserState,
  catalog: Catalog,
): void {
  const hypMuscles: string[] = [];
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (
      goal.objective === MuscleObjective.HYPERTROPHIE &&
      !hypMuscles.includes(muscle)
    ) {
      hypMuscles.push(muscle);
    }
  }

  const cartography = (m: string): Array<[number, number, Exercise]> => {
    const out: Array<[number, number, Exercise]> = [];
    weeklyTemplate.days.forEach((day, di) => {
      day.exercises.forEach((planned, pi) => {
        const ex = catalog.get(planned.exercise_id);
        if (exercisePrimaires(ex).includes(m)) {
          out.push([di, pi, ex]);
        }
      });
    });
    return out;
  };

  for (const muscle of hypMuscles) {
    const occurrences = cartography(muscle);
    if (occurrences.length < 2) continue;
    if (occurrences.some(([, , ex]) => ex.tags.includes('lengthened_bias'))) {
      continue;
    }
    const allChosenIds = new Set<string>();
    for (const day of weeklyTemplate.days) {
      for (const p of day.exercises) allChosenIds.add(p.exercise_id);
    }
    const lbCands = pickIsolationsForMuscle(muscle, 1, state, catalog, {
      preferLengthened: true,
      excludeIds: allChosenIds,
    }).filter((x) => x.tags.includes('lengthened_bias'));
    if (lbCands.length === 0) continue;
    const replacement = lbCands[0]!;
    // Refonte 09b — ne remplacer QU'un exo mono-muscle (ce muscle en unique
    // primaire) : sinon on volerait le volume d'un autre muscle servi par un
    // compound partagé (ex. remplacer un trap-bar quad+ischios par un exo quad
    // étiré prive les ischios). Priorité aux isolations, puis compounds dédiés.
    const single = occurrences.filter(
      ([, , ex]) => exercisePrimaires(ex).length === 1,
    );
    if (single.length === 0) continue;
    const isoOcc = single.filter(([, , ex]) => ex.type === ExType.ISOLATION);
    const target =
      isoOcc.length > 0 ? isoOcc[isoOcc.length - 1]! : single[single.length - 1]!;
    const [di, pi] = target;
    const old = weeklyTemplate.days[di]!.exercises[pi]!;
    weeklyTemplate.days[di]!.exercises[pi] = makePlannedExercise({
      exercise_id: replacement.id,
      base_sets: old.base_sets,
      progression: old.progression,
      progression_rule: old.progression_rule,
    });
  }
}

// =============================================================================
// 7. Fusion d'exercices équivalents (Conv #19)
// =============================================================================

/**
 * Clé d'équivalence pour la fusion d'exos après choix de variantes.
 * Deux exos sont équivalents s'ils partagent :
 *  - le même `pattern` (mouvement de base)
 *  - les mêmes muscles primaires (coef ≥ 1.0), set comparé par contenu
 *  - le même `charge` type (DUMBBELL vs BARBELL etc. restent distincts)
 *
 * Validé par Azur (Conv #19) — strict pour éviter des fusions douteuses
 * (bench barre vs haltère restent séparés car charge différente).
 */
function equivalenceKey(ex: Exercise): string {
  const primaries = exercisePrimaires(ex).slice().sort().join(',');
  return `${ex.pattern}|${primaries}|${ex.charge}`;
}

/**
 * Fusionne dans un jour les exos équivalents (cf. `equivalenceKey`) en
 * additionnant `base_sets` et `progression`. Le 1er exo rencontré sert d'ancre
 * (conserve son `exercise_id`, `role`, `intensity_scheme`, `progression_rule`).
 *
 * Cas typique : après `applyVariantReplacements` (Step5 onboarding), 2 slots
 * d'une même séance peuvent pointer vers le même `exercise_id` ou vers 2 exos
 * équivalents (ex: compound + isolation choisis par l'algo se retrouvent en
 * 2× bench_db si l'user remplace l'isolation par un compound équivalent).
 *
 * Cap : la somme de `base_sets` et chaque point de `progression` est cappée au
 * plafond DUR par-exo (`MAX_SETS_PER_EXERCISE_PER_SESSION` = 5) — la fusion
 * produit UN exercice, qui doit respecter la règle 3-5 (Bloc L).
 */
export function mergeEquivalentExercises(
  day: DayTemplate,
  catalog: Catalog,
): DayTemplate {
  const byKey = new Map<string, number>(); // key → index dans `exercises`
  const merged: PlannedExercise[] = [];
  for (const planned of day.exercises) {
    if (!catalog.has(planned.exercise_id)) {
      merged.push(planned);
      continue;
    }
    const ex = catalog.get(planned.exercise_id);
    const key = equivalenceKey(ex);
    const existingIdx = byKey.get(key);
    if (existingIdx === undefined) {
      byKey.set(key, merged.length);
      merged.push(planned);
      continue;
    }
    const existing = merged[existingIdx]!;
    const cap = MAX_SETS_PER_EXERCISE_PER_SESSION;
    const fusedSets = Math.min(cap, existing.base_sets + planned.base_sets);
    const len = Math.max(existing.progression.length, planned.progression.length);
    const fusedProg: number[] = [];
    for (let i = 0; i < len; i++) {
      const a = existing.progression[i] ?? existing.base_sets;
      const b = planned.progression[i] ?? planned.base_sets;
      fusedProg.push(Math.min(cap, a + b));
    }
    merged[existingIdx] = {
      ...existing,
      base_sets: fusedSets,
      progression: fusedProg,
      role: existing.role ?? planned.role,
      intensity_scheme: existing.intensity_scheme ?? planned.intensity_scheme,
      progression_rule: existing.progression_rule ?? planned.progression_rule,
    };
  }
  return { ...day, exercises: merged };
}

/**
 * Variante WeeklyTemplate : applique `mergeEquivalentExercises` à chaque jour.
 * Mute le `WeeklyTemplate` (remplace `days` par les jours fusionnés).
 */
export function mergeEquivalentExercisesInPlan(
  weekly: WeeklyTemplate,
  catalog: Catalog,
): void {
  weekly.days = weekly.days.map((d) => mergeEquivalentExercises(d, catalog));
}

// =============================================================================
// 9. Conv #22 — Nouveau path co-construit (skeleton + sets_allocator)
// =============================================================================

import { buildSkeleton } from './skeleton_builder';
import { allocateSets } from './sets_allocator';
import { DurationCategory } from './models';

/**
 * Conv #30 — Passe « préférence d'équipement stricte » sur le plan final.
 *
 * Le filtre par charge à l'auto-fill (candidatesForCell / autoGenerateCyclePlanV3)
 * est limité au PATTERN de la case : si aucune machine/poulie n'existe pour ce
 * pattern précis, il retombe sur une charge non voulue. Et les post-passes
 * (`enforceLengthenedBias` notamment) ré-injectent ensuite des variantes étirées
 * souvent en poids libre. Cette passe, lancée **en dernier** sur le
 * `WeeklyTemplate`, remplace tout exo dont la charge n'est pas autorisée par une
 * variante de la charge demandée (machine/poulie, poids libre, ou PdC) ciblant
 * un même muscle primaire, recherche élargie à tous les patterns.
 *
 * Si aucune variante autorisée n'existe pour le muscle, on garde l'exo tel quel
 * (mieux qu'un muscle privé de volume). NO_PREFERENCE → no-op. Mute en place,
 * en conservant séries / progression. Respecte les choix manuels : en préférence
 * stricte, la feuille de variantes ne propose que la charge voulue.
 */
export function enforceEquipmentPreference(
  weekly: WeeklyTemplate,
  state: UserState,
  catalog: Catalog,
): void {
  const allowed = chargesForPreference(state.profile.equipment_preference);
  if (allowed === null) return; // NO_PREFERENCE / undefined

  const used = new Set<string>();
  for (const day of weekly.days) {
    for (const ex of day.exercises) used.add(ex.exercise_id);
  }

  for (const day of weekly.days) {
    for (let pi = 0; pi < day.exercises.length; pi += 1) {
      const planned = day.exercises[pi]!;
      if (!catalog.has(planned.exercise_id)) continue;
      const meta = catalog.get(planned.exercise_id);
      if (allowed.has(meta.charge)) continue; // déjà conforme

      // Recherche : exo de charge autorisée partageant un muscle primaire, libre.
      let pick: Exercise | null = null;
      for (const muscle of exercisePrimaires(meta)) {
        const cands = catalog
          .filter({ muscle_primary: muscle })
          .filter((c) => allowed.has(c.charge) && !used.has(c.id));
        if (cands.length === 0) continue;
        // Priorité au même pattern, sinon ordre du catalogue.
        cands.sort((a, b) => {
          const aP = a.pattern === meta.pattern ? 0 : 1;
          const bP = b.pattern === meta.pattern ? 0 : 1;
          return aP - bP;
        });
        pick = cands[0]!;
        break;
      }
      if (pick === null) continue; // aucune variante → on garde

      used.delete(planned.exercise_id);
      used.add(pick.id);
      day.exercises[pi] = makePlannedExercise({
        exercise_id: pick.id,
        base_sets: planned.base_sets,
        progression: planned.progression,
        progression_rule: planned.progression_rule,
        role: planned.role,
        intensity_scheme: planned.intensity_scheme,
      });
    }
  }
}

/**
 * Conv #22 — Génère un cycle via le nouveau path en 2 temps :
 *  1. `buildSkeleton(state, durationCategory)` → grille (pattern × séance)
 *     vide, présentée à l'user à l'étape D.
 *  2. L'user remplit la grille à l'étape E (chosen_exercise_id par cell).
 *  3. `allocateSets(skeleton, state, catalog)` → DayTemplate[] avec n_sets.
 *
 * Cette fonction est l'orchestration finale **une fois la grille remplie**.
 * Si tu veux juste générer le squelette pour présentation, appelle
 * `buildSkeleton` directement.
 *
 * @param filledSkeleton skeleton avec `chosen_exercise_id` posé sur toutes
 *   les cases (sinon les cases vides sont signalées en warnings).
 */
export function generateCyclePlanV3(
  filledSkeleton: SkeletonTemplate,
  state: UserState,
  catalog: Catalog,
): WeeklyTemplate {
  const alloc = allocateSets(filledSkeleton, state, catalog);
  const weekly = makeWeeklyTemplate({
    cycle_index: state.cycle_index,
    rationale: `Custom co-construit · ${filledSkeleton.split_name}`,
    days: alloc.days,
    warnings: [...filledSkeleton.warnings, ...alloc.warnings],
  });
  // Post-pass : enforce lengthened bias + merge équivalents. Refonte 09b :
  // `rebalanceCycleDurations` retiré — les séances sœurs sont équilibrées PAR
  // CONSTRUCTION (répartition égale du volume dans `buildVolumePlan`).
  enforceLengthenedBias(weekly, state, catalog);
  mergeEquivalentExercisesInPlan(weekly, catalog);
  // Conv #39 — l'ordre canonique du split est conservé (alternance U/L/U/L…).
  renumberSessionLabels(weekly);
  // Conv #30 — en DERNIER : la préférence d'équipement stricte prime sur les
  // swaps précédents (lengthened bias en poids libre, etc.). Corrige les fuites
  // de charge dans le plan final.
  enforceEquipmentPreference(weekly, state, catalog);
  return weekly;
}

/**
 * Conv #22 — Helper : génère squelette + alloue séries d'une traite,
 * pour les cas où on veut un cycle "tout fait" sans étape E manuelle
 * (ex. tests, migration, mode démo). L'auto-fill des variantes utilise
 * le 1er candidat de chaque case (= compound canonique).
 */
export function autoGenerateCyclePlanV3(
  state: UserState,
  catalog: Catalog,
  durationCategory: DurationCategory = DurationCategory.MEDIUM,
): WeeklyTemplate {
  const skeleton = buildSkeleton(state, durationCategory);
  // Auto-fill : 1er candidat de chaque case.
  for (const day of skeleton.days) {
    for (const cell of day.cells) {
      const cands = catalog.filter({ muscle_primary: cell.primary_muscle });
      const sameSeen = new Set<string>();
      for (const day2 of skeleton.days) {
        for (const c2 of day2.cells) {
          if (c2.chosen_exercise_id) sameSeen.add(c2.chosen_exercise_id);
        }
      }
      // Conv #29 — respecte la préférence d'équipement stricte (cf.
      // chargesForPreference). Fallback inPattern pour machines/poids libres ;
      // pas de fallback pour BODYWEIGHT (PdC strict).
      const allowed = chargesForPreference(state.profile.equipment_preference);
      const inPattern = cands.filter((c) => c.pattern === cell.pattern);
      const pool = allowed
        ? inPattern.filter((c) => allowed.has(c.charge))
        : inPattern;
      const usable =
        pool.length === 0 &&
        state.profile.equipment_preference !== EquipmentPreference.BODYWEIGHT
          ? inPattern
          : pool;
      // Refonte 09b — cohérence de rôle d'abord (un compound dans un slot
      // compound), comme `candidatesForCell`. Le filtre par pattern ne suffit
      // pas (ex. pullover_machine, pattern pull_v mais type iso).
      const wantType =
        cell.role_hint === 'compound' ? ExType.COMPOUND : ExType.ISOLATION;
      const ordered = [...usable].sort(
        (a, b) => (a.type === wantType ? 0 : 1) - (b.type === wantType ? 0 : 1),
      );
      const fit = ordered.find((c) => !sameSeen.has(c.id)) ?? ordered[0];
      cell.chosen_exercise_id = fit?.id ?? null;
    }
  }
  return generateCyclePlanV3(skeleton, state, catalog);
}

// Conv #39 — `dayNeuralCost` / `orderDaysByNeuralCost` (Conv #21b) supprimés :
// le tri des jours par coût neuro cassait l'alternance des splits (U/U/L/L).
// L'ordre canonique du `SplitTemplate` est désormais conservé tel quel.

/**
 * Conv #23, refonte Conv #28 — Assigne une lettre **globale** par séance
 * (A, B, C… dans l'ordre de `template.days[]`, donc l'ordre du tri neuro),
 * au lieu de l'ancienne numérotation par préfixe.
 *
 * Pourquoi : la lettre IDENTIFIE la séance, le préfixe décrit son contenu.
 * Avec une numérotation par préfixe, un Upper/Lower 4× donnait « Upper A /
 * Lower A / Upper B / Lower B » → deux « Séance A » à l'affichage
 * (`formatSessionLabel`), confusant. Désormais : « Upper A / Lower B /
 * Upper C / Lower D ».
 *
 * Comportement :
 *  - Un éventuel suffixe lettre existant (`\s+[A-F]$`) est retiré, puis la
 *    lettre globale (position dans le tableau) est apposée.
 *  - Les labels SANS suffixe (« Push », « Focus ») reçoivent aussi leur
 *    lettre — toute séance est donc identifiable par sa lettre.
 */
export function renumberSessionLabels(template: WeeklyTemplate): void {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  template.days.forEach((day, i) => {
    const m = day.label.match(/^(.+?)\s+[A-F]$/);
    const prefix = m !== null ? m[1]! : day.label;
    day.label = `${prefix} ${LETTERS[i] ?? String(i + 1)}`;
  });
}
