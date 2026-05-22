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
  SessionFeedback,
  SessionPlan,
  SetFeedback,
} from '@/engine/models';
import type { Catalog } from '@/engine/catalog';
import {
  e1rmObserved,
  effectiveLoadForE1rm,
  measurementIsReliable,
} from '@/engine/prescription';
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
   */
  readonly reps: number | null;
  /** Idem `reps` : `null` = champ vidé. 0 reste une valeur valide (poids du corps). */
  readonly load_kg: number | null;
  readonly rpe: number;
  /** L'user a marqué cette série comme "faite" (= elle ira au feedback). */
  readonly done: boolean;
}

export type SessionEntries = ReadonlyArray<ReadonlyArray<SetEntry>>;

/**
 * Initialise la matrice d'entrées (par exo, par set) à partir des consignes du
 * `SessionPlan` : reps cibles, charge cible, RPE cible.
 * `done = false` par défaut — l'user "valide" ses séries au fur et à mesure.
 */
export function initEntries(plan: SessionPlan): SessionEntries {
  return plan.items.map((item) =>
    item.sets.map((s) => ({
      reps: s.reps,
      load_kg: s.load_kg,
      rpe: s.rpe_target,
      done: false,
    })),
  );
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
 * Conv #15 vague 2 — Recalibrage continu en cours de séance.
 *
 * Quand l'utilisateur valide une série fiable (`done=true` ET RPE / reps dans
 * la plage utilisable par Epley), on recalcule l'e1RM observé live (max sur
 * les séries déjà validées de cet exo) et on ajuste les charges des séries
 * non-cochées du même exo proportionnellement.
 *
 * Garde-fous :
 *  - Seuil de variation 5 % : on ne touche pas pour des micro-écarts.
 *  - On n'écrase que les `load_kg` encore identiques à la prescription
 *    originale du plan (heuristique "non touché par l'user"). Dès qu'un set
 *    a été ajusté (algo) ou modifié (user), on le respecte.
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
  let liveE1rm: number | null = null;
  for (const e of exoEntries) {
    if (!e.done) continue;
    if (e.reps === null || e.reps <= 0 || e.load_kg === null) continue;
    if (!measurementIsReliable(e.reps, e.rpe)) continue;
    try {
      const total = effectiveLoadForE1rm(e.load_kg, exo, bodyweightKg);
      const v = e1rmObserved(total, e.reps, e.rpe);
      if (liveE1rm === null || v > liveE1rm) liveE1rm = v;
    } catch {
      // RPE/reps hors plage Epley : ignore.
    }
  }
  if (liveE1rm === null) return entries;
  const ratio = liveE1rm / e1rmStart;
  if (Math.abs(ratio - 1) < 0.05) return entries;

  const inc = exo.inc_kg > 0 ? exo.inc_kg : 1.25;
  return entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => {
      if (s.done) return s;
      const planLoad = item.sets[j]?.load_kg ?? null;
      if (planLoad === null) return s;
      // Heuristique "non touché par user/algo" : on n'écrase que si la
      // valeur actuelle correspond exactement à la prescription d'origine.
      if (s.load_kg !== planLoad) return s;
      const adjusted = Math.max(0, Math.round((planLoad * ratio) / inc) * inc);
      if (adjusted === planLoad) return s;
      return { ...s, load_kg: adjusted };
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
  for (const [exId, tuple] of Object.entries(summary)) {
    if (tuple === null) continue;
    const [oldE, newE] = tuple;
    if (newE - oldE > 0.05) {
      prs.push({ exerciseId: exId, deltaKg: newE - oldE });
    }
  }
  prs.sort((a, b) => b.deltaKg - a.deltaKg);

  return { volumeKgToday, volumeKgLastSameLabel, volumeDeltaPct, prs };
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
