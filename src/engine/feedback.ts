/**
 * Mise à jour de l'e1RM par filtre exponentiel pondéré (EMA).
 *
 * Référence : recherche/03_modele_mathematique.md, §6.
 *
 * Bloc R — modèle de mesure UNIFIÉ : tous les exos sont mesurés via un plafond
 * e1RM (Epley étendu = ancre cohérente, même « faux » physiologiquement aux
 * hautes reps : les reps fixes par exo×objectif gardent le biais constant → le
 * delta reste juste). Plus de cas spécial `e1RM_app` / double progression.
 * Le filtre de fiabilité n_équiv ≤ 15 ne BLOQUE plus la progression ; on
 * distingue deux niveaux fondés sur la réserve (critère 4+, cf. Conv #34) :
 *   - ≥ 1 série « informative » (RPE > 6) → mise à jour DÉFINITIVE (snapshot).
 *   - toutes les séries « trop faciles » (RPE = 6 / 4+) → mise à jour PROVISOIRE
 *     (ratchet vers le haut, pas de snapshot — l'exo reste en calibration).
 */

import type { Exercise, SetFeedback, UserState } from './models';
import {
  EPLEY_K,
  e1rmObserved,
  effectiveIncrement,
  effectiveLoadForE1rm,
  exerciseUsesLoadFloor,
  exerciseUsesRepsFloor,
  nEquiv,
  resolveTargetReps,
  roundToIncrement,
} from './prescription';

/**
 * RPE plancher = réserve maximale informative (4 reps en réserve, libellé « 4+ »
 * côté UI). Une séance dont TOUTES les séries fiables sont à ce plancher est
 * « trop facile » : signal sans ambiguïté que l'user est plus fort que la
 * prescription. On réagit en montant le plafond décisivement (cf. update e1RM).
 */
export const RPE_RESERVE_FLOOR = 6;

/**
 * Bloc L — tolérance de reps sous la cible pour valider une charge volontairement
 * plus lourde que la prescription comme nouveau point de calibration. Si l'user
 * met plus lourd que préconisé et reste à ≤ 2 reps sous la cible, c'est un signal
 * de force fiable (≈ résolution du RPE/Epley ; la mesure passe déjà le filtre
 * `n_équiv ≤ 15`) : on adopte la charge décisivement au lieu d'amortir via l'EMA,
 * pour ne pas « rétrograder » involontairement la charge à la séance suivante.
 */
export const LOAD_OVERRIDE_REP_TOLERANCE = 2;

// =============================================================================
// 1. Coefficient α du filtre EMA (cf. §6.2)
// =============================================================================

/**
 * α dépend de la confiance dans la mesure (proximité du 1RM). Bloc R — plancher
 * à 0,1 au-delà de n_équiv 15 (avant : 0 = figé) : une série informative haute-rep
 * (endurance) doit quand même faire bouger l'ancre, juste plus doucement.
 */
export function computeAlpha(reps: number, rpe: number): number {
  const ne = nEquiv(reps, rpe);
  if (ne <= 5) return 0.3;
  if (ne <= 10) return 0.2;
  return 0.1;
}

/** Poids d'une mesure pour l'agrégation multi-séries (§6.4) : w = 1 / (1 + n_équiv/10). */
export function measurementWeight(reps: number, rpe: number): number {
  const ne = nEquiv(reps, rpe);
  return 1.0 / (1 + ne / 10);
}

// =============================================================================
// 2. Agrégation pondérée des e1RM observés (réutilisable côté UI)
// =============================================================================

export interface ReliableSetForE1rm {
  readonly load_kg: number;
  readonly reps: number;
  readonly rpe: number;
}

/**
 * Moyenne pondérée des e1RM observés d'un ensemble de séries.
 * Poids = `1/(1 + n_équiv/10)` — les séries plus proches du 1RM pèsent plus
 * (Bloc R : plus de filtre de fiabilité dur, le poids downweight les séries
 * longues sans jamais les annuler → Epley étendu).
 *
 * Retourne `null` si l'ensemble est vide ou si aucune série n'est exploitable
 * par Epley (RPE/reps hors plage).
 */
export function aggregateE1rmWeighted(
  sets: readonly ReliableSetForE1rm[],
  exercise: Exercise,
  bodyweightKg: number,
  k: number = EPLEY_K,
): number | null {
  if (sets.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const s of sets) {
    try {
      const total = effectiveLoadForE1rm(s.load_kg, exercise, bodyweightKg);
      const e1 = e1rmObserved(total, s.reps, s.rpe, k);
      const w = measurementWeight(s.reps, s.rpe);
      num += w * e1;
      den += w;
    } catch {
      // RPE/reps hors plage : on ignore cette série.
    }
  }
  if (den === 0) return null;
  return num / den;
}

// =============================================================================
// 3. Mise à jour de l'e1RM pour un exercice donné
// =============================================================================

export interface UpdateE1rmOptions {
  /**
   * Si `true`, on remplace l'ancien plafond par la nouvelle agrégation sans
   * appliquer le filtre EMA. À utiliser quand l'ancien plafond stocké n'est
   * qu'un bootstrap heuristique (1re séance d'un exo) : mélanger via EMA une
   * valeur agrégée fiable avec une estimation grossière pourrirait la mesure.
   *
   * Défaut : `false` (comportement EMA standard, séances ≥ 2 d'un exo).
   */
  readonly skipEma?: boolean;

  /**
   * Bloc L — charge et reps préconisées pour cet exo à cette séance (issues du
   * `SessionPlan`). Sert à détecter que l'user a soulevé plus lourd que prévu :
   * dans ce cas (et si l'écart de reps est dans la tolérance), on adopte la
   * charge décisivement plutôt que de l'amortir via l'EMA (cf.
   * `LOAD_OVERRIDE_REP_TOLERANCE`). Absent → comportement EMA standard.
   */
  readonly prescribed?: { readonly load_kg: number; readonly target_reps: number };

  /**
   * A-3 (#73) — semaine de RÉCUPÉRATION : la séance ne peut que faire MONTER le
   * plafond, jamais le baisser. On travaille volontairement plus léger, donc une
   * agrégation Epley plus basse ne mesure rien ; mais si l'user charge quand même
   * et bat son plafond, c'est un vrai progrès qu'on doit enregistrer (snapshot →
   * courbe Force) et afficher au bilan. Remplace l'ancien « on saute tout ».
   *
   * Exo jamais mesuré → aucune mise à jour (une semaine allégée ne calibre pas).
   */
  readonly ratchetUpOnly?: boolean;
}

/**
 * Résultat d'une mise à jour d'e1RM pour un exo (Bloc R).
 *  - `definitive === true` : au moins une série « informative » (RPE > 4+) →
 *    mesure fiable, un snapshot daté sera créé (confidence → 'measured', l'exo
 *    compte au bilan).
 *  - `definitive === false` : mise à jour PROVISOIRE (toutes les séries à 4+) →
 *    `state.e1rm` est remonté (ratchet) SANS snapshot. L'exo reste en
 *    calibration, on évite juste de redémarrer au même point la fois suivante.
 */
export interface E1rmUpdate {
  readonly old: number;
  readonly next: number;
  readonly definitive: boolean;
}

/**
 * Met à jour `state.e1rm[exercise.id]` à partir des séries faites sur cet exo.
 * Retourne `{ old, next, definitive }` si une mise à jour a eu lieu, sinon `null`
 * (aucune série exploitable par Epley). Modèle unifié Bloc R : cf. en-tête du module.
 */
export function updateE1rmForExercise(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
  k: number = EPLEY_K,
  options: UpdateE1rmOptions = {},
): E1rmUpdate | null {
  // Toutes les séries exploitables par Epley (reps > 0, RPE dans la plage).
  // Plus de filtre n_équiv ≤ 15 : `measurementWeight` downweight les séries
  // longues, le calcul reste défini (Epley étendu).
  const valid = feedbacks.filter(
    (f) => f.reps_done > 0 && f.rpe_perceived >= 0.5 && f.rpe_perceived <= 10,
  );
  if (valid.length === 0) {
    return null;
  }

  // Niveau de la MAJ : ≥ 1 série informative (RPE > 4+) → définitive (agrégée sur
  // les seules informatives) ; sinon tout-4+ → provisoire (agrégée sur le facile).
  const informative = valid.filter((f) => f.rpe_perceived > RPE_RESERVE_FLOOR);
  const definitive = informative.length > 0;
  const measureSets = definitive ? informative : valid;

  // Agrégation pondérée des e1RM observés (en charge totale).
  const bw = state.profile.bodyweight_kg;
  const weights = measureSets.map((f) => measurementWeight(f.reps_done, f.rpe_perceived));
  const e1rmsObs = measureSets.map((f) =>
    e1rmObserved(effectiveLoadForE1rm(f.load_kg, exercise, bw), f.reps_done, f.rpe_perceived, k),
  );
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const e1rmAgg = weights.reduce((acc, w, i) => acc + w * e1rmsObs[i]!, 0) / sumWeights;

  // Bootstrap si vide : on pose old = e1rmAgg.
  const old = state.e1rm[exercise.id] ?? e1rmAgg;

  // A-3 (#73) — récupération : cliquet MONTANT strict. La mise à jour n'est
  // « définitive » (⇒ snapshot ⇒ point sur la courbe Force) que si le plafond a
  // réellement monté sur une série informative.
  if (options.ratchetUpOnly) {
    const known = state.e1rm[exercise.id];
    if (known === undefined) return null;
    const nextUp = Math.max(known, e1rmAgg);
    state.e1rm[exercise.id] = nextUp;
    return { old: known, next: nextUp, definitive: definitive && nextUp > known };
  }

  let next: number;
  if (!definitive) {
    // Provisoire (tout en 4+) : ratchet vers le haut uniquement — on ne baisse
    // jamais le plafond sur une séance non concluante. Pas de snapshot.
    next = Math.max(old, e1rmAgg);
  } else if (options.skipEma) {
    // 1re séance calibrée : adopter e1rmAgg sans EMA (l'ancien plafond n'était
    // qu'un bootstrap heuristique).
    next = e1rmAgg;
  } else {
    // α basé sur la série informative la plus fiable (n_équiv le plus petit).
    let best = informative[0]!;
    let bestNe = nEquiv(best.reps_done, best.rpe_perceived);
    for (const f of informative) {
      const ne = nEquiv(f.reps_done, f.rpe_perceived);
      if (ne < bestNe) {
        bestNe = ne;
        best = f;
      }
    }
    const alpha = computeAlpha(best.reps_done, best.rpe_perceived);
    // Bloc L — charge volontairement > préconisée à ≤ tolérance reps sous la
    // cible : adoption décisive (max, pas d'EMA) pour ne pas rétrograder la
    // charge à la séance suivante.
    const outperformedLoad =
      options.prescribed != null &&
      best.load_kg > options.prescribed.load_kg &&
      best.reps_done >= options.prescribed.target_reps - LOAD_OVERRIDE_REP_TOLERANCE;
    next = outperformedLoad
      ? Math.max(old, e1rmAgg)
      : alpha * e1rmAgg + (1 - alpha) * old;
  }

  state.e1rm[exercise.id] = next;
  return { old, next, definitive };
}

// =============================================================================
// 4. Cliquet de charge prescrite (refonte progression)
// =============================================================================

/**
 * Réserve de graduation : on monte la charge d'un cran quand la meilleure série
 * atteint `R + 3` reps-équivalentes (n_équiv), c.-à-d. `R` reps à RIR 3 — juste
 * avant la zone « 4+ » (RIR ≥ 4) non fiable pour Epley.
 */
export const GRADUATION_RESERVE = 3;

/** Meilleur n_équiv (série la plus « facile ») d'un lot de séries + sa charge et
 *  ses reps réalisées, ou null. */
function bestNeq(
  feedbacks: readonly SetFeedback[],
): { neq: number; load: number; reps: number } | null {
  let neq = -Infinity;
  let load = 0;
  let reps = 0;
  for (const f of feedbacks) {
    if (f.reps_done <= 0) continue;
    if (!(f.rpe_perceived >= 0.5 && f.rpe_perceived <= 10)) continue;
    const v = nEquiv(f.reps_done, f.rpe_perceived);
    if (v > neq) {
      neq = v;
      load = f.load_kg;
      reps = f.reps_done;
    }
  }
  return neq === -Infinity ? null : { neq, load, reps };
}

/**
 * Meilleur n_équiv de la dernière séance ANTÉRIEURE contenant cet exo (ou null).
 * Utilisé par le cliquet de REPS uniquement : au poids du corps il n'y a pas de
 * charge à comparer, donc pas de filtre de plancher à appliquer (le cliquet de
 * charge, lui, passe par `previousSessionUnderperformed`).
 */
function previousBestNeqForExercise(
  state: UserState,
  exerciseId: string,
): number | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const exoSets = state.history[i]!.sets.filter(
      (f) => f.exercise_id === exerciseId,
    );
    if (exoSets.length === 0) continue;
    const best = bestNeq(exoSets);
    return best === null ? null : best.neq;
  }
  return null;
}

/**
 * Conv #77 — tolérance de comparaison de charges. Les charges sont arrondies à
 * l'incrément mais restent des flottants : on ne veut pas qu'un 9,999999 rate
 * un plancher à 10.
 */
const LOAD_MATCH_EPS = 1e-6;

/** Séries de ce lot faites AU PLANCHER ou au-dessus. */
function setsAtOrAboveFloor(
  feedbacks: readonly SetFeedback[],
  floor: number,
): SetFeedback[] {
  return feedbacks.filter((f) => f.load_kg >= floor - LOAD_MATCH_EPS);
}

/**
 * La dernière séance ANTÉRIEURE contenant cet exo est-elle une sous-performance
 * vis-à-vis de `floor` ? `null` = pas de séance antérieure exploitable (aucune
 * information, donc pas de descente).
 *
 * Sous-performance = aucune série tenue au plancher, OU meilleure série au
 * plancher sous `targetReps` reps-équivalentes.
 *
 * ⚠️ On teste le plancher COURANT, pas celui qui était en vigueur ce jour-là
 * (les planchers successifs ne sont pas persistés). Approximation assumée : la
 * question posée est « la séance d'avant tenait-elle la charge d'aujourd'hui ? ».
 */
function previousSessionUnderperformed(
  state: UserState,
  exerciseId: string,
  floor: number,
  targetReps: number,
): boolean | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const exoSets = state.history[i]!.sets.filter(
      (f) => f.exercise_id === exerciseId,
    );
    if (exoSets.length === 0) continue;
    // Séance présente mais sans aucune série exploitable (reps 0, RPE hors
    // plage) : pas de mesure, donc pas de verdict.
    if (bestNeq(exoSets) === null) return null;
    const atFloor = bestNeq(setsAtOrAboveFloor(exoSets, floor));
    return atFloor === null || atFloor.neq < targetReps;
  }
  return null;
}

/**
 * Met à jour `state.prescribed_load_floor[exo]` à partir des séries de cet exo.
 *
 * Règles (cf. fiche refonte) :
 *  - **Périmètre de jugement** (Conv #77) : seules les séries faites AU PLANCHER
 *    ou au-dessus comptent. Une séance entièrement plus légère que le plancher
 *    est une sous-performance, jamais une graduation.
 *  - **Graduation** : la MEILLEURE série (n_équiv le plus haut, ≈ la plus
 *    fraîche) atteint `R + GRADUATION_RESERVE` → plancher +1 incrément. La
 *    fatigue sur les dernières séries n'empêche donc rien.
 *  - **Anti-régression** : si la meilleure série a été faite plus lourd que le
 *    plancher ET reste une charge de croisière (n_équiv ≥ `R + ADOPTION_RESERVE`,
 *    donc menée à RIR ≥ 2, pas à l'échec), on adopte cette charge (remplace
 *    l'ancien `outperformedLoad`).
 *  - **Descente** : seulement si CETTE séance ET la précédente de l'exo sont en
 *    sous-performance — sous R reps-équivalentes au plancher, ou plancher jamais
 *    atteint (charge trop lourde, sous-perf répétée) → plancher −1.
 *
 * Cliquet à sens unique sauf descente (hystérésis). Le caller skippe la semaine
 * de récup. Exos sans charge externe additive ignorés.
 */
export interface UpdateLoadFloorOptions {
  /**
   * A-3 (#73) — semaine de RÉCUPÉRATION : seule l'anti-régression tourne (adopter
   * une charge réellement soulevée plus lourde que le plancher). Ni graduation ni
   * descente : la charge prescrite est allégée et le RPE cible tombe à 6, donc
   * `n_équiv` est mécaniquement élevé et ferait grimper le plancher tout seul.
   * L'user qui charge quand même de son propre chef garde son gain.
   */
  readonly adoptionOnly?: boolean;
}

export function updatePrescribedLoadFloorForExercise(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
  options: UpdateLoadFloorOptions = {},
): void {
  if (!exerciseUsesLoadFloor(state, exercise)) return;
  // Sert uniquement à SEMER le plancher la 1re fois (aucun plancher connu ⇒ la
  // charge réellement utilisée fait référence).
  const seedBest = bestNeq(feedbacks);
  if (seedBest === null) return;

  const targetReps = resolveTargetReps(state, exercise);
  const inc = effectiveIncrement(state, exercise);
  const cur = state.prescribed_load_floor[exercise.id] ?? seedBest.load;

  /**
   * Conv #77 — on ne juge le plancher que sur les séries faites AU PLANCHER ou
   * au-dessus. Sans ce filtre, une série faite volontairement plus légère (la
   * charge prescrite n'existe pas sur la machine, ou elle est trop lourde) était
   * lue comme une performance À la charge du plancher : n_équiv élevé sur une
   * charge basse pouvait graduer le plancher, et bloquait à coup sûr la descente
   * — cas réel vu sur l'élévation latérale poulie (plancher 10 jugé sur des
   * séries à 9, resté 3 séances trop haut). `null` = aucune série au plancher,
   * c'est-à-dire une sous-performance, pas une absence de donnée.
   */
  const best = bestNeq(setsAtOrAboveFloor(feedbacks, cur));

  if (options.adoptionOnly) {
    // Pas de seed en récupération : sans plancher établi, on ne fixe rien.
    if (state.prescribed_load_floor[exercise.id] === undefined) return;
    if (best !== null && best.load > cur && best.neq >= targetReps + ADOPTION_RESERVE) {
      state.prescribed_load_floor[exercise.id] = best.load;
    }
    return;
  }

  let next = cur;
  if (best !== null) {
    // Anti-régression : charge réelle plus lourde ET série de croisière (n_équiv
    // ≥ R + ADOPTION_RESERVE, soit RIR ≥ 2 — une série à l'échec ne fait pas un
    // plancher tenable) → on l'adopte.
    if (best.load > next && best.neq >= targetReps + ADOPTION_RESERVE) {
      next = best.load;
    }
    if (best.neq >= targetReps + GRADUATION_RESERVE) {
      // Graduation : +1 incrément.
      next = roundToIncrement(next + inc, inc);
    }
  }

  // Descente sur sous-perf répétée (2 séances de suite). Sous-performer, c'est
  // rester sous R reps-équivalentes au plancher — ou ne pas avoir tenu le
  // plancher du tout. Le garde `next === cur` laisse la priorité à une
  // graduation / adoption qui vient d'avoir lieu.
  if (next === cur && (best === null || best.neq < targetReps)) {
    const prev = previousSessionUnderperformed(state, exercise.id, cur, targetReps);
    if (prev === true) {
      next = Math.max(0, roundToIncrement(cur - inc, inc));
    }
  }

  state.prescribed_load_floor[exercise.id] = next;
}

// =============================================================================
// 5. Cliquet de reps prescrites (chantier D — poids du corps pur + mode PDC)
// =============================================================================

/**
 * Marge de réserve exigée pour ADOPTER une performance meilleure que le plancher
 * (anti-régression) : la meilleure série doit rester à RIR ≥ ADOPTION_RESERVE
 * au-delà du plancher — une série menée à l'échec n'est pas un régime de
 * croisière. Distinct de GRADUATION_RESERVE (3). Partagée par les deux cliquets :
 * le cliquet de charge (`updatePrescribedLoadFloorForExercise`) et le cliquet de
 * reps (`updatePrescribedRepsFloorForExercise`).
 */
export const ADOPTION_RESERVE = 2;

/**
 * Cap haut du cliquet de reps : au-delà, on cesse de graduer. Le poids du corps
 * seul ne suffit plus à surcharger — l'UI invite alors au lest ou à une
 * variante plus dure (cf. `reps-cap-hint`).
 */
export const REPS_FLOOR_MAX = 30;

/** Plancher bas du cliquet de reps : une descente ne va jamais sous ce seuil. */
export const REPS_FLOOR_MIN = 5;

/**
 * Met à jour `state.prescribed_reps_floor[exo]` à partir des séries de cet exo.
 * Miroir EXACT du cliquet de charge (`updatePrescribedLoadFloorForExercise`)
 * mais sur les REPS : pour les exos au poids du corps PUR (charge = 0) ou en
 * mode PDC, la progression se fait en ajoutant des reps, pas des kg. Le plancher
 * joue lui-même le rôle des « reps cibles R » (la prescription = le plancher).
 *
 * Règles :
 *  - **Graduation** : la MEILLEURE série (n_équiv le plus haut) atteint
 *    `plancher + GRADUATION_RESERVE` → plancher +1 rep. Stoppe au cap
 *    `REPS_FLOOR_MAX`.
 *  - **Anti-régression** : l'user a fait PLUS de reps que le plancher en gardant
 *    `n_équiv ≥ plancher + ADOPTION_RESERVE` → on adopte les reps faites
 *    (plafonnées au cap).
 *  - **Descente** : CETTE séance ET la précédente de l'exo sous le plancher
 *    (`n_équiv < plancher`) → plancher −1 (jamais sous `REPS_FLOOR_MIN`).
 *
 * Cliquet à sens unique sauf descente (hystérésis). Le caller skippe la semaine
 * de récup. Exos hors périmètre reps-floor ignorés.
 */
export function updatePrescribedRepsFloorForExercise(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
): void {
  if (!exerciseUsesRepsFloor(state, exercise)) return;
  const best = bestNeq(feedbacks);
  if (best === null) return;

  const cur = state.prescribed_reps_floor[exercise.id] ?? best.reps;
  let next = cur;

  // Anti-régression : plus de reps que le plancher en gardant de la réserve.
  if (best.reps > next && best.neq >= cur + ADOPTION_RESERVE) {
    next = Math.min(REPS_FLOOR_MAX, best.reps);
  }

  if (cur < REPS_FLOOR_MAX && best.neq >= cur + GRADUATION_RESERVE) {
    // Graduation : +1 rep (jamais au-dessus du cap).
    next = Math.min(REPS_FLOOR_MAX, next + 1);
  } else if (next === cur && best.neq < cur) {
    // Descente sur sous-perf répétée (2 séances de suite sous le plancher).
    const prev = previousBestNeqForExercise(state, exercise.id);
    if (prev !== null && prev < cur) {
      next = Math.max(REPS_FLOOR_MIN, next - 1);
    }
  }

  state.prescribed_reps_floor[exercise.id] = next;
}
