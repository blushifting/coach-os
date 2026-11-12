/**
 * Tests purs sur `src/lib/profile-edit.ts` — sélecteurs de l'onglet Profil.
 */

import { describe, expect, it } from 'vitest';
import {
  Level,
  MuscleIntention,
  Sex,
  makeMuscleGoal,
  makeProfile,
  makeUserState,
  type UserState,
} from '@/engine/models';
import {
  buildProfileFromDraft,
  goalsDraftFromState,
  profileDraftFromState,
} from '@/lib/profile-edit';

function fixtureUserState(): UserState {
  const profile = makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    sessions_per_week: 4,
    bodyweight_kg: 78,
    available_equip: new Set(['bb_oly', 'rack', 'db']),
  });
  const state = makeUserState(profile);
  state.muscle_goals = {
    pectoraux: makeMuscleGoal({
      muscle: 'pectoraux',
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: 2,
    }),
    dos_largeur: makeMuscleGoal({
      muscle: 'dos_largeur',
      intention: MuscleIntention.DEVELOPPER,
      priority_rank: 1,
    }),
    biceps: makeMuscleGoal({ muscle: 'biceps', intention: MuscleIntention.ENTRETENIR }),
  };
  return state;
}

describe('profileDraftFromState', () => {
  it("expose les champs du Profile sous une forme camelCase prête pour l'UI", () => {
    const draft = profileDraftFromState(fixtureUserState());
    expect(draft.sex).toBe(Sex.HOMME);
    expect(draft.age).toBe(30);
    expect(draft.bodyweightKg).toBe(78);
    expect(draft.level).toBe(Level.INTERMEDIAIRE);
    expect(draft.sessionsPerWeek).toBe(4);
    expect([...draft.equipment].sort()).toEqual(['bb_oly', 'db', 'rack']);
  });

  it('isole le Set équipement (mutation du draft ne touche pas le state)', () => {
    const state = fixtureUserState();
    const draft = profileDraftFromState(state);
    (draft.equipment as Set<string>).add('cable_low');
    expect(state.profile.available_equip.has('cable_low')).toBe(false);
  });
});

describe('goalsDraftFromState', () => {
  it('renvoie les muscles à développer triés par rang croissant', () => {
    const draft = goalsDraftFromState(fixtureUserState());
    expect(draft.priorities).toEqual(['dos_largeur', 'pectoraux']);
  });

  it('expose les muscles à entretenir à part', () => {
    const draft = goalsDraftFromState(fixtureUserState());
    expect([...draft.maintenance]).toEqual(['biceps']);
  });
});

describe('buildProfileFromDraft', () => {
  it("reconstruit un Profile valide depuis un draft", () => {
    const state = fixtureUserState();
    const draft = profileDraftFromState(state);
    const profile = buildProfileFromDraft({
      ...draft,
      age: 35,
      bodyweightKg: 80,
    });
    expect(profile.age).toBe(35);
    expect(profile.bodyweight_kg).toBe(80);
    expect(profile.available_equip.has('bb_oly')).toBe(true);
  });

  it("rejette un draft hors invariants (âge < 14)", () => {
    const draft = profileDraftFromState(fixtureUserState());
    expect(() => buildProfileFromDraft({ ...draft, age: 10 })).toThrow();
  });
});
