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
  e1rmObserved,
  effectiveLoadForE1rm,
  nEquiv,
  slopeFor,
} from './prescription';

/**
 * RPE plancher = réserve maximale informative (4 reps en réserve, libellé « 4+ »
 * côté UI). Une séance dont TOUTES les séries fiables sont à ce plancher est
 * « trop facile » : signal sans ambiguïté que l'user est plus fort que la
 * prescription. On réagit en montant le plafond décisivement (cf. update e1RM).
 */
export const RPE_RESERVE_FLOOR = 6;

// =============================================================================
// 1. Coefficient α du filtre EMA (cf. §6.2)
// =============================================================================

/**
 * Dump 2.4, étape 5 — fraction de l'écart avec la mesure de la séance que le
 * Plafond parcourt (lissage). Avant : 0,1 à 0,3 selon la proximité de l'échec ;
 * sur des séries longues (≈ 12 reps, le cas d'Azur) c'était toujours 0,1, et le
 * Plafond restait en moyenne 7 % sous les mesures (11 % au tirage vertical) :
 * l'ancienne adoption sans lissage (« Bloc L ») masquait ce retard. À 0,3, rejoué
 * sur l'export du 11/11 : retard moyen 2,8 %, variation moyenne 1,9 % par séance,
 * sous le bruit d'une mesure isolée (2 à 7 %).
 */
export const PLAFOND_SMOOTHING = 0.3;

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
): number | null {
  if (sets.length === 0) return null;
  const k = slopeFor(exercise);
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
   * A-3 (#73) — semaine de RÉCUPÉRATION : la séance ne peut que faire MONTER le
   * plafond, jamais le baisser. On travaille volontairement plus léger, donc une
   * agrégation Epley plus basse ne mesure rien ; mais si l'user charge quand même
   * et bat son plafond, c'est un vrai progrès qu'on doit enregistrer (snapshot →
   * courbe Force) et afficher au bilan. Remplace l'ancien « on saute tout ».
   * Dump 2.4, étape 5 — la montée passe par le même lissage qu'une séance normale.
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
  options: UpdateE1rmOptions = {},
): E1rmUpdate | null {
  const k = slopeFor(exercise);
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

  // A-3 (#73) — récupération : le Plafond ne peut que monter. La mise à jour n'est
  // « définitive » (⇒ snapshot ⇒ point sur la courbe Force) que si le plafond a
  // réellement monté sur une série informative. Dump 2.4, étape 5 — la montée est
  // lissée comme en semaine normale : adoptée telle quelle, elle faisait sauter la
  // courbe (+0,9 kg en une séance sur l'élévation latérale d'Azur).
  if (options.ratchetUpOnly) {
    const known = state.e1rm[exercise.id];
    if (known === undefined) return null;
    const nextUp =
      definitive && e1rmAgg > known ? smoothed(e1rmAgg, known) : known;
    state.e1rm[exercise.id] = nextUp;
    return { old: known, next: nextUp, definitive: nextUp > known };
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
    // Dump 2.4, étape 5 — plus d'adoption sans lissage quand la charge dépasse
    // la prescription (ancien « Bloc L ») : elle évitait de rétrograder une charge
    // tirée du Plafond, ce que la progression de l'étape 4 ne fait plus, et elle
    // faisait sauter la courbe à chaque cran franchi.
    next = smoothed(e1rmAgg, old);
  }

  state.e1rm[exercise.id] = next;
  return { old, next, definitive };
}

/** Lissage : le Plafond parcourt une fraction fixe de l'écart avec la mesure. */
function smoothed(measured: number, old: number): number {
  return PLAFOND_SMOOTHING * measured + (1 - PLAFOND_SMOOTHING) * old;
}

// =============================================================================
// 4. Mesure d'une séance, unité « une rep » et records (dump 2.4, étape 5)
// =============================================================================

/**
 * Un record (n° 9) : la mesure d'une séance, avant lissage, dépasse la meilleure
 * mesure passée de l'exercice d'au moins ce nombre de reps. Jugé sur la mesure
 * brute : le Plafond lissé ne parcourt qu'une fraction d'un bond, il ne
 * franchirait presque jamais deux reps d'un coup.
 */
export const RECORD_REPS = 2;

export interface SessionMeasure {
  /** Plafond mesuré par la séance, avant lissage (séries informatives). */
  readonly measured: number;
  /**
   * Ce que vaut une rep de plus en Plafond, à la charge la plus lourde de la
   * séance : charge × pente. Unité commune des seuils du bilan et des records.
   */
  readonly repKg: number;
}

/** `null` si la séance n'a aucune série informative (Réserve > 4+) sur l'exercice. */
export function sessionMeasure(
  sets: readonly SetFeedback[],
  exercise: Exercise,
  bodyweightKg: number,
): SessionMeasure | null {
  const informative = sets.filter(
    (f) =>
      f.exercise_id === exercise.id &&
      f.reps_done > 0 &&
      f.rpe_perceived > RPE_RESERVE_FLOOR &&
      f.rpe_perceived <= 10,
  );
  const measured = aggregateE1rmWeighted(
    informative.map((f) => ({ load_kg: f.load_kg, reps: f.reps_done, rpe: f.rpe_perceived })),
    exercise,
    bodyweightKg,
  );
  if (measured === null) return null;
  const top = Math.max(
    ...informative.map((f) => effectiveLoadForE1rm(f.load_kg, exercise, bodyweightKg)),
  );
  return { measured, repKg: top * slopeFor(exercise) };
}

/** La séance bat-elle la meilleure mesure passée d'au moins `RECORD_REPS` reps ? */
export function isRecord(measure: SessionMeasure, bestBefore: number | null): boolean {
  // Tolérance d'arrondi : deux reps pile comptent.
  return bestBefore !== null && measure.measured >= bestBefore + RECORD_REPS * measure.repKg - 1e-9;
}

/**
 * Dates des séances record d'un exercice, en parcourant son historique dans
 * l'ordre. La première mesure n'est jamais un record (rien à battre).
 */
export function recordDates(
  sessions: ReadonlyArray<{ readonly seance_date: string; readonly sets: readonly SetFeedback[] }>,
  exercise: Exercise,
  bodyweightKg: number,
): Set<string> {
  const ordered = [...sessions].sort((a, b) =>
    a.seance_date < b.seance_date ? -1 : a.seance_date > b.seance_date ? 1 : 0,
  );
  const out = new Set<string>();
  let best: number | null = null;
  for (const s of ordered) {
    const m = sessionMeasure(s.sets, exercise, bodyweightKg);
    if (m === null) continue;
    if (isRecord(m, best)) out.add(s.seance_date);
    best = best === null ? m.measured : Math.max(best, m.measured);
  }
  return out;
}
