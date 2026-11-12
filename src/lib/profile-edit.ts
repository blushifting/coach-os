/**
 * Sélecteurs purs pour la page Profil (Conv #6c).
 *
 * Convertit `UserState` ↔ drafts d'édition. Pas de side-effect, testable isolément.
 *
 * - `profileDraftFromState` : `UserState` → état des inputs de l'éditeur profil.
 * - `goalsDraftFromState`   : `UserState` → muscles à développer (dans l'ordre
 *   de leur rang) et muscles à entretenir (dump 2.4, D2).
 * - `buildProfileFromDraft` : reconstruit un `Profile` valide depuis le draft.
 *
 * Les intentions se modifient par le parcours d'onboarding (redémarrage
 * partiel), pas ici.
 */

import {
  GymBrand,
  MuscleIntention,
  makeProfile,
  type Level,
  type Profile,
  type Sex,
  type UserState,
} from '@/engine/models';

export interface ProfileDraft {
  readonly sex: Sex;
  readonly age: number;
  readonly bodyweightKg: number;
  readonly level: Level;
  readonly sessionsPerWeek: number;
  readonly equipment: ReadonlySet<string>;
  /** Conv #23 — marque salle (libellés exos). Default NONE. */
  readonly gymBrand: GymBrand;
}

export interface GoalsDraft {
  /** Muscles à développer, dans l'ordre du `priority_rank` croissant (1, 2, 3…). */
  readonly priorities: readonly string[];
  /** Muscles à entretenir. */
  readonly maintenance: ReadonlySet<string>;
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
    sessionsPerWeek: state.profile.sessions_per_week,
    equipment: new Set(state.profile.available_equip),
    gymBrand: state.profile.gym_brand ?? GymBrand.NONE,
  };
}

export function goalsDraftFromState(state: UserState): GoalsDraft {
  const goals = Object.values(state.muscle_goals);
  const priorities = goals
    .filter((g) => g.intention === MuscleIntention.DEVELOPPER)
    .sort((a, b) => a.priority_rank - b.priority_rank)
    .map((g) => g.muscle);
  const maintenance = new Set(
    goals.filter((g) => g.intention === MuscleIntention.ENTRETENIR).map((g) => g.muscle),
  );
  return { priorities, maintenance };
}

// =============================================================================
// Drafts → entités moteur
// =============================================================================

export function buildProfileFromDraft(draft: ProfileDraft): Profile {
  return makeProfile({
    sex: draft.sex,
    age: draft.age,
    level: draft.level,
    sessions_per_week: draft.sessionsPerWeek,
    bodyweight_kg: draft.bodyweightKg,
    available_equip: draft.equipment,
    gym_brand: draft.gymBrand,
  });
}
