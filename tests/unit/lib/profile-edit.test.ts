/**
 * Tests purs sur `src/lib/profile-edit.ts` — sélecteurs de l'onglet Profil.
 */

import { describe, expect, it } from 'vitest';
import {
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  Sex,
  makeMuscleGoal,
  makeProfile,
  makeUserState,
  type UserState,
} from '@/engine/models';
import {
  buildGoalsFromDraft,
  buildProfileFromDraft,
  explicitNonCoveredFromState,
  goalsDraftFromState,
  profileDraftFromState,
} from '@/lib/profile-edit';

function fixtureUserState(): UserState {
  const profile = makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: 78,
    available_equip: new Set(['bb_oly', 'rack', 'db']),
  });
  const state = makeUserState(profile);
  state.muscle_goals = {
    pectoraux: makeMuscleGoal({
      muscle: 'pectoraux',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 2,
    }),
    dos_largeur: makeMuscleGoal({
      muscle: 'dos_largeur',
      objective: MuscleObjective.FORCE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 1,
    }),
    biceps: makeMuscleGoal({
      muscle: 'biceps',
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.SUGGERE,
      priority_rank: 99,
    }),
    triceps: makeMuscleGoal({
      muscle: 'triceps',
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.NON_COUVERT,
      priority_rank: 99,
    }),
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
    expect(draft.objective).toBe(Objective.HYPERTROPHIE);
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
  it('renvoie les PRIORITAIRE triés par priority_rank ascendant', () => {
    const draft = goalsDraftFromState(fixtureUserState());
    expect(draft.priorities.map((p) => p.muscle)).toEqual([
      'dos_largeur',
      'pectoraux',
    ]);
    expect(draft.priorities[0]!.objective).toBe(MuscleObjective.FORCE);
    expect(draft.priorities[1]!.objective).toBe(MuscleObjective.HYPERTROPHIE);
  });

  it('expose les SUGGERE dans acceptedSuggestions, ignore les NON_COUVERT', () => {
    const draft = goalsDraftFromState(fixtureUserState());
    expect([...draft.acceptedSuggestions].sort()).toEqual(['biceps']);
  });
});

describe('explicitNonCoveredFromState', () => {
  it('renvoie uniquement les muscles NON_COUVERT', () => {
    const explicit = explicitNonCoveredFromState(fixtureUserState());
    expect([...explicit]).toEqual(['triceps']);
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

describe('buildGoalsFromDraft', () => {
  it('produit PRIORITAIRE rank=i+1 dans l\'ordre du draft', () => {
    const goals = buildGoalsFromDraft({
      priorities: [
        { muscle: 'quadriceps', objective: MuscleObjective.HYPERTROPHIE },
        { muscle: 'fessiers', objective: MuscleObjective.FORCE },
      ],
      acceptedSuggestions: new Set(),
    });
    expect(goals.quadriceps?.priority_rank).toBe(1);
    expect(goals.quadriceps?.status).toBe(MuscleStatus.PRIORITAIRE);
    expect(goals.fessiers?.priority_rank).toBe(2);
    expect(goals.fessiers?.objective).toBe(MuscleObjective.FORCE);
  });

  it("réinsère les NON_COUVERT explicites pour préserver les refus", () => {
    const goals = buildGoalsFromDraft(
      {
        priorities: [
          { muscle: 'pectoraux', objective: MuscleObjective.HYPERTROPHIE },
        ],
        acceptedSuggestions: new Set(),
      },
      new Set(['triceps']),
    );
    expect(goals.triceps?.status).toBe(MuscleStatus.NON_COUVERT);
    expect(goals.triceps?.objective).toBe(MuscleObjective.MAINTIEN);
  });

  it("ne réécrase pas un PRIORITAIRE par un NON_COUVERT", () => {
    const goals = buildGoalsFromDraft(
      {
        priorities: [
          { muscle: 'triceps', objective: MuscleObjective.FORCE },
        ],
        acceptedSuggestions: new Set(),
      },
      new Set(['triceps']),
    );
    expect(goals.triceps?.status).toBe(MuscleStatus.PRIORITAIRE);
    expect(goals.triceps?.objective).toBe(MuscleObjective.FORCE);
  });
});
