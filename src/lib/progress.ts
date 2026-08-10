/**
 * Sélecteurs purs pour l'onglet Progrès (Conv #6a).
 *
 * Source de vérité :
 * - `recherche/10_plan_claude_code.md §3 Conv #6a` — Couverture (heatmap
 *   muscles travaillés cette semaine), Volume (barres hebdo par muscle avec
 *   bandes V_min/V_max grises), Cycles (historique nommé par programme + dates).
 * - `recherche/08_ux_decisions.md §527-532` — silhouette propre refonte
 *   Conv #8, ici on livre la couverture en grille de chips colorés.
 * - `recherche/09_programmation.md §3.3, §5.1` — V_min/V_max effectifs,
 *   séries pondérées par muscle.
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
import { exercisePrimaires, MuscleStatus } from '@/engine/models';
import { effectiveVolumeBounds } from '@/engine/volume';
import {
  addDays,
  dateKey,
  DELOAD_WEEK_INDEX,
  parseDateKey,
  weekKeyFor,
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
// 1. Couverture (heatmap semaine en cours)
// =============================================================================

/**
 * Statut d'un muscle pour la semaine en cours.
 * - `non_travaille` : 0 série pondérée.
 * - `sous_min` : < V_min effectif (sous-dosé).
 * - `ok` : V_min ≤ x ≤ V_max.
 * - `depassement` : > V_max (sur-volume).
 * - `hors_scope` : muscle non couvert par les objectifs (V_min = 0).
 */
export type CoverageStatus =
  | 'non_travaille'
  | 'sous_min'
  | 'ok'
  | 'depassement'
  | 'hors_scope';

export interface MuscleCoverage {
  readonly muscle: string;
  readonly sets: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly status: CoverageStatus;
  /** Intensité 0..1 pour la heatmap (sets / V_max, clampé). */
  readonly intensity: number;
}

/**
 * Classe un volume hebdo (séries pondérées) par rapport à sa bande cible.
 * Factorisé (Bloc O) pour être partagé entre la couverture hebdo réelle et les
 * jauges de volume « live » du mode « à la main ».
 *
 * Tolérance epsilon (Conv #18) : `sets` pondéré (coefs muscles) peut tomber
 * pile sur une borne avec un arrondi flottant (ex : 9.999…).
 */
export function classifyVolume(
  sets: number,
  vMin: number,
  vMax: number,
): CoverageStatus {
  if (vMin === 0 && vMax === 0) return 'hors_scope';
  if (sets === 0) return 'non_travaille';
  if (sets < vMin - 0.05) return 'sous_min';
  if (sets > vMax + 0.05) return 'depassement';
  return 'ok';
}

/**
 * Calcule la couverture par muscle pour la semaine **du programme** contenant
 * `now` (Conv #11h — alignée sur `cycleStart` plutôt que sur le lundi ISO,
 * pour être cohérente avec le calendrier visuel). Si `cycleStart` est null
 * (pas de cycle posé), fallback sur la semaine ISO.
 * On considère uniquement les feedbacks (séances réalisées).
 */
export function computeCoverageThisWeek(
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
  feedbacks: readonly FeedbackRow[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
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
    const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    const sets = counts[muscle] ?? 0;
    const status = classifyVolume(sets, vMin, vMax);
    const denom = vMax > 0 ? vMax : Math.max(1, sets);
    const intensity = Math.min(1, sets / denom);
    out.push({ muscle, sets, vMin, vMax, status, intensity });
  }
  // Tri stable : par ordre canonique MUSCLES si possible, sinon alpha.
  out.sort((a, b) => a.muscle.localeCompare(b.muscle));
  return out;
}

export interface AddedVolumeOvershoot {
  readonly muscle: string;
  /** Séries pondérées projetées après ajout. */
  readonly projected: number;
  /** Plafond hebdo effectif (V_max / MRV). */
  readonly vMax: number;
}

/**
 * Conv #30 — Muscles qu'un exercice ajouté en séance (`addedSets` séries)
 * ferait passer **au-dessus de leur plafond de volume hebdo** (V_max / MRV).
 *
 * `weeklyWeightedSets` = séries pondérées déjà engagées cette semaine (séances
 * faites + séance en cours), par muscle. On y ajoute la contribution pondérée
 * de l'exo candidat (coef × séries) et on compare à V_max. Sert à la mise en
 * garde « volume élevé » de `AddExerciseSheet` (pas de série bonus, juste un
 * avertissement non bloquant). Pur. Trié du dépassement le plus fort au plus
 * faible.
 */
export function addedVolumeOvershoot(
  exoMuscles: Readonly<Record<string, number>>,
  addedSets: number,
  weeklyWeightedSets: Readonly<Record<string, number>>,
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
): AddedVolumeOvershoot[] {
  const out: AddedVolumeOvershoot[] = [];
  for (const [muscle, coef] of Object.entries(exoMuscles)) {
    if (coef <= 0) continue;
    const [, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    if (vMax <= 0) continue; // muscle hors scope (pas de plafond)
    const projected = (weeklyWeightedSets[muscle] ?? 0) + addedSets * coef;
    // Epsilon : évite de crier au dépassement sur un arrondi flottant pile au cap.
    if (projected > vMax + 0.05) {
      out.push({ muscle, projected, vMax });
    }
  }
  out.sort((a, b) => b.projected / b.vMax - a.projected / a.vMax);
  return out;
}

// =============================================================================
// 2. Volume hebdo par muscle (N dernières semaines)
// =============================================================================

export interface WeeklyVolumePoint {
  /** Lundi YYYY-MM-DD de la semaine. */
  readonly weekStart: string;
  readonly sets: number;
}

export interface MuscleVolumeSeries {
  readonly muscle: string;
  readonly vMin: number;
  readonly vMax: number;
  /** Séries pondérées par semaine, ordre chronologique ancien → récent. */
  readonly points: ReadonlyArray<WeeklyVolumePoint>;
  /** Conv #14c-6 — statut du muscle (PRIORITAIRE / SUGGERE / NON_COUVERT). */
  readonly status: string;
  /** Objectif du muscle (hypertrophie / force / maintien). */
  readonly objective: string;
}

/**
 * Pour chaque muscle, renvoie le volume hebdo des `weeks` dernières semaines
 * calendaires (du lundi de la semaine la plus ancienne au lundi de la semaine
 * courante). Inclut les semaines vides (`sets = 0`).
 */
export function computeVolumeHistory(
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
  feedbacks: readonly FeedbackRow[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  weeks: number = 8,
  now: Date = new Date(),
  cycleStart: string | null = null,
): MuscleVolumeSeries[] {
  if (weeks <= 0) return [];
  // Conv #11h — fenêtre glissante sur les `weeks` dernières semaines de
  // programme (alignées sur cycleStart), pas semaines ISO. Cohérent avec
  // le calendrier visuel.
  const thisWeekStart = weekStartFor(now, cycleStart);
  const weekStarts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    weekStarts.push(dateKey(addDays(thisWeekStart, -i * 7)));
  }

  const byWeek = new Map<string, SessionFeedback[]>();
  for (const f of feedbacks) {
    const wk = weekKeyFor(parseDateKey(f.seance_date), cycleStart);
    const list = byWeek.get(wk) ?? [];
    list.push(f.feedback);
    byWeek.set(wk, list);
  }

  // Muscles à afficher : ceux du profil (V_min connu).
  const muscles = Object.keys(state.volume_min).sort((a, b) =>
    a.localeCompare(b),
  );

  return muscles.map((muscle) => {
    const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    const points: WeeklyVolumePoint[] = weekStarts.map((ws) => {
      const fbs = byWeek.get(ws) ?? [];
      const sums = sumMuscleSets(fbs, musclesOf);
      return { weekStart: ws, sets: sums[muscle] ?? 0 };
    });
    const goal = state.muscle_goals[muscle];
    return {
      muscle,
      vMin,
      vMax,
      points,
      status: goal?.status ?? 'NON_COUVERT',
      objective: goal?.objective ?? 'maintien',
    };
  });
}

// =============================================================================
// 2bis. Volume par muscle réalisé sur un cycle (bilan de cycle — #15, E-3)
// =============================================================================

export interface MuscleCycleVolume {
  readonly muscle: string;
  /** Séries pondérées MOYENNES par semaine de travail (déload exclu). */
  readonly avgSetsPerWeek: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly status: CoverageStatus;
  /** PRIORITAIRE / SUGGERE / NON_COUVERT — tri + badge éventuel. */
  readonly goalStatus: string;
}

/**
 * #15 (E-3) — volume réalisé par muscle sur un cycle, en séries pondérées
 * MOYENNES par semaine de travail (les `workingWeeks` semaines hors déload),
 * comparé à la bande cible V_min–V_max. Répond à « as-tu tenu ta cible hebdo
 * sur le cycle ? ». Ne renvoie que les muscles suivis (V_max > 0), prioritaires
 * d'abord. Calculé à la volée depuis les feedbacks — rien de persisté (les
 * bornes utilisées sont celles de l'état COURANT, exactes pour le cycle en
 * cours ; approximation acceptable pour un bilan archivé si les objectifs ont
 * changé depuis).
 */
export function computeCycleVolumeByMuscle(
  feedbacks: ReadonlyArray<FeedbackRow>,
  cycleIndex: number,
  state: Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>,
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  workingWeeks: number = 4,
): MuscleCycleVolume[] {
  const inCycle = feedbacks.filter(
    (f) => f.cycle_index === cycleIndex && f.week_in_cycle !== DELOAD_WEEK_INDEX,
  );
  const sums = sumMuscleSets(
    inCycle.map((f) => f.feedback),
    musclesOf,
  );
  const out: MuscleCycleVolume[] = [];
  // Muscles SUIVIS uniquement. Un muscle travaillé hors objectifs n'a pas de
  // bande cible : sa barre n'aurait aucune référence à montrer. Sa progression
  // se lit sur la silhouette du bilan (Conv #76 — un temps listés ici, retirés
  // après essai).
  for (const muscle of Object.keys(state.volume_min)) {
    const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
    if (vMax <= 0) continue;
    const avg = (sums[muscle] ?? 0) / Math.max(1, workingWeeks);
    out.push({
      muscle,
      avgSetsPerWeek: avg,
      vMin,
      vMax,
      status: classifyVolume(avg, vMin, vMax),
      goalStatus: state.muscle_goals[muscle]?.status ?? MuscleStatus.NON_COUVERT,
    });
  }
  // Prioritaires d'abord (rank croissant), puis alpha.
  out.sort((a, b) => {
    const aPrio = a.goalStatus === MuscleStatus.PRIORITAIRE ? 0 : 1;
    const bPrio = b.goalStatus === MuscleStatus.PRIORITAIRE ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;
    if (aPrio === 0) {
      const ra = state.muscle_goals[a.muscle]?.priority_rank ?? 99;
      const rb = state.muscle_goals[b.muscle]?.priority_rank ?? 99;
      if (ra !== rb) return ra - rb;
    }
    return a.muscle.localeCompare(b.muscle);
  });
  return out;
}

// =============================================================================
// 3. Historique des cycles
// =============================================================================

export interface CycleHistoryItem {
  readonly cycleIndex: number;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Volume total kg (somme du cycle), 0 si pas de review. */
  readonly volumeTotalKg: number;
  /** Top 3 progressions e1RM (exId, Δkg) du cycle, ordre décroissant. */
  readonly plafondsTop: ReadonlyArray<readonly [string, number]>;
  /** Δ volume total vs cycle précédent (en kg), null si pas de précédent. */
  readonly deltaVolumeKg: number | null;
  /** Δ progression moyenne des plafonds vs cycle précédent (kg), null si N/A. */
  readonly deltaTopPlafondKg: number | null;
  /**
   * Conv #14c-7 — comparaison "visé vs fait" par muscle prioritaire, dérivée
   * du snapshot des `muscle_goals` au moment du bilan et de la classification
   * `progresses/plateau/undertrained/overshoot`. `null` si le cycle n'a pas
   * été clôturé avec la nouvelle feature (rétrocompat).
   */
  readonly objectivesByMuscle: ReadonlyArray<MuscleObjectiveOutcome> | null;
}

export type MuscleOutcomeStatus =
  | 'progressed'
  | 'plateau'
  | 'undertrained'
  | 'overshoot'
  | 'unknown';

export interface MuscleObjectiveOutcome {
  readonly muscle: string;
  /** ex: hypertrophie / force / maintien (string libre côté UI). */
  readonly objective: string;
  /** Statut du muscle dans le programme courant (PRIORITAIRE, SUGGERE, ...). */
  readonly status: string;
  /** Rang de priorité (1 = top) — utilisé pour trier les PRIORITAIRES. */
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
    let deltaVolumeKg: number | null = null;
    let deltaTopPlafondKg: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j]!;
      if (prev.review === null) continue;
      deltaVolumeKg = review.volume_total_kg - prev.review.volume_total_kg;
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
      volumeTotalKg: review.volume_total_kg,
      plafondsTop,
      deltaVolumeKg,
      deltaTopPlafondKg,
      objectivesByMuscle,
    });
  }

  // Retour du plus récent au plus ancien pour l'UI.
  return items.reverse();
}

function buildObjectivesByMuscle(
  review: CycleReview,
): ReadonlyArray<MuscleObjectiveOutcome> | null {
  const snapshot = review.muscle_goals_snapshot;
  if (snapshot === undefined || snapshot.length === 0) return null;
  const progressed = new Set(review.muscles_progresses);
  const plateau = new Set(review.muscles_plateau);
  const undertrained = new Set(review.muscles_undertrained);
  const overshoot = new Set(review.muscles_overshoot);

  const items: MuscleObjectiveOutcome[] = snapshot.map((g) => {
    let outcome: MuscleOutcomeStatus = 'unknown';
    if (progressed.has(g.muscle)) outcome = 'progressed';
    else if (plateau.has(g.muscle)) outcome = 'plateau';
    else if (undertrained.has(g.muscle)) outcome = 'undertrained';
    else if (overshoot.has(g.muscle)) outcome = 'overshoot';
    return {
      muscle: g.muscle,
      objective: g.objective,
      status: g.status,
      priorityRank: g.priority_rank,
      outcome,
    };
  });

  // Tri : PRIORITAIRE (rank croissant) puis le reste par muscle alphabétique.
  items.sort((a, b) => {
    const aPrio = a.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
    const bPrio = b.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
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

/** "11 mai" pour un YYYY-MM-DD. */
export function formatWeekLabel(weekStart: string): string {
  return parseDateKey(weekStart).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
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
// Historique des plafonds (Conv #11g — onglet Progrès / Force)
// =============================================================================

export interface E1rmPoint {
  /** seance_date au format YYYY-MM-DD (clé d'agrégation). */
  readonly date: string;
  /** Plafond estimé sur la meilleure série de cette date pour cet exo. */
  readonly e1rm: number;
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
 * #63 — Historique du Plafond (onglet Force) construit à partir des SNAPSHOTS
 * e1RM persistés (`e1rmSnapshots`) plutôt que recalculé depuis les feedbacks.
 *
 * Un snapshot stocke la valeur EXACTE de `state.e1rm[exo]` (plafond EMA) au
 * moment de chaque mesure définitive — la même valeur que le bilan de fin de
 * séance affiche et que la prescription utilise. La courbe colle donc au reste
 * de l'app. L'ancienne `computeE1rmHistory` recalculait un e1RM Epley brut sur
 * la meilleure série de chaque séance, une mesure DIFFÉRENTE qui pouvait monter
 * là où le bilan disait que le plafond baissait (EMA lissée).
 *
 * Déloads et séances "trop faciles" (mises à jour provisoires) ne créent pas de
 * snapshot → naturellement exclus. Une saisie manuelle de plafond en crée un →
 * elle apparaît sur la courbe. Valeurs gardées en flottant (pas d'arrondi).
 *
 * Ne renvoie que les exos avec ≥ 2 points (une courbe a besoin de 2 mesures).
 *
 * B-1/B-2 (dump 2.2.0) — tri par **date de la dernière mesure décroissante** :
 * ce que tu viens de travailler est en haut. L'ancien tri (nombre de points
 * décroissant) remontait mécaniquement les exos de longue date et enterrait les
 * nouveaux. **Aucune troncature ici** : l'ancien `topN = 8` écartait silencieu-
 * sement la majorité d'un catalogue réel (~20 exos) ; c'est désormais à l'UI de
 * paginer, en montrant qu'il y a une suite.
 */
export function computeE1rmSeriesFromSnapshots(
  snapshots: ReadonlyArray<E1rmSnapshotRow>,
  catalog: Catalog,
): ExerciseE1rmSeries[] {
  // Un seul point par (exo, date) : le dernier snapshot de la journée fait foi
  // (valeur la plus à jour du plafond). `snapshots` arrive trié par date.
  const byExo = new Map<string, Map<string, number>>();
  for (const snap of snapshots) {
    if (!Number.isFinite(snap.e1rm) || snap.e1rm <= 0) continue;
    if (!catalog.has(snap.exercise_id)) continue;
    let inner = byExo.get(snap.exercise_id);
    if (inner === undefined) {
      inner = new Map<string, number>();
      byExo.set(snap.exercise_id, inner);
    }
    inner.set(snap.date, snap.e1rm);
  }

  const result: ExerciseE1rmSeries[] = [];
  for (const [exId, dateMap] of byExo) {
    if (dateMap.size < 2) continue;
    const exercise = catalog.get(exId);
    const points: E1rmPoint[] = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ date, e1rm }));
    const initial = points[0]!.e1rm;
    const current = points[points.length - 1]!.e1rm;
    const deltaPct = initial > 0 ? (current / initial - 1) * 100 : 0;
    result.push({
      exercise_id: exId,
      nom_fr: exercise.nom_fr,
      points,
      current,
      initial,
      deltaPct,
      charge: exercise.charge,
    });
  }

  result.sort((a, b) => {
    // Récence d'abord (dernière mesure la plus récente en tête).
    const lastA = a.points[a.points.length - 1]!.date;
    const lastB = b.points[b.points.length - 1]!.date;
    if (lastA !== lastB) return lastB.localeCompare(lastA);
    // Départages stables : plus de points mesurés, puis plafond le plus lourd.
    if (b.points.length !== a.points.length) return b.points.length - a.points.length;
    if (b.current !== a.current) return b.current - a.current;
    return a.exercise_id.localeCompare(b.exercise_id);
  });
  return result;
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

/**
 * B-3 — nombre de semaines de programme couvrant TOUT l'historique, de la
 * semaine du premier feedback à celle de `now` incluse. Sert à alimenter
 * `computeVolumeHistory` quand l'utilisateur demande l'historique complet
 * plutôt que la fenêtre glissante par défaut. Minimum 1.
 */
export function weeksSinceFirstFeedback(
  feedbacks: readonly FeedbackRow[],
  now: Date = new Date(),
  cycleStart: string | null = null,
): number {
  let earliest: string | null = null;
  for (const f of feedbacks) {
    if (earliest === null || f.seance_date < earliest) earliest = f.seance_date;
  }
  if (earliest === null) return 1;
  const firstWeek = weekStartFor(parseDateKey(earliest), cycleStart);
  const thisWeek = weekStartFor(now, cycleStart);
  const days = Math.round(
    (thisWeek.getTime() - firstWeek.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, Math.floor(days / 7) + 1);
}
