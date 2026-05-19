/**
 * Sélecteurs ciblés sur `useCoachOsStore`. Les composants UI doivent
 * importer ces sélecteurs plutôt que de lire l'état complet, pour limiter
 * les re-renders.
 */

import { useCoachOsStore, type CoachOsState } from './index';

// === Slice "profile" ===
export const selectProfile = (s: CoachOsState) => s.userState?.profile ?? null;
export const selectMuscleGoals = (s: CoachOsState) => s.userState?.muscle_goals ?? null;
export const selectActiveProgrammeId = (s: CoachOsState) =>
  s.userState?.active_guided_program_id ?? null;

// === Slice "session" (UI séance en cours) ===
export const selectCurrentSessionPlan = (s: CoachOsState) => s.currentSessionPlan;
export const selectCurrentSessionId = (s: CoachOsState) => s.currentSessionId;

// === Slice "history" ===
export const selectHistory = (s: CoachOsState) => s.history;
export const selectSessions = (s: CoachOsState) => s.history.sessions;
export const selectFeedbacks = (s: CoachOsState) => s.history.feedbacks;
export const selectE1rmSnapshots = (s: CoachOsState) => s.history.e1rmSnapshots;
export const selectCycles = (s: CoachOsState) => s.history.cycles;

// === Slice "catalog" ===
export const selectCatalog = (s: CoachOsState) => s.catalog;

// === Méta ===
export const selectBootstrapped = (s: CoachOsState) => s.bootstrapped;
export const selectDemoMode = (s: CoachOsState) => s.demoMode;
export const selectDemoSnapshot = (s: CoachOsState) => s.demoSnapshot;
export const selectCycleProgress = (s: CoachOsState) => {
  if (s.userState === null) return null;
  return {
    cycle_index: s.userState.cycle_index,
    week_in_cycle: s.userState.current_week_in_cycle,
  };
};

// Hooks de commodité
export const useProfile = () => useCoachOsStore(selectProfile);
export const useMuscleGoals = () => useCoachOsStore(selectMuscleGoals);
export const useCurrentSessionPlan = () => useCoachOsStore(selectCurrentSessionPlan);
export const useCurrentSessionId = () => useCoachOsStore(selectCurrentSessionId);
export const useHistory = () => useCoachOsStore(selectHistory);
export const useCatalog = () => useCoachOsStore(selectCatalog);
export const useBootstrapped = () => useCoachOsStore(selectBootstrapped);
export const useCycleProgress = () => useCoachOsStore(selectCycleProgress);
export const useDemoMode = () => useCoachOsStore(selectDemoMode);
export const useDemoSnapshot = () => useCoachOsStore(selectDemoSnapshot);
