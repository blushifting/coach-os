/**
 * Sélecteurs purs pour la page Profil (Conv #6c).
 *
 * Convertit `UserState` ↔ drafts d'édition. Pas de side-effect, testable isolément.
 *
 * - `profileDraftFromState` : `UserState` → état des inputs de l'éditeur profil.
 * - `goalsDraftFromState`   : `UserState` → liste ordonnée des PRIORITAIRE +
 *   set des SUGGERE acceptés (équivalent fonctionnel du `OnboardingDraft`
 *   restreint aux étapes 2-3).
 * - `buildProfileFromDraft` : reconstruit un `Profile` valide depuis le draft.
 * - `buildGoalsFromDraft`   : reconstruit le `Record<string, MuscleGoal>` final.
 *   Délègue le calcul R1-R4 au moteur (`useEngine.updateMuscleGoals` applique
 *   les SUGGERE après — ici on ne pose que les PRIORITAIRE et les
 *   NON_COUVERT explicites pour respecter le contrat de `applyBalanceRules`).
 */

import {
  GymBrand,
  MuscleObjective,
  MuscleStatus,
  makeMuscleGoal,
  makeProfile,
  type Level,
  type MuscleGoal,
  type Objective,
  type Profile,
  type Sex,
  type UserState,
} from '@/engine/models';

export interface ProfileDraft {
  readonly sex: Sex;
  readonly age: number;
  readonly bodyweightKg: number;
  readonly level: Level;
  readonly objective: Objective;
  readonly sessionsPerWeek: number;
  readonly equipment: ReadonlySet<string>;
  /** Conv #23 — marque salle (libellés exos). Default NONE. */
  readonly gymBrand: GymBrand;
}

export interface RankedGoal {
  readonly muscle: string;
  readonly objective: MuscleObjective;
}

export interface GoalsDraft {
  /** PRIORITAIRE, dans l'ordre du `priority_rank` croissant (1, 2, 3…). */
  readonly priorities: readonly RankedGoal[];
  /** Muscles SUGGERE acceptés (status === SUGGERE et non PRIORITAIRE). */
  readonly acceptedSuggestions: ReadonlySet<string>;
}

// =============================================================================
// UserState → drafts
// =============================================================================

export function profileDraftFromState(state: UserState): ProfileDraft {
  return {
    sex: state.profile.sex,
    age: state.profile.age,
    bodyweightKg: state.profile.bodyweight_kg,
    level: state.profile.level,
    objective: state.profile.objective,
    sessionsPerWeek: state.profile.sessions_per_week,
    equipment: new Set(state.profile.available_equip),
    gymBrand: state.profile.gym_brand ?? GymBrand.NONE,
  };
}

export function goalsDraftFromState(state: UserState): GoalsDraft {
  const priorities: RankedGoal[] = [];
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
  return { priorities, acceptedSuggestions: accepted };
}

// =============================================================================
// Drafts → entités moteur
// =============================================================================

export function buildProfileFromDraft(draft: ProfileDraft): Profile {
  return makeProfile({
    sex: draft.sex,
    age: draft.age,
    level: draft.level,
    objective: draft.objective,
    sessions_per_week: draft.sessionsPerWeek,
    bodyweight_kg: draft.bodyweightKg,
    available_equip: draft.equipment,
    gym_brand: draft.gymBrand,
  });
}

/**
 * Construit le `muscle_goals` à passer à `updateMuscleGoals`.
 *
 * - PRIORITAIRE : un par muscle, dans l'ordre du ranking (rank = i+1).
 * - NON_COUVERT explicites (`previousNonCovered`) : préservés pour que
 *   `applyBalanceRules` ne re-suggère pas un muscle que l'utilisateur a
 *   refusé. C'est le miroir de l'étape 3 de l'onboarding.
 *
 * Les SUGGERE seront recomposés par `applyBalanceRules` côté `updateMuscleGoals`,
 * donc on ne les pose pas ici.
 */
export function buildGoalsFromDraft(
  draft: GoalsDraft,
  /** Muscles que l'utilisateur a explicitement refusé (NON_COUVERT à préserver). */
  explicitNonCovered: ReadonlySet<string> = new Set(),
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
  for (const m of explicitNonCovered) {
    if (goals[m] !== undefined) continue;
    goals[m] = makeMuscleGoal({
      muscle: m,
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.NON_COUVERT,
    });
  }
  return goals;
}

/**
 * Extrait les NON_COUVERT explicites de l'état courant (utile pour reconduire
 * les refus utilisateur précédents quand on met à jour les goals).
 */
export function explicitNonCoveredFromState(state: UserState): Set<string> {
  const set = new Set<string>();
  for (const g of Object.values(state.muscle_goals)) {
    if (g.status === MuscleStatus.NON_COUVERT) set.add(g.muscle);
  }
  return set;
}

