/**
 * Sélecteurs ciblés sur `useCoachOsStore`. Les composants UI doivent
 * importer ces sélecteurs plutôt que de lire l'état complet, pour limiter
 * les re-renders.
 */

import { useMemo } from 'react';
import { parseDateKey } from '@/lib/dashboard';
import { useCoachOsStore, type CoachOsState } from './index';

// === Slice "profile" ===
export const selectProfile = (s: CoachOsState) => s.userState?.profile ?? null;
export const selectMuscleGoals = (s: CoachOsState) => s.userState?.muscle_goals ?? null;

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

/**
 * « Aujourd'hui » du point de vue de l'app — la date à passer à TOUT calcul qui
 * dépend du temps (fenêtres glissantes, couverture de la semaine en cours,
 * fraîcheur des Plafonds).
 *
 * En mode démo, elle est ANCRÉE sur la date de génération du snapshot. L'histoire
 * d'Alex est figée au jour où le JSON a été produit, mais ce JSON est commité :
 * il vieillit. Lu à la date réelle, tout son historique sort des fenêtres
 * glissantes et l'UI affiche 0 partout — les courbes de Volume l'ont fait dès que
 * le snapshot a dépassé 8 semaines d'âge (Conv #66).
 *
 * ⚠️ En mode démo, ne JAMAIS appeler `new Date()` directement dans un écran :
 * passer par ce hook. C'est précisément l'oubli qui a cassé l'onglet Progrès
 * pendant que l'accueil, lui, ancrait sa date dans son coin.
 */
export function useToday(): Date {
  const snap = useDemoSnapshot();
  return useMemo(
    () => (snap === null ? new Date() : parseDateKey(snap.generated_at)),
    [snap],
  );
}

/**
 * Conv #23 — marque de salle déclarée par l'user. Utilisé par
 * `displayExerciseName` pour afficher le nom commercial des machines
 * (ex. « Matrix Aura Pulldown » au lieu de « Tirage vertical poulie
 * haute »). `null` si profil non chargé ou pas de salle déclarée.
 */
export const selectGymBrand = (s: CoachOsState) =>
  s.userState?.profile?.gym_brand ?? null;
export const useGymBrand = () => useCoachOsStore(selectGymBrand);
