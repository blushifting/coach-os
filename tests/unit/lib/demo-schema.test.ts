/**
 * Tests pour `lib/demo-schema.ts` + `public/demo/alex.json` — Conv #13a.
 *
 * On vérifie que le snapshot commité parse via Zod (garantit que la forme du
 * JSON reste alignée avec les types lus par les selectors), et qu'il contient
 * effectivement les phénomènes pédagogiques requis par le backlog persona Alex
 * (≥2 PR, déload visible, séance ratée, 3 swaps durables).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  demoSnapshotSchema,
  parseDemoSnapshot,
  type DemoSnapshot,
} from '@/lib/demo-schema';

function loadAlex(): DemoSnapshot {
  const path = resolve(process.cwd(), 'public', 'demo', 'alex.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  return parseDemoSnapshot(raw);
}

describe('demo-schema parse', () => {
  it("rejette un JSON malformé (manque persona)", () => {
    const bad = { generated_at: '2026-05-19', user_state: {}, history: {} };
    expect(() => demoSnapshotSchema.parse(bad)).toThrow();
  });

  it("rejette un persona avec id ≠ 'alex'", () => {
    const bad: unknown = {
      persona: { id: 'bob', label: 'x', summary: 'y' },
      generated_at: '2026-05-19',
      user_state: {},
      history: { sessions: [], feedbacks: [], e1rmSnapshots: [], cycles: [] },
    };
    expect(() => demoSnapshotSchema.parse(bad)).toThrow();
  });

  it('parse alex.json sans erreur', () => {
    expect(() => loadAlex()).not.toThrow();
  });
});

describe('snapshot Alex — forme attendue', () => {
  const snap = loadAlex();

  it("a un persona 'alex' avec label + summary non vides", () => {
    expect(snap.persona.id).toBe('alex');
    expect(snap.persona.label.length).toBeGreaterThan(0);
    expect(snap.persona.summary.length).toBeGreaterThan(0);
  });

  it('a un profile Alex (intermédiaire, 4 séances/sem, salle complète)', () => {
    expect(snap.user_state.profile.sessions_per_week).toBe(4);
    expect(snap.user_state.profile.level).toBe('intermediaire');
    expect(snap.user_state.profile.available_equip.length).toBeGreaterThanOrEqual(5);
  });

  it('est positionné cycle 2 semaine 4 (en cours)', () => {
    expect(snap.user_state.cycle_index).toBe(2);
    expect(snap.user_state.current_week_in_cycle).toBe(4);
  });

  it('a au moins 30 séances jouées (≥ 1 cycle complet de 4×5 + 3 sem)', () => {
    expect(snap.history.sessions.length).toBeGreaterThanOrEqual(30);
  });

  it('contient exactement 1 séance ratée', () => {
    const skipped = snap.history.sessions.filter((s) => s.status === 'skipped');
    expect(skipped.length).toBe(1);
  });

  it('a le cycle 1 fermé avec une review (≥1 PR, suggested_action set)', () => {
    const c1 = snap.history.cycles.find((c) => c.cycle_index === 1);
    expect(c1).toBeDefined();
    expect(c1!.review).not.toBeNull();
    expect(c1!.review!.PRs.length).toBeGreaterThanOrEqual(1);
  });

  it('a le cycle 2 ouvert (end_date null, review null)', () => {
    const c2 = snap.history.cycles.find((c) => c.cycle_index === 2);
    expect(c2).toBeDefined();
    expect(c2!.end_date).toBeNull();
    expect(c2!.review).toBeNull();
  });

  it("contient un déload (sem 5 cycle 1) avec un RPE moyen ≤ 7", () => {
    const deload = snap.history.feedbacks.filter(
      (f) => f.cycle_index === 1 && f.week_in_cycle === 5,
    );
    expect(deload.length).toBeGreaterThan(0);
    const allRpes = deload.flatMap((f) =>
      f.feedback.sets.map((s) => s.rpe_perceived),
    );
    const avg = allRpes.reduce((a, b) => a + b, 0) / allRpes.length;
    expect(avg).toBeLessThanOrEqual(7);
  });

  it('a des swaps durables au cycle 2 (front_squat, pullup libre, ohp_db_seated)', () => {
    const c2Feedbacks = snap.history.feedbacks.filter((f) => f.cycle_index === 2);
    const exosTouchedC2 = new Set(
      c2Feedbacks.flatMap((f) => f.feedback.sets.map((s) => s.exercise_id)),
    );
    expect(exosTouchedC2.has('front_squat')).toBe(true);
    expect(exosTouchedC2.has('pullup')).toBe(true);
    expect(exosTouchedC2.has('ohp_db_seated')).toBe(true);
  });

  it("a des snapshots e1rm datés pour les exos principaux", () => {
    const bySnap = new Set(snap.history.e1rmSnapshots.map((s) => s.exercise_id));
    for (const exId of [
      'squat_bb_high',
      'deadlift_conv',
      'bench_bb',
      'ohp_bb_standing',
      'bb_row',
    ]) {
      expect(bySnap.has(exId)).toBe(true);
    }
  });

  it('a des plafonds finaux qui ont progressé vs initiaux pour squat et bench', () => {
    const firstSquat = snap.history.e1rmSnapshots.find(
      (s) => s.exercise_id === 'squat_bb_high',
    )!;
    const lastSquat = [...snap.history.e1rmSnapshots]
      .reverse()
      .find((s) => s.exercise_id === 'squat_bb_high')!;
    expect(lastSquat.e1rm).toBeGreaterThan(firstSquat.e1rm);

    const firstBench = snap.history.e1rmSnapshots.find(
      (s) => s.exercise_id === 'bench_bb',
    )!;
    const lastBench = [...snap.history.e1rmSnapshots]
      .reverse()
      .find((s) => s.exercise_id === 'bench_bb')!;
    expect(lastBench.e1rm).toBeGreaterThan(firstBench.e1rm);
  });
});
