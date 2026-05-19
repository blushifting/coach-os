/**
 * Mode démo Coach OS — chargement & cycle de vie du snapshot persona Alex.
 *
 * Conv #13b. Pendant la démo, le store en mémoire est swappé pour le
 * `userState` + `history` du snapshot ; à l'exit, on restaure ce qui était là.
 * **La vraie DB Dexie n'est jamais touchée** : ni lecture pour entrer dans la
 * démo (le snapshot vient de `/demo/alex.json` commité, pas d'IndexedDB),
 * ni écriture (les actions destructrices ne sont pas exposées dans le parcours
 * tuto, et `useEngine.commitSessionFeedback` etc. ne tournent pas puisque
 * l'overlay guide vers la consultation seule).
 *
 * Backup en variable de module (pas dans le store) : on n'a pas besoin que
 * l'UI sache que l'utilisateur "avait" un état avant — le flag `demoMode`
 * suffit, le reste est plomberie pour `exitDemoMode`.
 */

import { useCoachOsStore } from '@/store';
import { deserializeUserState } from '@/db/serialize';
import type { CoachOsState } from '@/store';
import type { UserState } from '@/engine/models';
import type { HistorySnapshot } from '@/store';
import { parseDemoSnapshot, type DemoSnapshot } from './demo-schema';

interface PreDemoBackup {
  userState: UserState | null;
  history: HistorySnapshot;
  currentSessionPlan: CoachOsState['currentSessionPlan'];
  currentSessionId: CoachOsState['currentSessionId'];
}

let _backup: PreDemoBackup | null = null;
let _cachedSnapshot: DemoSnapshot | null = null;

/**
 * Fetch + parse + valide le snapshot Alex depuis `/demo/alex.json`.
 * Mémoïsé pour éviter un re-fetch à chaque entrée/sortie de démo.
 *
 * Le chemin honore `import.meta.env.BASE_URL` pour rester correct derrière
 * le préfixe GitHub Pages `/coach-os/`.
 */
export async function loadDemoSnapshot(): Promise<DemoSnapshot> {
  if (_cachedSnapshot !== null) return _cachedSnapshot;
  const base = import.meta.env.BASE_URL ?? '/';
  const url = `${base.replace(/\/$/, '')}/demo/alex.json`;
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(
      `Échec chargement snapshot démo (${res.status}) — vérifie public/demo/alex.json`,
    );
  }
  const raw = (await res.json()) as unknown;
  _cachedSnapshot = parseDemoSnapshot(raw);
  return _cachedSnapshot;
}

/**
 * Entre en mode démo. Sauvegarde l'état courant, charge le snapshot, swappe
 * `userState` + `history` dans le store. Idempotent — si la démo est déjà
 * active, ne fait rien (pas de double backup).
 */
export async function enterDemoMode(snapshot?: DemoSnapshot): Promise<void> {
  const store = useCoachOsStore.getState();
  if (store.demoMode) return;

  const snap = snapshot ?? (await loadDemoSnapshot());
  _backup = {
    userState: store.userState,
    history: store.history,
    currentSessionPlan: store.currentSessionPlan,
    currentSessionId: store.currentSessionId,
  };
  // Zod valide les valeurs string littérales — on cast vers les types métier
  // qui utilisent des enums (`ProgressionRule`, `SuggestedAction`, etc.). La
  // forme runtime est strictement identique.
  const serialized = snap.user_state as unknown as Parameters<typeof deserializeUserState>[0];
  const cycles = snap.history.cycles as unknown as HistorySnapshot['cycles'];
  useCoachOsStore.setState({
    userState: deserializeUserState(serialized),
    history: {
      sessions: snap.history.sessions.map((s) => ({ ...s })),
      feedbacks: snap.history.feedbacks.map((f) => ({ ...f })),
      e1rmSnapshots: snap.history.e1rmSnapshots.map((e) => ({ ...e })),
      cycles: cycles.map((c) => ({ ...c })),
    },
    currentSessionPlan: null,
    currentSessionId: null,
    demoMode: true,
    demoSnapshot: snap,
  });
}

/**
 * Sort du mode démo. Restaure l'état pré-démo depuis le backup module-level.
 * Idempotent — si pas en démo (ou pas de backup), no-op.
 */
export function exitDemoMode(): void {
  const store = useCoachOsStore.getState();
  if (!store.demoMode) return;
  if (_backup === null) {
    // sécurité — si on arrive là c'est qu'on a appelé enter sans bootstrap
    useCoachOsStore.setState({ demoMode: false, demoSnapshot: null });
    return;
  }
  useCoachOsStore.setState({
    userState: _backup.userState,
    history: _backup.history,
    currentSessionPlan: _backup.currentSessionPlan,
    currentSessionId: _backup.currentSessionId,
    demoMode: false,
    demoSnapshot: null,
  });
  _backup = null;
}

export function isDemoActive(): boolean {
  return useCoachOsStore.getState().demoMode;
}

/** Reset module-level state — pour les tests uniquement. */
export function _resetDemoForTests(): void {
  _backup = null;
  _cachedSnapshot = null;
}
