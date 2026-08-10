/**
 * Lifecycle de cycle : bilan, suggestion d'action, ajustement V.
 *
 * Pipeline en fin de cycle :
 *   1. generateCycleReview → CycleReview (progression, plateaux, adhérence)
 *   2. suggestNextAction → SuggestedAction (continuer / ajuster)
 *   3. applyUserActionAfterCycle (après choix utilisateur) → re-génère plan
 *
 * Conv #76 — l'étape d'ajustement automatique de `volume_min`/`volume_max`
 * a été retirée (cf. §4). Une fin de cycle ne mute plus aucune borne.
 */

import type { Catalog } from './catalog';
import type {
  CycleReview,
  SessionFeedback,
  UserState,
} from './models';
import {
  DurationCategory,
  SuggestedAction,
  exercisePrimaires,
  makeCycleReview,
} from './models';
import { e1rmObserved, effectiveLoadForE1rm } from './prescription';
import {
  DELOAD_WEEK_IN_CYCLE,
  countWeeklyVolume,
  cycleAdherence,
  effectiveVolumeBounds,
} from './volume';
import { autoGenerateCyclePlanV3 } from './cycle_planner';

/**
 * Semaines de travail d'un cycle (la dernière est la récupération). Sert de
 * dénominateur pour ramener le volume du cycle à une moyenne hebdomadaire.
 */
const WORKING_WEEKS = DELOAD_WEEK_IN_CYCLE - 1;

// =============================================================================
// 1. Helpers d'analyse
// =============================================================================

function computeE1rmDeltaPerExercise(
  state: UserState,
  cycleSessions: readonly SessionFeedback[],
  catalog: Catalog,
  bw: number,
): Record<string, number> {
  const firstE1rm: Record<string, number> = {};
  for (const s of cycleSessions) {
    for (const f of s.sets) {
      if (!(f.exercise_id in firstE1rm) && catalog.has(f.exercise_id)) {
        try {
          const totalLoad = effectiveLoadForE1rm(f.load_kg, catalog.get(f.exercise_id), bw);
          const baseline = e1rmObserved(totalLoad, f.reps_done, f.rpe_perceived);
          firstE1rm[f.exercise_id] = baseline;
        } catch {
          // reps/rpe hors plage : on ignore
        }
      }
    }
  }
  const deltas: Record<string, number> = {};
  for (const [exId, baseline] of Object.entries(firstE1rm)) {
    const current = state.e1rm[exId];
    if (current !== undefined) {
      deltas[exId] = current - baseline;
    }
  }
  return deltas;
}

interface MusclesOutcome {
  progresses: string[];
  plateau: string[];
  undertrained: string[];
  overshoot: string[];
}

/**
 * Seuil de significativité d'une variation de Plafond, en kg. En deçà, le
 * muscle est considéré stable — un Δ de quelques centaines de grammes relève
 * du bruit de mesure (EMA, arrondi d'incrément), pas d'une adaptation.
 */
export const FORCE_DELTA_THRESHOLD = 0.5;

export type ForceOutcome = 'up' | 'flat' | 'down';

/**
 * Δ Plafond MOYEN par muscle, à partir des variations par exercice du bilan.
 * Un exercice compte pour ses muscles **primaires** uniquement.
 *
 * Conv #76 — extrait de `classifyMusclesOutcome` pour être réutilisé par l'UI
 * (silhouette « Progression par muscle » du bilan). Il travaille sur
 * `plafonds_progression`, qui est **persisté** dans chaque `CycleReview` : les
 * bilans archivés se colorent donc sans champ supplémentaire ni migration.
 */
export function muscleForceDeltas(
  plafondsProgression: Readonly<Record<string, number>>,
  catalog: Catalog,
): Record<string, number> {
  const byMuscle: Record<string, number[]> = {};
  for (const [exId, delta] of Object.entries(plafondsProgression)) {
    if (!catalog.has(exId)) continue;
    const ex = catalog.get(exId);
    for (const m of exercisePrimaires(ex)) {
      (byMuscle[m] ??= []).push(delta);
    }
  }
  const out: Record<string, number> = {};
  for (const [muscle, deltas] of Object.entries(byMuscle)) {
    if (deltas.length === 0) continue;
    out[muscle] = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }
  return out;
}

export function classifyForceDelta(avgDelta: number): ForceOutcome {
  if (avgDelta > FORCE_DELTA_THRESHOLD) return 'up';
  if (avgDelta < -FORCE_DELTA_THRESHOLD) return 'down';
  return 'flat';
}

function classifyMusclesOutcome(
  state: UserState,
  cycleSessions: readonly SessionFeedback[],
  catalog: Catalog,
  plafondsProgression: Record<string, number>,
): MusclesOutcome {
  const progresses: string[] = [];
  const plateau: string[] = [];
  const undertrained: string[] = [];
  const overshoot: string[] = [];

  const avgByMuscle = muscleForceDeltas(plafondsProgression, catalog);

  // Volume réalisé par muscle, en séries pondérées MOYENNES PAR SEMAINE de
  // travail (récupération exclue).
  //
  // Conv #76 — c'était la somme brute sur les 5 semaines du cycle, comparée
  // juste en dessous à des bornes HEBDOMADAIRES : un muscle normalement
  // travaillé (~8 séries/sem, soit ~40 sur le cycle) dépassait donc toujours
  // `V_max × 1,1`, et tout le monde était classé en surcharge à chaque bilan.
  // Le dénominateur est fixe (4 semaines de travail), pas le nombre de
  // semaines réellement actives : s'entraîner une semaine sur quatre ne doit
  // pas gonfler la moyenne.
  const musclesOf: Record<string, Record<string, number>> = {};
  for (const x of catalog.all()) {
    musclesOf[x.id] = x.muscles;
  }
  const workingSessions = cycleSessions.filter(
    (s) => s.week_in_cycle !== DELOAD_WEEK_IN_CYCLE,
  );
  const volumesTotal = countWeeklyVolume(workingSessions, musclesOf, 99);

  for (const [muscle, avg] of Object.entries(avgByMuscle)) {
    const outcome = classifyForceDelta(avg);
    if (outcome === 'up') {
      progresses.push(muscle);
    } else if (outcome === 'down') {
      plateau.push(muscle);
    }
    // Conv #76 — bornes EFFECTIVES (pondérées par l'objectif du muscle), les
    // mêmes que celles affichées dans les barres du bilan. Avant : bornes
    // brutes, donc un muscle en Force était jugé sur 6–10 pendant que sa barre
    // annonçait 4,2–7.
    const [vMin, vMax] = effectiveVolumeBounds(state, muscle);
    const vReal = (volumesTotal[muscle] ?? 0) / WORKING_WEEKS;
    if (vMin > 0 && vReal < vMin * 0.7) {
      if (!undertrained.includes(muscle)) undertrained.push(muscle);
    }
    if (vMax > 0 && vReal > vMax * 1.1) {
      if (!overshoot.includes(muscle)) overshoot.push(muscle);
    }
  }

  // Chantier B — plateau purement INDICATIF : `plateau` n'est plus alimenté que
  // par le critère Δe1RM moyen < −0,5 (ci-dessus). Plus de `plateau_counter`
  // (compteur RPE supprimé) ni de déclenchement d'action automatique.
  return { progresses, plateau, undertrained, overshoot };
}

function sumVolumeKg(
  cycleSessions: readonly SessionFeedback[],
  catalog: Catalog,
  bw: number,
): number {
  let total = 0;
  for (const s of cycleSessions) {
    for (const f of s.sets) {
      const totalLoad = catalog.has(f.exercise_id)
        ? effectiveLoadForE1rm(f.load_kg, catalog.get(f.exercise_id), bw)
        : f.load_kg;
      total += totalLoad * f.reps_done;
    }
  }
  return total;
}

// =============================================================================
// 2. generateCycleReview (cf. 09 §8.1)
// =============================================================================

export function generateCycleReview(state: UserState, catalog: Catalog): CycleReview {
  const cycleSessions = state.history.filter(
    (s) => s.cycle_index === state.cycle_index,
  );

  const bw = state.profile.bodyweight_kg;
  const plafondsProgression = computeE1rmDeltaPerExercise(state, cycleSessions, catalog, bw);
  const { progresses, plateau, undertrained, overshoot } = classifyMusclesOutcome(
    state, cycleSessions, catalog, plafondsProgression,
  );

  // Conv A (plan 11) — assiduité unifiée : mêmes séances/dénominateur que
  // partout ailleurs (5 semaines du cycle, séances libres comprises).
  const adherence = cycleAdherence(state, 5);

  const volumeTotal = sumVolumeKg(cycleSessions, catalog, bw);

  const action = suggestNextAction(progresses, plateau, undertrained, adherence);

  // Conv #14c-7 — snapshot des objectifs muscle au moment du bilan pour
  // pouvoir afficher "visé vs fait" dans l'historique des cycles.
  const muscleGoalsSnapshot = Object.values(state.muscle_goals).map((g) => ({
    muscle: g.muscle,
    objective: g.objective,
    status: g.status,
    priority_rank: g.priority_rank,
  }));

  const review = makeCycleReview({
    cycle_index: state.cycle_index,
    plafonds_progression: plafondsProgression,
    muscles_progresses: progresses,
    muscles_plateau: plateau,
    muscles_undertrained: undertrained,
    muscles_overshoot: overshoot,
    adherence_pct: adherence,
    volume_total_kg: volumeTotal,
    PRs: [],
    suggested_action: action,
    warnings: [],
    muscle_goals_snapshot: muscleGoalsSnapshot,
  });

  // Conv #76 — l'avertissement « Plafond en baisse sur <exercice> » a été
  // retiré : le bilan porte désormais une alerte par MUSCLE, croisant volume
  // excessif et recul de force (cf. `muscles_overshoot` ∩ `muscles_plateau`),
  // qui dit la même chose en désignant une action.

  return review;
}

// =============================================================================
// 3. Suggestion d'action (cf. 09 §8.3)
// =============================================================================

export function suggestNextAction(
  _musclesProgresses: readonly string[],
  musclesPlateau: readonly string[],
  _musclesUndertrained: readonly string[],
  adherence: number,
): SuggestedAction {
  if (adherence < 0.6) return SuggestedAction.AJUSTER_OBJECTIFS;
  // Conv #44 — plateau sur ≥3 muscles : on suggère d'ajuster les objectifs/volume
  // (l'ancienne action « changer de programme » a disparu avec les programmes guidés).
  if (musclesPlateau.length >= 3) return SuggestedAction.AJUSTER_OBJECTIFS;
  // Chantier C (plan 11) — `TOURNER_EMPHASIS` retiré : un cycle qui progresse
  // bien avec une bonne assiduité reste sur `CONTINUER_PAREIL`.
  return SuggestedAction.CONTINUER_PAREIL;
}

// =============================================================================
// 4. Ajustement V_min/V_max — SUPPRIMÉ (Conv #76)
// =============================================================================

/*
 * `adjustVolumeBoundsAtCycleEnd` mutait les bornes de volume à chaque fin de
 * cycle : +2 sur V_max en cas de « surcharge », −2 en cas de recul, −1 sur
 * V_min en cas de sous-stimulation. Retiré en bloc, pour trois raisons :
 *
 *  1. **Dérive non bornée.** La montée n'avait aucun plafond, et son
 *     déclencheur était faussé (cf. `classifyMusclesOutcome`) : V_max montait
 *     de +2 sur presque tous les muscles à chaque bilan, indéfiniment. Le
 *     volume prescrit suivait via `effectiveCycleTargetVolume`.
 *  2. **Déclencheur inverse de la spec.** `recherche/03_modele_mathematique.md
 *     §7.3` conditionne la hausse à « cycle complet SANS plateau », c'est-à-dire
 *     à une bonne réponse à l'entraînement. Le code la conditionnait au fait
 *     d'avoir fait BEAUCOUP de volume — le signal opposé.
 *  3. **Base scientifique faible.** Les seuils MEV/MRV (Israetel) sont une
 *     synthèse experte sans validation peer-reviewed, à variabilité
 *     interindividuelle énorme (cf. `recherche/02_synthese_scientifique.md`
 *     §14.2) ; la méta-régression Pelland 2025 décrit une dose-réponse à
 *     rendements décroissants, sans seuil de récupération localisable. Deviner
 *     ce seuil puis muter l'état silencieusement n'était pas défendable.
 *
 * Décision Azur : les bornes ne bougent plus que via `updateProfile` (poids,
 * âge, niveau). Le signal de surcharge n'est pas perdu — il devient une
 * **alerte lisible** dans le bilan, qui laisse l'utilisateur décider.
 * `VMAX_UP_DELTA` / `VMAX_DOWN_DELTA` restent exportés par `volume.ts` (plus
 * aucun consommateur, mais la constante documente l'ordre de grandeur).
 */

// =============================================================================
// 5. applyUserActionAfterCycle (cf. 09 §9.2)
// =============================================================================

export function applyUserActionAfterCycle(
  state: UserState,
  catalog: Catalog,
  action: SuggestedAction,
): void {
  // Conv #39 — voie unique V3 (cf. endOfCycle de useEngine).
  const regen = () =>
    autoGenerateCyclePlanV3(
      state,
      catalog,
      state.profile.duration_category ?? DurationCategory.MEDIUM,
    );
  if (action === SuggestedAction.CONTINUER_PAREIL) {
    state.current_cycle_plan = regen();
  }
  // AJUSTER_OBJECTIFS : interaction UX, regen plan plus tard.

  state.cycle_index += 1;
  state.current_week_in_cycle = 1;
}
