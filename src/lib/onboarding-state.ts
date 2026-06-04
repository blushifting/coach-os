/**
 * État local du wizard d'onboarding (Conv #4b).
 *
 * `OnboardingDraft` = state mutable manipulé par OnboardingPage.tsx pendant
 * les 4 étapes. À la fin, on dérive :
 *   - un `Profile` via `buildProfile()`
 *   - un `Record<string, MuscleGoal>` final via `buildMuscleGoals()`
 *
 * Le moteur (`engine.startUser`) est appelé une seule fois, à la validation
 * finale, avec `applyBalance: false` puisqu'on a déjà arbitré les SUGGERE
 * dans l'étape 3.
 */

import {
  DurationCategory,
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  Sex,
  makeMuscleGoal,
  makeProfile,
  type MuscleGoal,
  type Profile,
  type UserState,
} from '@/engine/models';
import { applyBalanceRules } from '@/engine/balance';

export interface RankedPriority {
  readonly muscle: string;
  readonly objective: MuscleObjective;
}

export interface OnboardingDraft {
  // Étape 1 : profil
  readonly sex: Sex;
  readonly age: number;
  readonly bodyweightKg: number;
  readonly level: Level;
  readonly sessionsPerWeek: number;
  /** Codes du catalogue exercises.json — voir EQUIPMENT_OPTIONS. */
  readonly equipment: ReadonlySet<string>;

  // Étape 2 : muscles prioritaires (dans l'ordre du ranking)
  readonly priorities: readonly RankedPriority[];

  // Étape 3 : décisions sur les suggestions R1-R4
  /** Muscles SUGGERE acceptés par l'utilisateur (sous-ensemble des suggestions). */
  readonly acceptedSuggestions: ReadonlySet<string>;

  // Étape 4 : choix programme
  /** `null` = mode custom (pas de programme guidé). */
  readonly programmeId: string | null;
  /**
   * Conv #22 — durée MAX par séance (plafond patterns/séance).
   * Sert au nouveau path co-construit (mode custom seulement).
   * Default : MEDIUM (≤ 1h30).
   */
  readonly durationCategory: DurationCategory;
}

// =============================================================================
// Préset par défaut (étape 2 garde-fou : "Préset par défaut")
// =============================================================================

/**
 * Préset full-body Hypertrophie (cf. 04 §3.1 ligne 108).
 * 5 muscles prioritaires couvrant push/pull/jambes, qui déclenchent R1-R4
 * pour combler les manques (gainage, ischios, deltos postérieurs, etc.).
 */
export const PRESET_DEFAULT_PRIORITIES: readonly RankedPriority[] = [
  { muscle: 'pectoraux', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'dos_largeur', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'quadriceps', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'fessiers', objective: MuscleObjective.HYPERTROPHIE },
  { muscle: 'deltos_lateraux', objective: MuscleObjective.HYPERTROPHIE },
];

// =============================================================================
// Construction de l'état initial
// =============================================================================

/** État initial vide — utilisé par OnboardingPage au mount. */
export function makeInitialDraft(): OnboardingDraft {
  return {
    sex: Sex.HOMME,
    age: 30,
    bodyweightKg: 75,
    level: Level.DEBUTANT,
    sessionsPerWeek: 3,
    equipment: new Set<string>(),
    priorities: [],
    acceptedSuggestions: new Set<string>(),
    programmeId: null,
    durationCategory: DurationCategory.MEDIUM,
  };
}

/**
 * Conv #18 — initialise un draft depuis `UserState` pour le mode "partial
 * restart" : l'utilisateur revient sur l'onboarding (Step2→5) pour modifier
 * ses priorités / programme. On préserve les choix existants comme point
 * de départ.
 */
export function draftFromUserState(state: UserState): OnboardingDraft {
  const priorities: RankedPriority[] = [];
  const accepted = new Set<string>();
  for (const g of Object.values(state.muscle_goals)) {
    if (g.status === MuscleStatus.PRIORITAIRE) {
      priorities.push({ muscle: g.muscle, objective: g.objective });
    } else if (g.status === MuscleStatus.SUGGERE) {
      accepted.add(g.muscle);
    }
  }
  priorities.sort((a, b) => {
    const ra = state.muscle_goals[a.muscle]?.priority_rank ?? 99;
    const rb = state.muscle_goals[b.muscle]?.priority_rank ?? 99;
    return ra - rb;
  });
  return {
    sex: state.profile.sex,
    age: state.profile.age,
    bodyweightKg: state.profile.bodyweight_kg,
    level: state.profile.level,
    sessionsPerWeek: state.profile.sessions_per_week,
    equipment: new Set(state.profile.available_equip),
    priorities,
    acceptedSuggestions: accepted,
    programmeId: state.active_guided_program_id,
    durationCategory:
      state.profile.duration_category ?? DurationCategory.MEDIUM,
  };
}

// =============================================================================
// Étape 3 : calcul des suggestions R1-R4
// =============================================================================

/**
 * À partir des PRIORITAIRE issus de l'étape 2, calcule la liste des muscles
 * SUGGERE par R1-R4 (fonction pure de `balance.ts`).
 */
export function computeBalanceSuggestions(
  priorities: readonly RankedPriority[],
): MuscleGoal[] {
  const goals: Record<string, MuscleGoal> = {};
  priorities.forEach((p, i) => {
    goals[p.muscle] = makeMuscleGoal({
      muscle: p.muscle,
      objective: p.objective,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });
  return applyBalanceRules(goals);
}

// =============================================================================
// Finalisation : Profile + MuscleGoals à passer à engine.startUser
// =============================================================================

/**
 * Dérive l'`Objective` global (champ legacy de `Profile`) depuis le draft.
 * - Si programme guidé : on ne peut pas l'extraire ici (besoin du GuidedProgram).
 *   L'appelant peut surcharger via le paramètre `override`.
 * - Sinon : `MuscleObjective` majoritaire parmi les PRIORITAIRE, mappé.
 *   `MAINTIEN` n'existe pas au niveau global → fallback `HYPERTROPHIE`.
 */
export function deriveGlobalObjective(
  draft: OnboardingDraft,
  override?: MuscleObjective,
): Objective {
  const source = override ?? majorityMuscleObjective(draft.priorities);
  switch (source) {
    case MuscleObjective.FORCE:
      return Objective.FORCE;
    case MuscleObjective.ENDURANCE:
      return Objective.ENDURANCE;
    case MuscleObjective.HYPERTROPHIE:
    case MuscleObjective.MAINTIEN:
    default:
      return Objective.HYPERTROPHIE;
  }
}

function majorityMuscleObjective(
  priorities: readonly RankedPriority[],
): MuscleObjective {
  if (priorities.length === 0) return MuscleObjective.HYPERTROPHIE;
  const counts = new Map<MuscleObjective, number>();
  for (const p of priorities) {
    counts.set(p.objective, (counts.get(p.objective) ?? 0) + 1);
  }
  let best: MuscleObjective = MuscleObjective.HYPERTROPHIE;
  let bestCount = -1;
  for (const [obj, n] of counts) {
    if (n > bestCount) {
      best = obj;
      bestCount = n;
    }
  }
  return best;
}

export function buildProfile(
  draft: OnboardingDraft,
  globalObjective: Objective,
): Profile {
  return makeProfile({
    sex: draft.sex,
    age: draft.age,
    level: draft.level,
    objective: globalObjective,
    sessions_per_week: draft.sessionsPerWeek,
    bodyweight_kg: draft.bodyweightKg,
    available_equip: draft.equipment,
    duration_category: draft.durationCategory,
  });
}

/**
 * Assemble le `Record<string, MuscleGoal>` final, prêt pour `engine.startUser`
 * avec `applyBalance: false`.
 *
 * - PRIORITAIRE : un par muscle de `draft.priorities`, dans l'ordre du ranking.
 * - SUGGERE : muscles cochés dans `draft.acceptedSuggestions`, en MAINTIEN.
 * - NON_COUVERT : muscles suggérés par R1-R4 mais décochés. On les inscrit
 *   explicitement pour que le moteur respecte le choix utilisateur (cf.
 *   contrat de balance.ts : "respecte les NON_COUVERT explicites").
 *
 * @param suggestions Output de `computeBalanceSuggestions(draft.priorities)`
 *                    au moment où on a montré l'étape 3 à l'utilisateur.
 */
export function buildMuscleGoals(
  draft: OnboardingDraft,
  suggestions: readonly MuscleGoal[],
): Record<string, MuscleGoal> {
  const goals: Record<string, MuscleGoal> = {};

  draft.priorities.forEach((p, i) => {
    goals[p.muscle] = makeMuscleGoal({
      muscle: p.muscle,
      objective: p.objective,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });

  for (const sg of suggestions) {
    if (goals[sg.muscle] !== undefined) continue; // déjà PRIORITAIRE
    if (draft.acceptedSuggestions.has(sg.muscle)) {
      goals[sg.muscle] = sg; // SUGGERE / MAINTIEN
    } else {
      goals[sg.muscle] = makeMuscleGoal({
        muscle: sg.muscle,
        objective: MuscleObjective.MAINTIEN,
        status: MuscleStatus.NON_COUVERT,
      });
    }
  }

  return goals;
}

// =============================================================================
// Garde-fou
// =============================================================================

/** Vrai si l'utilisateur n'a coché aucun muscle ≠ NON_COUVERT. */
export function isEmptySelection(draft: OnboardingDraft): boolean {
  return draft.priorities.length === 0;
}

// =============================================================================
// Catalogue UX d'équipements (chips de l'étape 1)
// =============================================================================

export interface EquipmentChip {
  readonly id: string;
  readonly label: string;
  readonly equip: readonly string[];
}

/**
 * Regroupement UX des codes équipement (`exercises.json`) en chips compréhensibles.
 * Chaque chip mappe sur 1..N codes. L'utilisateur peut tout cocher d'un coup
 * via le préset "Salle complète".
 */
export const EQUIPMENT_CHIPS: readonly EquipmentChip[] = [
  { id: 'bb', label: 'Barre olympique + rack', equip: ['bb_oly', 'rack'] },
  { id: 'db', label: 'Haltères', equip: ['db'] },
  { id: 'bench_flat', label: 'Banc plat', equip: ['bench_flat'] },
  { id: 'bench_incl', label: 'Banc inclinable', equip: ['bench_incl', 'bench_decl'] },
  { id: 'pull_bar', label: 'Barre de traction', equip: ['pull_bar', 'assisted_pullup'] },
  { id: 'dip_bar', label: 'Barres parallèles (dips)', equip: ['dip_bar'] },
  { id: 'cable', label: 'Poulies', equip: ['cable_low', 'cable_high', 'cable_double'] },
  { id: 'smith', label: 'Smith machine', equip: ['smith'] },
  {
    id: 'machines_upper',
    label: 'Machines haut du corps',
    equip: [
      'lat_pulldown', 'seated_row', 'chest_press', 'pec_deck',
      'lateral_machine', 'preacher',
    ],
  },
  {
    id: 'machines_lower',
    label: 'Machines bas du corps',
    equip: [
      'leg_press', 'hack_squat', 'leg_curl_lying', 'leg_curl_seated',
      'leg_extension', 'glute_machine', 'calf_standing', 'calf_seated',
      'reverse_hyper', 'glute_ham',
    ],
  },
  {
    id: 'misc',
    label: 'Autres (back ext, ab wheel)',
    equip: ['back_extension', 'ab_wheel'],
  },
];

export const EQUIPMENT_PRESET_FULL_GYM: ReadonlySet<string> = new Set(
  EQUIPMENT_CHIPS.flatMap((c) => c.equip),
);

export const EQUIPMENT_PRESET_HOME_BASIC: ReadonlySet<string> = new Set([
  'db', 'bench_flat', 'pull_bar', 'assisted_pullup',
]);

/** Renvoie les ids des chips entièrement satisfaites par `equipment`. */
export function activeChipIds(equipment: ReadonlySet<string>): Set<string> {
  const active = new Set<string>();
  for (const chip of EQUIPMENT_CHIPS) {
    if (chip.equip.every((e) => equipment.has(e))) {
      active.add(chip.id);
    }
  }
  return active;
}

export function toggleChip(
  equipment: ReadonlySet<string>,
  chip: EquipmentChip,
): Set<string> {
  const next = new Set(equipment);
  const allOn = chip.equip.every((e) => next.has(e));
  if (allOn) {
    for (const e of chip.equip) next.delete(e);
  } else {
    for (const e of chip.equip) next.add(e);
  }
  return next;
}
