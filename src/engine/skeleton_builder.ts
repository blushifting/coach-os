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
  ExType,
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
  SlotKind,
  muscleBelongsToSlot,
  type SplitTemplate,
} from './split';
import { patternsForMusclePrio, getMusclePatterns } from './pattern_grid';
import { estimateExerciseDurationMinutes } from '@/lib/onboarding-preview';

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
/**
 * Conv #39 — Séance VIDE (0 case) = malus dominant, distinct du simple
 * sous-remplissage. Force le scorer à préférer une structure adaptée à la
 * distribution (ex. Push/Pull pour un profil « haut du corps seul ») plutôt
 * qu'un U/L avec des jours jambes vides. Doit écraser le bonus canonique le
 * plus élevé pour qu'une structure sans séance vide gagne toujours.
 */
const SCORE_EMPTY_SESSION = -25;
/** Bonus splits canoniques bien lus (U/L, PPL). */
const SCORE_CANONICAL_BONUS: Record<string, number> = {
  // Canoniques.
  ul_4x: 2,
  ppl_6x: 2,
  ul_5x_spec: 1,
  fb_3x: 1,
  fb_2x: 0,
  ppl_3x: 0,
  // Conv #39 — additionnelles spécialisées (bonus comparable aux canoniques).
  push_pull_2x: 1,
  push_pull_4x: 2,
  push_pull_6x: 2,
  ulf_3x: 0,
  ppl_ul_5x: 1,
  ul_6x: 1,
  // Filets Full Body : bonus faible → ne gagnent que si une structure
  // spécialisée laisse des séances vides.
  fb_4x: 0,
  fb_5x: 0,
  fb_6x: 0,
};

// =============================================================================
// Conv #40 — Coût durée proxy + distribution en passes (Temps-2 polish)
// =============================================================================

/**
 * Coût durée estimé d'une cellule AVANT allocation des séries. Réutilise le
 * modèle de durée canonique (`estimateExerciseDurationMinutes`,
 * onboarding-preview) avec un nb de séries supposé constant : seul le rôle
 * compte (repos compound 150 s vs iso 80 s → un compound « pèse » ~1,5× un
 * iso). Sert à équilibrer la DURÉE entre séances sœurs (Conv #40, décision
 * Azur : « on équilibre en durée/volume, le mélange compound/iso n'est pas
 * grave »).
 */
const ASSUMED_SETS_PER_CELL = 4;
function cellDurationCost(role: RoleHint): number {
  return estimateExerciseDurationMinutes(
    { base_sets: ASSUMED_SETS_PER_CELL },
    role === 'compound' ? ExType.COMPOUND : ExType.ISOLATION,
  );
}
function dayDurationCost(cells: readonly PatternCell[]): number {
  let total = 0;
  for (const c of cells) total += cellDurationCost(c.role_hint);
  return total;
}

/** Muscles « plaçables presque partout » = variable d'ajustement (#2). */
const CORE_PAD_MUSCLES: ReadonlySet<string> = new Set([
  'abdos',
  'obliques',
  'lombaires',
]);
/** En-dessous de (moyenne − ce seuil, en min) une séance est jugée creuse. */
const CORE_PAD_THRESHOLD_MIN = 2;
/** Max de cases core ajoutées par étoffage dans une même séance. */
const CORE_PAD_MAX_PER_SESSION = 2;

interface CellDistribution {
  distribution: PatternCell[][];
  focus_per_day: string[][];
  warnings: string[];
}

/**
 * Distribue les cases sur les séances du split, en passes (Conv #40) :
 *   1. prioritaires : équilibrage par DURÉE (un compound pèse plus qu'un iso),
 *      FULL autorisé (un prio peut tomber sur le Focus) ;
 *   2. maintien NON-core : exclut les slots FULL si le split a des slots
 *      spécialisés (réserve le Focus aux prios) ;
 *   2b. core en maintien : 1 placement de base (exclut FULL) ;
 *   3. enrichissement Focus/FULL : on garnit les slots FULL des prios les plus
 *      sous-couvertes jusqu'à la charge moyenne des séances spécialisées
 *      (« modéré ») — fin du « Focus fourre-tout » ;
 *   4. étoffage core : on verse du core dans les séances CREUSES (non vides)
 *      pour rapprocher les durées.
 *
 * Invariants : aucune passe ne RETIRE de case ; l'enrichissement ne touche que
 * les slots FULL ; l'étoffage ne touche que les séances déjà non vides → une
 * séance structurellement vide le reste (préserve les garanties Conv #39 :
 * sélection de split + alternance + « haut du corps seul → Push/Pull »). Sans
 * aléa (tie-breaks stables) → déterminisme onboarding ↔ fin de cycle conservé.
 */
function distributeCells(
  split: SplitTemplate,
  demands: readonly MuscleDemand[],
  capacityPerSession: number,
): CellDistribution {
  const nSessions = split.sessions_per_week;
  const distribution: PatternCell[][] = Array.from({ length: nSessions }, () => []);
  const focusPerDay: string[][] = Array.from({ length: nSessions }, () => []);
  const warnings: string[] = [];
  const placedByMuscle = new Map<string, number>();
  const hasSpecialized = split.slots.some((s) => s.kind !== SlotKind.FULL);

  const eligibleDays = (muscle: string, excludeFull: boolean): number[] => {
    const out: number[] = [];
    for (let i = 0; i < nSessions; i += 1) {
      const slot = split.slots[i]!;
      if (excludeFull && slot.kind === SlotKind.FULL) continue;
      if (muscleBelongsToSlot(muscle, slot.kind)) out.push(i);
    }
    return out;
  };

  // Séance éligible la MOINS chargée en durée, non saturée en nb de cases.
  const lightestDay = (eligible: readonly number[]): number => {
    let best = -1;
    let bestCost = Infinity;
    for (const i of eligible) {
      if (distribution[i]!.length >= capacityPerSession) continue;
      const cost = dayDurationCost(distribution[i]!);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = i;
      }
    }
    return best;
  };

  const placeCell = (
    d: MuscleDemand,
    p: { pattern: Pattern; role_hint: RoleHint },
    dayIdx: number,
  ): void => {
    distribution[dayIdx]!.push({
      pattern: p.pattern,
      primary_muscle: d.muscle,
      role_hint: p.role_hint,
      chosen_exercise_id: null,
    });
    placedByMuscle.set(d.muscle, (placedByMuscle.get(d.muscle) ?? 0) + 1);
    if (
      d.goal.status === MuscleStatus.PRIORITAIRE &&
      !focusPerDay[dayIdx]!.includes(d.muscle)
    ) {
      focusPerDay[dayIdx]!.push(d.muscle);
    }
  };

  // Placement « de base » d'un muscle : ses patterns sur freq séances cibles.
  const placeBase = (d: MuscleDemand, excludeFull: boolean): void => {
    let eligible = eligibleDays(d.muscle, excludeFull);
    if (eligible.length === 0 && excludeFull) {
      eligible = eligibleDays(d.muscle, false); // repli : autoriser FULL.
    }
    if (eligible.length === 0) {
      warnings.push(`${d.muscle}: aucune séance compatible dans ${split.name}`);
      return;
    }
    const freqAchievable = Math.min(d.target_frequency, eligible.length);
    const patternsToPlace: Array<{ pattern: Pattern; role_hint: RoleHint }> = [];
    if (d.patterns.length >= freqAchievable) {
      patternsToPlace.push(...d.patterns);
    } else {
      const main = d.patterns[0]!;
      for (let i = 0; i < freqAchievable; i += 1) {
        patternsToPlace.push(d.patterns[i] ?? main);
      }
    }
    let dropped = 0;
    for (const p of patternsToPlace) {
      const dayIdx = lightestDay(eligible);
      if (dayIdx < 0) {
        dropped += 1;
        continue;
      }
      placeCell(d, p, dayIdx);
    }
    if (dropped > 0) {
      warnings.push(
        `${d.muscle}: ${dropped} pattern(s) non placé(s) (capacité saturée). Ajoute une séance ou monte la durée max.`,
      );
    }
  };

  // Passe 1 — prioritaires (FULL autorisé).
  for (const d of demands) {
    if (d.goal.status === MuscleStatus.PRIORITAIRE) placeBase(d, false);
  }
  // Passe 2 — maintien non-core (FULL exclu si slots spécialisés).
  for (const d of demands) {
    if (d.goal.status !== MuscleStatus.SUGGERE) continue;
    if (CORE_PAD_MUSCLES.has(d.muscle)) continue;
    placeBase(d, hasSpecialized);
  }
  // Passe 2b — core en maintien : 1 placement de base.
  for (const d of demands) {
    if (d.goal.status !== MuscleStatus.SUGGERE) continue;
    if (!CORE_PAD_MUSCLES.has(d.muscle)) continue;
    placeBase(d, hasSpecialized);
  }

  // Passe 3 — enrichissement Focus/FULL par les prios sous-couvertes (#1).
  const fullIdx: number[] = [];
  const specIdx: number[] = [];
  for (let i = 0; i < nSessions; i += 1) {
    if (split.slots[i]!.kind === SlotKind.FULL) fullIdx.push(i);
    else specIdx.push(i);
  }
  const priorities = demands.filter(
    (d) => d.goal.status === MuscleStatus.PRIORITAIRE,
  );
  if (fullIdx.length > 0 && specIdx.length > 0 && priorities.length > 0) {
    const avgSpec =
      specIdx.reduce((s, i) => s + dayDurationCost(distribution[i]!), 0) /
      specIdx.length;
    const desired = (d: MuscleDemand): number =>
      Math.max(d.target_frequency, d.patterns.length);
    // Prios les plus sous-couvertes d'abord (placé/désiré asc, puis rank asc).
    const byCoverage = [...priorities].sort((a, b) => {
      const ca = (placedByMuscle.get(a.muscle) ?? 0) / desired(a);
      const cb = (placedByMuscle.get(b.muscle) ?? 0) / desired(b);
      if (Math.abs(ca - cb) > 1e-9) return ca - cb;
      return a.goal.priority_rank - b.goal.priority_rank;
    });
    for (const day of fullIdx) {
      // 1 cellule ISO par prio DISTINCTE (re-ciblage « finisher »), jusqu'à la
      // durée moyenne des séances spécialisées (« modéré »).
      const present = new Set(distribution[day]!.map((c) => c.primary_muscle));
      for (const pick of byCoverage) {
        if (distribution[day]!.length >= capacityPerSession) break;
        if (dayDurationCost(distribution[day]!) >= avgSpec) break;
        if (present.has(pick.muscle)) continue;
        const iso =
          getMusclePatterns(pick.muscle).isolationPatterns[0] ??
          pick.patterns[0]!.pattern;
        placeCell(pick, { pattern: iso, role_hint: 'isolation' }, day);
        present.add(pick.muscle);
      }
    }
  }

  // Passe 4 — étoffage core des séances creuses (#2), borné.
  const coreDemands = demands.filter(
    (d) =>
      d.goal.status === MuscleStatus.SUGGERE && CORE_PAD_MUSCLES.has(d.muscle),
  );
  if (coreDemands.length > 0) {
    const addedPerDay = new Array<number>(nSessions).fill(0);
    const maxIters = nSessions * CORE_PAD_MAX_PER_SESSION;
    for (let it = 0; it < maxIters; it += 1) {
      const costs = distribution.map((cells) => dayDurationCost(cells));
      const avg = costs.reduce((a, b) => a + b, 0) / nSessions;
      let target = -1;
      let targetCost = Infinity;
      for (let i = 0; i < nSessions; i += 1) {
        if (distribution[i]!.length === 0) continue; // ne pas rescuer une vide
        if (distribution[i]!.length >= capacityPerSession) continue;
        if (addedPerDay[i]! >= CORE_PAD_MAX_PER_SESSION) continue;
        if (costs[i]! >= avg - CORE_PAD_THRESHOLD_MIN) continue;
        if (costs[i]! < targetCost) {
          targetCost = costs[i]!;
          target = i;
        }
      }
      if (target < 0) break;
      const kind = split.slots[target]!.kind;
      // Jamais 2× le même muscle core dans une séance (pas d'empilement).
      const inDay = new Set(distribution[target]!.map((c) => c.primary_muscle));
      const pick = coreDemands
        .filter(
          (d) => muscleBelongsToSlot(d.muscle, kind) && !inDay.has(d.muscle),
        )
        .sort(
          (a, b) =>
            (placedByMuscle.get(a.muscle) ?? 0) -
            (placedByMuscle.get(b.muscle) ?? 0),
        )[0];
      if (!pick) break;
      placeCell(
        pick,
        { pattern: pick.patterns[0]!.pattern, role_hint: 'isolation' },
        target,
      );
      addedPerDay[target]! += 1;
    }
  }

  return { distribution, focus_per_day: focusPerDay, warnings };
}

/**
 * Score un split candidat à partir de la distribution produite par
 * `distributeCells`. Pénalités inchangées (Conv #39) : bonus canonique,
 * fréquence cible par muscle, overflow / séance vide (−25, dominant) /
 * sous-remplissage.
 */
function scoreSplit(
  split: SplitTemplate,
  demands: readonly MuscleDemand[],
  capacityPerSession: number,
): SplitScoreResult {
  const { distribution, focus_per_day, warnings } = distributeCells(
    split,
    demands,
    capacityPerSession,
  );
  const nSessions = split.sessions_per_week;
  let score = SCORE_CANONICAL_BONUS[split.id] ?? 0;

  // Fréquence atteinte par muscle = nb de séances distinctes où il apparaît.
  for (const d of demands) {
    let achieved = 0;
    for (let i = 0; i < nSessions; i += 1) {
      if (distribution[i]!.some((c) => c.primary_muscle === d.muscle)) {
        achieved += 1;
      }
    }
    if (achieved >= d.target_frequency) score += SCORE_FREQ_HIT;
    else score += SCORE_FREQ_MISS * (d.target_frequency - achieved);
  }

  // Pénalité overflow / séance vide / sous-remplissage par séance.
  for (let i = 0; i < nSessions; i += 1) {
    const load = distribution[i]!.length;
    if (load > capacityPerSession) {
      score += SCORE_OVERFLOW * (load - capacityPerSession);
      warnings.push(
        `${split.slots[i]!.label}: ${load} patterns vs ${capacityPerSession} max`,
      );
    } else if (load === 0) {
      // Conv #39 — séance vide = structure inadaptée à la distribution.
      score += SCORE_EMPTY_SESSION;
      warnings.push(
        `${split.slots[i]!.label}: séance vide (aucun muscle éligible)`,
      );
    } else if (load < capacityPerSession * SCORE_UNDERFILL_THRESHOLD) {
      score += SCORE_UNDERFILL;
    }
  }

  return { split, score, distribution, focus_per_day, warnings };
}

// =============================================================================
// 3. Choix du split par score
// =============================================================================

/**
 * Conv #39 — Full Body N× ajoutés comme **filet** (dernier recours, choisis
 * seulement si aucune structure spécialisée n'est valide). FB 2×/3× restent
 * des choix canoniques légitimes et ne sont PAS dans ce set.
 */
const FILET_SPLIT_IDS: ReadonlySet<string> = new Set(['fb_4x', 'fb_5x', 'fb_6x']);

/** Vrai si la distribution laisse au moins une séance sans aucune case. */
function hasEmptySession(r: SplitScoreResult): boolean {
  return r.distribution.some((cells) => cells.length === 0);
}

/**
 * Conv #39 — Invariant d'alternance : deux séances consécutives ne doivent pas
 * partager le même `slot_kind` non-FULL (sinon on travaille les mêmes muscles
 * deux jours d'affilée — c'était le bug U/U/L/L). FULL est exempté : un Full
 * Body répète volontairement tous les muscles (filet de dernier recours, dont
 * la récupération repose sur la cadence de repos).
 */
export function splitAlternationOk(split: SplitTemplate): boolean {
  for (let i = 1; i < split.slots.length; i += 1) {
    const prev = split.slots[i - 1]!.kind;
    const cur = split.slots[i]!.kind;
    if (prev === cur && cur !== SlotKind.FULL) return false;
  }
  return true;
}

/**
 * Sélectionne la meilleure structure pour ce profil parmi le catalogue élargi
 * (Conv #39). Boucle de sélection **bornée** (par le nombre de candidats — donc
 * aucun risque d'infini) :
 *   1. score tous les candidats à `sessionsPerWeek` séances ;
 *   2. tri par score décroissant (tie-break = ordre d'`ALL_SPLITS`, canoniques
 *      d'abord) ;
 *   3. retient la 1re structure qui respecte les invariants DURS — aucune
 *      séance vide ET alternance des kinds ;
 *   4. si aucune ne les respecte (ex. très peu de muscles → forcément des
 *      séances vides ; l'user assume d'aller contre l'avis de maintien), repli
 *      sur la meilleure au score, ses warnings signalant le problème.
 */
export function selectBestSplit(
  demands: readonly MuscleDemand[],
  sessionsPerWeek: number,
  capacityPerSession: number,
): SplitScoreResult {
  const candidates = ALL_SPLITS.filter(
    (s) => s.sessions_per_week === sessionsPerWeek,
  );
  if (candidates.length === 0) {
    throw new RangeError(
      `Aucune structure pour sessions_per_week=${sessionsPerWeek}`,
    );
  }
  const scored = candidates
    .map((split) => scoreSplit(split, demands, capacityPerSession))
    .sort((a, b) => b.score - a.score);
  const valid = scored.filter(
    (r) => !hasEmptySession(r) && splitAlternationOk(r.split),
  );
  // Conv #39 — on préfère une structure SPÉCIALISÉE valide ; le filet Full Body
  // (4×/5×/6×) n'est retenu que si aucune spécialisée n'est valide (toutes
  // laissent des séances vides — ex. 1 seul muscle prio). FB 2×/3× ne sont PAS
  // des filets : ce sont des choix canoniques légitimes, traités normalement.
  const specialized = valid.find((r) => !FILET_SPLIT_IDS.has(r.split.id));
  return specialized ?? valid[0] ?? scored[0]!;
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

  // Alerte sous-utilisation (Conv #22 — message orienté action user).
  const fillRatio = totalDemand / Math.max(1, totalCapacity);
  if (fillRatio < 0.5) {
    warnings.push(
      `Ton programme tient en ${Math.round(fillRatio * 100)} % du temps que tu as ` +
        `réservé. Tu peux : ajouter des muscles prioritaires pour étoffer ton ` +
        `programme, ou réduire le nombre / la durée de tes séances pour gagner ` +
        `du temps.`,
    );
  }

  // Alerte sur-engagement : si demande > capacité totale.
  // (Conv #22 retour Azur : message qui propose les 3 actions concretes.)
  if (totalDemand > totalCapacity) {
    warnings.push(
      `Tes priorités demandent plus de temps que ta limite ne le permet. ` +
        `Pour respecter ton programme tu peux :\n` +
        `• Ajouter une séance par semaine,\n` +
        `• Réduire le nombre de muscles prioritaires,\n` +
        `• Ou accepter des séances plus longues et continuer comme prévu.`,
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
 * Construit le label final d'une séance pour affichage UI (Conv #22.5).
 *
 * Stratégie simplifiée (retour Azur "on tourne en rond, on enlève les
 * muscles du nom, retour au format initial") : on normalise simplement
 * le `split_label` issu de `split.ts` pour un rendu cohérent.
 *
 *  - PPL : "Push A" / "Pull B" / "Legs A"…  (label split déjà OK).
 *  - U/L : "Upper A" / "Lower B"…           (label split déjà OK).
 *  - Full Body : "Full Body A" / "Full Body B" / "Full Body C"…
 *    (on rajoute "Body" + lettre par day_index pour homogénéité).
 *  - "Spec" (U/L 5x spec) → renommé "Focus" (Conv #28 ; la séance qui
 *    re-cible les prios — lisible après « Séance E — »).
 */
export function buildSessionLabel(day: SkeletonDay): string {
  const split = day.split_label;
  const split_lower = split.toLowerCase();

  // "Spec" → "Focus" (terminologie user-friendly).
  if (/^spec$/i.test(split.trim()) || /\bspec\b/i.test(split_lower)) {
    return split.replace(/\bspec\b/gi, 'Focus');
  }

  if (/full/i.test(split_lower)) {
    return `Full Body ${letterTag(day.day_index)}`;
  }

  // Upper / Lower / Push / Pull / Legs : label split déjà distinctif
  // (A/B générés par split.ts).
  return split;
}

/** Conv #22.4 — A/B/C/D/E/F (jusqu'à 6 séances). */
function letterTag(dayIndex: number): string {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return letters[dayIndex] ?? String(dayIndex + 1);
}
