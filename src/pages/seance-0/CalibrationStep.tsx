/**
 * 1 écran par exo à calibrer en séance 0.
 *
 * Deux modes :
 * - "1RM connu" : 1 champ "charge à 1 rep". Disponible pour barbell/dumbbell/
 *   machine/cable/bodyweight_loaded (cf. `allowsKnown1RM`).
 * - "Test sous-max" : reps (3-8) + charge + RPE (6-10 par 0.5).
 *
 * État local jusqu'à `onCommit`. Pas de persistance ici — c'est l'orchestrateur
 * (Seance0Page) qui agrège puis appelle `useEngine.commitInitialCalibration`.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { VariantPickerSheet } from './VariantPickerSheet';
import {
  SUBMAX_REPS_MAX,
  SUBMAX_REPS_MIN,
  SUBMAX_RPE_MAX,
  SUBMAX_RPE_MIN,
  SUBMAX_RPE_STEP,
  allowsKnown1RM,
  alternativeVariantsFor,
  e1rmFromKnown1RM,
  e1rmFromSubmaxTest,
  loadLabelFor,
  validateSubmaxInput,
} from '@/lib/calibration';
import { ChargeType, type Exercise } from '@/engine/models';
import type { Catalog } from '@/engine/catalog';

type Mode = 'known' | 'submax';

export interface CalibrationStepValue {
  /** e1RM "total" calculé, prêt à écrire dans `state.e1rm[exerciseId]`. */
  readonly e1rm: number;
  /** L'utilisateur a changé de variante → exo final à utiliser. */
  readonly finalExerciseId: string;
}

interface CalibrationStepProps {
  readonly exercise: Exercise;
  readonly catalog: Catalog;
  readonly equipment: ReadonlySet<string>;
  readonly bodyweightKg: number;
  readonly progress: { readonly index: number; readonly total: number };
  readonly canGoBack: boolean;
  readonly onBack: () => void;
  readonly onCommit: (value: CalibrationStepValue) => void;
}

export function CalibrationStep({
  exercise,
  catalog,
  equipment,
  bodyweightKg,
  progress,
  canGoBack,
  onBack,
  onCommit,
}: CalibrationStepProps) {
  const [currentEx, setCurrentEx] = useState<Exercise>(exercise);
  const [sheetOpen, setSheetOpen] = useState(false);
  const allowsKnown = allowsKnown1RM(currentEx.charge);
  const [mode, setMode] = useState<Mode>(allowsKnown ? 'known' : 'submax');
  const [knownLoad, setKnownLoad] = useState<string>('');
  const [submaxLoad, setSubmaxLoad] = useState<string>('');
  const [submaxReps, setSubmaxReps] = useState<number>(5);
  const [submaxRpe, setSubmaxRpe] = useState<number>(8);

  const alternatives = useMemo(
    () => alternativeVariantsFor(currentEx.id, equipment, catalog),
    [currentEx.id, equipment, catalog],
  );

  function handlePickVariant(newExId: string) {
    if (!catalog.has(newExId)) return;
    const newEx = catalog.get(newExId);
    setCurrentEx(newEx);
    setSheetOpen(false);
    if (!allowsKnown1RM(newEx.charge)) setMode('submax');
    setKnownLoad('');
    setSubmaxLoad('');
  }

  const liveE1rm: number | null = useMemo(() => {
    if (mode === 'known') {
      const v = Number.parseFloat(knownLoad);
      if (!Number.isFinite(v)) return null;
      if (currentEx.charge !== ChargeType.BODYWEIGHT && !(v > 0)) return null;
      return e1rmFromKnown1RM(v, currentEx, bodyweightKg);
    }
    const lv = currentEx.charge === ChargeType.BODYWEIGHT
      ? 0
      : Number.parseFloat(submaxLoad);
    const val = validateSubmaxInput(lv, submaxReps, submaxRpe, currentEx.charge);
    if (!val.ok) return null;
    try {
      return e1rmFromSubmaxTest(lv, submaxReps, submaxRpe, currentEx, bodyweightKg);
    } catch {
      return null;
    }
  }, [mode, knownLoad, submaxLoad, submaxReps, submaxRpe, currentEx, bodyweightKg]);

  const errorMsg: string | null = useMemo(() => {
    if (mode === 'submax') {
      const lv = currentEx.charge === ChargeType.BODYWEIGHT
        ? 0
        : Number.parseFloat(submaxLoad);
      if (Number.isNaN(lv)) return null;
      const val = validateSubmaxInput(lv, submaxReps, submaxRpe, currentEx.charge);
      return val.reason;
    }
    return null;
  }, [mode, submaxLoad, submaxReps, submaxRpe, currentEx.charge]);

  const canSubmit = liveE1rm !== null && liveE1rm > 0;

  function handleSubmit() {
    if (!canSubmit || liveE1rm === null) return;
    onCommit({ e1rm: liveE1rm, finalExerciseId: currentEx.id });
  }

  const loadLabel = loadLabelFor(currentEx.charge);
  const rpeOptions: number[] = [];
  for (let r = SUBMAX_RPE_MIN; r <= SUBMAX_RPE_MAX + 0.001; r += SUBMAX_RPE_STEP) {
    rpeOptions.push(Math.round(r * 2) / 2);
  }

  return (
    <div
      className="flex flex-col gap-4 p-4"
      data-testid="calibration-step"
      data-exercise-id={currentEx.id}
    >
      <div className="text-xs uppercase tracking-wide text-anthracite-500">
        Exo {progress.index} / {progress.total}
      </div>
      <h2 className="text-xl font-semibold text-white">{currentEx.nom_fr}</h2>
      <div className="-mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
          data-testid="btn-change-variant"
        >
          Changer de variante
        </Button>
      </div>

      <Card>
        <div
          role="tablist"
          className="grid grid-cols-2 gap-1 rounded-xl bg-anthracite-900 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'known'}
            disabled={!allowsKnown}
            onClick={() => setMode('known')}
            data-testid="tab-known"
            className={
              'rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 ' +
              (mode === 'known'
                ? 'bg-sang-700 text-white'
                : 'text-anthracite-500 hover:text-white')
            }
          >
            Je connais mon plafond
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'submax'}
            onClick={() => setMode('submax')}
            data-testid="tab-submax"
            className={
              'rounded-lg px-3 py-2 text-sm font-medium transition ' +
              (mode === 'submax'
                ? 'bg-sang-700 text-white'
                : 'text-anthracite-500 hover:text-white')
            }
          >
            Je teste
          </button>
        </div>

        {mode === 'known' ? (
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="known-load"
              className="text-sm text-anthracite-300"
            >
              Charge à 1 rep — {loadLabel}
            </label>
            <input
              id="known-load"
              data-testid="input-known-load"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={knownLoad}
              onChange={(e) => setKnownLoad(e.target.value)}
              className="h-11 rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 text-base text-white outline-none focus:border-sang-600"
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {currentEx.charge !== ChargeType.BODYWEIGHT ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="submax-load" className="text-sm text-anthracite-300">
                  {loadLabel}
                </label>
                <input
                  id="submax-load"
                  data-testid="input-submax-load"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={submaxLoad}
                  onChange={(e) => setSubmaxLoad(e.target.value)}
                  className="h-11 rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 text-base text-white outline-none focus:border-sang-600"
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <label htmlFor="submax-reps" className="text-sm text-anthracite-300">
                Reps réalisées ({SUBMAX_REPS_MIN}–{SUBMAX_REPS_MAX})
              </label>
              <input
                id="submax-reps"
                data-testid="input-submax-reps"
                type="number"
                inputMode="numeric"
                step="1"
                min={SUBMAX_REPS_MIN}
                max={SUBMAX_REPS_MAX}
                value={submaxReps}
                onChange={(e) => setSubmaxReps(Number.parseInt(e.target.value, 10) || 0)}
                className="h-11 rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 text-base text-white outline-none focus:border-sang-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="submax-rpe"
                className="flex items-center gap-1.5 text-sm text-anthracite-300"
              >
                Effort perçu (reps en réserve)
                <HelpButton topic="rpe" label="Aide : effort perçu" />
              </label>
              <select
                id="submax-rpe"
                data-testid="input-submax-rpe"
                value={submaxRpe}
                onChange={(e) => setSubmaxRpe(Number.parseFloat(e.target.value))}
                className="h-11 rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 text-base text-white outline-none focus:border-sang-600"
              >
                {rpeOptions.map((r) => (
                  <option key={r} value={r}>
                    Effort {r.toString()}/10 ({Math.max(0, 10 - r)} reps en réserve)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {errorMsg ? (
          <p
            role="alert"
            data-testid="calibration-error"
            className="mt-3 text-sm text-sang-500"
          >
            {errorMsg}
          </p>
        ) : null}

        {liveE1rm !== null && liveE1rm > 0 ? (
          <p
            data-testid="live-e1rm"
            className="mt-3 flex items-center gap-1.5 text-sm text-anthracite-300"
          >
            Plafond estimé :{' '}
            <span className="font-semibold text-white">{liveE1rm.toFixed(1)} kg</span>
            <HelpButton topic="plafond" label="Aide : plafond" />
          </p>
        ) : null}
      </Card>

      <div className="mt-auto flex gap-2 pt-4">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={!canGoBack}
          data-testid="btn-prev"
        >
          ← Précédent
        </Button>
        <Button
          variant="primary"
          fullWidth
          disabled={!canSubmit}
          onClick={handleSubmit}
          data-testid="btn-next"
        >
          Valider →
        </Button>
      </div>

      <VariantPickerSheet
        open={sheetOpen}
        currentExerciseId={currentEx.id}
        alternatives={alternatives}
        onPick={handlePickVariant}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
