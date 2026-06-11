/**
 * Tests pour `lib/demo.ts` — Conv #13b.
 *
 * On vérifie le cycle de vie enter / exit : swap propre du store, backup
 * restauré sans fuite, idempotence. Le `fetch` de `loadDemoSnapshot` est
 * stubbé en injectant le snapshot directement via `enterDemoMode(snap)`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useCoachOsStore } from '@/store';
import { startUser } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';
import { makeTestProfile } from '@/test-utils/fixtures';
import { parseDemoSnapshot, type DemoSnapshot } from '@/lib/demo-schema';
import {
  enterDemoMode,
  exitDemoMode,
  isDemoActive,
  _resetDemoForTests,
} from '@/lib/demo';

function loadAlex(): DemoSnapshot {
  const path = resolve(process.cwd(), 'public', 'demo', 'alex.json');
  return parseDemoSnapshot(JSON.parse(readFileSync(path, 'utf-8')));
}

beforeEach(() => {
  useCoachOsStore.getState().resetAll();
  _resetDemoForTests();
});

afterEach(() => {
  useCoachOsStore.getState().resetAll();
  _resetDemoForTests();
});

describe('enterDemoMode / exitDemoMode', () => {
  it('isDemoActive() est faux par défaut', () => {
    expect(isDemoActive()).toBe(false);
  });

  it('enterDemoMode mute le store avec le snapshot', async () => {
    const snap = loadAlex();
    await enterDemoMode(snap);

    const s = useCoachOsStore.getState();
    expect(s.demoMode).toBe(true);
    expect(s.demoSnapshot).not.toBeNull();
    expect(s.userState).not.toBeNull();
    expect(s.userState!.profile.sessions_per_week).toBe(4);
    expect(s.history.sessions.length).toBeGreaterThan(20);
    expect(s.history.cycles.length).toBe(2);
    expect(isDemoActive()).toBe(true);
  });

  it('exitDemoMode restaure exactement le userState pré-démo', async () => {
    // Pose un userState "réel" avant la démo
    const realState = startUser(makeTestProfile(), new Catalog());
    useCoachOsStore.getState().setUserState(realState);
    useCoachOsStore.getState().setHistory({
      sessions: [],
      feedbacks: [],
      e1rmSnapshots: [],
      cycles: [{ cycle_index: 1, start_date: '2026-01-01', end_date: null, programme_id: null, review: null }],
    });

    const snap = loadAlex();
    await enterDemoMode(snap);
    // Pendant la démo, on voit Alex
    expect(useCoachOsStore.getState().userState!.profile.bodyweight_kg).toBe(75);

    exitDemoMode();

    const s = useCoachOsStore.getState();
    expect(s.demoMode).toBe(false);
    expect(s.demoSnapshot).toBeNull();
    // Le real state revient (makeTestProfile -> bodyweight 80)
    expect(s.userState!.profile.bodyweight_kg).toBe(80);
    expect(s.history.cycles.length).toBe(1);
  });

  it('exitDemoMode no-op si pas en démo', () => {
    useCoachOsStore.getState().setUserState(startUser(makeTestProfile(), new Catalog()));
    exitDemoMode(); // ne doit rien casser
    expect(useCoachOsStore.getState().userState!.profile.bodyweight_kg).toBe(80);
  });

  it('enterDemoMode idempotent — appel double ne re-backup pas', async () => {
    const realState = startUser(makeTestProfile(), new Catalog());
    useCoachOsStore.getState().setUserState(realState);

    const snap = loadAlex();
    await enterDemoMode(snap);
    const userStateInDemoFirst = useCoachOsStore.getState().userState;
    await enterDemoMode(snap); // 2ᵈ appel : doit être no-op
    const userStateInDemoSecond = useCoachOsStore.getState().userState;
    expect(userStateInDemoFirst).toBe(userStateInDemoSecond);

    exitDemoMode();
    // Le backup doit refléter l'état pré-1er-enter, pas pré-2ᵈ-enter (= Alex)
    expect(useCoachOsStore.getState().userState!.profile.bodyweight_kg).toBe(80);
  });

  it('userState démo a un Profile.available_equip qui est un vrai Set', async () => {
    const snap = loadAlex();
    await enterDemoMode(snap);
    const profile = useCoachOsStore.getState().userState!.profile;
    expect(profile.available_equip).toBeInstanceOf(Set);
    expect(profile.available_equip.has('barbell')).toBe(true);
  });

  it('enterDemoMode pose currentSessionPlan + currentSessionId depuis le snapshot', async () => {
    const snap = loadAlex();
    await enterDemoMode(snap);
    const s = useCoachOsStore.getState();
    expect(s.currentSessionPlan).not.toBeNull();
    // Conv #28 — lettre globale par séance : le jour 1 (Lower) porte « B ».
    expect(s.currentSessionPlan!.label).toBe('Lower B');
    expect(s.currentSessionPlan!.seance_date).toBe('2026-05-19');
    expect(s.currentSessionId).toBe(-1);
  });

  it('enterDemoMode pose lastCycleReview depuis cycles[0].review', async () => {
    const snap = loadAlex();
    await enterDemoMode(snap);
    const s = useCoachOsStore.getState();
    expect(s.lastCycleReview).not.toBeNull();
    expect(s.lastCycleReview!.cycle_index).toBe(1);
    expect(s.lastCycleReview!.PRs.length).toBeGreaterThanOrEqual(1);
  });

  it('save/restore des currentSessionEntries (régression : démo effaçait la séance en cours)', async () => {
    // Séance réelle en cours avec des saisies (coches/reps) déjà remplies.
    const realEntries = [
      [
        { reps: 8, load_kg: 60, rpe: 8, done: true },
        { reps: 8, load_kg: 60, rpe: null, done: false },
      ],
    ];
    useCoachOsStore.setState({
      userState: startUser(makeTestProfile(), new Catalog()),
      currentSessionPlan: null,
      currentSessionId: 42,
      currentSessionEntries: realEntries as never,
    });

    const snap = loadAlex();
    await enterDemoMode(snap);
    // Pendant la démo, les entries sont vierges (séance d'Alex).
    expect(useCoachOsStore.getState().currentSessionEntries).toBeNull();

    exitDemoMode();
    // Au retour, les saisies réelles sont restaurées à l'identique.
    expect(useCoachOsStore.getState().currentSessionEntries).toBe(realEntries);
    expect(useCoachOsStore.getState().currentSessionId).toBe(42);
  });

  it('exitDemoMode restaure currentSessionPlan + lastCycleReview pré-démo', async () => {
    // Pose un userState et un lastCycleReview "réels"
    useCoachOsStore.setState({
      userState: startUser(makeTestProfile(), new Catalog()),
      lastCycleReview: null,
      currentSessionPlan: null,
      currentSessionId: null,
    });

    const snap = loadAlex();
    await enterDemoMode(snap);
    expect(useCoachOsStore.getState().currentSessionPlan).not.toBeNull();

    exitDemoMode();
    const s = useCoachOsStore.getState();
    expect(s.currentSessionPlan).toBeNull();
    expect(s.currentSessionId).toBeNull();
    expect(s.lastCycleReview).toBeNull();
  });
});
