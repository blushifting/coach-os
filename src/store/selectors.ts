/**
 * Sélecteurs ciblés sur `useCoachOsStore`. Les composants UI doivent
 * importer ces sélecteurs plutôt que de lire l'état complet, pour limiter
 * les re-renders.
 */

import { useMemo } from 'react';
import { parseDateKey } from '@/lib/dashboard';
import { useCoachOsStore, type CoachOsState } from './index';









export const selectCycles = (s: CoachOsState) => s.history.cycles;

// === Slice "catalog" ===
export const selectCatalog = (s: CoachOsState) => s.catalog;


export const selectDemoMode = (s: CoachOsState) => s.demoMode;
export const selectDemoSnapshot = (s: CoachOsState) => s.demoSnapshot;


export const useCatalog = () => useCoachOsStore(selectCatalog);

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
 * le snapshot a dépassé 8 semaines d'âge.
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
 * Marque de salle déclarée par l'user. Utilisé par
 * `displayExerciseName` pour afficher le nom commercial des machines
 * (ex. « Matrix Aura Pulldown » au lieu de « Tirage vertical poulie
 * haute »). `null` si profil non chargé ou pas de salle déclarée.
 */
export const selectGymBrand = (s: CoachOsState) =>
  s.userState?.profile?.gym_brand ?? null;
export const useGymBrand = () => useCoachOsStore(selectGymBrand);
