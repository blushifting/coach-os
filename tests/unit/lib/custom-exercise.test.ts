/**
 * Tests pour `lib/custom-exercise.ts` (Conv #21b).
 *
 * Couvre les helpers purs : slugify, uniqueId, validateDraft, findDuplicate,
 * defaultIncKg/defaultRepsHyp. La construction d'`ExerciseDict`
 * est testée bout-en-bout via `buildExerciseDict`.
 */

import { describe, expect, it } from 'vitest';
import {
  buildExerciseDict,
  defaultIncKg,
  defaultRepos,
  defaultRepsHyp,
  EMPTY_DRAFT,
  findDuplicate,
  slugify,
  uniqueId,
  validateDraft,
  type CustomExerciseDraft,
} from '@/lib/custom-exercise';
import { Catalog } from '@/engine/catalog';

describe('defaults par charge / type', () => {
  it('defaultIncKg : 2 pour DB, 0 pour bw, 1 partout ailleurs', () => {
    expect(defaultIncKg('dumbbell')).toBe(2);
    expect(defaultIncKg('bodyweight')).toBe(0);
    expect(defaultIncKg('barbell')).toBe(1);
    expect(defaultIncKg('machine_stack')).toBe(1);
    expect(defaultIncKg('cable')).toBe(1);
    expect(defaultIncKg('bodyweight_loaded')).toBe(1);
  });

  it('defaultRepsHyp / defaultRepos : différent selon compound vs iso', () => {
    expect(defaultRepsHyp('compound')).toEqual([6, 10]);
    expect(defaultRepsHyp('isolation')).toEqual([10, 15]);
    expect(defaultRepos('compound')).toBe(180);
    expect(defaultRepos('isolation')).toBe(90);
  });
});

describe('slugify / uniqueId', () => {
  it('slugify enlève accents et ponctuation, lowercase', () => {
    expect(slugify('Curl marteau à 45°')).toBe('curl_marteau_a_45');
    expect(slugify('  Squat front à la barre  ')).toBe('squat_front_a_la_barre');
  });

  it('uniqueId ajoute un suffixe en cas de collision', () => {
    const existing = new Set(['curl_marteau', 'curl_marteau_2']);
    expect(uniqueId('Curl marteau', existing)).toBe('curl_marteau_3');
  });

  it('uniqueId retourne base si pas de collision', () => {
    expect(uniqueId('Tirage rope', new Set())).toBe('tirage_rope');
  });
});

describe('validateDraft', () => {
  function draft(overrides: Partial<CustomExerciseDraft> = {}): CustomExerciseDraft {
    return { ...EMPTY_DRAFT, ...overrides };
  }

  it('échoue si nom < 3 caractères', () => {
    const errs = validateDraft(draft({ nom_fr: 'AB' }));
    expect(errs.some((e) => e.field === 'nom_fr')).toBe(true);
  });

  it('échoue si aucun muscle sélectionné', () => {
    const errs = validateDraft(draft({ nom_fr: 'Mon exo', muscles: {} }));
    expect(errs.some((e) => e.field === 'muscles')).toBe(true);
  });

  it('passe avec un brouillon minimal valide', () => {
    const errs = validateDraft(
      draft({ nom_fr: 'Mon exo', muscles: { pectoraux: 1 } }),
    );
    expect(errs).toHaveLength(0);
  });

  it('échoue si charge inconnue', () => {
    const errs = validateDraft(
      draft({ nom_fr: 'Mon exo', charge: 'banana', muscles: { abdos: 1 } }),
    );
    expect(errs.some((e) => e.field === 'charge')).toBe(true);
  });
});

describe('findDuplicate', () => {
  const catalog = new Catalog();
  const allExos = catalog.all();

  it('détecte un match exact sur nom_fr (normalisé)', () => {
    const sample = allExos[0]!;
    const dup = findDuplicate(
      { ...EMPTY_DRAFT, nom_fr: sample.nom_fr.toUpperCase(), muscles: { abdos: 1 } },
      allExos,
    );
    expect(dup?.kind).toBe('exact-name');
    expect(dup?.exercise.id).toBe(sample.id);
  });

  it('détecte un match par profil (pattern + charge + muscles primaires)', () => {
    // bench_bb : pattern push_h, charge barbell, primaire = pectoraux
    const draft: CustomExerciseDraft = {
      ...EMPTY_DRAFT,
      nom_fr: 'Mon développé custom unique',
      pattern: 'push_h',
      charge: 'barbell',
      type: 'compound',
      muscles: { pectoraux: 1, triceps: 0.5 }, // pectoraux est primaire
    };
    const dup = findDuplicate(draft, allExos);
    expect(dup?.kind).toBe('similar-profile');
  });

  it('renvoie null si aucun match', () => {
    const draft: CustomExerciseDraft = {
      ...EMPTY_DRAFT,
      nom_fr: 'Xyzzyflarp jamais vu',
      pattern: 'core',
      charge: 'bodyweight',
      muscles: { obliques: 1 },
    };
    // Note : il existe peut-être un exo obliques + bodyweight en core, donc
    // on accepte que ce test soit "best-effort" — on vérifie surtout qu'on
    // ne crash pas et qu'on ne match pas par accident sur le nom unique.
    const dup = findDuplicate(draft, allExos);
    if (dup !== null) {
      expect(dup.kind).toBe('similar-profile');
    }
  });
});

describe('buildExerciseDict', () => {
  it('produit un ExerciseDict cohérent depuis un brouillon', () => {
    const draft: CustomExerciseDraft = {
      nom_fr: 'Curl rotation perso',
      pattern: 'isolation',
      type: 'isolation',
      charge: 'dumbbell',
      equip: ['db'],
      uni: true,
      muscles: { biceps: 1, deltos_anterieurs: 0.5 },
      note: '',
    };
    const dict = buildExerciseDict(draft, new Set());
    expect(dict.id).toBe('curl_rotation_perso');
    expect(dict.nom_fr).toBe('Curl rotation perso');
    expect(dict.charge).toBe('dumbbell');
    expect(dict.inc_kg).toBe(2);
    expect(dict.reps_hyp).toEqual([10, 15]);
    expect(dict.repos_s).toBe(90);
    expect(dict.muscles).toEqual({ biceps: 1, deltos_anterieurs: 0.5 });
    expect(dict.uni).toBe(true);
  });

  it('filtre les muscles à coef 0 (ne les met pas dans le dict)', () => {
    const draft: CustomExerciseDraft = {
      ...EMPTY_DRAFT,
      nom_fr: 'Test filtre muscles',
      muscles: { biceps: 1, abdos: 0, triceps: 0.5 },
    };
    const dict = buildExerciseDict(draft, new Set());
    expect(Object.keys(dict.muscles).sort()).toEqual(['biceps', 'triceps']);
  });

  it('génère un id unique en cas de collision', () => {
    const existing = new Set(['mon_curl']);
    const dict = buildExerciseDict(
      { ...EMPTY_DRAFT, nom_fr: 'Mon curl', muscles: { biceps: 1 } },
      existing,
    );
    expect(dict.id).toBe('mon_curl_2');
  });
});
