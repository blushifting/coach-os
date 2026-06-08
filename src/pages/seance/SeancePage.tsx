import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import type { SessionPlan } from '@/engine/models';
import {
  buildSessionFeedback,
  computeSessionSummary,
  initEntries,
  type SessionEntries,
  type SessionSummaryData,
} from '@/lib/session-runner';
import { isNotCalibrated, isStale } from '@/lib/calibration-status';
import { ChevronLeft } from '@/components/icons';
import { SessionRunner } from './SessionRunner';
import { SessionSummary } from './SessionSummary';

/**
 * Page runner — route `/seance/runner` (Conv #14b-1).
 *
 * Sortie de la TabBar : on n'arrive ici qu'après avoir démarré une séance
 * depuis le `PlanDaySheet` du Programme. Deux états :
 *
 *   B. `currentSessionPlan !== null` → exécution + saisie set par set.
 *   C. `summary !== null` (vient d'être enregistré) → bilan, jusqu'au "Retour".
 *
 * Conv #15 :
 *  - Contenu wrappé dans un `<main>` scrollable (l'AppShell est en
 *    `overflow-hidden`, sans wrapper interne la séance n'était pas
 *    scrollable).
 *  - Header "← Programme" pour pouvoir naviguer vers d'autres onglets sans
 *    terminer la séance — les coches survivent au démontage (cf. ci-dessous).
 *  - `entries` sortis du `useState` local et stockés dans le store global
 *    (`currentSessionEntries`) : revenir sur la route retrouve l'état exact.
 */
export default function SeancePage() {
  const engine = useEngine();
  const navigate = useNavigate();
  const userState = useCoachOsStore((s) => s.userState);
  const catalog = useCoachOsStore((s) => s.catalog);
  const currentSessionPlan = useCoachOsStore((s) => s.currentSessionPlan);
  const currentSessionId = useCoachOsStore((s) => s.currentSessionId);
  const storedEntries = useCoachOsStore((s) => s.currentSessionEntries);
  const setStoredEntries = useCoachOsStore((s) => s.setCurrentSessionEntries);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const snapshots = useCoachOsStore((s) => s.history.e1rmSnapshots);

  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{
    label: string;
    data: SessionSummaryData;
  } | null>(null);

  // Source de vérité : store. Si le store n'a pas encore d'entries (1er render
  // après démarrage de séance), on init et on persiste immédiatement.
  const entries: SessionEntries = storedEntries ?? [];

  // Conv #16 — Exos en mode calibration pour cette séance : ceux qui n'ont
  // pas encore de snapshot e1RM "récent" en BDD (`not_calibrated` ou `stale`).
  // Stable par session : capturé en ref au 1er mount d'une séance donnée pour
  // que le statut ne bascule pas pendant la séance (le snapshot ne se crée
  // qu'à la fin via `recordFeedback`).
  const calibrationSetRef = useRef<{
    sessionId: number | null;
    set: ReadonlySet<string>;
  } | null>(null);
  const computeCalibrationSet = useCallback(
    (plan: SessionPlan): ReadonlySet<string> => {
      const today = new Date();
      const out = new Set<string>();
      for (const item of plan.items) {
        if (
          isNotCalibrated(item.exercise_id, snapshots) ||
          isStale(item.exercise_id, snapshots, today)
        ) {
          out.add(item.exercise_id);
        }
      }
      return out;
    },
    [snapshots],
  );
  const calibrationExoIds = useMemo<ReadonlySet<string>>(() => {
    if (currentSessionPlan === null) return new Set();
    const cached = calibrationSetRef.current;
    if (cached !== null && cached.sessionId === currentSessionId) {
      return cached.set;
    }
    const next = computeCalibrationSet(currentSessionPlan);
    calibrationSetRef.current = { sessionId: currentSessionId, set: next };
    return next;
  }, [currentSessionPlan, currentSessionId, computeCalibrationSet]);

  // (Re)initialise les entrées quand le plan en cours change.
  // Cas particuliers (Conv #10d / #15) :
  //  - Plan ↦ null : rien à faire (store déjà clean).
  //  - Nouvelle session (sessionId change) : init complet, peu importe la forme.
  //  - Plan muté à sessionId constant (remplacement d'un exo en cours) :
  //    préserver les lignes des exos inchangés, ne réinitialiser que celles
  //    de l'exo remplacé.
  //  - Retour sur la page après navigation (même sessionId, même plan) :
  //    no-op, on lit `storedEntries` du store.
  const prevPlanRef = useRef<SessionPlan | null>(null);
  const prevSessionIdRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevPlanRef.current;
    const prevId = prevSessionIdRef.current;
    prevPlanRef.current = currentSessionPlan;
    prevSessionIdRef.current = currentSessionId;
    if (currentSessionPlan === null) return;

    // Conv #15 vague 3 — ordre des conditions corrigé : le 1er mount
    // doit être traité AVANT le `sessionChanged` (sinon `prevId === null`
    // déclenche à tort un reset au remount du composant alors qu'on veut
    // préserver `storedEntries`). Le `sessionChanged` ne s'applique qu'aux
    // changements de session pendant qu'on reste monté.
    if (prev === null) {
      const compatible =
        storedEntries !== null &&
        storedEntries.length === currentSessionPlan.items.length &&
        storedEntries.every(
          (row, i) => row.length === currentSessionPlan.items[i]!.sets.length,
        );
      if (!compatible) {
        setStoredEntries(
          initEntries(currentSessionPlan, { calibrationExoIds }),
        );
      }
      return;
    }
    const sessionChanged = currentSessionId !== prevId;
    if (sessionChanged) {
      setStoredEntries(
        initEntries(currentSessionPlan, { calibrationExoIds }),
      );
      return;
    }
    // Même session : tester si la structure du plan a changé (remplacement d'exo).
    const sameShape =
      prev.items.length === currentSessionPlan.items.length &&
      prev.items.every((it, i) => it.exercise_id === currentSessionPlan.items[i]!.exercise_id);
    if (sameShape) return; // rien à faire — le store garde les entries.

    const current = storedEntries ?? [];
    const merged: SessionEntries = currentSessionPlan.items.map((item, i) => {
      const prevItem = prev.items[i];
      const currentRow = current[i];
      const expectedLen = item.sets.length;
      const exoChanged = prevItem?.exercise_id !== item.exercise_id;
      if (exoChanged || currentRow === undefined || currentRow.length !== expectedLen) {
        const isCalibration = calibrationExoIds.has(item.exercise_id);
        return item.sets.map((s) => ({
          reps: isCalibration ? null : s.reps,
          load_kg: s.load_kg,
          rpe: null,
          done: false,
        }));
      }
      return currentRow;
    });
    setStoredEntries(merged);
    // storedEntries volontairement omis : on ne veut pas reboucler à chaque
    // saisie. On reset/merge uniquement quand plan ou sessionId change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionPlan, currentSessionId]);

  const isInitialized = useMemo(() => {
    if (userState === null) return false;
    return userState.current_cycle_plan !== null;
  }, [userState]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (!isInitialized) {
    return <Navigate to="/onboarding" replace />;
  }

  // État C : bilan post-séance.
  // Conv #24 (D5) — wrappé dans un conteneur plein écran scrollable et paddé.
  // Avant, le bilan était rendu nu : pas de scroll (AppShell est en
  // overflow-hidden), pas de marge horizontale, et surtout son titre « Bilan »
  // démarrait dans le coin haut-gauche → chevauché par le filigrane K (z-50).
  // Le `pt` réserve la bande du filigrane comme le font les autres pages.
  if (summary !== null) {
    return (
      <div
        className="flex h-full flex-1 flex-col bg-anthracite-950"
        data-testid="seance-summary-page"
      >
        <main
          className="flex-1 overflow-y-auto px-4 pb-8"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 3.25rem)' }}
        >
          <SessionSummary
            label={summary.label}
            data={summary.data}
            catalog={catalog}
            onClose={() => setSummary(null)}
          />
        </main>
      </div>
    );
  }

  // Conv #14b-1 — Plus de "État A" (start list) : si pas de plan en cours,
  // le démarrage se fait depuis le Programme. On rebondit là-bas.
  // Garde anti-flicker : pendant que `onFinish` est in-flight, le commit
  // peut clear `currentSessionPlan` AVANT que `setSummary` soit appelé.
  // On n'a alors ni plan ni summary l'espace d'un render — il ne faut pas
  // rediriger, sinon on rate le bilan.
  if (currentSessionPlan === null && !finishing) {
    return <Navigate to="/programme" replace />;
  }

  // État B : séance en cours (ou finish in-flight — on garde le runner monté).
  if (currentSessionPlan === null) return null;

  return (
    <div
      className="flex h-full flex-1 flex-col bg-anthracite-950"
      data-testid="seance-page"
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b border-anthracite-800 bg-anthracite-950/95 px-3 py-2 pl-12 backdrop-blur"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/programme')}
          data-testid="btn-back-to-programme"
          aria-label="Retour au programme (séance en pause)"
          className="flex h-11 items-center gap-1 rounded-lg px-3 text-sm text-anthracite-200 hover:bg-anthracite-800 hover:text-white"
        >
          <ChevronLeft />
          Programme
        </button>
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-sang-400">
          Séance en cours
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 pb-32">
        <SessionRunner
          // Conv #15 vague 2 — key sur sessionId pour garantir le remount à
          // chaque vraie nouvelle session (snapshot e1rmInitialRef refait).
          key={currentSessionId ?? 'no-session'}
          plan={currentSessionPlan}
          catalog={catalog}
          entries={entries}
          onEntriesChange={setStoredEntries}
          finishing={finishing}
          onFinish={async () => {
            const fb = buildSessionFeedback(currentSessionPlan, entries);
            if (fb === null) return;
            setFinishing(true);
            try {
              const previousFeedbacks = feedbacks;
              // Conv #21 — snapshot des exos déjà calibrés AVANT le commit
              // (= au moins un snapshot e1RM en BDD). Permet à
              // `computeSessionSummary` de distinguer première calibration
              // (pas d'ancien plafond à comparer) vs évolution (delta).
              const previouslyCalibrated = new Set(
                snapshots.map((s) => s.exercise_id),
              );
              const result = await engine.recordFeedbackAndCommit(fb);
              const data = computeSessionSummary(
                fb,
                result,
                previousFeedbacks,
                previouslyCalibrated,
              );
              setSummary({ label: fb.label, data });
            } finally {
              setFinishing(false);
            }
          }}
        />
      </main>
    </div>
  );
}
