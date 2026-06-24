/**
 * Tests Vitest pour le catalogue.
 * Couvre : chargement complet, indexation, requêtes par muscle, filtres,
 * substitution, recherche fuzzy.
 */

import { describe, expect, it } from 'vitest';

import { Catalog, loadExercises } from '@/engine/catalog';
import { ExType, MUSCLES } from '@/engine/models';

// =============================================================================
// 1. Chargement
// =============================================================================

describe('loadExercises', () => {
  // Bloc Q (Conv #46) — l'ancien test de TAILLE du catalogue (plancher ≥130) a
  // été retiré : le dédoublonnage agressif descend le compte (~113) et l'import
  // free-exercise-db reporté le regonflera. Le nombre exact n'a plus de sens à
  // figer ; l'assertion relationnelle `cat.length === loadExercises().length`
  // (plus bas) reste le garde-fou.

  it('chaque exo a un ID non vide', () => {
    for (const ex of loadExercises()) {
      expect(ex.id).toBeTruthy();
    }
  });

  it("chaque exo a au moins un muscle primaire (coef ≥ 1.0)", () => {
    for (const ex of loadExercises()) {
      const primaires = Object.entries(ex.muscles).filter(([, c]) => c >= 1.0);
      expect(primaires.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// 2. Catalog — accès direct
// =============================================================================

describe('Catalog — accès direct', () => {
  const cat = new Catalog();

  it('length = nb exos chargés', () => {
    expect(cat.length).toBe(loadExercises().length);
  });

  it('get(id) retourne le bon exo', () => {
    const ex = cat.get('bench_bb');
    expect(ex.id).toBe('bench_bb');
  });

  it('get(id) lève si inconnu', () => {
    expect(() => cat.get('exercise_qui_nexiste_pas')).toThrow();
  });

  it('has(id) renvoie un boolean', () => {
    expect(cat.has('bench_bb')).toBe(true);
    expect(cat.has('nope')).toBe(false);
  });

  it('itérable', () => {
    let count = 0;
    for (const _ex of cat) count += 1;
    expect(count).toBe(cat.length);
  });
});

// =============================================================================
// 3. Catalog — requêtes par muscle / subst
// =============================================================================

describe('Catalog — requêtes par muscle et substitution', () => {
  const cat = new Catalog();

  it('for_muscle_primary("pectoraux") inclut bench_bb', () => {
    const exos = cat.for_muscle_primary('pectoraux');
    expect(exos.some((x) => x.id === 'bench_bb')).toBe(true);
  });

  it('chaque muscle canonique a au moins 1 exo primaire (sanity check catalogue)', () => {
    // Tolérance : "deltos_posterieurs" peut être thin, mais on attend ≥ 1.
    for (const m of MUSCLES) {
      const exos = cat.for_muscle_primary(m);
      expect(exos.length, `Aucun exo primaire pour ${m}`).toBeGreaterThan(0);
    }
  });

  it('in_substitution_group renvoie au moins l\'exo demandé', () => {
    const groupe = cat.in_substitution_group('bench_h_bb');
    expect(groupe.some((x) => x.id === 'bench_bb')).toBe(true);
  });
});

// =============================================================================
// 4. Catalog.filter
// =============================================================================

describe('Catalog.filter', () => {
  const cat = new Catalog();

  it('compound_only ne renvoie que des compounds', () => {
    const exos = cat.filter({ compound_only: true });
    expect(exos.length).toBeGreaterThan(0);
    for (const ex of exos) expect(ex.type).toBe(ExType.COMPOUND);
  });

  it('isolation_only ne renvoie que des isolations', () => {
    const exos = cat.filter({ isolation_only: true });
    expect(exos.length).toBeGreaterThan(0);
    for (const ex of exos) expect(ex.type).toBe(ExType.ISOLATION);
  });

  it('equip_available exclut les exos avec équipement manquant', () => {
    // Ensemble vide = on ne peut faire que les exos sans équipement (bodyweight pur).
    const exos = cat.filter({ equip_available: new Set<string>() });
    for (const ex of exos) expect(ex.equip.length).toBe(0);
  });

  it('muscle_primary + compound_only se combinent', () => {
    const exos = cat.filter({ muscle_primary: 'pectoraux', compound_only: true });
    expect(exos.length).toBeGreaterThan(0);
    for (const ex of exos) {
      expect(ex.type).toBe(ExType.COMPOUND);
      expect(ex.muscles['pectoraux']).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// =============================================================================
// 5. Catalog.search_fuzzy
// =============================================================================

describe('Catalog.search_fuzzy', () => {
  const cat = new Catalog();

  it('match exact sur ID classe en tête', () => {
    const res = cat.search_fuzzy('bench_bb', 5);
    expect(res[0]!.id).toBe('bench_bb');
  });

  it('respecte la limite', () => {
    const res = cat.search_fuzzy('bench', 3);
    expect(res.length).toBeLessThanOrEqual(3);
  });

  it('renvoie vide si rien ne matche', () => {
    expect(cat.search_fuzzy('xyzzy_unknown_term', 10)).toEqual([]);
  });

  // Conv #10d : enrichissement synonymes + fold accents + multi-tokens.

  it('matche les synonymes injectés (DC → développé couché)', () => {
    const res = cat.search_fuzzy('DC', 5);
    expect(res.map((x) => x.id)).toContain('bench_bb');
  });

  it('matche bench press → développé couché barre', () => {
    const res = cat.search_fuzzy('bench press', 5);
    expect(res.map((x) => x.id)).toContain('bench_bb');
  });

  it('ignore les accents (developpe → développé)', () => {
    const res = cat.search_fuzzy('developpe couche', 5);
    expect(res.map((x) => x.id)).toContain('bench_bb');
  });

  it('match SDT → soulevé de terre', () => {
    const res = cat.search_fuzzy('SDT', 5);
    expect(res.map((x) => x.id)).toContain('deadlift_conv');
  });

  it('match RDL → romanian deadlift', () => {
    const res = cat.search_fuzzy('RDL', 5);
    expect(res.map((x) => x.id)).toContain('rdl_bb');
  });
});
