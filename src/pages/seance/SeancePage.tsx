import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
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
import { dateKey } from '@/lib/dashboard';
import { StartSessionList } from './StartSessionList';
import { SessionRunner } from './SessionRunner';
import { SessionSummary } from './SessionSummary';

/**
 * Onglet Séance — orchestre 3 états (Conv #5b).
 *
 *  A. `currentSessionPlan === null` et `summary === null` → liste de démarrage.
 *  B. `currentSessionPlan !== null` → exécution + saisie set par set.
 *  C. `summary !== null` (vient d'être enregistré) → bilan, jusqu'au "Retour".
 *
 * Source : `recherche/08_ux_decisions.md §3 Onglet Séance` (tuile dashboard,
 * saisie reps + RPE, récap fin de séance).
 */
export default function SeancePage() {
  const engine = useEngine();
  const userState = useCoachOsStore((s) => s.userState);
  const catalog = useCoachOsStore((s) => s.catalog);
  const currentSessionPlan = useCoachOsStore((s) => s.currentSessionPlan);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);

  const [entries, setEntries] = useState<SessionEntries>([]);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{
    label: string;
    data: SessionSummaryData;
  } | null>(null);

  // (Re)initialise les entrées quand le plan en cours change.
  // Cas particuliers (Conv #10d) :
  //  - Plan ↦ null : on vide.
  //  - Nouveau plan, ou structure différente (nb d'items) : on initialise tout.
  //  - Plan muté (remplacement d'un exo) : on garde les lignes déjà saisies des
  //    exos inchangés et on ne réinitialise QUE les lignes de l'exo remplacé.
  //    Sinon cocher une série puis remplacer un exo perdrait toutes les saisies
  //    en cours.
  const prevPlanRef = useRef<SessionPlan | null>(null);
  useEffect(() => {
    const prev = prevPlanRef.current;
    prevPlanRef.current = currentSessionPlan;
    if (currentSessionPlan === null) {
      setEntries([]);
      return;
    }
    if (prev === null || prev.items.length !== currentSessionPlan.items.length) {
      setEntries(initEntries(currentSessionPlan));
      return;
    }
    setEntries((current) =>
      currentSessionPlan.items.map((item, i) => {
        const prevItem = prev.items[i];
        const currentRow = current[i];
        const expectedLen = item.sets.length;
        const exoChanged = prevItem?.exercise_id !== item.exercise_id;
        if (exoChanged || currentRow === undefined || currentRow.length !== expectedLen) {
          return item.sets.map((s) => ({
            reps: s.reps,
            load_kg: s.load_kg,
            rpe: s.rpe_target,
            done: false,
          }));
        }
        return currentRow;
      }),
    );
  }, [currentSessionPlan]);

  const isInitialized = useMemo(() => {
    if (userState === null) return false;
    if (userState.current_cycle_plan === null) return false;
    return !userState.current_cycle_plan.requires_calibration;
  }, [userState]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (!isInitialized) {
    return <Navigate to="/seance-0" replace />;
  }

  // État C : bilan post-séance.
  if (summary !== null) {
    return (
      <SessionSummary
        label={summary.label}
        data={summary.data}
        catalog={catalog}
        onClose={() => setSummary(null)}
      />
    );
  }

  // État A : pas de plan en cours.
  if (currentSessionPlan === null) {
    return (
      <StartSessionList
        userState={userState}
        feedbacks={feedbacks}
        starting={starting}
        onStart={async (dayIndex) => {
          setStarting(true);
          try {
            await engine.generateAndStoreSession({
              dayIndex,
              seanceDate: dateKey(new Date()),
            });
          } finally {
            setStarting(false);
          }
        }}
      />
    );
  }

  // État B : séance en cours.
  return (
    <SessionRunner
      plan={currentSessionPlan}
      catalog={catalog}
      entries={entries}
      onEntriesChange={setEntries}
      finishing={finishing}
      onFinish={async () => {
        const fb = buildSessionFeedback(currentSessionPlan, entries);
        if (fb === null) return;
        setFinishing(true);
        try {
          const previousFeedbacks = feedbacks;
          const result = await engine.recordFeedbackAndCommit(fb);
          const data = computeSessionSummary(fb, result, previousFeedbacks);
          setSummary({ label: fb.label, data });
        } finally {
          setFinishing(false);
        }
      }}
    />
  );
}
