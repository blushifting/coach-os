/**
 * Sélecteurs et helpers purs pour l'exécution d'une séance (Conv #5b).
 *
 * Source de vérité :
 * - `recherche/08_ux_decisions.md §3 Onglet Séance` — pas de timer actif,
 *   saisie reps + RPE par série, récap fin de séance (volume cumulé,
 *   comparaison sem dernière, PR du jour).
 * - `recherche/10_plan_claude_code.md §3 Conv #5` — pictos par pattern
 *   (placeholders), fiche détaillée exo, bilan fin de séance.
 *
 * Tout est pur : prend `SessionPlan` + saisie locale, retourne du dérivé.
 */

import type {
  RecordFeedbackResult,
} from '@/engine/engine';
import type {
  Exercise,
  SessionFeedback,
  SessionPlan,
  SetFeedback,
} from '@/engine/models';
import type { Catalog } from '@/engine/catalog';
import {
  effectiveLoadForE1rm,
  externalLoadFromE1rm,
  EPLEY_K,
  measurementIsReliable,
  roundToIncrement,
  targetLoad,
} from '@/engine/prescription';
import { aggregateE1rmWeighted } from '@/engine/feedback';
import type { FeedbackRow } from '@/db/schema';

// =============================================================================
// Formats d'affichage UI
// =============================================================================

/**
 * Formate un temps de repos en secondes vers une chaîne lisible :
 * - < 60 s   → `45 s`
 * - 60 s     → `1 min`
 * - multiple → `2 min`
 * - sinon    → `1 min 30 s`
 */
export function formatRest(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

// =============================================================================
// État local UI : saisie set par set
// =============================================================================

export interface SetEntry {
  /**
   * `null` = champ vidé par l'utilisateur (input vide affiché tel quel).
   * Permet d'éviter le default à 0 qui force des "07"/"08" quand on reprend
   * la saisie (Conv #11e). La coche est bloquée tant que c'est `null`.
   *
   * En mode calibration (1re séance d'un exo), `reps` est `null` dès l'init
   * pour ne pas biaiser le user — il doit aller chercher un vrai effort.
   */
  readonly reps: number | null;
  /** Idem `reps` : `null` = champ vidé. 0 reste une valeur valide (poids du corps). */
  readonly load_kg: number | null;
  /**
   * `null` par défaut (Conv #16) : l'effort est une mesure subjective de
   * l'user, pas une prescription. On ne pré-remplit pas pour éviter le biais
   * d'ancrage. La cible RPE reste affichée à côté à titre indicatif.
   */
  readonly rpe: number | null;
  /** L'user a marqué cette série comme "faite" (= elle ira au feedback). */
  readonly done: boolean;
}

export type SessionEntries = ReadonlyArray<ReadonlyArray<SetEntry>>;

export interface InitEntriesOptions {
  /**
   * Ensemble des `exercise_id` à initialiser en mode calibration : `reps`
   * vide (sinon = cible programme), `load_kg` reste la prescription bootstrap.
   * En mode normal (hors de cet ensemble), `reps` est pré-remplie avec la
   * cible programme. Dans tous les cas, `rpe` est vide (cf. SetEntry.rpe).
   */
  readonly calibrationExoIds?: ReadonlySet<string> | null;
}

/**
 * Initialise la matrice d'entrées (par exo, par set) à partir des consignes du
 * `SessionPlan`. `done = false` par défaut — l'user "valide" ses séries au fur
 * et à mesure.
 */
export function initEntries(
  plan: SessionPlan,
  options: InitEntriesOptions = {},
): SessionEntries {
  const calib = options.calibrationExoIds ?? null;
  return plan.items.map((item) => {
    const isCalibration = calib !== null && calib.has(item.exercise_id);
    return item.sets.map((s) => ({
      reps: isCalibration ? null : s.reps,
      load_kg: s.load_kg,
      rpe: null,
      done: false,
    }));
  });
}

export function updateSetEntry(
  entries: SessionEntries,
  itemIdx: number,
  setIdx: number,
  patch: Partial<SetEntry>,
): SessionEntries {
  return entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s));
  });
}

/**
 * Calcule le plafond "live" d'un exo en cours de séance, par moyenne pondérée
 * de toutes les séries fiables déjà cochées. Cohérent avec l'algo fin-de-séance
 * (`updateE1rmForExercise`) — pas de filtre EMA ici car la baseline (bootstrap
 * heuristique) n'est pas une vraie mesure.
 *
 * `null` si aucune série cochée fiable / si rpe ou reps absents.
 */
export function computeLiveE1rmFromEntries(
  exercise: Exercise,
  bodyweightKg: number,
  entries: ReadonlyArray<SetEntry>,
): number | null {
  const reliable = entries.flatMap((e) => {
    if (!e.done) return [];
    if (e.reps === null || e.reps <= 0) return [];
    if (e.load_kg === null) return [];
    if (e.rpe === null) return [];
    if (!measurementIsReliable(e.reps, e.rpe)) return [];
    return [{ load_kg: e.load_kg, reps: e.reps, rpe: e.rpe }];
  });
  return aggregateE1rmWeighted(reliable, exercise, bodyweightKg);
}

/**
 * Est-ce que la dernière série cochée de cet exo était non fiable ? Sert à
 * afficher un message correctif dans le bandeau de calibration.
 */
export function lastCheckedSetIsUnreliable(entries: ReadonlyArray<SetEntry>): {
  reps: number;
  rpe: number;
  load_kg: number;
} | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (!e.done) continue;
    if (e.reps === null || e.rpe === null || e.load_kg === null) return null;
    if (!measurementIsReliable(e.reps, e.rpe)) {
      return { reps: e.reps, rpe: e.rpe, load_kg: e.load_kg };
    }
    return null;
  }
  return null;
}

/**
 * Quand la dernière série est non fiable (trop facile : n_équiv > 15), propose
 * une charge plus adaptée pour la série suivante : on extrapole un plafond à
 * partir de la série non fiable, puis on cible ~80 % de ce plafond pour la
 * prochaine tentative — censé tomber à ~5 reps avec un vrai effort.
 *
 * Retourne `null` si extrapolation impossible.
 */
export function suggestNextLoadAfterUnreliable(args: {
  exercise: Exercise;
  bodyweightKg: number;
  reps: number;
  rpe: number;
  load_kg: number;
}): number | null {
  const { exercise, bodyweightKg, reps, rpe, load_kg } = args;
  if (reps <= 0 || load_kg < 0) return null;
  // Extrapole un plafond approximatif depuis cette série (même formule Epley
  // que e1rmObserved, mais accepté quel que soit n_équiv puisqu'on n'a que ça).
  const totalLoad = effectiveLoadForE1rm(load_kg, exercise, bodyweightKg);
  if (totalLoad <= 0) return null;
  const extrapolatedE1rm = totalLoad * (1 + EPLEY_K * (reps + (10 - rpe)));
  // Cible : ~5 reps à RPE 7.5 → bonne calibration.
  const targetTotal = targetLoad(extrapolatedE1rm, 5, 7.5);
  const extLoad = externalLoadFromE1rm(targetTotal, exercise, bodyweightKg);
  const inc = exercise.inc_kg > 0 ? exercise.inc_kg : 1.25;
  const rounded = roundToIncrement(extLoad, inc);
  return rounded > 0 ? rounded : null;
}

/**
 * Conv #15 vague 2, refondu Conv #16 — Recalibrage continu en cours de séance.
 *
 * **Périmètre** : appelé uniquement pour les exos en mode calibration (= pas
 * encore de snapshot e1RM en base, donc 1re séance de cet exo). Le caller
 * (SessionRunner) gate l'appel par `confidence !== 'measured'`.
 *
 * Quand l'utilisateur valide une série fiable (`done=true` ET reps/rpe dans
 * la plage utilisable par Epley), on calcule l'e1RM observé live via moyenne
 * pondérée des séries fiables déjà validées (cf. `computeLiveE1rmFromEntries`,
 * cohérent avec `updateE1rmForExercise` fin de séance) et on ajuste les
 * charges des séries non-cochées du même exo proportionnellement.
 *
 * On en profite aussi pour pré-remplir les `reps` des séries non-cochées
 * encore vides avec la cible programme du plan — une fois qu'une 1re série
 * fiable a posé un repère, on bascule en flow normal pour la suite.
 *
 * Garde-fous :
 *  - Seuil de variation 5 % : on ne touche pas les charges pour des micro-écarts.
 *  - On n'écrase que les `load_kg` encore identiques à la prescription
 *    originale du plan (heuristique "non touché par l'user").
 *  - Arrondi sur `inc_kg` de l'exo (paliers réels de la machine/barre).
 *  - Aucune mutation : retourne une nouvelle `SessionEntries`.
 */
export function recalibrateUpcomingSets(args: {
  entries: SessionEntries;
  plan: SessionPlan;
  catalog: Catalog;
  bodyweightKg: number;
  e1rmInitial: Record<string, number>;
  itemIdx: number;
}): SessionEntries {
  const { entries, plan, catalog, bodyweightKg, e1rmInitial, itemIdx } = args;
  const item = plan.items[itemIdx];
  if (item === undefined) return entries;
  if (!catalog.has(item.exercise_id)) return entries;
  const exo = catalog.get(item.exercise_id);
  const e1rmStart = e1rmInitial[item.exercise_id];
  if (e1rmStart === undefined || e1rmStart <= 0) return entries;

  const exoEntries = entries[itemIdx] ?? [];
  const liveE1rm = computeLiveE1rmFromEntries(exo, bodyweightKg, exoEntries);
  if (liveE1rm === null) return entries;

  const ratio = liveE1rm / e1rmStart;
  const significant = Math.abs(ratio - 1) >= 0.05;

  const inc = exo.inc_kg > 0 ? exo.inc_kg : 1.25;
  return entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => {
      if (s.done) return s;
      const planLoad = item.sets[j]?.load_kg ?? null;
      const planReps = item.sets[j]?.reps ?? null;

      let nextLoad = s.load_kg;
      if (significant && planLoad !== null && s.load_kg === planLoad) {
        const adjusted = Math.max(
          0,
          Math.round((planLoad * ratio) / inc) * inc,
        );
        if (adjusted !== planLoad) nextLoad = adjusted;
      }
      // Pré-remplissage reps : on n'écrit que sur les séries où l'user n'a
      // pas encore touché (reps null).
      const nextReps = s.reps === null && planReps !== null ? planReps : s.reps;

      if (nextLoad === s.load_kg && nextReps === s.reps) return s;
      return { ...s, load_kg: nextLoad, reps: nextReps };
    });
  });
}

/** Nombre de séries marquées "done", tous exos confondus. */
export function countDoneSets(entries: SessionEntries): number {
  let n = 0;
  for (const sets of entries) for (const s of sets) if (s.done) n++;
  return n;
}

/** Nombre total de séries planifiées. */
export function countPlannedSets(entries: SessionEntries): number {
  return entries.reduce((acc, sets) => acc + sets.length, 0);
}

// =============================================================================
// Construction du SessionFeedback à envoyer au moteur
// =============================================================================

/**
 * Construit le `SessionFeedback` à passer à `recordFeedbackAndCommit`.
 *
 * Ne garde que les séries marquées `done`. Si une série a 0 reps elle est
 * exclue (équivaut à un "skip"). Au moins 1 set doit être présent pour que
 * le feedback ait un sens — sinon retourne `null`.
 */
export function buildSessionFeedback(
  plan: SessionPlan,
  entries: SessionEntries,
): SessionFeedback | null {
  const sets: SetFeedback[] = [];
  plan.items.forEach((item, i) => {
    const entry = entries[i];
    if (entry === undefined) return;
    for (const s of entry) {
      if (!s.done) continue;
      if (s.reps === null || s.reps <= 0) continue;
      if (s.load_kg === null) continue;
      if (s.rpe === null) continue;
      sets.push({
        exercise_id: item.exercise_id,
        reps_done: s.reps,
        load_kg: s.load_kg,
        rpe_perceived: s.rpe,
      });
    }
  });
  if (sets.length === 0) return null;
  return {
    seance_date: plan.seance_date,
    week_in_cycle: plan.week_in_cycle,
    cycle_index: plan.cycle_index,
    rpe_target: plan.rpe_target,
    sets,
    label: plan.label,
  };
}

// =============================================================================
// Bilan fin de séance
// =============================================================================

export interface SessionSummaryData {
  readonly volumeKgToday: number;
  readonly volumeKgLastSameLabel: number | null;
  readonly volumeDeltaPct: number | null;
  /** Liste des exos avec une augmentation d'e1RM (sur ce feedback). */
  readonly prs: ReadonlyArray<{ exerciseId: string; deltaKg: number }>;
  /**
   * Conv #21 — Évolution complète des plafonds touchés par la séance (tous
   * les exos avec une mesure fiable, pas seulement les PR). Pour chaque exo
   * on a l'ancien plafond (`null` = première calibration), le nouveau, et
   * le delta. Affiché en bilan séance pour rendre visible le résultat brut
   * du recalibrage : avant on ne voyait que les hausses ≥ +0.05 kg.
   */
  readonly plafondChanges: ReadonlyArray<PlafondChange>;
}

export interface PlafondChange {
  readonly exerciseId: string;
  /** `null` si c'était la première calibration de l'exo (rien avant). */
  readonly oldE: number | null;
  readonly newE: number;
  /** `null` si première calibration ; sinon `newE - oldE` (peut être négatif). */
  readonly deltaKg: number | null;
}

/**
 * Volume = Σ reps × load_kg sur tous les sets d'une séance.
 */
export function computeSessionVolume(feedback: SessionFeedback): number {
  let v = 0;
  for (const s of feedback.sets) {
    v += s.reps_done * s.load_kg;
  }
  return v;
}

/** Volume cumulé sur une `FeedbackRow`. */
export function feedbackRowVolume(row: FeedbackRow): number {
  return computeSessionVolume(row.feedback);
}

/**
 * Calcule le bilan post-feedback :
 *  - volume du jour
 *  - volume de la même séance (`label`) la semaine précédente, si dispo
 *  - PR du jour = exos pour lesquels `summary[exId]` retourne un delta > 0
 */
export function computeSessionSummary(
  feedback: SessionFeedback,
  summary: RecordFeedbackResult,
  previousFeedbacks: ReadonlyArray<FeedbackRow>,
  previouslyCalibratedExoIds: ReadonlySet<string> = new Set(),
): SessionSummaryData {
  const volumeKgToday = computeSessionVolume(feedback);

  // Cherche la séance la plus récente avec le même label, dans une semaine
  // strictement antérieure (même cycle ou cycle précédent).
  const candidates = previousFeedbacks
    .filter(
      (r) =>
        r.feedback.label === feedback.label &&
        (r.cycle_index < feedback.cycle_index ||
          (r.cycle_index === feedback.cycle_index &&
            r.week_in_cycle < feedback.week_in_cycle)),
    )
    .sort((a, b) =>
      b.cycle_index - a.cycle_index !== 0
        ? b.cycle_index - a.cycle_index
        : b.week_in_cycle - a.week_in_cycle,
    );
  const previous = candidates[0] ?? null;
  const volumeKgLastSameLabel = previous === null ? null : feedbackRowVolume(previous);
  const volumeDeltaPct =
    volumeKgLastSameLabel === null || volumeKgLastSameLabel === 0
      ? null
      : ((volumeKgToday - volumeKgLastSameLabel) / volumeKgLastSameLabel) * 100;

  const prs: Array<{ exerciseId: string; deltaKg: number }> = [];
  const plafondChanges: PlafondChange[] = [];
  for (const [exId, tuple] of Object.entries(summary)) {
    if (tuple === null) continue;
    const [oldE, newE] = tuple;
    const wasCalibrated = previouslyCalibratedExoIds.has(exId);
    plafondChanges.push({
      exerciseId: exId,
      oldE: wasCalibrated ? oldE : null,
      newE,
      deltaKg: wasCalibrated ? newE - oldE : null,
    });
    if (wasCalibrated && newE - oldE > 0.05) {
      prs.push({ exerciseId: exId, deltaKg: newE - oldE });
    }
  }
  prs.sort((a, b) => b.deltaKg - a.deltaKg);
  // Tri du nouveau bloc : premières calibrations en tête (event saillant),
  // puis évolutions par |delta| décroissant.
  plafondChanges.sort((a, b) => {
    const aFirst = a.oldE === null ? 1 : 0;
    const bFirst = b.oldE === null ? 1 : 0;
    if (aFirst !== bFirst) return bFirst - aFirst;
    return Math.abs(b.deltaKg ?? 0) - Math.abs(a.deltaKg ?? 0);
  });

  return {
    volumeKgToday,
    volumeKgLastSameLabel,
    volumeDeltaPct,
    prs,
    plafondChanges,
  };
}

// =============================================================================
// Sélection du prochain DayTemplate suggéré (État A)
// =============================================================================

export interface DayCandidate {
  readonly dayIndex: number;
  readonly label: string;
  /** `null` si jamais fait dans la semaine en cours. */
  readonly doneCountThisWeek: number;
}

/**
 * Liste les `DayTemplate` avec le nombre de fois où ils ont été faits cette
 * semaine du cycle courant. Permet d'afficher "Push (fait)" si pertinent.
 */
export function listDayCandidates(
  plan: { days: ReadonlyArray<{ label: string }> },
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'week_in_cycle' | 'feedback'>>,
  cycleIndex: number,
  weekInCycle: number,
): DayCandidate[] {
  return plan.days.map((d, i) => ({
    dayIndex: i,
    label: d.label,
    doneCountThisWeek: feedbacks.filter(
      (f) =>
        f.cycle_index === cycleIndex &&
        f.week_in_cycle === weekInCycle &&
        f.feedback.label === d.label,
    ).length,
  }));
}
