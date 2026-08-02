/**
 * Chantier F-1 — état de la session cloud (compte + sauvegarde).
 *
 * Store séparé du store moteur à dessein : rien ici n'est de l'état
 * d'entraînement, rien ici ne se persiste en Dexie, et `useCoachOsStore`
 * impose l'invariant « toute mutation passe par useEngine » — invariant qui
 * n'a aucun sens pour une session OAuth.
 *
 * Ce module ne contient QUE de l'état. La logique (connexion, réconciliation,
 * envoi) vit dans `lib/auth.ts` et `lib/backup.ts`.
 */

import { create } from 'zustand';

/**
 * Conflit détecté à la connexion : le cloud contient déjà une sauvegarde et
 * cet appareil n'a pas encore été réconcilié avec ce compte.
 *
 * Deux cas du §3.2 du doc 12, distingués par `localHasData` :
 *   - **cas B** (`false`) — appareil vierge, cloud plein. La restauration
 *     arrive en F-2 ; ici on ne sait que le dire.
 *   - **cas C** (`true`) — les deux ont des données. Jamais silencieux.
 */
export interface CloudConflict {
  /** Date (ISO, horloge serveur) de la sauvegarde la plus récente du cloud. */
  readonly cloudAt: string;
  /** Version de l'app qui a produit cette sauvegarde. */
  readonly cloudAppVersion: string;
  /** Cet appareil porte-t-il déjà des données d'entraînement ? */
  readonly localHasData: boolean;
}

export interface AuthState {
  /** La session initiale a-t-elle été résolue ? Faux pendant le tout début. */
  ready: boolean;
  /** `null` = pas de compte lié sur cet appareil. */
  userId: string | null;
  email: string | null;
  /** Une opération de compte (connexion, déconnexion, envoi) est en cours. */
  busy: boolean;
  /** Message lisible de la dernière opération ratée, ou `null`. */
  error: string | null;
  /** Date ISO du dernier envoi réussi (miroir mémoire du drapeau persisté). */
  lastBackupAt: string | null;
  /** Non nul ⟹ les envois sont bloqués tant que l'utilisateur n'a pas tranché. */
  conflict: CloudConflict | null;
}

const initialAuthState: AuthState = {
  ready: false,
  userId: null,
  email: null,
  busy: false,
  error: null,
  lastBackupAt: null,
  conflict: null,
};

export const useAuthStore = create<AuthState>(() => ({ ...initialAuthState }));

/** Remet le store à zéro (tests, et déconnexion complète). */
export function resetAuthStore(): void {
  useAuthStore.setState({ ...initialAuthState, ready: true });
}

// === Sélecteurs / hooks de commodité ===
export const useCloudSignedIn = () =>
  useAuthStore((s) => s.userId !== null);
export const useCloudConflict = () => useAuthStore((s) => s.conflict);
