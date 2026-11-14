import { describe, it, expect } from 'vitest';
import { useCoachOsStore } from '@/store';
import { startUser } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';
import { makeTestProfile } from '@/test-utils/fixtures';

describe('useCoachOsStore', () => {
  it('initial state vide', () => {
    const s = useCoachOsStore.getState();
    expect(s.userState).toBeNull();
    expect(s.catalog).toBeNull();
    expect(s.bootstrapped).toBe(false);
    expect(s.history.sessions).toEqual([]);
  });

  it('setUserState met à jour l’état', () => {
    const state = startUser(makeTestProfile(), new Catalog());
    useCoachOsStore.getState().setUserState(state);

    expect(useCoachOsStore.getState().userState?.profile.bodyweight_kg).toBe(80);
  });

  it('resetAll remet tout à zéro', () => {
    const state = startUser(makeTestProfile(), new Catalog());
    useCoachOsStore.getState().setUserState(state);
    useCoachOsStore.getState().setBootstrapped(true);

    useCoachOsStore.getState().resetAll();
    const s = useCoachOsStore.getState();
    expect(s.userState).toBeNull();
    expect(s.bootstrapped).toBe(false);
  });

  it('setCurrentSession set/clear', () => {
    useCoachOsStore.getState().setCurrentSession(
      {
        seance_date: '2026-05-10',
        cycle_index: 1,
        week_in_cycle: 1,
        rpe_target: 7,
        label: 'A',
        items: [],
      },
      42,
    );
    expect(useCoachOsStore.getState().currentSessionId).toBe(42);
    useCoachOsStore.getState().setCurrentSession(null, null);
    expect(useCoachOsStore.getState().currentSessionId).toBeNull();
  });
});
