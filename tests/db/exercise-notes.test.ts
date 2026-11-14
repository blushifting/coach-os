import { describe, expect, it } from 'vitest';
import { deserializeUserState, serializeUserState } from '@/db/serialize';
import { Level, makeProfile, makeUserState, Sex } from '@/engine/models';

// Dump 2.4, n° 14 — note libre par exercice.
describe('notes sur les exercices', () => {
  function state() {
    return makeUserState(
      makeProfile({
        sex: Sex.HOMME,
        age: 30,
        level: Level.INTERMEDIAIRE,
        sessions_per_week: 3,
        bodyweight_kg: 70,
        available_equip: new Set(['pec_deck']),
      }),
    );
  }

  it('la note survit à la sauvegarde', () => {
    const st = state();
    st.exercise_notes = { pec_deck: 'Siège cran 4' };
    expect(deserializeUserState(serializeUserState(st)).exercise_notes).toEqual({
      pec_deck: 'Siège cran 4',
    });
  });

  it('une ancienne sauvegarde sans notes se lit, une note vide est ignorée', () => {
    const { exercise_notes: _absent, ...old } = serializeUserState(state());
    void _absent;
    expect(deserializeUserState(old).exercise_notes).toEqual({});
    const raw = { ...serializeUserState(state()), exercise_notes: { pec_deck: '  ', curl: 'Coudes fixes' } };
    expect(deserializeUserState(raw).exercise_notes).toEqual({ curl: 'Coudes fixes' });
  });
});
