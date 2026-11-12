/**
 * Sélecteurs purs pour l'onglet Progrès (Conv #6a).
 *
 * Volume (dump 2.4, étape 3 — `recherche/13_ligne_directrice_2_4.md`) : un
 * seul repère par muscle selon son intention, une zone haute commune (20
 * séries pondérées par semaine), une échelle commune par écran, et le volume
 * d'un cycle semaine par semaine. Cycles : historique nommé par programme.
 * Force : courbes de Plafond.
 *
 * Tout est pur : aucune dépendance au store ni à la DB. Les composants UI
 * lisent l'état via les sélecteurs Zustand puis appellent ces fonctions.
 */

import type { Catalog } from '@/engine/catalog';
import type { CycleRow, E1rmSnapshotRow, FeedbackRow } from '@/db/schema';
import type {
  ChargeType,
  CycleReview,
  SessionFeedback,
  UserState,
} from '@/engine/models';
import { exercisePrimaires, MuscleIntention } from '@/engine/models';
import { migrateMuscleGoalList } from '@/engine/intentions';
import { VOLUME_HIGH_MARK, volumeMark } from '@/engine/volume';
import { CYCLE_WEEKS, weekOfCycle } from '@/engine/cycle-week';
import { recordDates } from '@/engine/feedback';
import {
  addDays,
  dateKey,
  DELOAD_WEEK_INDEX,
  parseDateKey,
  weekStartFor,
} from '@/lib/dashboard';

// =============================================================================
// Helpers communs
// =============================================================================

/**
 * Construit le mapping `exercise_id → { muscle: coef }` exploité par les
 * sélecteurs de volume. Équivalent du dict transmis à `countWeeklyVolume`.
 */
export function buildMusclesOf(
  catalog: Catalog,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const out: Record<string, Record<string, number>> = {};
  for (const ex of catalog.all()) {
    out[ex.id] = { ...ex.muscles };
  }
  return out;
}

/**
 * Sommes par muscle des coefficients sur un sous-ensemble de feedbacks.
 * Une série compte autant que `muscles[m]` (1.0 si primaire, 0.5 si synergiste).
 */
export function sumMuscleSets(
  feedbacks: readonly SessionFeedback[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fb of feedbacks) {
    for (const set of fb.sets) {
      const muscles = musclesOf[set.exercise_id] ?? {};
      for (const [m, c] of Object.entries(muscles)) {
        out[m] = (out[m] ?? 0) + c;
      }
    }
  }
  return out;
}

// =============================================================================
// 1. Volume hebdo d'un muscle : repère, zone haute, statut (dump 2.4, étape 3)
// =============================================================================

/**
 * Statut d'un volume hebdo (séries pondérées), dump 2.4 (D2, D7) :
 * - `non_travaille` : aucune série ;
 * - `sous_repere` : sous le repère de l'intention (seuil de croissance pour un
 *   muscle à développer, plancher d'entretien pour un muscle à entretenir) ;
 * - `ok` : du repère jusqu'à la zone haute ;
 * - `eleve` : au-delà de la zone haute (20 séries), pour tous les muscles. Un
 *   constat (« beau total, tu peux t'arrêter là »), jamais un frein ;
 * - `sans_objectif` : muscle sans objectif, sous la zone haute : on compte les
 *   séries, sans repère ni alerte.
 */
export type CoverageStatus =
  | 'non_travaille'
  | 'sous_repere'
  | 'ok'
  | 'eleve'
  | 'sans_objectif';

/** Les séries pondérées tombent sur des flottants (9,999…) : tolérance de lecture. */
const SETS_EPSILON = 0.05;

type VolumeState = Pick<UserState, 'volume_min' | 'muscle_goals'>;
type MusclesOf = Readonly<Record<string, Readonly<Record<string, number>>>>;

/**
 * Repère tel qu'affiché, arrondi au supérieur (conv #77) : le plancher
 * d'entretien des lombaires (2,4) se lit « 3 », et c'est 3 qui est testé — ce
 * qui est annoncé atteint l'est vraiment. Epsilon : 6,000000001 reste 6.
 */
export function displayMark(mark: number | null): number | null {
  return mark === null ? null : Math.ceil(mark - SETS_EPSILON);
}

/** Repère hebdo affiché de ce muscle (cf. `volumeMark`), `null` sans objectif. */
export function weeklyMark(state: VolumeState, muscle: string): number | null {
  return displayMark(volumeMark(state, muscle));
}

/** Classe un volume (séries pondérées) par rapport au repère et à la zone haute. */
export function classifyVolume(sets: number, mark: number | null): CoverageStatus {
  if (sets < SETS_EPSILON) return 'non_travaille';
  if (sets > VOLUME_HIGH_MARK + SETS_EPSILON) return 'eleve';
  if (mark === null) return 'sans_objectif';
  if (sets < mark - SETS_EPSILON) return 'sous_repere';
  return 'ok';
}

/**
 * Échelle commune des barres d'un écran (D7) : la zone haute (20 séries), qui
 * fait le bout de la barre, allongée seulement si un muscle la dépasse. Deux
 * barres d'un même écran se comparent donc à l'œil.
 */
export function volumeScale(values: Iterable<number>): number {
  let max = VOLUME_HIGH_MARK;
  for (const v of values) if (v > max) max = v;
  return max;
}

export interface MuscleCoverage {
  readonly muscle: string;
  readonly sets: number;
  /** Repère affiché (seuil ou plancher), `null` sans objectif. */
  readonly mark: number | null;
  readonly status: CoverageStatus;
}

/**
 * Volume par muscle de la semaine **du cycle** qui contient `now` (alignée sur
 * `cycleStart`, D6 ; semaine ISO s'il n'y a pas de cycle). Séances faites
 * uniquement. Tous les muscles connus, plus ceux qui ont été travaillés.
 */
export function computeCoverageThisWeek(
  state: VolumeState,
  feedbacks: readonly FeedbackRow[],
  musclesOf: MusclesOf,
  now: Date = new Date(),
  cycleStart: string | null = null,
): MuscleCoverage[] {
  const weekStart = dateKey(weekStartFor(now, cycleStart));
  const weekEnd = dateKey(addDays(parseDateKey(weekStart), 7));
  const inWeek = feedbacks.filter(
    (f) => f.seance_date >= weekStart && f.seance_date < weekEnd,
  );
  const counts = sumMuscleSets(
    inWeek.map((f) => f.feedback),
    musclesOf,
  );

  const muscles = new Set<string>([
    ...Object.keys(state.volume_min),
    ...Object.keys(counts),
  ]);

  const out: MuscleCoverage[] = [];
  for (const muscle of muscles) {
    const mark = weeklyMark(state, muscle);
    const sets = counts[muscle] ?? 0;
    out.push({ muscle, sets, mark, status: classifyVolume(sets, mark) });
  }
  out.sort((a, b) => a.muscle.localeCompare(b.muscle));
  return out;
}

export interface AddedVolumeOvershoot {
  readonly muscle: string;
  /** Séries pondérées projetées après ajout. */
  readonly projected: number;
}

/**
 * Conv #30, dump 2.4 étape 3 — muscles qu'un exercice ajouté (`addedSets`
 * séries) ferait passer **au-delà de la zone haute** (20 séries pondérées), pour
 * tous les muscles, avec ou sans objectif.
 *
 * `weeklyWeightedSets` = séries pondérées déjà engagées cette semaine, par
 * muscle. Sert à l'avertissement non bloquant « Volume élevé » à l'ajout d'un
 * exercice. Pur. Trié du plus chargé au moins chargé.
 */
export function addedVolumeOvershoot(
  exoMuscles: Readonly<Record<string, number>>,
  addedSets: number,
  weeklyWeightedSets: Readonly<Record<string, number>>,
): AddedVolumeOvershoot[] {
  const out: AddedVolumeOvershoot[] = [];
  for (const [muscle, coef] of Object.entries(exoMuscles)) {
    if (coef <= 0) continue;
    const projected = (weeklyWeightedSets[muscle] ?? 0) + addedSets * coef;
    if (projected > VOLUME_HIGH_MARK + SETS_EPSILON) {
      out.push({ muscle, projected });
    }
  }
  out.sort((a, b) => b.projected - a.projected);
  return out;
}

// =============================================================================
// 2. Volume d'un cycle, semaine par semaine (Progrès > Volume, bilan de cycle)
// =============================================================================

export interface CycleWeek {
  /** Numéro de la semaine dans le cycle (1, 2, …). */
  readonly week: number;
  /** Premier jour de la semaine, `YYYY-MM-DD`. */
  readonly start: string;
  /** Semaine de récupération prise (repère divisé par deux). */
  readonly recovery: boolean;
  /** Semaine déjà commencée (le cycle en cours a des semaines à venir). */
  readonly started: boolean;
}

export interface MuscleCycleVolume {
  readonly muscle: string;
  readonly intention: MuscleIntention | null;
  /** Rang d'un muscle à développer, `null` sinon. */
  readonly priorityRank: number | null;
  /** Séries pondérées de chaque semaine (index 0 = semaine 1). */
  readonly perWeek: readonly number[];
  /** Repère affiché de chaque semaine (moitié en récupération), `null` sans objectif. */
  readonly markPerWeek: readonly (number | null)[];
  /** Séries pondérées moyennes par semaine, sur les semaines comptées. */
  readonly average: number;
  /** Repère moyen sur ces mêmes semaines (une décimale), `null` sans objectif. */
  readonly averageMark: number | null;
  readonly averageStatus: CoverageStatus;
}

export interface CycleVolume {
  readonly cycleIndex: number;
  readonly weeks: readonly CycleWeek[];
  /** Numéros des semaines comptées dans la moyenne. */
  readonly countedWeeks: readonly number[];
  /** Tous les muscles connus, plus ceux travaillés sur le cycle (ordre alphabétique). */
  readonly muscles: readonly MuscleCycleVolume[];
}

export interface CycleVolumeInput {
  readonly cycleIndex: number;
  readonly startDate: string;
  /** Date de clôture, `null` pour le cycle en cours. */
  readonly endDate: string | null;
  /**
   * Récupération prise sur ce cycle : `true` / `false`, ou `null` si on ne le
   * sait pas (cycle clos avant la 2.3.2) ; la semaine 5 est alors laissée hors
   * de la moyenne, comme avant.
   */
  readonly recoveryTaken: boolean | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Dump 2.4, étape 3 (n° 13, 19) — volume d'un cycle semaine par semaine, et sa
 * moyenne comparée à un repère moyen.
 *
 * La moyenne compte les semaines écoulées du cycle (pour le cycle en cours :
 * les semaines terminées, ou la semaine en cours si aucune ne l'est). La semaine
 * de récupération prise y entre avec un repère divisé par deux, puisque le
 * générateur y divise les séries par deux. Qui fait toutes ses séances tombe
 * donc pile sur le repère moyen : seuil 10, quatre semaines à 10 et une
 * récupération à 5 → 45 séries sur 5 semaines, repère moyen 9.
 *
 * La semaine d'une séance se lit sur sa date (D6). Une séance faite après la
 * fin prévue du cycle tombe en semaine 6 et compte comme une semaine normale.
 */
export function computeCycleVolume(
  state: VolumeState,
  feedbacks: readonly FeedbackRow[],
  musclesOf: MusclesOf,
  cycle: CycleVolumeInput,
  today: string,
): CycleVolume {
  const inCycle = feedbacks.filter((f) => f.cycle_index === cycle.cycleIndex);
  const byWeek = new Map<number, SessionFeedback[]>();
  let lastWorkedWeek = 0;
  for (const f of inCycle) {
    const w = weekOfCycle(f.seance_date, cycle.startDate);
    const list = byWeek.get(w) ?? [];
    list.push(f.feedback);
    byWeek.set(w, list);
    lastWorkedWeek = Math.max(lastWorkedWeek, w);
  }

  const isCurrent = cycle.endDate === null;
  const reachedWeek = isCurrent
    ? weekOfCycle(today, cycle.startDate)
    : Math.min(CYCLE_WEEKS, weekOfCycle(cycle.endDate!, cycle.startDate));
  const lastWeek = Math.max(isCurrent ? CYCLE_WEEKS : 1, reachedWeek, lastWorkedWeek);

  const weeks: CycleWeek[] = [];
  for (let w = 1; w <= lastWeek; w++) {
    weeks.push({
      week: w,
      start: dateKey(addDays(parseDateKey(cycle.startDate), 7 * (w - 1))),
      recovery: w === DELOAD_WEEK_INDEX && cycle.recoveryTaken === true,
      started: w <= Math.max(reachedWeek, lastWorkedWeek),
    });
  }

  const elapsed = isCurrent
    ? Math.max(1, reachedWeek - 1)
    : Math.max(reachedWeek, lastWorkedWeek);
  const countedWeeks: number[] = [];
  for (let w = 1; w <= elapsed; w++) {
    if (w === DELOAD_WEEK_INDEX && cycle.recoveryTaken === null) continue;
    countedWeeks.push(w);
  }

  const sumsByWeek = weeks.map((wk) => sumMuscleSets(byWeek.get(wk.week) ?? [], musclesOf));
  const muscleSet = new Set<string>(Object.keys(state.volume_min));
  for (const sums of sumsByWeek) for (const m of Object.keys(sums)) muscleSet.add(m);

  const muscles: MuscleCycleVolume[] = [...muscleSet]
    .sort((a, b) => a.localeCompare(b))
    .map((muscle) => {
      const goal = state.muscle_goals[muscle];
      const mark = weeklyMark(state, muscle);
      const perWeek = sumsByWeek.map((sums) => sums[muscle] ?? 0);
      const markPerWeek = weeks.map((wk) =>
        mark === null ? null : wk.recovery ? mark / 2 : mark,
      );
      const n = Math.max(1, countedWeeks.length);
      const total = countedWeeks.reduce((acc, w) => acc + perWeek[w - 1]!, 0);
      const average = total / n;
      const averageMark =
        mark === null
          ? null
          : round1(countedWeeks.reduce((acc, w) => acc + markPerWeek[w - 1]!, 0) / n);
      return {
        muscle,
        intention: goal?.intention ?? null,
        priorityRank:
          goal?.intention === MuscleIntention.DEVELOPPER ? goal.priority_rank : null,
        perWeek,
        markPerWeek,
        average,
        averageMark,
        averageStatus: classifyVolume(average, averageMark),
      };
    });

  return { cycleIndex: cycle.cycleIndex, weeks, countedWeeks, muscles };
}

// =============================================================================
// 3. Historique des cycles
// =============================================================================

export interface CycleHistoryItem {
  readonly cycleIndex: number;
  readonly startDate: string;
  readonly endDate: string | null;
  /**
   * Assiduité du cycle, en fraction 0–1 (peut dépasser 1 : les séances libres
   * gonflent le numérateur, l'affichage plafonne).
   *
   * Conv #76 — remplace `volumeTotalKg` sur la carte de l'onglet Cycles. Le
   * tonnage avait été retiré du bilan de séance puis du bilan de cycle en E-3
   * (charge × reps × poids du corps : une séance plus légère mais plus dure
   * ressortait « en baisse ») ; il survivait ici seul. `volume_total_kg` reste
   * calculé et persisté dans `CycleReview`, il n'est simplement plus affiché.
   */
  readonly adherencePct: number;
  /** Top 3 progressions e1RM (exId, Δkg) du cycle, ordre décroissant. */
  readonly plafondsTop: ReadonlyArray<readonly [string, number]>;
  /** Δ d'assiduité vs cycle précédent, en POINTS de pourcentage. */
  readonly deltaAdherencePts: number | null;
  /** Δ progression moyenne des plafonds vs cycle précédent (kg), null si N/A. */
  readonly deltaTopPlafondKg: number | null;
  /**
   * Conv #14c-7 — comparaison "visé vs fait" par muscle prioritaire, dérivée
   * du snapshot des `muscle_goals` au moment du bilan et de la classification
   * `progresses/plateau/undertrained/overshoot`. `null` si le cycle n'a pas
   * été clôturé avec la nouvelle feature (rétrocompat).
   */
  readonly objectivesByMuscle: ReadonlyArray<MuscleIntentionOutcome> | null;
}

export type MuscleOutcomeStatus =
  | 'progressed'
  | 'plateau'
  | 'undertrained'
  | 'overshoot'
  | 'unknown';

export interface MuscleIntentionOutcome {
  readonly muscle: string;
  /** Intention du muscle à la clôture du cycle (ancien format migré). */
  readonly intention: MuscleIntention;
  /** Rang (1 = top) — trie les muscles à développer. */
  readonly priorityRank: number;
  /** Comment ce muscle a fini le cycle d'après la classification. */
  readonly outcome: MuscleOutcomeStatus;
}

/**
 * Construit l'historique lisible des cycles, du plus récent au plus ancien.
 * On ne garde que les cycles ayant `review` non-null (cycles terminés) — un
 * cycle en cours n'a pas encore de bilan à afficher.
 */
export function buildCycleHistory(
  cycles: readonly CycleRow[],
): CycleHistoryItem[] {
  // Tri chronologique ascendant (cycle_index = ordre naturel).
  const sorted = [...cycles].sort((a, b) => a.cycle_index - b.cycle_index);

  const items: CycleHistoryItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const review = c.review;
    if (review === null) continue;

    const plafondsAll = Object.entries(review.plafonds_progression);
    const plafondsTop = plafondsAll
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, d]) => [id, d] as const);

    // Δ vs cycle précédent (le précédent ayant aussi une review).
    let deltaAdherencePts: number | null = null;
    let deltaTopPlafondKg: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j]!;
      if (prev.review === null) continue;
      // Les deux termes sont plafonnés comme à l'affichage : sans ça, deux
      // cycles à 100 % pourraient afficher un écart dû aux séances libres.
      deltaAdherencePts =
        (Math.min(1, review.adherence_pct) -
          Math.min(1, prev.review.adherence_pct)) *
        100;
      const topNow = plafondsTop[0]?.[1] ?? 0;
      const prevTops = Object.values(prev.review.plafonds_progression).sort(
        (a, b) => b - a,
      );
      const topPrev = prevTops[0] ?? 0;
      deltaTopPlafondKg = topNow - topPrev;
      break;
    }

    const objectivesByMuscle = buildObjectivesByMuscle(review);

    items.push({
      cycleIndex: c.cycle_index,
      startDate: c.start_date,
      endDate: c.end_date,
      adherencePct: review.adherence_pct,
      plafondsTop,
      deltaAdherencePts,
      deltaTopPlafondKg,
      objectivesByMuscle,
    });
  }

  // Retour du plus récent au plus ancien pour l'UI.
  return items.reverse();
}

function buildObjectivesByMuscle(
  review: CycleReview,
): ReadonlyArray<MuscleIntentionOutcome> | null {
  // Dump 2.4 — les cycles clos avant la 2.4 portent l'ancien format.
  const snapshot = migrateMuscleGoalList(review.muscle_goals_snapshot ?? []);
  if (snapshot.length === 0) return null;
  const progressed = new Set(review.muscles_progresses);
  const plateau = new Set(review.muscles_plateau);
  const undertrained = new Set(review.muscles_undertrained);
  const overshoot = new Set(review.muscles_overshoot);

  const items: MuscleIntentionOutcome[] = snapshot.map((g) => {
    let outcome: MuscleOutcomeStatus = 'unknown';
    if (progressed.has(g.muscle)) outcome = 'progressed';
    else if (plateau.has(g.muscle)) outcome = 'plateau';
    else if (undertrained.has(g.muscle)) outcome = 'undertrained';
    else if (overshoot.has(g.muscle)) outcome = 'overshoot';
    return {
      muscle: g.muscle,
      intention: g.intention,
      priorityRank: g.priority_rank,
      outcome,
    };
  });

  // Tri : à développer (rank croissant) puis le reste par muscle alphabétique.
  items.sort((a, b) => {
    const aPrio = a.intention === MuscleIntention.DEVELOPPER ? 0 : 1;
    const bPrio = b.intention === MuscleIntention.DEVELOPPER ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;
    if (aPrio === 0) return a.priorityRank - b.priorityRank;
    return a.muscle.localeCompare(b.muscle);
  });

  return items;
}

// =============================================================================
// 4. Formatages utilitaires (purs)
// =============================================================================

/** "12 avr. – 17 mai 2026" à partir de deux YYYY-MM-DD. */
export function formatCycleDates(start: string, end: string | null): string {
  const startD = parseDateKey(start);
  const startStr = startD.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  if (end === null) {
    return `depuis le ${startStr}`;
  }
  const endD = parseDateKey(end);
  const endStr = endD.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

/**
 * Libellé court FR d'un muscle pour titres, listes et badges (Conv #14c-8).
 *
 * Capitalize sans article ("Pectoraux", pas "les pectoraux"). Les noms
 * tordus du dictionnaire interne (`dos_largeur`, `trapezes_hauts`,
 * `deltos_lateraux`, ...) sont mappés vers leur nom français usuel.
 *
 * Pour une utilisation dans une phrase ("Cible les pectoraux"), `lib/
 * catalog-filter.ts` toLowercase puis insère sans article.
 */
const MUSCLE_LABEL_FR: Readonly<Record<string, string>> = {
  pectoraux: 'Pectoraux',
  // Conv #22.3 — terminologie anatomique : "Grand dorsal" plutôt que
  // "Dos en largeur", "Trapèzes / rhomboïdes" plutôt que "Dos en épaisseur".
  dos_largeur: 'Grand dorsal',
  dos_epaisseur: 'Trapèzes / rhomboïdes',
  trapezes_hauts: 'Trapèzes hauts',
  quadriceps: 'Quadriceps',
  ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  // deltos_anterieurs n'est pas choisissable mais peut apparaître en
  // synergie : on prévoit le libellé pour cohérence visuelle.
  deltos_anterieurs: 'Deltoïdes antérieurs',
  deltos_lateraux: 'Deltoïdes latéraux',
  deltos_posterieurs: 'Deltoïdes postérieurs',
  biceps: 'Biceps',
  triceps: 'Triceps',
  abdos: 'Abdominaux',
  obliques: 'Obliques',
  lombaires: 'Lombaires',
};

export function muscleLabel(muscle: string): string {
  const known = MUSCLE_LABEL_FR[muscle];
  if (known !== undefined) return known;
  // Fallback Capitalize underscore-split (muscle inconnu du dictionnaire).
  return muscle
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Libellé court FR d'un exercice depuis le catalogue (ou l'id si introuvable). */
export function exerciseLabel(exerciseId: string, catalog: Catalog | null): string {
  if (catalog === null || !catalog.has(exerciseId)) return exerciseId;
  return catalog.get(exerciseId).nom_fr;
}

/** Liste des muscles primaires d'un exercice — pour info-bulles cycles. */
export function exerciseMusclesLabel(
  exerciseId: string,
  catalog: Catalog | null,
): string {
  if (catalog === null || !catalog.has(exerciseId)) return '';
  return exercisePrimaires(catalog.get(exerciseId))
    .map(muscleLabel)
    .join(', ');
}

// =============================================================================
// Courbe Force (onglet Progrès) — dump 2.4, étape 5
// =============================================================================

export interface E1rmPoint {
  /** seance_date au format YYYY-MM-DD (clé d'agrégation). */
  readonly date: string;
  /** Plafond après la séance de cette date. */
  readonly e1rm: number;
  /** Cycle de la mesure (porté par l'instantané). */
  readonly cycleIndex: number;
  /**
   * Dump 2.4, étape 5 (n° 9) — la séance de cette date bat la meilleure mesure
   * passée de l'exercice d'au moins deux reps (`recordDates`).
   */
  readonly record: boolean;
}

export interface ExerciseE1rmSeries {
  readonly exercise_id: string;
  readonly nom_fr: string;
  readonly points: ReadonlyArray<E1rmPoint>;
  /** Plafond actuel = dernier point. */
  readonly current: number;
  /** Plafond initial = premier point. Sert au calcul du delta %. */
  readonly initial: number;
  /** Pourcentage d'évolution (current/initial − 1) × 100. */
  readonly deltaPct: number;
  /**
   * Conv #20 — ChargeType de l'exo. Permet à `ForceView` d'afficher le suffixe
   * "kg / haltère" pour les exos DUMBBELL au lieu du "kg" générique.
   */
  readonly charge: ChargeType;
}

/**
 * #63 — Historique du Plafond (onglet Force) construit à partir des instantanés
 * persistés (`e1rmSnapshots`) : la valeur EXACTE du Plafond après chaque mesure
 * définitive, la même que le bilan de séance. Les records se lisent, eux, sur
 * les séries, avant lissage (`recordDates`).
 *
 * Mises à jour provisoires (séance trop facile) : pas d'instantané, donc pas de
 * point. Une saisie manuelle de Plafond en crée un.
 *
 * Ne renvoie que les exos avec ≥ 2 points. Tri par date de la dernière mesure
 * décroissante (B-1/B-2 du dump 2.2.0) ; aucune troncature, l'UI pagine.
 */
export function computeE1rmSeriesFromSnapshots(
  snapshots: ReadonlyArray<E1rmSnapshotRow>,
  catalog: Catalog,
  feedbacks: ReadonlyArray<FeedbackRow>,
  bodyweightKg: number,
): ExerciseE1rmSeries[] {
  // Un seul point par (exo, date) : le dernier instantané de la journée fait foi.
  const byExo = new Map<string, Map<string, { e1rm: number; cycleIndex: number }>>();
  for (const snap of snapshots) {
    if (!Number.isFinite(snap.e1rm) || snap.e1rm <= 0) continue;
    if (!catalog.has(snap.exercise_id)) continue;
    let inner = byExo.get(snap.exercise_id);
    if (inner === undefined) {
      inner = new Map<string, { e1rm: number; cycleIndex: number }>();
      byExo.set(snap.exercise_id, inner);
    }
    inner.set(snap.date, { e1rm: snap.e1rm, cycleIndex: snap.cycle_index });
  }

  const sessions = feedbacks.map((r) => ({ seance_date: r.seance_date, sets: r.feedback.sets }));
  const result: ExerciseE1rmSeries[] = [];
  for (const [exId, dateMap] of byExo) {
    if (dateMap.size < 2) continue;
    const exercise = catalog.get(exId);
    const records = recordDates(
      sessions.filter((s) => s.sets.some((f) => f.exercise_id === exId)),
      exercise,
      bodyweightKg,
    );
    const points: E1rmPoint[] = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        e1rm: v.e1rm,
        cycleIndex: v.cycleIndex,
        record: records.has(date),
      }));
    result.push(seriesOf(exId, exercise.nom_fr, exercise.charge, points));
  }

  result.sort((a, b) => {
    // Récence d'abord (dernière mesure la plus récente en tête).
    const lastA = a.points[a.points.length - 1]!.date;
    const lastB = b.points[b.points.length - 1]!.date;
    if (lastA !== lastB) return lastB.localeCompare(lastA);
    if (b.current !== a.current) return b.current - a.current;
    return a.exercise_id.localeCompare(b.exercise_id);
  });
  return result;
}

function seriesOf(
  exerciseId: string,
  nom: string,
  charge: ChargeType,
  points: E1rmPoint[],
): ExerciseE1rmSeries {
  const initial = points[0]!.e1rm;
  const current = points[points.length - 1]!.e1rm;
  return {
    exercise_id: exerciseId,
    nom_fr: nom,
    points,
    current,
    initial,
    deltaPct: initial > 0 ? (current / initial - 1) * 100 : 0,
    charge,
  };
}

/**
 * Dump 2.4, étape 5 (n° 21) — périodes de l'onglet Force : en nombre de séances
 * (propre à chaque exercice), en mois, sur le cycle en cours (communes à toutes
 * les cartes), ou tout l'historique.
 */
export const FORCE_WINDOW_DAYS = 91;
export const FORCE_WINDOW_SESSIONS = 12;

/** Garde les `count` dernières mesures de chaque série. */
export function lastForceSeries(
  series: ReadonlyArray<ExerciseE1rmSeries>,
  count: number,
): ExerciseE1rmSeries[] {
  return series.map((s) =>
    s.points.length <= count
      ? s
      : seriesOf(s.exercise_id, s.nom_fr, s.charge, s.points.slice(-count)),
  );
}

/**
 * Restreint les séries aux mesures faites depuis `fromDate` (incluse). Une série
 * qui garde moins de deux points sort de la liste ; la variation en % se calcule
 * sur la période gardée.
 */
export function windowForceSeries(
  series: ReadonlyArray<ExerciseE1rmSeries>,
  fromDate: string,
): ExerciseE1rmSeries[] {
  const out: ExerciseE1rmSeries[] = [];
  for (const s of series) {
    const points = s.points.filter((p) => p.date >= fromDate);
    if (points.length < 2) continue;
    out.push(seriesOf(s.exercise_id, s.nom_fr, s.charge, points));
  }
  return out;
}

/**
 * Dump 2.4, étape 5 (n° 21) — à partir de cet écart entre deux mesures, le
 * segment de courbe est dessiné en pointillé avec sa durée. Sur l'export d'Azur
 * du 11/11, 90 % des écarts entre deux mesures d'un exercice font moins de
 * 26 jours (médiane : 4) ; au-delà, c'est un exercice sorti du programme.
 */
export const FORCE_GAP_DAYS = 21;

export interface ForceChartLayout {
  /** Position horizontale de chaque point, de 0 (début de l'axe) à 1 (fin). */
  readonly xs: readonly number[];
  /** Segments longs : index du point d'arrivée et durée en semaines (arrondie). */
  readonly gaps: ReadonlyArray<{ readonly index: number; readonly weeks: number }>;
  /** Débuts de cycle tombant sur l'axe. */
  readonly cycleMarks: ReadonlyArray<{ readonly x: number; readonly cycleIndex: number }>;
  /** Premiers du mois tombant sur l'axe, avec leur libellé court (« oct. »). */
  readonly monthTicks: ReadonlyArray<{ readonly x: number; readonly label: string }>;
}

const DAY_MS = 86_400_000;
const dayNumber = (key: string): number => Math.round(parseDateKey(key).getTime() / DAY_MS);

/**
 * Dump 2.4, étape 5 (n° 21) — géométrie de l'axe du temps d'une courbe Force.
 * L'axe va de `from` à `to` à l'échelle réelle : une pause garde sa vraie
 * longueur (décision d'Azur : rester fidèle à la chronologie).
 */
export function forceChartLayout(
  points: ReadonlyArray<{ readonly date: string }>,
  from: string,
  to: string,
  cycleStarts: ReadonlyArray<{ readonly cycle_index: number; readonly start_date: string }>,
): ForceChartLayout {
  const d0 = dayNumber(from);
  const span = Math.max(1, dayNumber(to) - d0);
  const xOf = (key: string) => Math.min(1, Math.max(0, (dayNumber(key) - d0) / span));

  const gaps: { index: number; weeks: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const days = dayNumber(points[i]!.date) - dayNumber(points[i - 1]!.date);
    if (days >= FORCE_GAP_DAYS) gaps.push({ index: i, weeks: Math.round(days / 7) });
  }

  const monthTicks: { x: number; label: string }[] = [];
  const cursor = parseDateKey(from);
  cursor.setDate(1);
  for (;;) {
    cursor.setMonth(cursor.getMonth() + 1);
    const key = dateKey(cursor);
    if (key > to) break;
    monthTicks.push({
      x: xOf(key),
      label: cursor.toLocaleDateString('fr-FR', { month: 'short' }),
    });
  }

  return {
    xs: points.map((p) => xOf(p.date)),
    gaps,
    cycleMarks: cycleStarts
      .filter((c) => c.cycle_index > 1 && c.start_date > from && c.start_date <= to)
      .map((c) => ({ x: xOf(c.start_date), cycleIndex: c.cycle_index })),
    monthTicks,
  };
}

// =============================================================================
// Récence de travail par muscle (B-1 du dump 2.2.0)
// =============================================================================

/**
 * B-1 — date de la dernière séance ayant réellement sollicité chaque muscle
 * (`YYYY-MM-DD`), pour trier les cartes de l'onglet Volume du plus récemment
 * travaillé au plus ancien. Un muscle jamais travaillé est absent de la map.
 *
 * « Sollicité » = au moins une série dont l'exercice porte un coefficient > 0
 * sur ce muscle — synergies comprises (coef 0,5), exactement comme le volume
 * pondéré affiché sur la carte.
 */
export function computeLastWorkedByMuscle(
  feedbacks: readonly FeedbackRow[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fb of feedbacks) {
    for (const set of fb.feedback.sets) {
      const muscles = musclesOf[set.exercise_id] ?? {};
      for (const [m, coef] of Object.entries(muscles)) {
        if (coef <= 0) continue;
        const known = out[m];
        if (known === undefined || fb.seance_date > known) {
          out[m] = fb.seance_date;
        }
      }
    }
  }
  return out;
}
