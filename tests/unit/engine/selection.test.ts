/**
 * Miroir TS de prototype/tests/test_selection.py.
 * Couvre : candidates par muscle, filtrage par équipement, rotation,
 * substitution, répartition du volume.
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import {
  candidatesForMuscle,
} from '@/engine/selection';
import { ExType, Level,  Sex, makeProfile } from '@/engine/models';

import { profileIntermediaireH } from './_helpers';

const catalog = new Catalog();

describe('candidatesForMuscle', () => {
  it('équipement complet → > 5 candidats pectoraux, 1er = compound', () => {
    const p = profileIntermediaireH();
    const cands = candidatesForMuscle(catalog, 'pectoraux', p);
    expect(cands.length).toBeGreaterThan(5);
    expect(cands[0]!.type).toBe(ExType.COMPOUND);
  });

  it('équipement haltère + bancs seulement → bench_bb exclu', () => {
    const p = makeProfile({
      sex: Sex.HOMME,
      age: 30,
      level: Level.INTERMEDIAIRE,
      sessions_per_week: 3,
      bodyweight_kg: 80,
      available_equip: new Set(['db', 'bench_flat', 'bench_incl']),
    });
    const cands = candidatesForMuscle(catalog, 'pectoraux', p);
    for (const x of cands) {
      if (x.equip.length > 0) {
        for (const e of x.equip) {
          expect(p.available_equip.has(e)).toBe(true);
        }
      }
    }
    expect(cands.find((x) => x.id === 'bench_bb')).toBeUndefined();
  });
});

