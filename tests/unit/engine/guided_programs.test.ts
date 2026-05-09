/**
 * Tests des programmes guidés (port de prototype/tests/test_guided_programs.py).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  ALL_GUIDED_PROGRAMS,
  GREYSKULL_LP,
  PPL_NIPPARD,
  STARTING_STRENGTH,
  UL_HELMS,
  WENDLER_531_BBB,
  fitGuidedProgram,
  getGuidedProgram,
  hasRequiredPlafonds,
  pickSubstitution,
} from '@/engine/guided_programs';
import { EQUIP_FULL, profile } from './_helpers';
import { Level } from '@/engine/models';

const EQUIP_NO_BARBELL = new Set([...EQUIP_FULL].filter((e) => e !== 'bb_oly' && e !== 'rack'));

const catalog = new Catalog();

// =============================================================================
// 1. Bibliothèque
// =============================================================================

describe('Bibliothèque V1 — 5 programmes', () => {
  it('contient 5 programmes', () => {
    expect(ALL_GUIDED_PROGRAMS).toHaveLength(5);
  });

  it('Starting Strength existe', () => {
    expect(STARTING_STRENGTH.id).toBe('ss');
    expect(STARTING_STRENGTH.sessions_per_week).toBe(3);
  });

  it('GreySkull LP existe', () => {
    expect(GREYSKULL_LP.id).toBe('greyskull');
  });

  it('U/L Helms existe', () => {
    expect(UL_HELMS.id).toBe('ul_helms');
    expect(UL_HELMS.sessions_per_week).toBe(4);
  });

  it('5/3/1 BBB existe', () => {
    expect(WENDLER_531_BBB.id).toBe('531_bbb');
    expect(WENDLER_531_BBB.sessions_per_week).toBe(4);
  });

  it('PPL Nippard existe', () => {
    expect(PPL_NIPPARD.id).toBe('ppl_nippard');
    expect(PPL_NIPPARD.sessions_per_week).toBe(6);
  });

  it('getGuidedProgram récupère par id', () => {
    expect(getGuidedProgram('ss')).toBe(STARTING_STRENGTH);
    expect(getGuidedProgram('inexistant')).toBeNull();
  });

  it('chaque programme a au moins 1 jour', () => {
    for (const p of ALL_GUIDED_PROGRAMS) {
      expect(p.days.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('cohérence sessions_per_week ↔ nb de jours', () => {
    for (const p of ALL_GUIDED_PROGRAMS) {
      expect(p.days.length).toBe(p.sessions_per_week);
    }
  });
});

// =============================================================================
// 2. pickSubstitution
// =============================================================================

describe('pickSubstitution', () => {
  it('preferred utilisé en priorité s\'il est compatible', () => {
    const canon = STARTING_STRENGTH.days[0].canonical_exercises[0];
    const ex = pickSubstitution(canon, EQUIP_FULL, catalog);
    expect(ex).not.toBeNull();
    expect(ex?.id).toBe(canon.preferred_id);
  });

  it('fallback si preferred indispo', () => {
    const canon = STARTING_STRENGTH.days[0].canonical_exercises[0]; // squat_bb_low
    const eq = new Set(['smith', 'bench_flat']);
    const ex = pickSubstitution(canon, eq, catalog);
    if (ex !== null) {
      expect(
        canon.fallback_subst.includes(ex.id) || ex.id === canon.preferred_id,
      ).toBe(true);
    }
  });

  it('null si rien dispo (ne plante pas)', () => {
    const canon = STARTING_STRENGTH.days[0].canonical_exercises[0];
    const ex = pickSubstitution(canon, new Set(), catalog);
    // null ou bodyweight, juste pas un crash
    expect(ex === null || typeof ex.id === 'string').toBe(true);
  });
});

// =============================================================================
// 3. fitGuidedProgram — équipement complet
// =============================================================================

describe('fitGuidedProgram (équipement complet)', () => {
  it('Starting Strength passe', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const plafonds = {
      squat_bb_low: 100.0,
      bench_bb: 80.0,
      ohp_bb_standing: 50.0,
      deadlift_conv: 130.0,
    };
    const { weekly, blocking } = fitGuidedProgram(
      STARTING_STRENGTH, p, EQUIP_FULL, plafonds, catalog,
    );
    expect(weekly).not.toBeNull();
    expect(blocking).toEqual([]);
    expect(weekly!.days).toHaveLength(STARTING_STRENGTH.sessions_per_week);
  });

  it('les 5 programmes passent avec équipement complet', () => {
    const p = profile({ level: Level.AVANCE, sessions_per_week: 6 });
    const plafonds = {
      squat_bb_low: 100.0, squat_bb_high: 100.0,
      bench_bb: 80.0, bench_bb_incl30: 70.0,
      ohp_bb_standing: 50.0, ohp_bb_seated: 50.0,
      deadlift_conv: 130.0,
      pullup: 0.0,
    };
    for (const prog of ALL_GUIDED_PROGRAMS) {
      const { weekly, blocking } = fitGuidedProgram(
        prog, p, EQUIP_FULL, plafonds, catalog,
      );
      expect(weekly, `${prog.id} blocking=${JSON.stringify(blocking)}`).not.toBeNull();
    }
  });

  it('Helms : progression sur 5 semaines pour chaque exo', () => {
    const p = profile();
    const plafonds = {
      squat_bb_low: 100.0, bench_bb: 80.0, deadlift_conv: 130.0, bb_row: 70.0,
    };
    const { weekly } = fitGuidedProgram(UL_HELMS, p, EQUIP_FULL, plafonds, catalog);
    expect(weekly).not.toBeNull();
    for (const day of weekly!.days) {
      for (const pe of day.exercises) {
        expect(pe.progression).toHaveLength(5);
      }
    }
  });
});

// =============================================================================
// 4. fitGuidedProgram — équipement réduit
// =============================================================================

describe('fitGuidedProgram (équipement réduit)', () => {
  it('SS sans barbell ni smith → blocking', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const { weekly, blocking } = fitGuidedProgram(
      STARTING_STRENGTH, p, new Set(['db', 'bench_flat']), {}, catalog,
    );
    expect(weekly).toBeNull();
    expect(blocking.length).toBeGreaterThanOrEqual(1);

    // Variante : avec EQUIP_NO_BARBELL → smith disponible → peut passer ou bloquer
    const r2 = fitGuidedProgram(STARTING_STRENGTH, p, EQUIP_NO_BARBELL, {}, catalog);
    if (r2.weekly === null) {
      expect(r2.blocking.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('5/3/1 sans barbell → blocking', () => {
    const p = profile();
    const { weekly, blocking } = fitGuidedProgram(
      WENDLER_531_BBB, p, new Set(['db', 'bench_flat']), {}, catalog,
    );
    expect(weekly).toBeNull();
    expect(blocking.length).toBeGreaterThanOrEqual(1);
  });

  it('PPL Nippard : ne crashe pas avec équipement machines+db', () => {
    const p = profile({ level: Level.AVANCE, sessions_per_week: 6 });
    const eq = new Set([
      'db', 'bench_flat', 'bench_incl', 'pull_bar', 'lat_pulldown',
      'seated_row', 'chest_press', 'leg_press', 'hack_squat',
      'smith', 'leg_curl_lying', 'leg_extension',
      'lateral_machine', 'calf_standing',
    ]);
    const { weekly } = fitGuidedProgram(PPL_NIPPARD, p, eq, {}, catalog);
    if (weekly !== null) {
      expect(weekly.days).toHaveLength(6);
    }
  });
});

// =============================================================================
// 5. requires_calibration
// =============================================================================

describe('requires_calibration', () => {
  it('true si plafonds manquants', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const { weekly } = fitGuidedProgram(STARTING_STRENGTH, p, EQUIP_FULL, {}, catalog);
    expect(weekly).not.toBeNull();
    expect(weekly!.requires_calibration).toBe(true);
  });

  it('false si plafonds complets', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const plafonds = {
      squat_bb_low: 100.0, bench_bb: 80.0,
      ohp_bb_standing: 50.0, deadlift_conv: 130.0,
    };
    const { weekly } = fitGuidedProgram(
      STARTING_STRENGTH, p, EQUIP_FULL, plafonds, catalog,
    );
    expect(weekly).not.toBeNull();
    expect(weekly!.requires_calibration).toBe(false);
  });
});

// =============================================================================
// 6. hasRequiredPlafonds
// =============================================================================

describe('hasRequiredPlafonds', () => {
  it('true si tous les main_* ont un plafond', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const plafonds = {
      squat_bb_low: 100.0, bench_bb: 80.0,
      ohp_bb_standing: 50.0, deadlift_conv: 130.0,
    };
    const { weekly } = fitGuidedProgram(
      STARTING_STRENGTH, p, EQUIP_FULL, plafonds, catalog,
    );
    expect(hasRequiredPlafonds(weekly!, plafonds)).toBe(true);
  });

  it('false si un main_* manque', () => {
    const p = profile({ level: Level.DEBUTANT, sessions_per_week: 3 });
    const partial = { squat_bb_low: 100.0, bench_bb: 80.0 };
    const { weekly } = fitGuidedProgram(
      STARTING_STRENGTH, p, EQUIP_FULL, partial, catalog,
    );
    expect(hasRequiredPlafonds(weekly!, partial)).toBe(false);
  });
});
