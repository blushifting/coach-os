import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ProgressRing } from '@/components/ProgressRing';
import { cn } from '@/lib/cn';
import { triggerHaptic } from '@/lib/haptics';
import type { Catalog } from '@/engine/catalog';
import type { SessionPlan } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import {
  countDoneSets,
  countPlannedSets,
  formatRest,
  recalibrateUpcomingSets,
  type SessionEntries,
  updateSetEntry,
} from '@/lib/session-runner';
import { e1rmConfidenceFor } from '@/lib/calibration-status';
import { bootstrapE1rmIfMissing } from '@/engine/engine';
import { CalibrationBanner } from './CalibrationBanner';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { PatternIcon } from './PatternIcon';
import { SetInput } from './SetInput';

interface SessionRunnerProps {
  readonly plan: SessionPlan;
  readonly catalog: Catalog | null;
  readonly entries: SessionEntries;
  readonly onEntriesChange: (next: SessionEntries) => void;
  readonly onFinish: () => void;
  readonly finishing: boolean;
}

/**
 * Écran "État B" — séance en cours. Affiche les exos planifiés, saisie set
 * par set, indicateur de progression. Bouton "Terminer la séance".
 */
export function SessionRunner({
  plan,
  catalog,
  entries,
  onEntriesChange,
  onFinish,
  finishing,
}: SessionRunnerProps) {
  const engine = useEngine();
  const navigate = useNavigate();
  const userState = useCoachOsStore((s) => s.userState);
  const demoActive = useDemoMode();
  const snapshots = useCoachOsStore((s) => s.history.e1rmSnapshots);
  const [detail, setDetail] = useState<{ exerciseId: string; itemIndex: number } | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sessionId = useCoachOsStore.getState().currentSessionId;
  const done = countDoneSets(entries);
  const total = countPlannedSets(entries);
  const incomplete = done < total;

  async function handleSkip() {
    setConfirmSkip(false);
    setSkipping(true);
    try {
      await engine.skipCurrentSession();
      navigate('/programme');
    } finally {
      setSkipping(false);
    }
  }

  // Conv #15 vague 3 — annulation : supprime la session de la DB (vs skip
  // qui la marque `status='skipped'`). La case calendrier redevient libre.
  async function handleCancel() {
    setConfirmCancel(false);
    if (sessionId === null) return;
    setCancelling(true);
    try {
      await engine.cancelPlannedSession(sessionId);
      navigate('/programme');
    } finally {
      setCancelling(false);
    }
  }

  // Conv #12b — confidence dérivée pour chaque exo, calculée 1× par cycle de
  // render à partir des snapshots datés. Le banner s'affiche au-dessus du
  // bloc des séries pour les exos `not_calibrated` ou `stale`.
  const confidenceByExo = useMemo(() => {
    const today = new Date();
    const e1rm = userState?.e1rm ?? {};
    const out: Record<string, ReturnType<typeof e1rmConfidenceFor>> = {};
    for (const item of plan.items) {
      out[item.exercise_id] = e1rmConfidenceFor(
        item.exercise_id,
        e1rm,
        snapshots,
        today,
      );
    }
    return out;
  }, [plan.items, userState?.e1rm, snapshots]);
  const bodyweight = userState?.profile.bodyweight_kg ?? 75;

  // Conv #15 vague 2/3 — snapshot des e1RM au mount du runner (figé pour
  // toute la séance). Sert de baseline pour `recalibrateUpcomingSets`.
  // Inclut le bootstrap heuristique des exos non encore calibrés (pour
  // un fresh user post-onboarding, `state.e1rm` est vide — sans bootstrap
  // le ratio serait toujours undefined et le recalibrage no-op). Le
  // remount à chaque sessionId (key dans SeancePage) rafraîchit ce snapshot.
  const e1rmInitialRef = useRef<Record<string, number> | null>(null);
  if (e1rmInitialRef.current === null && userState !== null && catalog !== null) {
    const snap: Record<string, number> = { ...userState.e1rm };
    for (const item of plan.items) {
      if (snap[item.exercise_id] === undefined && catalog.has(item.exercise_id)) {
        snap[item.exercise_id] = bootstrapE1rmIfMissing(
          userState,
          catalog.get(item.exercise_id),
        );
      }
    }
    e1rmInitialRef.current = snap;
  }

  // Wrap onEntriesChange : à chaque transition `done=false → done=true`
  // d'une série, on déclenche le recalibrage **uniquement pour les exos en
  // mode calibration** (`confidence !== 'measured'`, Conv #16). Pour les exos
  // déjà calibrés, on laisse les charges prescrites intactes en cours de
  // séance — l'algo fin de séance s'occupera de la mise à jour stable du
  // plafond. `recalibrateUpcomingSets` accepte aussi les séries non fiables :
  // dans ce cas il ne touche pas aux charges mais peut pré-remplir les reps.
  const handleEntriesChange = useCallback(
    (next: SessionEntries) => {
      if (catalog === null) {
        onEntriesChange(next);
        return;
      }
      let triggeredIdx = -1;
      for (let i = 0; i < next.length && triggeredIdx < 0; i++) {
        const newRow = next[i] ?? [];
        const oldRow = entries[i] ?? [];
        for (let j = 0; j < newRow.length; j++) {
          const ne = newRow[j];
          const oe = oldRow[j];
          if (!ne || !oe) continue;
          if (ne.done && !oe.done) {
            if (ne.reps !== null && ne.reps > 0) {
              triggeredIdx = i;
              break;
            }
          }
        }
      }
      if (triggeredIdx >= 0 && e1rmInitialRef.current !== null) {
        const exId = plan.items[triggeredIdx]?.exercise_id;
        const isCalibrating =
          exId !== undefined &&
          (confidenceByExo[exId] ?? 'measured') !== 'measured';
        if (isCalibrating) {
          next = recalibrateUpcomingSets({
            entries: next,
            plan,
            catalog,
            bodyweightKg: bodyweight,
            e1rmInitial: e1rmInitialRef.current,
            itemIdx: triggeredIdx,
          });
        }
      }
      onEntriesChange(next);
    },
    [catalog, entries, plan, bodyweight, onEntriesChange, confidenceByExo],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="session-runner">
      <Card accent data-testid="session-progress" className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-sang-400/90">
            Séance
          </span>
          <span className="font-display text-2xl leading-none tracking-wide text-white">
            {plan.label}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-anthracite-300">
            Cycle {plan.cycle_index} · S{plan.week_in_cycle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* Conv #18 — `whitespace-nowrap` + shrink-0 sur le wrapper pour que
              "Séries 12/12" reste sur une ligne quand X a 2 chiffres. */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-anthracite-300">
              Séries
            </span>
            <span className="whitespace-nowrap font-display text-3xl leading-none tabular-nums text-white">
              <span className="text-sang-400">{done}</span>
              <span className="text-anthracite-400"> / {total}</span>
            </span>
          </div>
          <ProgressRing
            value={done}
            total={total}
            size={44}
            strokeWidth={4}
            data-testid="session-ring"
          />
        </div>
      </Card>

      <ul className="flex flex-col gap-3">
        {plan.items.map((item, i) => {
          const ex = safeGet(catalog, item.exercise_id);
          const entrySets = entries[i] ?? [];
          const doneCount = entrySets.filter((s) => s.done).length;
          const chargeType = ex?.charge;
          return (
            <li key={`${item.exercise_id}-${i}`}>
              <Card
                className="flex flex-col gap-2"
                data-testid={`exo-card-${i}`}
                data-exercise-id={item.exercise_id}
              >
                <header className="flex items-center gap-2">
                  {ex !== null && <PatternIcon pattern={ex.pattern} size="sm" />}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-white">
                      {ex?.nom_fr ?? item.exercise_id}
                    </span>
                    <span className="text-xs text-anthracite-300">
                      <span
                        className={cn(
                          'font-display tabular-nums tracking-wide',
                          doneCount > 0 ? 'text-sang-400' : 'text-anthracite-200',
                        )}
                      >
                        {doneCount}/{entrySets.length}
                      </span>{' '}
                      séries — repos {formatRest(item.sets[0]?.rest_s ?? 0)}
                    </span>
                  </div>
                  {/* Conv #11i — progress ring par exo */}
                  <ProgressRing
                    value={doneCount}
                    total={entrySets.length}
                    size={28}
                    strokeWidth={3}
                  />
                  <button
                    type="button"
                    aria-label={`Détail ${ex?.nom_fr ?? item.exercise_id}`}
                    data-testid={`btn-detail-${i}`}
                    onClick={() => setDetail({ exerciseId: item.exercise_id, itemIndex: i })}
                    className="h-7 w-7 rounded-full bg-anthracite-700 text-xs text-anthracite-300 hover:text-white"
                  >
                    i
                  </button>
                </header>

                {ex !== null ? (
                  <CalibrationBanner
                    exercise={ex}
                    bodyweightKg={bodyweight}
                    confidence={confidenceByExo[item.exercise_id] ?? 'measured'}
                    entries={entrySets}
                  />
                ) : null}

                <div className="flex flex-col gap-1.5">
                  {entrySets.map((entry, j) => (
                    <SetInput
                      key={j}
                      index={j}
                      entry={entry}
                      chargeType={chargeType}
                      rpeTarget={item.sets[j]?.rpe_target}
                      checkLocked={j > 0 && !entrySets[j - 1]!.done}
                      onChange={(patch) =>
                        handleEntriesChange(updateSetEntry(entries, i, j, patch))
                      }
                    />
                  ))}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => setConfirmFinish(true)}
        disabled={finishing || done === 0 || demoActive}
        data-testid="btn-finish-session"
      >
        {finishing ? 'Enregistrement…' : 'Terminer la séance'}
      </Button>

      <Dialog
        open={confirmFinish}
        title="Terminer la séance ?"
        description={
          incomplete ? (
            <>
              Tu as coché <strong>{done}/{total}</strong> séries. Une fois
              terminée, tu ne pourras plus modifier la séance — les séries non
              cochées seront comptées comme non faites (dette de volume).
            </>
          ) : (
            <>
              Toutes les séries sont cochées. La séance sera enregistrée et
              tes plafonds seront mis à jour.
            </>
          )
        }
        confirmLabel="Terminer"
        cancelLabel="Continuer la séance"
        onConfirm={() => {
          setConfirmFinish(false);
          triggerHaptic('session-done');
          onFinish();
        }}
        onCancel={() => setConfirmFinish(false)}
      />

      {/* Conv #14b-3 — sortie alternative : marquer la séance comme sautée.
          Verrouillé en mode démo (protection mutations, Conv #16). */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        onClick={() => setConfirmSkip(true)}
        disabled={finishing || skipping || cancelling || demoActive}
        data-testid="btn-skip-session"
      >
        {skipping ? 'Marquage…' : 'Sauter cette séance'}
      </Button>

      {/* Conv #15 vague 3 — annuler : retire complètement la séance, comme
          si elle n'avait pas été programmée. Distinct de "Sauter" (qui
          laisse une trace barrée dans le calendrier). */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        onClick={() => setConfirmCancel(true)}
        disabled={finishing || skipping || cancelling || demoActive}
        data-testid="btn-cancel-session"
      >
        {cancelling ? 'Annulation…' : 'Annuler la séance'}
      </Button>

      <Dialog
        open={confirmCancel}
        title="Annuler la séance ?"
        description={
          <>
            La séance sera retirée du calendrier comme si elle n'avait jamais
            été programmée. Tes coches éventuelles ne seront pas enregistrées.
          </>
        }
        confirmLabel="Annuler la séance"
        cancelLabel="Continuer"
        destructive
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <Dialog
        open={confirmSkip}
        title="Sauter cette séance ?"
        description={
          done > 0 ? (
            <>
              Tu as déjà coché {done} série(s) — elles ne seront pas enregistrées.
              La séance restera marquée comme sautée dans le calendrier.
            </>
          ) : (
            <>La séance sera marquée comme sautée dans le calendrier. Tu pourras
            en redémarrer une depuis le Programme.</>
          )
        }
        confirmLabel="Sauter"
        cancelLabel="Annuler"
        destructive
        onConfirm={handleSkip}
        onCancel={() => setConfirmSkip(false)}
      />

      <ExerciseDetailSheet
        open={detail !== null}
        exerciseId={detail?.exerciseId ?? null}
        catalog={catalog}
        onClose={() => setDetail(null)}
        onReplace={
          detail === null
            ? undefined
            : async (newExId) => {
                await engine.replaceSessionExercise({
                  itemIndex: detail.itemIndex,
                  newExerciseId: newExId,
                });
              }
        }
      />
    </div>
  );
}

function safeGet(catalog: Catalog | null, exerciseId: string) {
  if (catalog === null) return null;
  try {
    return catalog.get(exerciseId);
  } catch {
    return null;
  }
}
