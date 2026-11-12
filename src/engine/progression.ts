/**
 * Dump 2.4, étape 4 (D5) — **une seule règle de progression : la double
 * progression dans la fourchette de l'exercice.**
 *
 * Conception : `Kotsh/recherche/14_progression_charge.md`. Remplace le cliquet
 * de charge (`prescribed_load_floor`, graduation, adoption, descente, garde-fou
 * du Plafond) et le cliquet de reps du poids du corps (`prescribed_reps_floor`).
 *
 * La règle, appliquée série après série :
 *   - une série atteint le HAUT de la fourchette → cran suivant ;
 *   - une série tombe sous le BAS → cran inférieur ;
 *   - sinon → même charge, une rep de plus visée.
 *
 * Entre deux séances, elle part de la **dernière séance réelle** de l'exercice
 * (lue dans l'historique) : rien n'est mémorisé à part. Les **crans** sont les
 * charges déjà saisies sur l'exercice (ce que la machine offre vraiment) ; au-delà
 * de la plus lourde, on ajoute l'écart entre les deux plus lourdes, à défaut
 * l'incrément du catalogue.
 *
 * Le Plafond ne décide plus de la charge (D4) : il sert seulement à prévoir les
 * reps après un changement de cran, et la charge d'un exercice jamais fait.
 */

import type {
  Exercise,
  Profile,
  SessionFeedback,
  SetFeedback,
  RepRangeKey,
  SetPrescription,
  UserState,
} from './models';
import { ChargeType, makeUserState } from './models';
import {
  EPLEY_K,
  effectiveIncrement,
  effectiveLoadForE1rm,
  effectivePdcOnly,
  externalLoadFromE1rm,
  roundToIncrement,
  targetLoad,
} from './prescription';
import { DELOAD_WEEK_IN_CYCLE } from './volume';

// =============================================================================
// 1. Constantes
// =============================================================================

/**
 * Effort de référence des calculs internes (RPE 9, une rep en réserve). N'est
 * jamais affiché : il sert à prévoir des reps ou une charge depuis le Plafond.
 * Décision d'Azur en conv #82 (n° 10 du dump).
 */
export const INTERNAL_RPE = 9;

/** Effort de référence en semaine de récupération acceptée. */
export const RECOVERY_RPE = 6;

/** Allègement de la charge en semaine de récupération acceptée. */
export const RECOVERY_LOAD_FACTOR = 0.9;

/**
 * Au poids du corps, au-delà de ce nombre de reps on cesse d'en viser une de
 * plus : l'écran invite (sans obliger) au lest ou à une variante plus dure.
 */
export const BODYWEIGHT_REPS_CAP = 30;

const EPS = 1e-6;

// =============================================================================
// 2. Familles d'exercices
// =============================================================================

/**
 * L'exercice progresse-t-il en reps seulement (aucune charge externe) ? Poids du
 * corps pur, ou exercice lestable que l'utilisateur fait au poids du corps : il
 * y reste tant qu'il n'a pas choisi d'ajouter du lest (#63, rappelé en #82).
 */
export function progressesByReps(state: UserState, exercise: Exercise): boolean {
  if (effectivePdcOnly(state, exercise)) return true;
  return exercise.charge === ChargeType.BODYWEIGHT;
}

/**
 * Charge = assistance (machine à dips ou tractions assistée) : le cran « plus
 * dur » est une charge PLUS FAIBLE.
 */
function isAssisted(exercise: Exercise): boolean {
  return exercise.charge === ChargeType.BODYWEIGHT_ASSISTED;
}

// =============================================================================
// 3. Fourchette de reps
// =============================================================================

export interface RepRange {
  readonly low: number;
  readonly high: number;
}

/**
 * Les trois fourchettes (conv #82, doc 14 §6 ter). Largeurs progressives (4, 5,
 * 6) : plus les crans d'une machine sont gros par rapport à la charge, plus un
 * cran coûte de reps, plus la fourchette doit être large pour qu'on y retombe
 * après une montée. Jamais au-delà de 16 : le Plafond se mesure mal plus haut.
 */
export const REP_RANGES: Readonly<Record<RepRangeKey, RepRange>> = {
  heavy: { low: 6, high: 10 },
  medium: { low: 8, high: 13 },
  light: { low: 10, high: 16 },
};

/** Ordre de la plus étroite à la plus large. */
export const REP_RANGE_KEYS: readonly RepRangeKey[] = ['heavy', 'medium', 'light'];

/** « 8–13 » : fourchette telle qu'affichée. */
export function repRangeLabel(key: RepRangeKey): string {
  const r = REP_RANGES[key];
  return `${r.low}–${r.high}`;
}

/** Vrai si `v` est une clé de fourchette connue (lecture tolérante). */
export function isRepRangeKey(v: unknown): v is RepRangeKey {
  return v === 'heavy' || v === 'medium' || v === 'light';
}

/**
 * Fourchette conseillée par le catalogue : celle des trois dont le milieu est le
 * plus proche du milieu de `reps_hyp` (à égalité, la plus large).
 */
export function catalogRepRangeKey(exercise: Exercise): RepRangeKey {
  const [a, b] = exercise.reps_hyp;
  const mid = (a + b) / 2;
  let best: RepRangeKey = 'light';
  let bestDist = Infinity;
  for (const key of REP_RANGE_KEYS) {
    const r = REP_RANGES[key];
    const dist = Math.abs((r.low + r.high) / 2 - mid);
    if (dist <= bestDist) {
      best = key;
      bestDist = dist;
    }
  }
  return best;
}

/** Fourchette en vigueur : le choix de l'utilisateur, sinon celle conseillée. */
export function repRangeKeyOf(state: UserState | null, exercise: Exercise): RepRangeKey {
  const chosen = state?.rep_ranges[exercise.id];
  return chosen !== undefined && isRepRangeKey(chosen) ? chosen : catalogRepRangeKey(exercise);
}

/** Fourchette de reps en vigueur pour cet exercice. */
export function repRangeOf(state: UserState | null, exercise: Exercise): RepRange {
  return REP_RANGES[repRangeKeyOf(state, exercise)];
}

// =============================================================================
// 4. Historique : dernière séance et charges connues
// =============================================================================

/** Séries valides (au moins une rep) de cet exercice dans une séance. */
function setsOf(session: SessionFeedback, exerciseId: string): SetFeedback[] {
  return session.sets.filter((s) => s.exercise_id === exerciseId && s.reps_done > 0);
}

/** Séances de l'historique contenant l'exercice, de la plus récente à la plus ancienne. */
function sessionsWith(
  history: readonly SessionFeedback[],
  exerciseId: string,
): SessionFeedback[] {
  return history
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => setsOf(s, exerciseId).length > 0)
    .sort((a, b) =>
      a.s.seance_date === b.s.seance_date
        ? b.i - a.i
        : a.s.seance_date < b.s.seance_date
          ? 1
          : -1,
    )
    .map(({ s }) => s);
}

/**
 * Séries de la dernière séance de référence de l'exercice, ou `null` s'il n'a
 * jamais été fait. Une séance de semaine 5 n'est prise que s'il n'y en a pas
 * d'autre : en récupération la charge est allégée, elle ne doit pas faire
 * reculer la prescription du cycle suivant. (Une semaine 5 refusée était une
 * semaine normale : l'ignorer fait seulement repartir de la séance d'avant.)
 */
export function lastSessionSets(
  history: readonly SessionFeedback[],
  exerciseId: string,
): SetFeedback[] | null {
  const sessions = sessionsWith(history, exerciseId);
  if (sessions.length === 0) return null;
  const ref = sessions.find((s) => s.week_in_cycle !== DELOAD_WEEK_IN_CYCLE) ?? sessions[0]!;
  return setsOf(ref, exerciseId);
}

/** Charges déjà saisies sur l'exercice, triées, sans doublon. */
export function knownLoads(
  history: readonly SessionFeedback[],
  exerciseId: string,
  extra: readonly number[] = [],
): number[] {
  const all: number[] = [...extra];
  for (const s of history) for (const f of setsOf(s, exerciseId)) all.push(f.load_kg);
  const sorted = all.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (out.length === 0 || v - out[out.length - 1]! > EPS) out.push(v);
  return out;
}

// =============================================================================
// 5. Crans
// =============================================================================

/** Seules les charges proches comptent pour estimer le cran (± 25 %). */
const NEARBY_RATIO = 0.25;

/**
 * Cran habituel de la machine autour de `load` : le plus grand écart entre deux
 * charges connues proches. Le plus grand, parce qu'un cran intermédiaire qui
 * existe aurait été utilisé avant de sauter au-dessus (raisonnement d'Azur,
 * conv #82) ; une charge isolée (54 kg sur une pile 52 / 59 / 66) ne doit pas
 * faire inventer un 64. À défaut : l'incrément du catalogue.
 */
export function usualStep(known: readonly number[], load: number, inc: number): number {
  const near = known.filter((v) => Math.abs(v - load) <= load * NEARBY_RATIO + EPS);
  let gap = 0;
  for (let i = 1; i < near.length; i++) gap = Math.max(gap, near[i]! - near[i - 1]!);
  if (gap > EPS) return gap;
  return inc > 0 ? inc : 1;
}

/** Charge connue juste au-dessus de `load`, sinon `load` + cran habituel. */
export function nextLoadUp(known: readonly number[], load: number, inc: number): number {
  const above = known.find((v) => v > load + EPS);
  if (above !== undefined) return above;
  return round2(load + usualStep(known, load, inc));
}

/** Charge connue juste en dessous de `load`, sinon `load` − cran habituel (≥ 0). */
export function nextLoadDown(known: readonly number[], load: number, inc: number): number {
  for (let i = known.length - 1; i >= 0; i--) {
    if (known[i]! < load - EPS) return known[i]!;
  }
  return Math.max(0, round2(load - usualStep(known, load, inc)));
}

/** Cran plus dur (plus lourd ; moins d'assistance pour un exercice assisté). */
function harder(exercise: Exercise, known: readonly number[], load: number, inc: number): number {
  return isAssisted(exercise) ? nextLoadDown(known, load, inc) : nextLoadUp(known, load, inc);
}

/** Cran plus facile. */
function easier(exercise: Exercise, known: readonly number[], load: number, inc: number): number {
  return isAssisted(exercise) ? nextLoadUp(known, load, inc) : nextLoadDown(known, load, inc);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// =============================================================================
// 6. Prévisions depuis le Plafond (D4)
// =============================================================================

/**
 * Reps attendues à `extLoad` à l'effort de référence, d'après le Plafond, bornées
 * à la fourchette. Sans Plafond exploitable : le bas de la fourchette.
 */
export function predictedReps(
  exercise: Exercise,
  e1rmTotal: number | null,
  extLoad: number,
  bodyweightKg: number,
  range: RepRange,
): number {
  if (e1rmTotal === null || !(e1rmTotal > 0)) return range.low;
  const total = effectiveLoadForE1rm(extLoad, exercise, bodyweightKg);
  if (!(total > 0)) return range.high;
  const nEq = (e1rmTotal / total - 1) / EPLEY_K;
  const reps = Math.round(nEq - (10 - INTERNAL_RPE));
  return Math.max(range.low, Math.min(range.high, reps));
}

// =============================================================================
// 7. Prescription d'une séance
// =============================================================================

export interface ProgressionTarget {
  readonly load_kg: number;
  readonly reps: number;
}

/**
 * Charge et reps de référence d'une séance : la charge la plus lourde (la plus
 * dure, pour un exercice assisté) à laquelle une série a atteint le bas de la
 * fourchette, et le meilleur nombre de reps fait à cette charge. Si aucune série
 * n'a atteint le bas : la charge la plus dure utilisée.
 */
export function referenceOf(
  exercise: Exercise,
  sets: readonly SetFeedback[],
  range: RepRange,
): ProgressionTarget | null {
  if (sets.length === 0) return null;
  const dir = isAssisted(exercise) ? -1 : 1;
  const hardest = (xs: readonly SetFeedback[]): number =>
    xs.reduce((acc, s) => (dir * s.load_kg > dir * acc ? s.load_kg : acc), xs[0]!.load_kg);
  const inRange = sets.filter((s) => s.reps_done >= range.low);
  const load = hardest(inRange.length > 0 ? inRange : sets);
  const reps = Math.max(
    ...sets.filter((s) => Math.abs(s.load_kg - load) <= EPS).map((s) => s.reps_done),
  );
  return { load_kg: load, reps };
}

export interface SessionTargetArgs {
  readonly state: UserState;
  readonly exercise: Exercise;
  /** Plafond (charge totale) mesuré, ou estimé pour un exercice jamais fait. */
  readonly e1rmTotal: number;
  /** Semaine de récupération acceptée. */
  readonly recovery: boolean;
}

/**
 * Charge et reps à prescrire pour cet exercice dans la prochaine séance.
 */
export function sessionTarget(args: SessionTargetArgs): ProgressionTarget {
  const { state, exercise, e1rmTotal, recovery } = args;
  const range = repRangeOf(state, exercise);
  const bw = state.profile.bodyweight_kg;
  const last = lastSessionSets(state.history, exercise.id);

  // Poids du corps : seules les reps progressent, une de plus que la dernière fois.
  if (progressesByReps(state, exercise)) {
    if (last === null) {
      return { load_kg: 0, reps: firstBodyweightReps(state, exercise, e1rmTotal, range) };
    }
    const best = Math.max(...last.map((s) => s.reps_done));
    const reps = recovery ? best : Math.min(BODYWEIGHT_REPS_CAP, Math.max(best, best + 1));
    return { load_kg: 0, reps: Math.max(1, reps) };
  }

  const inc = effectiveIncrement(state, exercise);
  const ref = last === null ? null : referenceOf(exercise, last, range);

  let target: ProgressionTarget;
  if (ref === null) {
    // Exercice jamais fait : charge estimée depuis le Plafond, au milieu de la fourchette.
    const reps = Math.round((range.low + range.high) / 2);
    const total = targetLoad(e1rmTotal, reps, INTERNAL_RPE);
    const load = Math.max(0, roundToIncrement(externalLoadFromE1rm(total, exercise, bw), inc));
    target = { load_kg: load, reps };
  } else {
    const known = knownLoads(state.history, exercise.id);
    if (ref.reps >= range.high) {
      const load = harder(exercise, known, ref.load_kg, inc);
      target = { load_kg: load, reps: predictedReps(exercise, e1rmTotal, load, bw, range) };
    } else if (ref.reps < range.low) {
      const load = easier(exercise, known, ref.load_kg, inc);
      target = { load_kg: load, reps: predictedReps(exercise, e1rmTotal, load, bw, range) };
    } else {
      target = { load_kg: ref.load_kg, reps: Math.min(range.high, ref.reps + 1) };
    }
  }

  if (!recovery) return target;
  return { load_kg: recoveryLoad(state, exercise, target.load_kg, inc), reps: target.reps };
}

/** Charge allégée de récupération, prise parmi les charges connues si possible. */
function recoveryLoad(
  state: UserState,
  exercise: Exercise,
  load: number,
  inc: number,
): number {
  const known = knownLoads(state.history, exercise.id);
  if (isAssisted(exercise)) {
    // Plus d'assistance = plus facile.
    const wanted = load + Math.max(inc, load * (1 - RECOVERY_LOAD_FACTOR));
    return known.find((v) => v >= wanted - EPS) ?? roundToIncrement(wanted, inc);
  }
  const wanted = load * RECOVERY_LOAD_FACTOR;
  for (let i = known.length - 1; i >= 0; i--) {
    if (known[i]! <= wanted + EPS) return known[i]!;
  }
  return Math.max(0, roundToIncrement(wanted, inc));
}

/**
 * Reps de départ d'un exercice au poids du corps jamais fait : depuis un Plafond
 * réellement mesuré si l'exercice a été fait lesté avant, sinon le bas de la
 * fourchette.
 */
function firstBodyweightReps(
  state: UserState,
  exercise: Exercise,
  e1rmTotal: number,
  range: RepRange,
): number {
  const bw = state.profile.bodyweight_kg;
  if (state.e1rm[exercise.id] === undefined || !(bw > 0)) return range.low;
  const ratio = e1rmTotal / bw;
  if (ratio <= 1) return range.low;
  const reps = Math.round((ratio - 1) / EPLEY_K - (10 - INTERNAL_RPE));
  return Math.max(1, Math.min(BODYWEIGHT_REPS_CAP, reps));
}

// =============================================================================
// 7 bis. Fourchette trop étroite pour les crans : proposition de changement
// =============================================================================

/** Une montée d'un cran qui fait tomber sous le bas de la fourchette. */
export interface RangeTrap {
  /** Charge et reps de la série qui a atteint le haut. */
  readonly fromLoad: number;
  readonly fromReps: number;
  /** Charge et reps de la série plus dure, tombée sous le bas. */
  readonly toLoad: number;
  readonly toReps: number;
}

/**
 * Le piège dans une séance : une série atteint le haut, puis une série plus
 * dure tombe sous le bas — dans la même séance, ou au début de la séance qui
 * suit une séance terminée en haut de la fourchette (`previous`).
 */
export function rangeTrapIn(
  exercise: Exercise,
  sets: readonly SetFeedback[],
  previous: readonly SetFeedback[] | null,
  range: RepRange,
): RangeTrap | null {
  const dir = isAssisted(exercise) ? -1 : 1;
  const harderThan = (a: number, b: number): boolean => dir * a > dir * b + EPS;
  for (let j = 0; j < sets.length; j++) {
    const b = sets[j]!;
    if (b.reps_done >= range.low) continue;
    for (let i = 0; i < j; i++) {
      const a = sets[i]!;
      if (a.reps_done >= range.high && harderThan(b.load_kg, a.load_kg)) {
        return { fromLoad: a.load_kg, fromReps: a.reps_done, toLoad: b.load_kg, toReps: b.reps_done };
      }
    }
  }
  if (previous !== null && sets.length > 0) {
    const ref = referenceOf(exercise, previous, range);
    const first = sets[0]!;
    if (
      ref !== null &&
      ref.reps >= range.high &&
      harderThan(first.load_kg, ref.load_kg) &&
      first.reps_done < range.low
    ) {
      return { fromLoad: ref.load_kg, fromReps: ref.reps, toLoad: first.load_kg, toReps: first.reps_done };
    }
  }
  return null;
}

/** Nombre de séances de suite où le piège doit être vu avant de proposer. */
export const RANGE_TRAP_SESSIONS = 2;

export interface RepRangeSuggestion {
  readonly exercise_id: string;
  readonly from: RepRangeKey;
  readonly to: RepRangeKey;
  /** Le piège de la séance la plus récente, pour l'expliquer. */
  readonly trap: RangeTrap;
}

/**
 * Faut-il proposer une fourchette plus large pour cet exercice ? Oui quand ses
 * deux dernières séances (hors semaine 5) montrent le piège, que la fourchette
 * n'a pas été choisie explicitement par l'utilisateur (un choix, même « garder »,
 * coupe les propositions) et qu'une fourchette plus large existe.
 */
export function repRangeSuggestion(state: UserState, exercise: Exercise): RepRangeSuggestion | null {
  if (progressesByReps(state, exercise)) return null;
  if (state.rep_ranges[exercise.id] !== undefined) return null;
  const from = repRangeKeyOf(state, exercise);
  const idx = REP_RANGE_KEYS.indexOf(from);
  if (idx < 0 || idx >= REP_RANGE_KEYS.length - 1) return null;
  const range = REP_RANGES[from];
  const sessions = sessionsWith(state.history, exercise.id).filter(
    (s) => s.week_in_cycle !== DELOAD_WEEK_IN_CYCLE,
  );
  if (sessions.length < RANGE_TRAP_SESSIONS) return null;
  let latest: RangeTrap | null = null;
  for (let k = 0; k < RANGE_TRAP_SESSIONS; k++) {
    const prev = sessions[k + 1];
    const trap = rangeTrapIn(
      exercise,
      setsOf(sessions[k]!, exercise.id),
      prev === undefined ? null : setsOf(prev, exercise.id),
      range,
    );
    if (trap === null) return null;
    if (k === 0) latest = trap;
  }
  return { exercise_id: exercise.id, from, to: REP_RANGE_KEYS[idx + 1]!, trap: latest! };
}

// =============================================================================
// 8. En séance : la même règle, série après série
// =============================================================================

export interface NextSetTarget {
  readonly load_kg: number;
  /** Reps prévues au nouveau cran ; `null` = charge inchangée, reps inchangées. */
  readonly reps: number | null;
}

/**
 * Charge (et reps prévues) des séries suivantes après une série faite à
 * `load_kg` pour `reps` reps. Dans la fourchette, la charge reste et les reps
 * prévues ne bougent pas (la fatigue en retire d'une série à l'autre). `null` =
 * ne rien changer (poids du corps).
 */
export function nextSetTarget(args: {
  readonly state: UserState;
  readonly exercise: Exercise;
  readonly e1rmTotal: number | null;
  readonly load_kg: number;
  readonly reps: number;
  /** Charges déjà saisies dans la séance en cours (elles comptent comme connues). */
  readonly sessionLoads?: readonly number[];
}): NextSetTarget | null {
  const { state, exercise, e1rmTotal, load_kg, reps } = args;
  if (progressesByReps(state, exercise)) return null;
  const range = repRangeOf(state, exercise);
  const inc = effectiveIncrement(state, exercise);
  const known = knownLoads(state.history, exercise.id, [...(args.sessionLoads ?? []), load_kg]);
  const bw = state.profile.bodyweight_kg;
  if (reps >= range.high) {
    const load = harder(exercise, known, load_kg, inc);
    return { load_kg: load, reps: predictedReps(exercise, e1rmTotal, load, bw, range) };
  }
  if (reps < range.low) {
    const load = easier(exercise, known, load_kg, inc);
    return { load_kg: load, reps: predictedReps(exercise, e1rmTotal, load, bw, range) };
  }
  return { load_kg, reps: null };
}

// =============================================================================
// 9. Construction d'une SetPrescription
// =============================================================================

export interface BuildPrescriptionOptions {
  /**
   * Récupération EFFECTIVE (semaine 5 + récupération acceptée). Charge allégée
   * (`RECOVERY_LOAD_FACTOR`), effort de référence abaissé.
   */
  deloadActive?: boolean;
  /** Sans état : exercice traité comme jamais fait (charge depuis le Plafond). */
  state?: UserState | null;
}

/**
 * Prescription d'une série de cet exercice (toutes les séries d'un exercice
 * reçoivent la même). `e1rmTotal` : Plafond en charge totale (poids du corps
 * inclus pour un exercice lesté), mesuré ou estimé.
 */
export function buildPrescription(
  exercise: Exercise,
  e1rmTotal: number,
  profile: Profile,
  options: BuildPrescriptionOptions = {},
): SetPrescription {
  const recovery = options.deloadActive ?? false;
  const state: UserState = options.state ?? makeUserState(profile);
  const target = sessionTarget({ state, exercise, e1rmTotal, recovery });
  return {
    exercise_id: exercise.id,
    reps: target.reps,
    load_kg: target.load_kg,
    rpe_target: recovery ? RECOVERY_RPE : INTERNAL_RPE,
    rest_s: exercise.repos_s,
  };
}
