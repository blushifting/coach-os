/**
 * Tests purs sur `src/lib/catalog-filter.ts` — sélecteurs de l'onglet Catalogue.
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  ChargeType,
  E1RMApp,
  ExType,
  Pattern,
  exerciseFromDict,
} from '@/engine/models';
import type { Exercise, ExerciseDict } from '@/engine/models';
import {
  EMPTY_FILTERS,
  EXTYPE_LABEL_FR,
  PATTERN_LABEL_FR,
  applyFilters,
  buildDescription,
  chargeLabel,
  extypeLabel,
  hasActiveFilters,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';

// =============================================================================
// Fixtures
// =============================================================================

function ex(
  partial: Partial<ExerciseDict> & Pick<ExerciseDict, 'id'>,
): Exercise {
  return exerciseFromDict({
    id: partial.id,
    nom_fr: partial.nom_fr ?? `Exo ${partial.id}`,
    pattern: (partial.pattern as string | undefined) ?? Pattern.PUSH_H,
    type: (partial.type as string | undefined) ?? ExType.COMPOUND,
    charge: (partial.charge as string | undefined) ?? ChargeType.BARBELL,
    equip: partial.equip ?? [],
    uni: partial.uni ?? false,
    muscles: partial.muscles ?? { pectoraux: 1.0 },
    subst: partial.subst ?? partial.id,
    inc_kg: partial.inc_kg ?? 2.5,
    reps_hyp: partial.reps_hyp ?? [6, 10],
    reps_force: partial.reps_force ?? null,
    repos_s: partial.repos_s ?? 120,
    dif: partial.dif ?? 'moyen',
    e1RM_app: (partial.e1RM_app as string | undefined) ?? E1RMApp.FULL,
    tags: partial.tags ?? [],
    note: partial.note ?? '',
    synonymes: partial.synonymes ?? [],
  });
}

function makeCatalog(items: Exercise[]): Catalog {
  return new Catalog(items);
}

// =============================================================================
// 1. Labels FR
// =============================================================================

describe('labels FR', () => {
  it('extypeLabel("compound") = "Polyarticulaire" (vocabulaire UI 08 §2)', () => {
    expect(extypeLabel(ExType.COMPOUND)).toBe('Polyarticulaire');
    expect(extypeLabel(ExType.ISOLATION)).toBe('Isolation');
  });

  it('patternLabel couvre les 9 patterns', () => {
    for (const p of Object.values(Pattern)) {
      expect(PATTERN_LABEL_FR[p]).toBeTruthy();
      expect(patternLabel(p)).not.toBe(p);
    }
  });

  it('chargeLabel couvre tous les ChargeType', () => {
    for (const c of Object.values(ChargeType)) {
      const label = chargeLabel(c);
      expect(label).toBeTruthy();
      expect(label).not.toBe(c); // toujours traduit
    }
  });

  it('tagLabel retourne null pour tags inconnus, label FR pour connus', () => {
    expect(tagLabel('lengthened_bias')).toBe('Étirement');
    expect(tagLabel('pause_3s')).toBe('Pause 3s');
    expect(tagLabel('tag_inexistant_xyz')).toBe(null);
  });

  it("aucun label FR n'est en anglais", () => {
    const forbidden = /compound|isolation_en|push|pull|hinge|squat|barbell|dumbbell|machine|cable|bodyweight/i;
    // On vérifie que les labels exposés à l'UI ne contiennent pas les mots anglais bruts.
    // (Exception : "compound" devient "Polyarticulaire", pas "Compound".)
    for (const v of Object.values(EXTYPE_LABEL_FR)) {
      expect(v).not.toMatch(forbidden);
    }
  });
});

// =============================================================================
// 2. buildDescription
// =============================================================================

describe('buildDescription', () => {
  it('utilise la note manuelle si elle existe (audit ciblé)', () => {
    const e = ex({
      id: 'foo',
      note: 'Variante avec pause de 3 secondes en position basse.',
    });
    expect(buildDescription(e)).toBe(
      'Variante avec pause de 3 secondes en position basse.',
    );
  });

  it('ignore une note vide ou whitespace-only', () => {
    const e = ex({ id: 'foo', note: '   ' });
    expect(buildDescription(e)).not.toBe('   ');
    expect(buildDescription(e)).toContain('Polyarticulaire');
  });

  it('génère "Polyarticulaire — poussée horizontale. Cible les pectoraux."', () => {
    const e = ex({
      id: 'bench',
      pattern: Pattern.PUSH_H,
      type: ExType.COMPOUND,
      muscles: { pectoraux: 1.0, triceps: 0.5 },
    });
    const d = buildDescription(e);
    expect(d).toContain('Polyarticulaire');
    expect(d.toLowerCase()).toContain('poussée horizontale');
    expect(d.toLowerCase()).toContain('pectoraux');
    // triceps en synergiste → pas dans la cible
    expect(d.toLowerCase()).not.toContain('triceps');
  });

  it('joint plusieurs muscles primaires avec virgule + "et"', () => {
    const e = ex({
      id: 'squat',
      pattern: Pattern.SQUAT,
      type: ExType.COMPOUND,
      muscles: { quadriceps: 1.0, fessiers: 1.0, ischios: 1.0 },
    });
    const d = buildDescription(e);
    expect(d.toLowerCase()).toMatch(/quadriceps.*fessiers.*et.*ischios/);
  });

  it('isolation sans primaire → pas de "Cible"', () => {
    const e = ex({
      id: 'iso',
      type: ExType.ISOLATION,
      pattern: Pattern.ISOLATION,
      muscles: { biceps: 0.5 }, // pas de primaire
    });
    const d = buildDescription(e);
    expect(d).toContain('Isolation');
    expect(d).not.toContain('Cible');
  });
});

// =============================================================================
// 3. applyFilters
// =============================================================================

describe('applyFilters', () => {
  const allExos = [
    ex({ id: 'bench_bb', nom_fr: 'Développé couché barre', pattern: Pattern.PUSH_H, type: ExType.COMPOUND, charge: ChargeType.BARBELL, muscles: { pectoraux: 1.0 } }),
    ex({ id: 'bench_db', nom_fr: 'Développé couché haltères', pattern: Pattern.PUSH_H, type: ExType.COMPOUND, charge: ChargeType.DUMBBELL, muscles: { pectoraux: 1.0 }, tags: ['lengthened_bias'] }),
    ex({ id: 'squat_bb', nom_fr: 'Squat barre', pattern: Pattern.SQUAT, type: ExType.COMPOUND, charge: ChargeType.BARBELL, muscles: { quadriceps: 1.0, fessiers: 0.7 } }),
    ex({ id: 'leg_ext', nom_fr: 'Leg extension', pattern: Pattern.ISOLATION, type: ExType.ISOLATION, charge: ChargeType.MACHINE_STACK, muscles: { quadriceps: 1.0 } }),
    ex({ id: 'curl_db', nom_fr: 'Curl haltères', pattern: Pattern.ISOLATION, type: ExType.ISOLATION, charge: ChargeType.DUMBBELL, muscles: { biceps: 1.0 } }),
  ];
  const cat = makeCatalog(allExos);

  it('aucun filtre → tous les exos dans l\'ordre du catalogue', () => {
    const out = applyFilters(cat, EMPTY_FILTERS);
    expect(out).toHaveLength(allExos.length);
    expect(out.map((e) => e.id)).toEqual(allExos.map((e) => e.id));
  });

  it('texte "bench" → 2 résultats triés par score fuzzy', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, text: 'bench' });
    expect(out.map((e) => e.id)).toEqual(['bench_bb', 'bench_db']);
  });

  it('texte qui ne matche rien → liste vide', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, text: 'xyzabc' });
    expect(out).toEqual([]);
  });

  it('filtre muscle = pectoraux → 2 résultats', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, muscles: ['pectoraux'] });
    expect(out.map((e) => e.id).sort()).toEqual(['bench_bb', 'bench_db']);
  });

  it('filtre muscle = quadriceps → on garde aussi le squat (primaire)', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, muscles: ['quadriceps'] });
    expect(out.map((e) => e.id).sort()).toEqual(['leg_ext', 'squat_bb']);
  });

  it('plusieurs muscles → OR entre eux', () => {
    const out = applyFilters(cat, {
      ...EMPTY_FILTERS,
      muscles: ['pectoraux', 'biceps'],
    });
    expect(out.map((e) => e.id).sort()).toEqual([
      'bench_bb',
      'bench_db',
      'curl_db',
    ]);
  });

  it('filtre charge = barbell uniquement', () => {
    const out = applyFilters(cat, {
      ...EMPTY_FILTERS,
      charges: [ChargeType.BARBELL],
    });
    expect(out.map((e) => e.id).sort()).toEqual(['bench_bb', 'squat_bb']);
  });

  it('filtre type isolation', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, types: [ExType.ISOLATION] });
    expect(out.map((e) => e.id).sort()).toEqual(['curl_db', 'leg_ext']);
  });

  it('filtre lengthenedBiasOnly garde uniquement les exos étirés', () => {
    const out = applyFilters(cat, { ...EMPTY_FILTERS, lengthenedBiasOnly: true });
    expect(out.map((e) => e.id)).toEqual(['bench_db']);
  });

  it('plusieurs catégories combinées (AND) : pattern=push_h + charge=dumbbell', () => {
    const out = applyFilters(cat, {
      ...EMPTY_FILTERS,
      patterns: [Pattern.PUSH_H],
      charges: [ChargeType.DUMBBELL],
    });
    expect(out.map((e) => e.id)).toEqual(['bench_db']);
  });

  it('texte + filtre statique : texte "bench" + pattern=push_h → ne change rien (les 2 matchent)', () => {
    const out = applyFilters(cat, {
      ...EMPTY_FILTERS,
      text: 'bench',
      patterns: [Pattern.PUSH_H],
    });
    expect(out.map((e) => e.id)).toEqual(['bench_bb', 'bench_db']);
  });

  it('texte + filtre incompatible → liste vide', () => {
    const out = applyFilters(cat, {
      ...EMPTY_FILTERS,
      text: 'bench',
      patterns: [Pattern.SQUAT],
    });
    expect(out).toEqual([]);
  });
});

// =============================================================================
// 4. hasActiveFilters
// =============================================================================

describe('hasActiveFilters', () => {
  it('EMPTY_FILTERS → false', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('texte non vide → true (même après trim)', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, text: 'bench' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, text: '   ' })).toBe(false);
  });

  it('chaque catégorie déclenche active', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, muscles: ['pectoraux'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, patterns: [Pattern.SQUAT] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, charges: [ChargeType.BARBELL] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, types: [ExType.COMPOUND] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, lengthenedBiasOnly: true })).toBe(true);
  });
});

// =============================================================================
// 5. Sanité sur le catalogue réel (anti-régression mot anglais "compound")
// =============================================================================

describe('catalogue réel', () => {
  it('aucun exo n\'a "compound" dans son nom_fr (le mot ne doit pas fuiter en UI)', () => {
    const real = new Catalog();
    for (const e of real.all()) {
      expect(e.nom_fr.toLowerCase()).not.toContain('compound');
    }
  });

  it('extypeLabel sur tous les exos donne un mot français', () => {
    const real = new Catalog();
    for (const e of real.all()) {
      const lbl = extypeLabel(e.type);
      expect(lbl).toMatch(/^(Polyarticulaire|Isolation)$/);
    }
  });
});
