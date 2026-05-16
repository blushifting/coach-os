/**
 * Tests pour `lib/calibration.ts` — Conv #10d.
 *
 * Focus : `alternativeVariantsFor` (modes strict + élargi muscle primaire).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import { alternativeVariantsFor } from '@/lib/calibration';
import { EQUIPMENT_PRESET_FULL_GYM } from '@/lib/onboarding-state';

describe('alternativeVariantsFor — mode strict (subst group)', () => {
  const catalog = new Catalog();
  const fullEquip = EQUIPMENT_PRESET_FULL_GYM;

  it('renvoie les variantes du même subst, exclut l\'exo courant', () => {
    const alts = alternativeVariantsFor('bench_bb', fullEquip, catalog);
    const ids = alts.map((x) => x.id);
    expect(ids).not.toContain('bench_bb'); // exclu
    // toutes les alternatives partagent le subst de bench_bb (bench_h_bb)
    for (const ex of alts) {
      expect(ex.subst).toBe('bench_h_bb');
    }
  });

  it('renvoie [] si exo inconnu', () => {
    expect(alternativeVariantsFor('xxx_unknown', fullEquip, catalog)).toEqual([]);
  });
});

describe('alternativeVariantsFor — mode élargi (muscle primaire commun)', () => {
  const catalog = new Catalog();
  const fullEquip = EQUIPMENT_PRESET_FULL_GYM;

  it('élargit aux exos hors subst qui ciblent le même muscle primaire', () => {
    const strict = alternativeVariantsFor('bench_bb', fullEquip, catalog);
    const expanded = alternativeVariantsFor('bench_bb', fullEquip, catalog, {
      expand: true,
    });
    expect(expanded.length).toBeGreaterThan(strict.length);
    // Doit contenir au moins un exo isolation pectoraux (qui n'est pas
    // dans le subst bench_h_bb)
    const isolationIds = expanded
      .filter((ex) => ex.type === 'isolation')
      .map((ex) => ex.id);
    expect(isolationIds.length).toBeGreaterThan(0);
  });

  it('filtre par équipement même en mode élargi', () => {
    const noEquip = new Set<string>();
    const alts = alternativeVariantsFor('bench_bb', noEquip, catalog, { expand: true });
    // Sans équipement, on garde uniquement les exos bodyweight (equip.length === 0)
    for (const ex of alts) {
      expect(ex.equip.length).toBe(0);
    }
  });

  it('exclut toujours l\'exo courant', () => {
    const alts = alternativeVariantsFor('bench_bb', fullEquip, catalog, { expand: true });
    expect(alts.map((x) => x.id)).not.toContain('bench_bb');
  });
});
