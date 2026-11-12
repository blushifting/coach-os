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
import { Sex, Level, MuscleIntention } from './models';

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

/**
 * Dump 2.4 (D7, étape 3) — **zone haute** : un repère unique, commun à tous les
 * muscles, en séries pondérées par semaine. Au-delà, le volume est dit « élevé »
 * (ambre) : un constat, jamais un blocage.
 *
 * Sources (vérifiées en conv #81) : Baz-Valle et al. 2022 (J Hum Kinet,
 * méta-analyse, 6 essais sur sujets entraînés) recommandent 12 à 20 séries par
 * muscle et par semaine ; au-delà de 20, pas de gain supplémentaire mesuré sur
 * quadriceps et biceps, un gain sur triceps. Pelland et al. 2025 (prépublication
 * SportRxiv, lue à travers des résumés) : le gain croît avec le volume en
 * rendement décroissant, sans plafond net. Au-delà de 20, le bénéfice devient
 * incertain ; ce n'est pas un danger.
 *
 * Remplace l'ancien repère haut par muscle (`V_min × 1,8`, sans source propre).
 */
export const VOLUME_HIGH_MARK = 20;

export const DELOAD_FACTOR = 0.5;
/**
 * Conv #21bis — Semaine du cycle dédiée au déload (5/5 par convention).
 * Dupliqué côté `lib/dashboard.ts` (`DELOAD_WEEK_INDEX`) mais le moteur
 * reste pur (pas d'import depuis lib/). Toute relecture doit se baser
 * sur cette constante plutôt qu'un `=== 5` magique.
 */
export const DELOAD_WEEK_IN_CYCLE = 5;

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
export const MAINTENANCE_FACTOR = 0.4;

// =============================================================================
// 3. Initialisation des bornes
// =============================================================================

/** Seuil de croissance (V_min) par muscle pour ce profil. */
export function initialGrowthThresholds(profile: Profile): Record<string, number> {
  const vMin: Record<string, number> = {};
  for (const [muscle, byLevel] of Object.entries(V_MIN_BASE)) {
    let base = byLevel[profile.level];
    if (profile.sex === Sex.FEMME && FEMALE_BONUS_MUSCLES.has(muscle)) {
      base *= FEMALE_BONUS_FACTOR;
    }
    if (profile.age >= SENIOR_AGE_THRESHOLD) {
      base *= SENIOR_FACTOR;
    }
    vMin[muscle] = base;
  }
  return vMin;
}

// =============================================================================
// 5. Voie muscle_goals : volumeMark + targetFrequencyV2 (cf. 09 §4.5)
// =============================================================================

/**
 * Dump 2.4 (D2, étape 3) — **le repère** de volume hebdo de ce muscle (séries
 * pondérées), un seul par muscle, selon son intention. `state.volume_min[muscle]`
 * est le seuil de croissance (MEV).
 *   - Développer → le seuil de croissance ;
 *   - Entretenir → le plancher d'entretien (40 % du seuil, au moins 2 séries) ;
 *   - sans objectif, ou muscle inconnu du modèle → `null` : on compte les
 *     séries, sans repère.
 * Au-dessus du repère, la seule autre borne est la zone haute commune
 * (`VOLUME_HIGH_MARK`).
 */
export function volumeMark(
  state: Pick<UserState, 'volume_min' | 'muscle_goals'>,
  muscle: string,
): number | null {
  const threshold = state.volume_min[muscle];
  if (threshold === undefined) return null;
  const intention = state.muscle_goals[muscle]?.intention;
  if (intention === MuscleIntention.DEVELOPPER) return threshold;
  if (intention === MuscleIntention.ENTRETENIR) return maintenanceFloor(threshold);
  return null;
}

/** Plancher d'entretien : 40 % du seuil de croissance, au moins 2 séries (Bickel 2011). */
export function maintenanceFloor(growthThreshold: number): number {
  return Math.max(MAINTENANCE_MIN_SETS, growthThreshold * MAINTENANCE_FACTOR);
}

/**
 * Refonte remplissage (recherche/09b, 2026-07) — le générateur vise un peu
 * au-dessus du seuil de croissance pour un muscle à développer : viser le seuil
 * sec est trop conservateur depuis que le volume est fixe sur le cycle (Bloc L).
 *
 * Étape 3 du dump 2.4 : la cible s'exprimait comme « seuil + 20 % de la bande
 * jusqu'au repère haut (seuil × 1,8) », soit seuil × 1,16. Le repère haut par
 * muscle a disparu (zone haute commune, `VOLUME_HIGH_MARK`) ; la cible est
 * gardée telle quelle, écrite directement. L'entretien n'est pas relevé.
 */
export const DEVELOP_TARGET_FACTOR = 1.16;

/**
 * Volume cible du cycle pour ce muscle (séries pondérées).
 *
 * Bloc L (Conv #37) : nb de séries par exo FIXE sur les 4 semaines de travail.
 * La progression intra-cycle passe par l'intensité (charge/RPE) et les reps ;
 * le volume monte d'un cycle à l'autre via la recalibration de fin de cycle.
 *
 *   - sans objectif → 0 (suivi, mais aucune cible : D1)
 *   - Entretenir    → le plancher d'entretien
 *   - Développer    → seuil de croissance × `DEVELOP_TARGET_FACTOR`
 */
export function effectiveCycleTargetVolume(
  state: UserState,
  muscle: string,
): number {
  const goal = state.muscle_goals[muscle];
  const mark = volumeMark(state, muscle);
  if (goal === undefined || mark === null) return 0;
  if (goal.intention === MuscleIntention.DEVELOPPER) {
    return mark * DEVELOP_TARGET_FACTOR;
  }
  return mark;
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
  return isDeloadWeek(state, state.current_week_in_cycle);
}

/**
 * Dump 2.4, étape 1 — même question pour une semaine donnée (celle de la date
 * d'une séance programmée d'avance, qui n'est pas forcément la semaine en cours).
 */
export function isDeloadWeek(state: UserState, weekInCycle: number): boolean {
  return (
    weekInCycle === DELOAD_WEEK_IN_CYCLE && state.deload_decision === 'accepted'
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
