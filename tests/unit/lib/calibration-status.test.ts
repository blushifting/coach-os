/**
 * Tests pour `lib/calibration-status.ts` — Conv #12b.
 */

import { describe, expect, it } from 'vitest';
import type { E1rmSnapshotRow } from '@/db/schema';
import {
  e1rmConfidenceFor,
  isNotCalibrated,
  isStale,
  lastSnapshotDateFor,
  STALE_WEEKS,
} from '@/lib/calibration-status';

function snap(exercise_id: string, date: string): E1rmSnapshotRow {
  return {
    date,
    exercise_id,
    e1rm: 100,
    cycle_index: 1,
    week_in_cycle: 1,
  };
}

describe('lastSnapshotDateFor', () => {
  it('renvoie null si aucun snapshot pour cet exo', () => {
    const snaps = [snap('squat', '2026-05-01')];
    expect(lastSnapshotDateFor('bench', snaps)).toBeNull();
  });

  it('renvoie la date la plus récente parmi plusieurs', () => {
    const snaps = [
      snap('squat', '2026-04-01'),
      snap('squat', '2026-05-10'),
      snap('squat', '2026-05-05'),
      snap('bench', '2026-06-01'),
    ];
    expect(lastSnapshotDateFor('squat', snaps)).toBe('2026-05-10');
  });

  it('ignore les snapshots d\'autres exos', () => {
    const snaps = [snap('bench', '2026-06-01'), snap('squat', '2026-01-01')];
    expect(lastSnapshotDateFor('squat', snaps)).toBe('2026-01-01');
  });
});

describe('e1rmConfidenceFor', () => {
  const today = new Date(2026, 4, 19); // 2026-05-19

  it("'not_calibrated' si aucun snapshot, même avec e1rm bootstrap posé", () => {
    const e1rm = { squat: 80 };
    expect(e1rmConfidenceFor('squat', e1rm, [], today)).toBe('not_calibrated');
  });

  it("'measured' si snapshot frais (< 8 semaines)", () => {
    const snaps = [snap('squat', '2026-05-01')]; // 18 jours avant
    const e1rm = { squat: 100 };
    expect(e1rmConfidenceFor('squat', e1rm, snaps, today)).toBe('measured');
  });

  it("'stale' si dernier snapshot ≥ 8 semaines (56 jours)", () => {
    // 2026-05-19 - 56j = 2026-03-24
    const snaps = [snap('squat', '2026-03-23')];
    expect(e1rmConfidenceFor('squat', {}, snaps, today)).toBe('stale');
  });

  it('frontière exacte à 56 jours = stale', () => {
    // 2026-05-19 - 56j = 2026-03-24
    const snaps = [snap('squat', '2026-03-24')];
    expect(e1rmConfidenceFor('squat', {}, snaps, today)).toBe('stale');
  });

  it('55 jours = encore measured', () => {
    // 2026-05-19 - 55j = 2026-03-25
    const snaps = [snap('squat', '2026-03-25')];
    expect(e1rmConfidenceFor('squat', {}, snaps, today)).toBe('measured');
  });
});

describe('helpers', () => {
  it('isNotCalibrated true si pas de snapshot', () => {
    expect(isNotCalibrated('squat', [])).toBe(true);
    expect(isNotCalibrated('squat', [snap('bench', '2026-05-01')])).toBe(true);
  });

  it('isNotCalibrated false dès qu\'un snapshot existe', () => {
    expect(isNotCalibrated('squat', [snap('squat', '2020-01-01')])).toBe(false);
  });

  it('isStale false si pas de snapshot (on est "non calibré", pas "stale")', () => {
    expect(isStale('squat', [], new Date(2026, 4, 19))).toBe(false);
  });

  it('STALE_WEEKS = 8', () => {
    expect(STALE_WEEKS).toBe(8);
  });
});
