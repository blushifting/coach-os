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
 * Si on arrive ici sans plan en cours et sans bilan à afficher, on redirige
 * vers `/programme` (l'utilisateur n'a rien à faire sur cette route).
 */
export default function SeancePage() {
  const engine = useEngine();
  const userState = useCoachOsStore((s) => s.userState);
  const catalog = useCoachOsStore((s) => s.catalog);
  const currentSessionPlan = useCoachOsStore((s) => s.currentSessionPlan);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);

  const [entries, setEntries] = useState<SessionEntries>([]);
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
    return userState.current_cycle_plan !== null;
  }, [userState]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (!isInitialized) {
    return <Navigate to="/onboarding" replace />;
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
