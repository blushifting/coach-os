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
  UserState,
} from '@/engine/models';
import type { Catalog } from '@/engine/catalog';
import {
  effectiveLoadForE1rm,
  externalLoadFromE1rm,
  EPLEY_K,
  roundToIncrement,
  targetLoad,
} from '@/engine/prescription';
import { aggregateE1rmWeighted, RPE_RESERVE_FLOOR } from '@/engine/feedback';
import { effectiveVolumeBounds } from '@/engine/volume';
import {
  buildMusclesOf,
  classifyVolume,
  sumMuscleSets,
  type CoverageStatus,
} from '@/lib/progress';
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
  // Bloc B1 — pas de « s » après les secondes en format composite : « 1 min 30 »
  // est déjà clair et le « s » orphelin passait à la ligne. Le « s » reste sur
  // le format secondes seules (« 45 s ») où il lève l'ambiguïté.
  return `${m} min ${s}`;
}

// =============================================================================
// État local UI : saisie set par set
// =============================================================================

/**
 * Bloc I (Conv #34) — réserve présélectionnée par défaut à **« 4+ »** (RPE 6, le
 * plancher de l'échelle). Chaque série démarre « facile » et l'utilisateur ne
 * fait que glisser vers plus d'effort — plus motivant et plus rapide que de
 * partir d'un état vide qu'il fallait toucher pour valider. Remplace l'ancien
 * `rpe = null` (Conv #16, biais d'ancrage) : la réserve n'étant pas une mesure
 * de précision comme la charge, un défaut assumé sert mieux l'UX.
 */
export const DEFAULT_RPE = 6;

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
   * Réserve perçue (RPE interne). Bloc I (Conv #34) — présélectionnée à
   * `DEFAULT_RPE` (« 4+ ») à l'init, plus `null`. Reste `number | null` pour
   * tolérer d'anciennes séances persistées et le vidage explicite.
   */
  readonly rpe: number | null;
  /** L'user a marqué cette série comme "faite" (= elle ira au feedback). */
  readonly done: boolean;
  /**
   * 1.17 (D9) — `true` quand la `load_kg` courante a été posée par le
   * recalibrage intra-séance (algo), pas par l'user. Permet à un recalibrage
   * ultérieur (ex. après décoche/recoche corrigée d'une série) de re-piloter
   * cette charge, alors que l'heuristique « load == prescription » la voyait
   * comme « touchée par l'user » dès le 1er ajustement et la figeait. Une
   * édition manuelle de la charge (via le stepper) repasse ce flag à `false`.
   */
  readonly loadAuto?: boolean;
}

export type SessionEntries = ReadonlyArray<ReadonlyArray<SetEntry>>;

export interface InitEntriesOptions {
  /**
   * Ensemble des `exercise_id` à initialiser en mode calibration : `reps`
   * vide (sinon = cible programme), `load_kg` reste la prescription bootstrap.
   * En mode normal (hors de cet ensemble), `reps` est pré-remplie avec la
   * cible programme. Dans tous les cas, `rpe` démarre à `DEFAULT_RPE` (« 4+ »,
   * cf. SetEntry.rpe).
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
      rpe: DEFAULT_RPE,
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
  // 1.17 (D9) — une édition explicite de la charge (sans flag explicite) est
  // forcément le fait de l'user → on coupe le pilotage algo de cette série.
  const effectivePatch =
    'load_kg' in patch && !('loadAuto' in patch)
      ? { ...patch, loadAuto: false }
      : patch;
  return entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => (j === setIdx ? { ...s, ...effectivePatch } : s));
  });
}

/**
 * Calcule le plafond "live" d'un exo en cours de séance, par moyenne pondérée
 * des séries cochées (Epley étendu, cohérent avec `updateE1rmForExercise` — pas
 * de filtre EMA ici car la baseline bootstrap n'est pas une vraie mesure).
 *
 * Bloc R — par défaut on prend TOUTES les séries valides (sert au recalibrage
 * intra-séance, qui doit aussi propager depuis une série lourde faite en 4+).
 * `informativeOnly` ne garde que les séries à effort réel (RPE > 4+) → sert au
 * bandeau « Plafond appris » pour ne pas l'afficher depuis une séance trop facile.
 *
 * `null` si aucune série exploitable.
 */
export function computeLiveE1rmFromEntries(
  exercise: Exercise,
  bodyweightKg: number,
  entries: ReadonlyArray<SetEntry>,
  options: { informativeOnly?: boolean } = {},
): number | null {
  const sets = entries.flatMap((e) => {
    if (!e.done) return [];
    if (e.reps === null || e.reps <= 0) return [];
    if (e.load_kg === null) return [];
    if (e.rpe === null) return [];
    if (options.informativeOnly && e.rpe <= RPE_RESERVE_FLOOR) return [];
    return [{ load_kg: e.load_kg, reps: e.reps, rpe: e.rpe }];
  });
  return aggregateE1rmWeighted(sets, exercise, bodyweightKg);
}

/**
 * La dernière série cochée était-elle « trop facile » (réserve 4+, RPE ≤ plancher) ?
 * Sert à afficher un message correctif + une charge suggérée plus lourde dans le
 * bandeau de calibration (Bloc R — critère 4+, cf. Conv #34).
 */
export function lastCheckedSetTooEasy(entries: ReadonlyArray<SetEntry>): {
  reps: number;
  rpe: number;
  load_kg: number;
} | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (!e.done) continue;
    if (e.reps === null || e.rpe === null || e.load_kg === null) return null;
    if (e.rpe <= RPE_RESERVE_FLOOR) {
      return { reps: e.reps, rpe: e.rpe, load_kg: e.load_kg };
    }
    return null;
  }
  return null;
}

/**
 * Quand la dernière série est « trop facile » (réserve 4+), propose une charge
 * plus lourde pour la suivante : on extrapole un plafond depuis la série puis on
 * cible ~5 reps à RPE 7,5 (un vrai effort). Retourne `null` si impossible.
 */
export function suggestNextLoadAfterTooEasy(args: {
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
 * Conv #15 vague 2, refondu Conv #16, corrigé chantier E — recalibrage continu
 * des exos EN CALIBRATION en cours de séance (le bootstrap est souvent très faux).
 *
 * **Périmètre** : appelé uniquement pour les exos en mode calibration (= pas
 * encore de snapshot e1RM en base, donc 1re séance de cet exo). Le caller
 * (SessionRunner) gate l'appel par `confidence !== 'measured'`.
 *
 * Dès qu'une série cochée fournit un e1RM live (`computeLiveE1rmFromEntries`,
 * moyenne pondérée des séries fiables — cohérent avec `updateE1rmForExercise`),
 * on RE-DÉRIVE la charge de chaque série suivante encore pilotée par l'algo,
 * exactement comme `buildPrescription` : `targetLoad(e1rm, reps, rpe)` décline le
 * plafond estimé au % de 1RM visé (reps + RPE cibles DE CHAQUE série du plan),
 * `externalLoadFromE1rm` retire le poids du corps, puis arrondi au cran de l'exo.
 *
 * Contrairement à l'ancienne version (`charge_d'origine × e1RM_live/e1RM_bootstrap`),
 * ça ne dépend d'AUCUNE baseline : ça se déclenche à chaque série informative,
 * dans les deux sens (bootstrap trop bas → on monte ; trop haut → on descend) —
 * fin du « gel de calibration » (une série bien plus lourde qui ne bougeait rien)
 * et des valeurs bâtardes issues du ratio.
 *
 * On pré-remplit aussi les `reps` des séries non-cochées encore vides avec la
 * cible du plan.
 *
 * Garde-fous :
 *  - On ne re-pilote qu'une série encore « algo » : charge = prescription
 *    d'origine OU déjà posée par un recalibrage (`loadAuto`). Une série ajustée
 *    à la main (`loadAuto:false`, charge ≠ prescription) est préservée.
 *  - Séries déjà cochées (`done`) intactes.
 *  - Aucune mutation : retourne une nouvelle `SessionEntries`.
 */
export function recalibrateUpcomingSets(args: {
  entries: SessionEntries;
  plan: SessionPlan;
  catalog: Catalog;
  bodyweightKg: number;
  itemIdx: number;
}): SessionEntries {
  const { entries, plan, catalog, bodyweightKg, itemIdx } = args;
  const item = plan.items[itemIdx];
  if (item === undefined) return entries;
  if (!catalog.has(item.exercise_id)) return entries;
  const exo = catalog.get(item.exercise_id);

  const exoEntries = entries[itemIdx] ?? [];
  const liveE1rm = computeLiveE1rmFromEntries(exo, bodyweightKg, exoEntries);
  if (liveE1rm === null || liveE1rm <= 0) return entries;

  const inc = exo.inc_kg > 0 ? exo.inc_kg : 1.25;
  return entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => {
      if (s.done) return s;
      const planSet = item.sets[j];
      const planLoad = planSet?.load_kg ?? null;
      const planReps = planSet?.reps ?? null;
      const planRpe = planSet?.rpe_target ?? null;

      // On ne re-pilote qu'une série encore « algo » : charge = prescription
      // d'origine OU déjà posée par un recalibrage (`loadAuto`). Une série
      // ajustée à la main par l'user est préservée. La cible est TOUJOURS
      // re-dérivée du e1RM live (jamais depuis la charge ajustée précédente).
      let nextLoad = s.load_kg;
      let nextLoadAuto = s.loadAuto ?? false;
      const algoOwned = s.load_kg === planLoad || s.loadAuto === true;
      if (
        algoOwned &&
        planReps !== null &&
        planReps > 0 &&
        planRpe !== null &&
        planRpe >= 0.5 &&
        planRpe <= 10
      ) {
        const totalLoad = targetLoad(liveE1rm, planReps, planRpe);
        const target = roundToIncrement(
          externalLoadFromE1rm(totalLoad, exo, bodyweightKg),
          inc,
        );
        if (target !== s.load_kg) {
          nextLoad = target;
          nextLoadAuto = true;
        }
      }
      // Pré-remplissage reps : on n'écrit que sur les séries encore vides.
      const nextReps = s.reps === null && planReps !== null ? planReps : s.reps;

      if (
        nextLoad === s.load_kg &&
        nextReps === s.reps &&
        nextLoadAuto === (s.loadAuto ?? false)
      ) {
        return s;
      }
      return { ...s, load_kg: nextLoad, reps: nextReps, loadAuto: nextLoadAuto };
    });
  });
}

/**
 * Bloc S (Conv #45) — report de charge sur les séries suivantes.
 *
 * Hors calibration : quand l'utilisateur valide une série dont il a **modifié**
 * la charge (≠ prescription du plan), on reporte cette charge sur les séries
 * **suivantes non cochées** du même exo — pour coller au pas réel de la machine
 * ou à l'ajustement qu'il vient de faire, sans qu'il ait à le ressaisir série
 * par série. Déclenché à CHAQUE validation de série (choix Azur).
 *
 * Garde-fous (même heuristique `algoOwned` que `recalibrateUpcomingSets`) :
 *  - No-op si la charge validée est `null` ou égale à la prescription (= non
 *    modifiée) → on ne touche à rien.
 *  - On n'écrase qu'une série suivante encore « pilotée par l'algo » : sa charge
 *    vaut encore sa prescription d'origine, OU elle a déjà été posée par un
 *    report (`loadAuto`). Une série que l'user a ajustée lui-même
 *    (`loadAuto:false`, charge ≠ prescription) est PRÉSERVÉE.
 *  - Les séries déjà cochées (`done`) ne bougent pas.
 *  - Aucune mutation : retourne `entries` inchangé si rien n'est à reporter.
 */
export function propagateLoadToUpcomingSets(args: {
  entries: SessionEntries;
  plan: SessionPlan;
  itemIdx: number;
  fromSetIdx: number;
}): SessionEntries {
  const { entries, plan, itemIdx, fromSetIdx } = args;
  const item = plan.items[itemIdx];
  if (item === undefined) return entries;
  const src = (entries[itemIdx] ?? [])[fromSetIdx];
  if (src === undefined) return entries;
  const srcLoad = src.load_kg;
  const planLoad = item.sets[fromSetIdx]?.load_kg ?? null;
  // Charge non modifiée par l'user → rien à reporter.
  if (srcLoad === null || srcLoad === planLoad) return entries;

  let changed = false;
  const next = entries.map((sets, i) => {
    if (i !== itemIdx) return sets;
    return sets.map((s, j) => {
      if (j <= fromSetIdx || s.done) return s;
      const sPlanLoad = item.sets[j]?.load_kg ?? null;
      const algoOwned = s.load_kg === sPlanLoad || s.loadAuto === true;
      if (!algoOwned) return s;
      if (s.load_kg === srcLoad && s.loadAuto === true) return s;
      changed = true;
      return { ...s, load_kg: srcLoad, loadAuto: true };
    });
  });
  return changed ? next : entries;
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
    custom_name: plan.custom_name ?? null,
  };
}

// =============================================================================
// Bilan fin de séance
// =============================================================================

export interface SessionMuscleVolume {
  readonly muscle: string;
  /** Séries pondérées apportées par CETTE séance. */
  readonly sessionSets: number;
  /** Séries pondérées cumulées cette semaine de programme (séance incluse). */
  readonly weekTotal: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly status: CoverageStatus;
}

export interface SessionSummaryData {
  /** Nombre total de séries effectuées dans la séance. */
  readonly setsCount: number;
  /** Nombre d'exercices distincts de la séance. */
  readonly exerciseCount: number;
  /**
   * #13 (E-3) — volume par muscle travaillé ce jour, rapporté à la cible hebdo.
   * Remplace le tonnage kg (non fiable). Trié par contribution décroissante.
   */
  readonly muscleVolume: ReadonlyArray<SessionMuscleVolume>;
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
 * Volume = Σ reps × charge TOTALE sur tous les sets d'une séance. Chantier C
 * (plan 11) — la charge totale inclut le poids du corps pour les exos
 * bodyweight (`effectiveLoadForE1rm`), cohérente avec le Plafond affiché
 * ailleurs. Fallback `load_kg` brut si l'exo n'est plus dans le catalog
 * (exo custom supprimé).
 */
export function computeSessionVolume(
  feedback: SessionFeedback,
  catalog: Catalog,
  bodyweightKg: number,
): number {
  let v = 0;
  for (const s of feedback.sets) {
    const totalLoad = catalog.has(s.exercise_id)
      ? effectiveLoadForE1rm(s.load_kg, catalog.get(s.exercise_id), bodyweightKg)
      : s.load_kg;
    v += s.reps_done * totalLoad;
  }
  return v;
}

/** Volume cumulé sur une `FeedbackRow`. */
export function feedbackRowVolume(
  row: FeedbackRow,
  catalog: Catalog,
  bodyweightKg: number,
): number {
  return computeSessionVolume(row.feedback, catalog, bodyweightKg);
}

/**
 * Calcule le bilan post-feedback (#13, E-3) :
 *  - nombre de séries effectuées + exos distincts ;
 *  - volume par muscle travaillé, rapporté à la cible hebdo (contribution de la
 *    séance + total de la semaine de programme vs V_min–V_max) ;
 *  - évolution des plafonds mesurés (MAJ définitives).
 *
 * Le total hebdo regroupe par SEMAINE DE PROGRAMME via (cycle, semaine) —
 * plus robuste qu'un calcul de dates, et aligné sur le calendrier.
 */
export function computeSessionSummary(
  feedback: SessionFeedback,
  summary: RecordFeedbackResult,
  previousFeedbacks: ReadonlyArray<FeedbackRow>,
  catalog: Catalog,
  state: UserState,
  previouslyCalibratedExoIds: ReadonlySet<string> = new Set(),
): SessionSummaryData {
  const setsCount = feedback.sets.length;
  const exerciseCount = new Set(feedback.sets.map((s) => s.exercise_id)).size;

  const musclesOf = buildMusclesOf(catalog);
  const sessionByMuscle = sumMuscleSets([feedback], musclesOf);
  const weekPrior = previousFeedbacks
    .filter(
      (r) =>
        r.cycle_index === feedback.cycle_index &&
        r.week_in_cycle === feedback.week_in_cycle,
    )
    .map((r) => r.feedback);
  const weekByMuscle = sumMuscleSets([...weekPrior, feedback], musclesOf);
  const muscleVolume: SessionMuscleVolume[] = Object.keys(sessionByMuscle)
    .map((muscle) => {
      const [vMin, vMax] = effectiveVolumeBounds(state, muscle);
      const weekTotal = weekByMuscle[muscle] ?? 0;
      return {
        muscle,
        sessionSets: sessionByMuscle[muscle] ?? 0,
        weekTotal,
        vMin,
        vMax,
        status: classifyVolume(weekTotal, vMin, vMax),
      };
    })
    .sort((a, b) => b.sessionSets - a.sessionSets);

  const plafondChanges: PlafondChange[] = [];
  for (const [exId, update] of Object.entries(summary)) {
    // Bloc R — on ignore les MAJ provisoires (séance tout-4+) : pas de plafond
    // « mesuré » à afficher (l'état vide « aucune série assez intense » suffit).
    if (update === null || !update.definitive) continue;
    const { old: oldE, next: newE } = update;
    const wasCalibrated = previouslyCalibratedExoIds.has(exId);
    plafondChanges.push({
      exerciseId: exId,
      oldE: wasCalibrated ? oldE : null,
      newE,
      deltaKg: wasCalibrated ? newE - oldE : null,
    });
  }
  // Tri : premières calibrations en tête (event saillant), puis évolutions par
  // |delta| décroissant.
  plafondChanges.sort((a, b) => {
    const aFirst = a.oldE === null ? 1 : 0;
    const bFirst = b.oldE === null ? 1 : 0;
    if (aFirst !== bFirst) return bFirst - aFirst;
    return Math.abs(b.deltaKg ?? 0) - Math.abs(a.deltaKg ?? 0);
  });

  return { setsCount, exerciseCount, muscleVolume, plafondChanges };
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
