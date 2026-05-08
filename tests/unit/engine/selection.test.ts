/**
 * Miroir TS de prototype/tests/test_selection.py.
 * Couvre : candidates par muscle, filtrage par équipement, rotation,
 * substitution, répartition du volume.
 */

import { describe, expect, it } from 'vitest';

import { Catalog } from '@/engine/catalog';
import {
  candidatesForMuscle,
  pickForMuscle,
  splitVolumeIntoSessions,
  substitute,
} from '@/engine/selection';
import { ExType, Level, Objective, Sex, makeProfile } from '@/engine/models';

import { profileIntermediaireH, startUserStub } from './_helpers';

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
      objective: Objective.HYPERTROPHIE,
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

describe('pickForMuscle', () => {
  it('évite l’exo précédent (rotation simple)', () => {
    const state = startUserStub(profileIntermediaireH());
    state.last_used_for_muscle['pectoraux'] = 'bench_bb';
    const ex = pickForMuscle(catalog, 'pectoraux', state);
    expect(ex).not.toBeNull();
    expect(ex!.id).not.toBe('bench_bb');
  });
});

describe('substitute', () => {
  it('reste dans le même groupe de substitution', () => {
    const bench = catalog.get('bench_bb');
    const sub = substitute(catalog, bench, profileIntermediaireH());
    if (sub !== null) {
      expect(sub.subst).toBe('bench_h_bb');
      expect(sub.id).not.toBe('bench_bb');
    }
  });
});

describe('splitVolumeIntoSessions', () => {
  it('équilibre les séries entières', () => {
    expect(splitVolumeIntoSessions(10, 2)).toEqual([5, 5]);
    expect(splitVolumeIntoSessions(9, 2)).toEqual([5, 4]);
    expect(splitVolumeIntoSessions(12, 3)).toEqual([4, 4, 4]);
    expect(splitVolumeIntoSessions(13, 3)).toEqual([5, 4, 4]);
  });

  it('0 séances → []', () => {
    expect(splitVolumeIntoSessions(10, 0)).toEqual([]);
  });
});
