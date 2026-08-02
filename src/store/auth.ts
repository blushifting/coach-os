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

/** La sauvegarde en ligne la plus récente du compte, sans son payload. */
export interface CloudConflictSnapshot {
  /** Identifiant — cible de la restauration (chantier F-2). */
  readonly id: number;
  /** Date (ISO, horloge serveur). */
  readonly at: string;
  /** Version de l'app qui a produit cette sauvegarde. */
  readonly appVersion: string;
}

/**
 * Point de décision à la connexion : cet appareil n'a pas encore été
 * réconcilié avec ce compte et on ne peut pas trancher tout seul.
 *
 * Trois situations, lisibles sur les deux champs :
 *   - **cas B** — `cloud` non nul, `localHasData` faux : appareil vierge,
 *     cloud plein → on propose la restauration.
 *   - **cas C** — `cloud` non nul, `localHasData` vrai : les deux côtés ont
 *     des données, il faut choisir laquelle garde la main.
 *   - **cas D** — `cloud` nul, `localHasData` vrai : compte neuf sur un
 *     appareil qui porte la progression de **quelqu'un d'autre** (un ami se
 *     connecte sur un téléphone déjà utilisé). Sans ce cas, l'envoi
 *     automatique du cas A verserait les données du premier dans le compte du
 *     second, sans un mot.
 */
export interface CloudConflict {
  readonly cloud: CloudConflictSnapshot | null;
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
