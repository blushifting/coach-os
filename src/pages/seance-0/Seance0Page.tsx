/**
 * Séance 0 — Calibration des plafonds 1RM (Conv #4c).
 *
 * Au mount :
 *   1. `bootstrap()` (idempotent — utile en arrivée directe sur /seance-0).
 *   2. `generateInitialCyclePlan()` (idempotent) — pose `current_cycle_plan`.
 *   3. `pickCalibrationExercises(weekly, e1rm, catalog)`.
 *
 * Si la liste est vide (déjà tout calibré, ou reprise après tab fermé) →
 * redirige vers `/programme`.
 *
 * Si la liste est non vide → wizard 1 exo/écran (CalibrationStep). À la fin,
 * `commitInitialCalibration({ e1rmByExerciseId, variantReplacements })` puis
 * redirection vers `/programme` (dashboard, Conv #5).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import {
  bootstrap,
  commitInitialCalibration,
  generateInitialCyclePlan,
} from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { pickCalibrationExercises, type CalibrationItem } from '@/lib/calibration';
import type { WeeklyTemplate } from '@/engine/models';
import { CalibrationStep, type CalibrationStepValue } from './CalibrationStep';

type Phase = 'loading' | 'blocked' | 'ready' | 'committing' | 'done';

type StepResult = CalibrationStepValue;

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
    }

    try {
      await commitInitialCalibration({
        e1rmByExerciseId,
        variantReplacements: replacements,
      });
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
        onBack={handleBack}
        onCommit={handleStepCommit}
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
    <Card className="mx-4 mt-4" data-testid="seance0-intro">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
        Séance 0 — Calibration
        <HelpButton topic="plafond" label="Aide : plafond" />
      </h1>
      <p className="mt-2 text-sm text-anthracite-300">
        On mesure ton <span className="font-medium text-white">plafond</span>{' '}
        (charge max pour 1 rep) sur {total} exo{total > 1 ? 's' : ''} clé
        {total > 1 ? 's' : ''} du programme. Pour chacun, choisis ta variante
        préférée, puis indique ton plafond connu ou fais un test rapide (5 reps
        à un effort de 8/10 environ).
      </p>
    </Card>
  );
}

