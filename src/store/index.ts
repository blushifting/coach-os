/**
 * Store global Coach OS — Zustand.
 *
 * Architecture : un store unique avec **4 sections logiques** (cf. plan
 * Conv #3 §3) — `userState` (source de vérité moteur), `session` (UI
 * de la séance en cours, non encore commit), `history` (vues cachées
 * lues depuis la DB pour l'UI Progrès), `catalog` (référence statique).
 *
 * Pas de slices Zustand séparés : le moteur veut un `UserState` unifié,
 * fragmenter le store en 4 instances obligerait à le recomposer à chaque
 * tick. Sections logiques + sélecteurs ciblés suffisent (cf. selectors.ts).
 *
 * Toute mutation passe par `useEngine` (hook), jamais par `set` direct
 * depuis l'UI — pour garantir l'invariant "mutation moteur ⟹ persistance DB".
 */

import { create } from 'zustand';
import type { Catalog } from '@/engine/catalog';
import type {
  CycleReview,
  SessionFeedback,
  SessionPlan,
  UserState,
} from '@/engine/models';
import type { SessionEntries } from '@/lib/session-runner';
import type {
  CycleRow,
  E1rmSnapshotRow,
  FeedbackRow,
  SessionRow,
} from '@/db/schema';
import type { DemoSnapshot } from '@/lib/demo-schema';

// =============================================================================
// État du store
// =============================================================================

export interface HistorySnapshot {
  sessions: SessionRow[];
  feedbacks: FeedbackRow[];
  e1rmSnapshots: E1rmSnapshotRow[];
  cycles: CycleRow[];
}

export interface CoachOsState {
  // --- userState : source de vérité moteur (in-memory miroir du blob DB) ---
  userState: UserState | null;

  // --- session UI : séance en cours non encore commitée en DB ---
  currentSessionPlan: SessionPlan | null;
  currentSessionId: number | null;
  /**
   * Conv #15 — coches/saisies en cours pour la session active. Sorti du
   * `useState` local de `SeancePage` pour survivre à la navigation (l'utilisateur
   * peut consulter le Catalogue ou les Progrès au milieu de la séance sans
   * perdre ses séries déjà cochées). Reset à chaque changement de
   * `currentSessionPlan` (nouvelle structure de plan).
   */
  currentSessionEntries: SessionEntries | null;

  // --- history : vues lues depuis la DB pour l'UI Progrès ---
  history: HistorySnapshot;

  // --- catalog : référence statique chargée une fois ---
  catalog: Catalog | null;
  /**
   * Conv #21b-fix — Ids des exos custom ajoutés par l'utilisateur (table
   * `userAddedExercises`). Sert à l'UI pour distinguer ces exos des exos
   * par défaut (ex. proposer un bouton "Supprimer cet exo" sur un custom,
   * pas sur un exo de la base). Synchronisé avec `catalog` à chaque
   * `addCustomExercise` / `removeCustomExercise`.
   */
  customExerciseIds: ReadonlySet<string>;

  // --- méta ---
  bootstrapped: boolean;
  lastEndOfWeekReview: { event: string; cycle_index: number } | null;
  lastCycleReview: CycleReview | null;

  /**
   * Mode démo Conv #13. Quand `true`, `userState` + `history` viennent de
   * `demoSnapshot` (cf. `lib/demo.ts`). La vraie DB Dexie est figée pendant
   * cette session : aucune écriture, aucun bootstrap rechargé.
   */
  demoMode: boolean;
  demoSnapshot: DemoSnapshot | null;
}

// =============================================================================
// Setters internes (utilisés par useEngine, pas par l'UI)
// =============================================================================

export interface CoachOsActions {
  setCatalog: (catalog: Catalog) => void;
  setUserState: (state: UserState | null) => void;
  setBootstrapped: (b: boolean) => void;
  setCurrentSession: (plan: SessionPlan | null, id: number | null) => void;
  setCurrentSessionEntries: (entries: SessionEntries | null) => void;
  setHistory: (h: HistorySnapshot) => void;
  setLastEndOfWeek: (r: { event: string; cycle_index: number } | null) => void;
  setLastCycleReview: (r: CycleReview | null) => void;
  /** Reset complet — utilisé après import ou reset de profil. */
  resetAll: () => void;
}

const initialHistory: HistorySnapshot = {
  sessions: [],
  feedbacks: [],
  e1rmSnapshots: [],
  cycles: [],
};

const initialState: CoachOsState = {
  userState: null,
  currentSessionPlan: null,
  currentSessionId: null,
  currentSessionEntries: null,
  history: initialHistory,
  catalog: null,
  customExerciseIds: new Set<string>(),
  bootstrapped: false,
  lastEndOfWeekReview: null,
  lastCycleReview: null,
  demoMode: false,
  demoSnapshot: null,
};

export const useCoachOsStore = create<CoachOsState & CoachOsActions>((set) => ({
  ...initialState,
  setCatalog: (catalog) => set({ catalog }),
  setUserState: (userState) => set({ userState }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  setCurrentSession: (currentSessionPlan, currentSessionId) =>
    // Conv #15 — changement de plan ⟹ reset des entries pour éviter d'hériter
    // de coches d'une session précédente (callers : start/skip/finish session).
    set({ currentSessionPlan, currentSessionId, currentSessionEntries: null }),
  setCurrentSessionEntries: (currentSessionEntries) =>
    set({ currentSessionEntries }),
  setHistory: (history) => set({ history }),
  setLastEndOfWeek: (lastEndOfWeekReview) => set({ lastEndOfWeekReview }),
  setLastCycleReview: (lastCycleReview) => set({ lastCycleReview }),
  resetAll: () => set({ ...initialState }),
}));

// Pour les tests : version "vanilla" du store (sans React).
export type CoachOsStore = typeof useCoachOsStore;

// Réexport des feedbacks publics (utile pour useEngine)
export type { CycleReview, SessionFeedback, SessionPlan, UserState };
