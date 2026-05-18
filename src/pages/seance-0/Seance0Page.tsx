/**
 * Séance 0 — Calibration des plafonds 1RM + séries de travail (Conv #4c, refondu #10c).
 *
 * Au mount :
 *   1. `bootstrap()` (idempotent — utile en arrivée directe sur /seance-0).
 *   2. `generateInitialCyclePlan()` (idempotent) — pose `current_cycle_plan`.
 *   3. `pickCalibrationExercises(weekly, e1rm, catalog)`.
 *
 * Si la liste est vide (déjà tout calibré, ou reprise après tab fermé) →
 * redirige vers `/programme`.
 *
 * Si la liste est non vide → wizard 1 exo/écran (CalibrationStep) en 2 phases :
 *  - mesure du plafond (test 1RM connu ou submax)
 *  - 2 séries de travail (charges dérivées du plafond via `buildPrescription`).
 *
 * À la fin : `commitInitialCalibration({e1rm, variantReplacements})` puis,
 * si au moins une série de travail a été cochée "fait",
 * `recordFeedbackAndCommit({label: "Séance 0", sets})` pour alimenter
 * l'historique et raffiner les e1RM via le moteur. Puis redirection
 * vers `/programme`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import {
  bootstrap,
  commitInitialCalibration,
  generateInitialCyclePlan,
  recordFeedbackAndCommit,
  shiftCurrentCycleStartToTomorrow,
} from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { pickCalibrationExercises, type CalibrationItem } from '@/lib/calibration';
import { buildPrescription } from '@/engine/prescription';
import type {
  Exercise,
  SessionFeedback,
  SetFeedback,
  WeeklyTemplate,
} from '@/engine/models';
import {
  CalibrationStep,
  type CalibrationStepValue,
  type WorkingPrescription,
} from './CalibrationStep';

type Phase = 'loading' | 'blocked' | 'ready' | 'committing' | 'done';

type StepResult = CalibrationStepValue;

const WORKING_SETS_COUNT = 2;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Seance0Page() {
  const navigate = useNavigate();
  const catalog = useCoachOsStore((s) => s.catalog);
  const userState = useCoachOsStore((s) => s.userState);

  const [phase, setPhase] = useState<Phase>('loading');
  const [blocking, setBlocking] = useState<string[]>([]);
  const [items, setItems] = useState<readonly CalibrationItem[]>([]);
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        await bootstrap();
        const res = await generateInitialCyclePlan();
        if (cancelled) return;
        if (res.state === null) {
          setBlocking(res.blocking);
          setPhase('blocked');
          return;
        }
        const cat = useCoachOsStore.getState().catalog;
        if (cat === null) throw new Error('catalog non initialisé');
        const weekly = res.state.current_cycle_plan as WeeklyTemplate;
        const list = pickCalibrationExercises(weekly, res.state.e1rm, cat);
        if (list.length === 0) {
          navigate('/programme', { replace: true });
          return;
        }
        setItems(list);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Erreur inattendue');
        setPhase('ready');
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const currentItem = items[stepIndex] ?? null;
  const currentExercise = useMemo(() => {
    if (currentItem === null || catalog === null) return null;
    if (!catalog.has(currentItem.exerciseId)) return null;
    return catalog.get(currentItem.exerciseId);
  }, [currentItem, catalog]);

  const buildWorkingPrescription = useCallback(
    (e1rmTotal: number, exercise: Exercise): WorkingPrescription => {
      const state = useCoachOsStore.getState().userState;
      if (state === null) {
        return { reps: 5, load_kg: 0, rpe_target: 8 };
      }
      const presc = buildPrescription(
        exercise,
        e1rmTotal,
        state.profile,
        state.current_week_in_cycle,
        {
          muscleGoals: state.muscle_goals,
          state,
        },
      );
      return {
        reps: presc.reps,
        load_kg: presc.load_kg,
        rpe_target: presc.rpe_target,
      };
    },
    [],
  );

  function handleStepCommit(value: StepResult) {
    if (currentItem === null) return;
    const next = { ...results, [currentItem.exerciseId]: value };
    setResults(next);
    if (stepIndex + 1 < items.length) {
      setStepIndex((i) => i + 1);
    } else {
      void finalize(next);
    }
  }

  function handleBack() {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  }

  async function finalize(allResults: Record<string, StepResult>) {
    if (userState === null) return;
    const weekly = userState.current_cycle_plan;
    if (weekly === null) return;
    setPhase('committing');
    setError(null);

    const e1rmByExerciseId: Record<string, number> = {};
    const replacements: Array<{
      dayIndex: number;
      slotIndex: number;
      newExerciseId: string;
    }> = [];
    const feedbackSets: SetFeedback[] = [];

    for (const it of items) {
      const r = allResults[it.exerciseId];
      if (r === undefined) continue;
      e1rmByExerciseId[r.finalExerciseId] = r.e1rm;
      if (r.finalExerciseId !== it.exerciseId) {
        for (let di = 0; di < weekly.days.length; di++) {
          const day = weekly.days[di]!;
          for (let si = 0; si < day.exercises.length; si++) {
            if (day.exercises[si]!.exercise_id === it.exerciseId) {
              replacements.push({
                dayIndex: di,
                slotIndex: si,
                newExerciseId: r.finalExerciseId,
              });
            }
          }
        }
      }
      for (const ws of r.workingSets) {
        feedbackSets.push({
          exercise_id: r.finalExerciseId,
          reps_done: ws.reps_done,
          load_kg: ws.load_kg,
          rpe_perceived: ws.rpe_perceived,
        });
      }
    }

    try {
      const stateAfter = await commitInitialCalibration({
        e1rmByExerciseId,
        variantReplacements: replacements,
      });

      if (feedbackSets.length > 0) {
        const feedback: SessionFeedback = {
          seance_date: todayIso(),
          week_in_cycle: stateAfter.current_week_in_cycle,
          cycle_index: stateAfter.cycle_index,
          rpe_target: 8,
          sets: feedbackSets,
          label: 'Séance 0',
        };
        await recordFeedbackAndCommit(feedback);

        // Conv #11i bis — la Séance 0 est une intro pré-cycle : on décale le
        // start_date du cycle au lendemain pour que le calendrier visuel ne
        // place pas la S1 sur le jour de la calibration. Le shift n'a de
        // sens que si l'user a effectivement fait des séries (sinon la
        // Séance 0 = simple parcours de validation sans contenu, pas la
        // peine de décaler).
        await shiftCurrentCycleStartToTomorrow();
      }

      setPhase('done');
      navigate('/programme', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
      setPhase('ready');
    }
  }

  if (phase === 'loading') {
    return (
      <div
        className="flex flex-1 items-center justify-center bg-anthracite-950 text-anthracite-300"
        data-testid="seance0-loading"
      >
        Préparation de ta séance 0…
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div
        className="flex flex-1 flex-col gap-4 overflow-y-auto bg-anthracite-950 p-6"
        data-testid="seance0-blocked"
      >
        <h2 className="text-xl font-semibold text-white">
          Programme guidé incompatible avec ton équipement
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-anthracite-300">
          {blocking.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <Button variant="primary" onClick={() => navigate('/onboarding')}>
          Retour à l'onboarding
        </Button>
      </div>
    );
  }

  if (currentItem === null || currentExercise === null || catalog === null || userState === null) {
    return (
      <div
        className="flex flex-1 items-center justify-center bg-anthracite-950 text-anthracite-300"
        data-testid="seance0-empty"
      >
        Aucune calibration à faire.
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto bg-anthracite-950"
      data-testid="seance0-page"
      data-step={stepIndex + 1}
      data-total={items.length}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {stepIndex === 0 ? (
        <IntroBanner total={items.length} />
      ) : null}

      <CalibrationStep
        key={currentItem.exerciseId}
        exercise={currentExercise}
        catalog={catalog}
        equipment={new Set(userState.profile.available_equip)}
        bodyweightKg={userState.profile.bodyweight_kg}
        progress={{ index: stepIndex + 1, total: items.length }}
        canGoBack={stepIndex > 0 && phase !== 'committing'}
        isLastStep={stepIndex + 1 === items.length}
        workingSetsCount={WORKING_SETS_COUNT}
        onBack={handleBack}
        onCommit={handleStepCommit}
        buildWorkingPrescription={buildWorkingPrescription}
      />

      {phase === 'committing' ? (
        <div
          className="px-4 pb-4 text-center text-sm text-anthracite-400"
          data-testid="seance0-committing"
        >
          Enregistrement…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          data-testid="seance0-error"
          className="mx-4 mb-4 rounded-xl border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-500"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

function IntroBanner({ total }: { readonly total: number }) {
  return (
    <Card accent className="mx-4 mt-4" data-testid="seance0-intro">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Séance 0
        </span>
        <h1 className="flex items-center gap-2 font-display text-2xl leading-tight tracking-wide text-white">
          Calibration
          <HelpButton topic="plafond" label="Aide : plafond" />
        </h1>
      </header>
      <p className="mt-3 text-sm leading-relaxed text-anthracite-200">
        Cette séance sert à découvrir ton niveau réel sur les {total} exo
        {total > 1 ? 's' : ''} clé{total > 1 ? 's' : ''} de ton programme.
        C'est une vraie séance, pas un sondage — tu chauffes, tu pousses,
        tu enregistres.
      </p>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm text-anthracite-200">
        <li className="flex gap-2">
          <span className="font-display text-sang-400">1.</span>
          <span>
            Pour chaque exo, on commence par{' '}
            <span className="font-medium text-white">mesurer ton plafond</span>{' '}
            (charge à 1 rep). Pas besoin de la chercher pile : tu fais un
            test à charge modérée et l'app calcule.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-display text-sang-400">2.</span>
          <span>
            Puis tu enchaînes{' '}
            <span className="font-medium text-white">2 séries de travail</span>{' '}
            à charge réelle (effort cible 8/10), exactement comme dans le
            programme. Ces séries comptent dans ton historique.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-display text-sang-400">3.</span>
          <span>
            On passe à l'exo suivant. Compte ~7-8 min par exo (~
            {Math.round(total * 7.5)} min au total).
          </span>
        </li>
      </ol>
    </Card>
  );
}
