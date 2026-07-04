/**
 * Modèle de volume Israetel simplifié, détection de plateau et déload.
 *
 * Référence :
 *   - recherche/03_modele_mathematique.md, §5, §7, §8.1 (legacy)
 *   - recherche/09_programmation.md, §3.3, §4.5, §5.1 (extension par MuscleGoal)
 */

import type {
  Profile,
  UserState,
  SessionFeedback,
  Muscle,
} from './models';
import { Sex, Level, MuscleObjective, MuscleStatus } from './models';

// =============================================================================
// 1. V_min par muscle, niveau (cf. 03_§8.1)
// =============================================================================

export const V_MIN_BASE: Readonly<Record<string, Record<Level, number>>> = {
  pectoraux: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  dos_largeur: { [Level.DEBUTANT]: 10, [Level.INTERMEDIAIRE]: 12, [Level.AVANCE]: 14 },
  dos_epaisseur: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  trapezes_hauts: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
  quadriceps: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  ischios: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  fessiers: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  mollets: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  deltos_lateraux: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  deltos_posterieurs: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  biceps: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  triceps: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  abdos: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  obliques: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
  lombaires: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
};

export const FEMALE_BONUS_MUSCLES: ReadonlySet<string> = new Set([
  'pectoraux',
  'dos_largeur',
  'dos_epaisseur',
  'deltos_lateraux',
  'deltos_posterieurs',
  'biceps',
  'triceps',
]);
export const FEMALE_BONUS_FACTOR = 1.15;

export const SENIOR_AGE_THRESHOLD = 50;
export const SENIOR_FACTOR = 0.8;
export const SENIOR_VMAX_FACTOR = 1.5;

export const DEFAULT_VMAX_FACTOR = 1.8;
export const DELOAD_FACTOR = 0.5;
/**
 * Refonte progression — facteur d'allègement de la CHARGE en semaine de
 * récupération (déload), appliqué au plancher de charge (`prescribed_load_floor`).
 * Le déload reste surtout un allègement de VOLUME ; la charge ne baisse que
 * modérément. Tunable (le déload deviendra opt-in, cf. backlog).
 */
export const DELOAD_LOAD_FACTOR = 0.9;
/**
 * Conv #21bis — Semaine du cycle dédiée au déload (5/5 par convention).
 * Dupliqué côté `lib/dashboard.ts` (`DELOAD_WEEK_INDEX`) mais le moteur
 * reste pur (pas d'import depuis lib/). Toute relecture doit se baser
 * sur cette constante plutôt qu'un `=== 5` magique.
 */
export const DELOAD_WEEK_IN_CYCLE = 5;

export const VMAX_UP_DELTA = 2;
export const VMAX_DOWN_DELTA = 2;

// =============================================================================
// 2. Facteurs de volume par MuscleObjective (cf. 09 §3.3)
// =============================================================================

export const OBJECTIVE_VOLUME_FACTOR: Record<MuscleObjective, number> = {
  [MuscleObjective.FORCE]: 0.7,
  [MuscleObjective.HYPERTROPHIE]: 1.0,
  [MuscleObjective.ENDURANCE]: 1.25,
  [MuscleObjective.MAINTIEN]: 0.4,
};

// Cf. 09 §5.1 — rendement décroissant >5-6 séries/exo (Schoenfeld 2017).
export const SETS_PER_SESSION_OPTIMAL = 5;
export const MAX_SETS_PER_SESSION_PER_MUSCLE = 10;

// Bloc L — bornes DURES de séries par exo et par séance (règle 3-5). Au-delà de
// 5-6 séries/exo, le rendement décroît (Schoenfeld 2017) : on ne propose jamais
// plus de 5 ni moins de 3 séries sur un même exercice (y compris en maintien :
// c'est le volume hebdo total qui fait foi). La progression intra-cycle passe
// par l'intensité (charge/RPE) et les reps, pas par l'empilement de séries.
export const MIN_SETS_PER_EXERCISE_PER_SESSION = 3;
export const MAX_SETS_PER_EXERCISE_PER_SESSION = 5;

// Volume "maintenance" : 2 séries minimum, sinon 40 % de V_min (Bickel 2011).
export const MAINTENANCE_MIN_SETS = 2.0;

// =============================================================================
// 3. Initialisation des bornes
// =============================================================================

/** Retourne `[V_min, V_max]` par muscle pour ce profil. */
export function initialVolumeBounds(
  profile: Profile,
): readonly [Record<string, number>, Record<string, number>] {
  const vMin: Record<string, number> = {};
  const vMax: Record<string, number> = {};
  for (const [muscle, byLevel] of Object.entries(V_MIN_BASE)) {
    let base = byLevel[profile.level];
    if (profile.sex === Sex.FEMME && FEMALE_BONUS_MUSCLES.has(muscle)) {
      base *= FEMALE_BONUS_FACTOR;
    }
    if (profile.age >= SENIOR_AGE_THRESHOLD) {
      base *= SENIOR_FACTOR;
    }
    vMin[muscle] = base;
    if (profile.age >= SENIOR_AGE_THRESHOLD) {
      vMax[muscle] = base * SENIOR_VMAX_FACTOR;
    } else {
      vMax[muscle] = base * DEFAULT_VMAX_FACTOR;
    }
  }
  return [vMin, vMax];
}

// =============================================================================
// 5. Voie muscle_goals : effectiveVolumeBounds + targetFrequencyV2 (cf. 09 §4.5)
// =============================================================================

/**
 * V_min/V_max effectifs pour ce muscle, pondérés par MuscleGoal.
 *   - NON_COUVERT ou absent → (0, 0)
 *   - MAINTIEN (SUGGERE, ou PRIORITAIRE hérité) → bande [MV, MEV] (cf. infra)
 *   - PRIORITAIRE non-maintien → (base_min × factor, base_max × factor)
 *
 * Maintien — bande de lecture uniforme (Conv #29) :
 *   `state.volume_min[muscle]` joue le rôle de **MEV** (Minimum Effective
 *   Volume, seuil de croissance). Un muscle « en maintien » se prescrit au bas
 *   de la bande (V_min = MV ≈ 0,4×MEV, Bickel 2011) mais reçoit un **plafond
 *   explicite V_max = MEV** : au-delà, ce n'est plus du maintien mais de la
 *   prise. La bande maintien [MV, MEV] se loge ainsi juste sous la bande
 *   hypertrophie [MEV, V_max_hyp] — la lecture des courbes de progrès est
 *   identique pour tous les muscles, seules les bornes changent.
 *
 *   La borne BASSE est INCHANGÉE : le volume *prescrit*
 *   (`effectiveCycleTargetVolume` = borne basse) reste le même, seul le plafond
 *   d'affichage/dépassement s'ouvre. Aucun impact sur l'allocation de séries —
 *   les muscles SUGGERE sont des priorityTargets, et `sets_allocator` ne
 *   consomme jamais ce V_max maintien comme cap (il saute les priorityTargets).
 */
export function effectiveVolumeBounds(
  state: UserState,
  muscle: string,
): readonly [number, number] {
  if (!(muscle in state.volume_min)) {
    return [0, 0];
  }
  const baseMin = state.volume_min[muscle]!;
  const baseMax = state.volume_max[muscle]!;
  const goal = state.muscle_goals[muscle];

  if (!goal || goal.status === MuscleStatus.NON_COUVERT) {
    return [0, 0];
  }
  if (
    goal.status === MuscleStatus.SUGGERE ||
    goal.objective === MuscleObjective.MAINTIEN
  ) {
    const vMin = Math.max(
      MAINTENANCE_MIN_SETS,
      baseMin * OBJECTIVE_VOLUME_FACTOR[MuscleObjective.MAINTIEN],
    );
    return [vMin, baseMin];
  }
  // PRIORITAIRE non-maintien
  const factor = OBJECTIVE_VOLUME_FACTOR[goal.objective];
  return [baseMin * factor, baseMax * factor];
}

/**
 * Refonte remplissage (recherche/09b, 2026-07) — position de la cible DANS la
 * bande `[V_min, V_max]`, pour les muscles PRIORITAIRES uniquement.
 *
 * Historique : on visait `V_min` sec (le plancher de la bande sourcée
 * Schoenfeld). Depuis que la montée de volume intra-cycle a été retirée
 * (Bloc L, séries fixes), sitter au plancher est trop conservateur → on décolle
 * de 20 % dans la bande. `V_cible ≈ V_min × 1,16` en hypertrophie. Tunable
 * 0,15-0,25. Le MAINTIEN n'est PAS relevé (il n'a pas vocation à progresser).
 */
export const CYCLE_TARGET_VOLUME_RATIO = 0.2;

/**
 * Volume cible du cycle pour ce muscle (séries pondérées).
 *
 * Bloc L (Conv #37) : nb de séries par exo FIXE sur les 4 semaines de travail.
 * La progression intra-cycle passe par l'intensité (charge/RPE) et les reps ;
 * le volume monte d'un cycle à l'autre via la recalibration de fin de cycle.
 *
 *   - NON_COUVERT / absent → 0
 *   - SUGGERE / MAINTIEN   → borne basse (V_maintien fixe ~4), INCHANGÉ
 *   - PRIORITAIRE          → V_min + ratio × (V_max − V_min)
 */
export function effectiveCycleTargetVolume(
  state: UserState,
  muscle: string,
): number {
  const [lo, hi] = effectiveVolumeBounds(state, muscle);
  const goal = state.muscle_goals[muscle];
  const isPriority =
    goal !== undefined &&
    goal.status === MuscleStatus.PRIORITAIRE &&
    goal.objective !== MuscleObjective.MAINTIEN;
  if (isPriority) {
    return lo + CYCLE_TARGET_VOLUME_RATIO * (hi - lo);
  }
  return lo;
}

/**
 * Conv #22 — Fréquence hebdo cible v2, basée sur V cible effectif (cycle).
 * Règle E.1 corrigée : un muscle prio bas-volume reste à freq 1-2× ;
 * un muscle prio haut-volume monte naturellement à 3-4× selon capacité.
 */
export function targetFrequencyV2(muscle: string, state: UserState): number {
  const vTarget = effectiveCycleTargetVolume(state, muscle);
  if (vTarget <= 0) return 0;
  const freq = Math.max(1, Math.ceil(vTarget / SETS_PER_SESSION_OPTIMAL));
  return Math.min(freq, state.profile.sessions_per_week);
}

// =============================================================================
// Déload opt-in (chantier B, plan 11) — cf. recherche/09c_deload_optin.md
// =============================================================================

/**
 * Seuil d'assiduité (semaines 1-4) au-dessus duquel l'app PROPOSE la semaine de
 * récupération. En-dessous, peu de charge encaissée → pas de fatigue accumulée
 * → pas de proposition (semaine 5 = semaine normale). Proxy de fatigue = nombre
 * de séances réellement faites (cf. 09c §3.1).
 */
export const PROPOSE_DELOAD_MIN_ADHERENCE = 0.75;

/**
 * La semaine de récupération est-elle EFFECTIVE (semaine 5 + acceptée par
 * l'utilisateur) ? Pilote l'allègement volume/charge/RPE et le gel des mesures.
 * Semaine 5 refusée (ou non décidée) → semaine normale, ce helper renvoie false.
 */
export function isDeloadActive(state: UserState): boolean {
  return (
    state.current_week_in_cycle === DELOAD_WEEK_IN_CYCLE &&
    state.deload_decision === 'accepted'
  );
}

// =============================================================================
// Conv #22 — Plafond unique séries/séance (remplace table par niveau)
// =============================================================================

/**
 * Plafond total séries/séance unique pour le nouveau path.
 * Remplace `MAX_TOTAL_SETS_PER_SESSION[level]` du legacy. L'auto-calibration
 * (cycle 1 → cycle 2) ajuste les volumes par muscle si overshoot, donc un
 * plafond unique haut (30) suffit, secondé par la contrainte durée séance.
 */
export const MAX_TOTAL_SETS_PER_SESSION_V2 = 30;

// =============================================================================
// 6. Décompte des séries effectivement réalisées
// =============================================================================

/**
 * Compte le volume hebdo réalisé pour chaque muscle, agrégé sur les N
 * dernières (cycle_index, week_in_cycle) distincts.
 */
export function countWeeklyVolume(
  history: readonly SessionFeedback[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  weeks = 1,
): Record<string, number> {
  if (history.length === 0) {
    return {};
  }
  const keysSeen: Array<readonly [number, number]> = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i]!;
    const k: readonly [number, number] = [s.cycle_index, s.week_in_cycle];
    if (!keysSeen.some((x) => x[0] === k[0] && x[1] === k[1])) {
      keysSeen.push(k);
    }
    if (keysSeen.length >= weeks) {
      break;
    }
  }
  const inSet = (k0: number, k1: number) =>
    keysSeen.some((x) => x[0] === k0 && x[1] === k1);

  const volumes: Record<string, number> = {};
  for (const s of history) {
    if (!inSet(s.cycle_index, s.week_in_cycle)) continue;
    for (const f of s.sets) {
      const mus = musclesOf[f.exercise_id] ?? {};
      for (const [m, coef] of Object.entries(mus)) {
        volumes[m] = (volumes[m] ?? 0) + coef;
      }
    }
  }
  return volumes;
}

// =============================================================================
// 7. Avancement hebdomadaire
//    (Chantier B — plus de détection de plateau ici : le plateau est désormais
//     purement indicatif, calculé au bilan de cycle via le Δe1RM moyen, cf.
//     lifecycle.classifyMusclesOutcome. Ni déload anticipé, ni saut de semaine.)
// =============================================================================

/**
 * Décide la semaine suivante. Renvoie un libellé d'événement.
 *
 * Chantier B — forme finale (plus de plateau ni de stratégie de déload) :
 *   w ∈ [1..3] → w+1
 *   w === 4    → 5 (entrée en semaine de récupération potentielle, opt-in)
 *   w === 5    → no-op : la bascule de cycle est faite exclusivement par
 *               `endOfCycle` (bilan validé par l'user, bump `cycle_index`) ;
 *               `tickWeekIfNeeded` plafonne à 5 → branche jamais atteinte en
 *               flux réel.
 */
export function advanceWeek(state: UserState): string {
  const w = state.current_week_in_cycle;
  if (w === 5) {
    return 'semaine_5_stable';
  }
  if (w === 4) {
    state.current_week_in_cycle = 5;
    return 'deload_fin_de_cycle';
  }
  state.current_week_in_cycle = w + 1;
  return `semaine_suivante_${state.current_week_in_cycle}`;
}

/**
 * Assiduité du cycle courant (Conv A, plan 11) — métrique UNIFIÉE pour toute
 * l'app : séances faites (TOUTES, séances libres comprises — on mesure un
 * épuisement global) / séances prévues sur les semaines 1..`throughWeek`.
 *
 * La valeur brute peut dépasser 1 (séances libres qui gonflent le numérateur) ;
 * c'est voulu au niveau du calcul, l'affichage plafonne à 100 %.
 */
export function cycleAdherence(state: UserState, throughWeek: number): number {
  const plan = state.current_cycle_plan;
  if (plan === null || plan.days.length === 0) return 0;
  const done = state.history.filter(
    (s) => s.cycle_index === state.cycle_index && s.week_in_cycle <= throughWeek,
  ).length;
  return done / (plan.days.length * throughWeek);
}

// Re-export (Muscle est défini dans models).
export type { Muscle };
