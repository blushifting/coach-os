/**
 * Tests Vitest pour le catalogue.
 * Couvre : chargement complet, indexation, requêtes par muscle, filtres,
 * substitution, recherche fuzzy.
 */

import { describe, expect, it } from 'vitest';

import { Catalog, loadExercises } from '@/engine/catalog';
import { ExType, MUSCLES } from '@/engine/models';
import { photosFor } from '@/data/exercise-photos';
import { EXERCISE_SYNONYMES } from '@/data/exercise-synonymes';
import { getMusclePatterns } from '@/engine/pattern_grid';

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

// =============================================================================
// Carte des muscles (dump 2.4, étape 6)
// =============================================================================

describe('carte des muscles — coefficients du catalogue', () => {
  const tous = loadExercises();
  const cat = new Catalog();
  const exo = (id: string) => {
    const ex = tous.find((x) => x.id === id);
    if (ex === undefined) throw new Error(`exo absent : ${id}`);
    return ex;
  };

  it('chaque muscle compté par un exercice est un muscle suivi', () => {
    const suivis = new Set<string>(MUSCLES);
    for (const ex of tous) {
      for (const m of Object.keys(ex.muscles)) {
        expect(suivis.has(m), `${ex.id} compte ${m}`).toBe(true);
      }
    }
  });

  it('les développés épaules comptent les antérieurs à 1 et les latéraux à 0,5', () => {
    for (const id of ['ohp_bb_standing', 'ohp_db_seated', 'arnold_press', 'machine_shoulder_press']) {
      expect(exo(id).muscles.deltos_anterieurs, id).toBe(1);
      expect(exo(id).muscles.deltos_lateraux, id).toBe(0.5);
    }
  });

  it('tout exercice des pectoraux compte au moins 0,5 sur les antérieurs (jamais sous-estimés)', () => {
    for (const ex of tous) {
      if ((ex.muscles.pectoraux ?? 0) >= 1) {
        expect(ex.muscles.deltos_anterieurs ?? 0, ex.id).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('squats, presse et fentes comptent les adducteurs à 0,5 et plus les ischios', () => {
    for (const ex of tous) {
      if (ex.pattern !== 'squat' && ex.pattern !== 'lunge') continue;
      expect(ex.muscles.adducteurs, ex.id).toBe(0.5);
      expect(ex.muscles.ischios, ex.id).toBeUndefined();
    }
  });

  it('la machine à adducteurs ne compte que les adducteurs', () => {
    expect(exo('hip_adductor_machine').muscles).toEqual({ adducteurs: 1 });
  });

  it('les élévations frontales isolent les antérieurs, avec photo et synonymes', () => {
    for (const id of ['db_front_raise', 'cable_front_raise']) {
      expect(exo(id).muscles).toEqual({ deltos_anterieurs: 1 });
      expect(photosFor(id), id).not.toBeNull();
      expect(EXERCISE_SYNONYMES[id]?.length ?? 0, id).toBeGreaterThan(0);
    }
    expect(cat.search_fuzzy('élévation frontale', 5).map((x) => x.id)).toContain('db_front_raise');
  });
});

describe('carte des muscles — grille de patterns du générateur', () => {
  it('chaque muscle a au moins une case polyarticulaire remplissable', () => {
    // Garde-fou : à l'étape 6, les développés épaules sont passés à 0,5 sur les
    // latéraux ; leur seule case polyarticulaire (push_v) est restée vide et le
    // générateur leur retirait tout volume. Une case vide parmi d'autres est
    // tolérée (les fessiers n'ont de primaire qu'en hinge, pas en squat).
    const tous = loadExercises();
    for (const m of MUSCLES) {
      const remplissable = getMusclePatterns(m).compoundPatterns.some((p) =>
        tous.some((ex) => ex.pattern === p && (ex.muscles[m] ?? 0) >= 1),
      );
      expect(remplissable, `${m} : aucune case polyarticulaire remplissable`).toBe(true);
    }
  });
});
