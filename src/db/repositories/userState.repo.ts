import type { UserState } from '@/engine/models';
import { getDb } from '../schema';
import { deserializeUserState, serializeUserState } from '../serialize';

const SINGLETON_ID = 1 as const;

/** Lit l'état utilisateur (null si vide). */
export async function loadUserState(): Promise<UserState | null> {
  const row = await getDb().userState.get(SINGLETON_ID);
  if (row === undefined) return null;
  return deserializeUserState(row.state);
}

/**
 * Écrit l'état utilisateur (overwrite). Pour les écritures qui doivent rester
 * atomiques avec les tables dérivées (sessions, feedbacks, snapshots), passer
 * par `db/transactions.ts` plutôt que d'appeler ce repo directement.
 */
export async function saveUserState(state: UserState): Promise<void> {
  await getDb().userState.put({
    id: SINGLETON_ID,
    state: serializeUserState(state),
    updated_at: new Date().toISOString(),
  });
}

/** Supprime l'état utilisateur (utilisé par l'import qui réécrit tout). */
export async function clearUserState(): Promise<void> {
  await getDb().userState.delete(SINGLETON_ID);
}
