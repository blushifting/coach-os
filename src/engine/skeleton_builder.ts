/**
 * Skeleton builder (Conv #22, étape D du nouveau onboarding).
 *
 * Construit la grille (pattern × séance) à partir de :
 *   - state.muscle_goals (prios + maintien R1-R4 déjà appliqués)
 *   - state.profile.sessions_per_week
 *   - durationCategory (plafond max patterns/séance)
 *
 * Sortie : SkeletonTemplate avec cases vides (chosen_exercise_id = null),
 * prête à être remplie par l'user à l'étape E.
 *
 * Pipeline :
 *   1. Calculer la demande totale en cases (patterns) pour chaque muscle.
 *   2. Calculer la capacité hebdo (plafond × nb séances).
 *   3. Scorer chaque split canonique candidat et choisir le meilleur.
 *   4. Distribuer les cases sur les séances du split choisi (équilibrage,
 *      respect 48h compound, respect plafond/séance).
 *   5. Assembler le SkeletonTemplate avec warnings (sous-utilisation,
 *      sur-utilisation, contraintes serrées).
 *
 * Référence : recherche/09_programmation.md §5, §6.
 */

import type {
  MuscleGoal,
  Pattern,
  PatternCell,
  RoleHint,
  SkeletonDay,
  SkeletonTemplate,
  UserState,
} from './models';
import {
  DurationCategory,
  MAX_PATTERNS_PER_SESSION,
  MuscleStatus,
  makeSkeletonTemplate,
} from './models';
import {
  effectiveCycleTargetVolume,
  targetFrequencyV2,
} from './volume';
import {
  ALL_SPLITS,
  muscleBelongsToSlot,
  type SplitTemplate,
} from './split';
import { patternsForMusclePrio, getMusclePatterns } from './pattern_grid';

// =============================================================================
// Types intermédiaires
// =============================================================================

/** Demande en cases pour un muscle donné, après application V_cible. */
interface MuscleDemand {
  muscle: string;
  goal: MuscleGoal;
  /** Patterns à programmer pour ce muscle sur le cycle (sans dup). */
  patterns: Array<{ pattern: Pattern; role_hint: RoleHint }>;
  /** Fréquence hebdo cible (nb de séances où le muscle apparaît). */
  target_frequency: number;
  /** Volume cible hebdo (séries pondérées). */
  v_target: number;
}

interface SplitScoreResult {
  split: SplitTemplate;
  score: number;
  /** Distribution proposée des cases (séance → cases). */
  distribution: PatternCell[][];
  /** Focus muscles par séance (pour label). */
  focus_per_day: string[][];
  warnings: string[];
}

// =============================================================================
// 1. Calculer la demande par muscle
// =============================================================================

export function computeMuscleDemands(state: UserState): MuscleDemand[] {
  const demands: MuscleDemand[] = [];
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (goal.status === MuscleStatus.NON_COUVERT) continue;

    if (goal.status === MuscleStatus.SUGGERE) {
      // Maintien : 1 pattern, 1 séance par sem (cf. 09 §3.4).
      const map = getMusclePatterns(muscle);
      const pattern = map.compoundPatterns[0] ?? map.isolationPatterns[0]!;
      demands.push({
        muscle,
        goal,
        patterns: [{ pattern, role_hint: 'isolation' }],
        target_frequency: 1,
        v_target: effectiveCycleTargetVolume(state, muscle),
      });
      continue;
    }

    // PRIORITAIRE
    const vTarget = effectiveCycleTargetVolume(state, muscle);
    const patterns = patternsForMusclePrio(muscle, vTarget);
    const freq = targetFrequencyV2(muscle, state);
    demands.push({
      muscle,
      goal,
      patterns,
      target_frequency: freq,
      v_target: vTarget,
    });
  }

  // Tri : prioritaires d'abord, puis priority_rank.
  demands.sort((a, b) => {
    const sa = a.goal.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
    const sb = b.goal.status === MuscleStatus.PRIORITAIRE ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.goal.priority_rank - b.goal.priority_rank;
  });
  return demands;
}

/** Demande totale en cases sur le cycle pour la semaine (1 cycle = 1 sem
 *  répétée 4 fois + déload). cases = Σ freq × nb_patterns. */
export function totalCellDemand(demands: readonly MuscleDemand[]): number {
  let total = 0;
  for (const d of demands) {
    // Cases hebdo : chaque pattern est réparti sur freq séances ; pour la
    // demande totale on compte la somme des occurrences, soit
    // max(freq, patterns.length). Conservateur : si freq > nb patterns,
    // on duplique des patterns ; si nb_patterns > freq, on packe plusieurs
    // par séance.
    total += Math.max(d.target_frequency, d.patterns.length);
  }
  return total;
}

// =============================================================================
// 2. Score d'un split candidat
// =============================================================================

/** Récompense respect freq cible. */
const SCORE_FREQ_HIT = 5;
const SCORE_FREQ_MISS = -3;
/** Pénalité capacité dépassée par séance. */
const SCORE_OVERFLOW = -10;
/** Pénalité sous-utilisation (séance peu remplie). */
const SCORE_UNDERFILL_THRESHOLD = 0.4; // < 40% capacité = under-fill
const SCORE_UNDERFILL = -2;
/** Bonus splits canoniques bien lus (U/L, PPL). */
const SCORE_CANONICAL_BONUS: Record<string, number> = {
  ul_4x: 2,
  ppl_6x: 2,
  ul_5x_spec: 1,
  fb_3x: 1,
  fb_2x: 0,
  ppl_3x: 0,
};

/**
 * Score un split candidat en simulant la distribution des cases.
 * Retourne aussi la distribution et focus calculés (réutilisés ensuite).
 */
function scoreSplit(
  split: SplitTemplate,
  demands: readonly MuscleDemand[],
  capacityPerSession: number,
): SplitScoreResult {
  const nSessions = split.sessions_per_week;
  const distribution: PatternCell[][] = Array.from({ length: nSessions }, () => []);
  const focusPerDay: string[][] = Array.from({ length: nSessions }, () => []);
  const warnings: string[] = [];
  let score = SCORE_CANONICAL_BONUS[split.id] ?? 0;

  // Pour chaque demande, placer les cases sur les séances éligibles.
  for (const d of demands) {
    const eligibleIdx: number[] = [];
    for (let i = 0; i < nSessions; i += 1) {
      const slot = split.slots[i]!;
      if (muscleBelongsToSlot(d.muscle, slot.kind)) eligibleIdx.push(i);
    }
    if (eligibleIdx.length === 0) {
      // Muscle non plaçable dans ce split (ex. quadriceps en split full-upper).
      score += SCORE_FREQ_MISS * d.target_frequency;
      warnings.push(`${d.muscle}: aucune séance compatible dans ${split.name}`);
      continue;
    }

    // Tri des séances éligibles par charge actuelle ascendante.
    const sortByLoad = (): number[] => {
      const arr = [...eligibleIdx];
      arr.sort((a, b) => {
        const la = distribution[a]!.length;
        const lb = distribution[b]!.length;
        if (la !== lb) return la - lb;
        return a - b; // tie-break stable
      });
      return arr;
    };

    // Combien de séances on touche pour ce muscle.
    const freqAchievable = Math.min(d.target_frequency, eligibleIdx.length);

    // Placement des patterns sur les freq séances cibles.
    // Si nb_patterns ≥ freq : on packe plusieurs patterns dans certaines séances.
    // Si nb_patterns < freq : on place 1 pattern par séance (peut dupliquer le 1er pattern compound).
    const patternsToPlace: Array<{ pattern: Pattern; role_hint: RoleHint }> = [];
    if (d.patterns.length >= freqAchievable) {
      patternsToPlace.push(...d.patterns);
    } else {
      // Pad avec duplication du compound principal.
      const main = d.patterns[0]!;
      for (let i = 0; i < freqAchievable; i += 1) {
        patternsToPlace.push(d.patterns[i] ?? main);
      }
    }

    // Placement strict capé par capacityPerSession. Si la séance préférée
    // est pleine, on tente la suivante. Si toutes les séances éligibles
    // sont pleines, on drop la cell et on warn (sur-engagement).
    let placedCount = 0;
    let droppedCount = 0;
    for (const p of patternsToPlace) {
      const ordered = sortByLoad(); // re-sort à chaque placement
      let placed = false;
      for (const dayIdx of ordered) {
        if ((distribution[dayIdx]!.length) >= capacityPerSession) continue;
        const cell: PatternCell = {
          pattern: p.pattern,
          primary_muscle: d.muscle,
          role_hint: p.role_hint,
          chosen_exercise_id: null,
        };
        distribution[dayIdx]!.push(cell);
        if (
          d.goal.status === MuscleStatus.PRIORITAIRE &&
          !focusPerDay[dayIdx]!.includes(d.muscle)
        ) {
          focusPerDay[dayIdx]!.push(d.muscle);
        }
        placed = true;
        placedCount += 1;
        break;
      }
      if (!placed) droppedCount += 1;
    }

    if (droppedCount > 0) {
      score += SCORE_FREQ_MISS * droppedCount;
      warnings.push(
        `${d.muscle}: ${droppedCount} pattern(s) non placé(s) (capacité saturée). Ajoute une séance ou monte la durée max.`,
      );
    }

    // Score : freq atteinte vs cible.
    if (freqAchievable >= d.target_frequency) {
      score += SCORE_FREQ_HIT;
    } else {
      score += SCORE_FREQ_MISS * (d.target_frequency - freqAchievable);
    }
  }

  // Pénalité overflow / underfill par séance.
  for (let i = 0; i < nSessions; i += 1) {
    const load = distribution[i]!.length;
    if (load > capacityPerSession) {
      score += SCORE_OVERFLOW * (load - capacityPerSession);
      warnings.push(
        `${split.slots[i]!.label}: ${load} patterns vs ${capacityPerSession} max`,
      );
    } else if (load < capacityPerSession * SCORE_UNDERFILL_THRESHOLD) {
      score += SCORE_UNDERFILL;
    }
  }

  return { split, score, distribution, focus_per_day: focusPerDay, warnings };
}

// =============================================================================
// 3. Choix du split par score
// =============================================================================

/**
 * Sélectionne le meilleur split parmi les 6 canoniques pour ce profil.
 * Critère : score max (respect freq cible, équilibre capacité, lisibilité).
 *
 * Note Conv #22 : si profile.sessions_per_week ne matche aucun split
 * directement (ex. 4 séances), on prend les splits dont sessions_per_week =
 * profile.sessions_per_week. Pas de splits ad-hoc dans cette version
 * (Phase 1.A) — l'U/L 5× spec / PPL 6× couvrent les cas "Profil 3" upper-heavy.
 */
export function selectBestSplit(
  demands: readonly MuscleDemand[],
  sessionsPerWeek: number,
  capacityPerSession: number,
): SplitScoreResult {
  const candidates = ALL_SPLITS.filter((s) => s.sessions_per_week === sessionsPerWeek);
  if (candidates.length === 0) {
    throw new RangeError(
      `Aucun split canonique pour sessions_per_week=${sessionsPerWeek}`,
    );
  }
  let best: SplitScoreResult | null = null;
  for (const split of candidates) {
    const res = scoreSplit(split, demands, capacityPerSession);
    if (best === null || res.score > best.score) {
      best = res;
    }
  }
  return best!;
}

// =============================================================================
// 4. Assemblage du SkeletonTemplate
// =============================================================================

/**
 * Construit le SkeletonTemplate complet à partir du state.
 *
 * @param state UserState avec muscle_goals déjà initialisés (prios + R1-R4).
 * @param durationCategory Plafond max patterns/séance choisi par l'user.
 * @returns SkeletonTemplate prêt à être présenté à l'user (étape D).
 */
export function buildSkeleton(
  state: UserState,
  durationCategory: DurationCategory,
): SkeletonTemplate {
  const demands = computeMuscleDemands(state);
  const capacityPerSession = MAX_PATTERNS_PER_SESSION[durationCategory];
  const totalDemand = totalCellDemand(demands);
  const totalCapacity = state.profile.sessions_per_week * capacityPerSession;

  const best = selectBestSplit(
    demands,
    state.profile.sessions_per_week,
    capacityPerSession,
  );

  const warnings: string[] = [...best.warnings];

  // Alerte sous-utilisation : si demande effective << capacité plafond.
  // Seuil 50 % : si l'user a réservé 2h × 5 séances pour ne faire que 25 %
  // de la capacité, on suggère prio++ ou durée--.
  const fillRatio = totalDemand / Math.max(1, totalCapacity);
  if (fillRatio < 0.5) {
    warnings.push(
      `Sous-utilisation : ton programme couvre environ ${Math.round(fillRatio * 100)} % ` +
        `de la capacité réservée. Tu peux ajouter des priorités musculaires, ` +
        `ou réduire la durée/le nombre de séances.`,
    );
  }

  // Alerte sur-engagement : si demande > capacité totale.
  if (totalDemand > totalCapacity) {
    warnings.push(
      `Tes priorités demandent ${totalDemand} cases pour ${totalCapacity} disponibles. ` +
        `Certaines fréquences cibles ne pourront pas être atteintes — envisage ` +
        `d'ajouter une séance ou de monter la durée max.`,
    );
  }

  const days: SkeletonDay[] = best.split.slots.map((slot, i) => {
    const cells = best.distribution[i] ?? [];
    return {
      day_index: i,
      split_label: slot.label,
      focus_muscles: [...(best.focus_per_day[i] ?? [])],
      cells: cells.map((c) => ({ ...c })),
    };
  });

  return makeSkeletonTemplate({
    cycle_index: state.cycle_index,
    split_name: best.split.name,
    duration_category: durationCategory,
    days,
    warnings,
  });
}

// =============================================================================
// 5. Helpers — labels descriptifs (item L du backlog)
// =============================================================================

/**
 * Construit le label final d'une séance pour affichage UI.
 *
 * Stratégie (Conv #22, retour Azur sur Full Body 3× monotone) : on dérive
 * la "zone dominante" et le focus du **1er pattern compound** de la séance
 * (= celui qui ouvre la séance par convention §6.5). Ça produit des labels
 * variés même quand le split label est répétitif :
 *
 *   - PPL : on garde le label split tel quel ("Push", "Pull", "Legs").
 *   - U/L : "Upper · <focus>" / "Lower · <focus>" selon le pattern d'ouverture.
 *   - Full Body : la séance prend le nom de sa dominante ("Push dominant",
 *     "Pull dominant", "Jambes dominant") plutôt qu'un "Full A · Focus X/Y"
 *     répétitif.
 */
export function buildSessionLabel(day: SkeletonDay): string {
  const split = day.split_label;
  const split_lower = split.toLowerCase();
  // PPL : le label est déjà très explicite.
  if (/push|pull|legs/i.test(split_lower)) return split;
  // Spec / autres splits exotiques : on laisse tel quel.
  if (/spec/i.test(split_lower)) return split;

  const firstCompound = day.cells.find((c) => c.role_hint === 'compound');
  const anchor = firstCompound ?? day.cells[0];
  const dominance = anchor !== undefined ? patternDominance(anchor.pattern) : null;

  if (/full/i.test(split_lower)) {
    if (dominance === null) return split;
    return `Full Body · ${dominance.full}`;
  }
  if (/upper/i.test(split_lower)) {
    if (dominance === null || dominance.zone !== 'upper') {
      // Fallback focus muscles.
      const focus = day.focus_muscles.slice(0, 2).map(prettyMuscle).join('/');
      return focus.length > 0 ? `${split} · ${focus}` : split;
    }
    return `${split} · ${dominance.short}`;
  }
  if (/lower/i.test(split_lower)) {
    if (dominance === null || dominance.zone !== 'lower') {
      const focus = day.focus_muscles.slice(0, 2).map(prettyMuscle).join('/');
      return focus.length > 0 ? `${split} · ${focus}` : split;
    }
    return `${split} · ${dominance.short}`;
  }
  // Défaut : focus muscles.
  if (day.focus_muscles.length === 0) return split;
  const focus = day.focus_muscles.slice(0, 2).map(prettyMuscle).join('/');
  return `${split} · ${focus}`;
}

/**
 * Conv #22 — Mapping pattern d'ouverture → dominance lisible. Utilisé pour
 * varier les labels de Full Body et préciser les U/L.
 */
function patternDominance(
  pattern: string,
): { zone: 'upper' | 'lower' | 'core'; full: string; short: string } | null {
  switch (pattern) {
    case 'squat':
      return { zone: 'lower', full: 'Squat / Quads', short: 'Quads' };
    case 'hinge':
      return { zone: 'lower', full: 'Hinge / Ischios', short: 'Hinge' };
    case 'lunge':
      return { zone: 'lower', full: 'Fente / Jambes', short: 'Jambes' };
    case 'push_h':
      return { zone: 'upper', full: 'Push horizontal', short: 'Pec' };
    case 'push_v':
      return { zone: 'upper', full: 'Push vertical', short: 'Épaules' };
    case 'pull_h':
      return { zone: 'upper', full: 'Pull horizontal', short: 'Dos' };
    case 'pull_v':
      return { zone: 'upper', full: 'Pull vertical', short: 'Lats' };
    case 'core':
      return { zone: 'core', full: 'Gainage', short: 'Core' };
    default:
      return null;
  }
}

function prettyMuscle(m: string): string {
  const map: Record<string, string> = {
    pectoraux: 'Pec',
    dos_largeur: 'Lats',
    dos_epaisseur: 'Dos',
    trapezes_hauts: 'Trapèzes',
    quadriceps: 'Quads',
    ischios: 'Ischios',
    fessiers: 'Fessiers',
    mollets: 'Mollets',
    deltos_lateraux: 'Épaules',
    deltos_posterieurs: 'Delto post',
    biceps: 'Biceps',
    triceps: 'Triceps',
    abdos: 'Abdos',
    obliques: 'Obliques',
    lombaires: 'Lombaires',
  };
  return map[m] ?? m;
}
