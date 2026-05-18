/**
 * 1 écran par exo à calibrer en séance 0 (Conv #4c, refondu Conv #10c).
 *
 * Deux phases successives par exo :
 *  - **measure** : test plafond (1RM connu ou submax). Mêmes contrôles qu'avant.
 *  - **work**    : 2 séries de travail pré-remplies depuis `buildWorkingPrescription`
 *                  (charges déduites du plafond fraîchement mesuré, RPE cible
 *                  selon `targetRpeForExercise`). L'utilisateur ajuste, coche
 *                  "fait", puis passe à l'exo suivant. Les séries cochées
 *                  remontent côté Seance0Page pour alimenter un SessionFeedback
 *                  global (calibration fine via le moteur).
 *
 * Navigation :
 *  - En **measure**, "Précédent" = exo précédent (`onBack`).
 *  - En **work**, "← Modifier le plafond" = rebascule en **measure** (même exo).
 *
 * État local jusqu'à `onCommit`. Pas de persistance ici — c'est l'orchestrateur
 * (Seance0Page) qui agrège puis appelle `useEngine.commitInitialCalibration`
 * puis `useEngine.recordFeedbackAndCommit`.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { SetInput } from '@/pages/seance/SetInput';
import type { SetEntry } from '@/lib/session-runner';
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
type Phase = 'measure' | 'work';

export interface CalibrationWorkingSet {
  readonly reps_done: number;
  readonly load_kg: number;
  readonly rpe_perceived: number;
}

export interface CalibrationStepValue {
  /** e1RM "total" calculé, prêt à écrire dans `state.e1rm[exerciseId]`. */
  readonly e1rm: number;
  /** L'utilisateur a changé de variante → exo final à utiliser. */
  readonly finalExerciseId: string;
  /** Séries de travail cochées "fait" (peut être vide si l'user a tout sauté). */
  readonly workingSets: ReadonlyArray<CalibrationWorkingSet>;
}

export interface WorkingPrescription {
  readonly reps: number;
  readonly load_kg: number;
  readonly rpe_target: number;
}

interface CalibrationStepProps {
  readonly exercise: Exercise;
  readonly catalog: Catalog;
  readonly equipment: ReadonlySet<string>;
  readonly bodyweightKg: number;
  readonly progress: { readonly index: number; readonly total: number };
  readonly canGoBack: boolean;
  readonly isLastStep: boolean;
  readonly workingSetsCount: number;
  readonly onBack: () => void;
  readonly onCommit: (value: CalibrationStepValue) => void;
  readonly buildWorkingPrescription: (
    e1rmTotal: number,
    exercise: Exercise,
  ) => WorkingPrescription;
}

export function CalibrationStep({
  exercise,
  catalog,
  equipment,
  bodyweightKg,
  progress,
  canGoBack,
  isLastStep,
  workingSetsCount,
  onBack,
  onCommit,
  buildWorkingPrescription,
}: CalibrationStepProps) {
  const [phase, setPhase] = useState<Phase>('measure');
  const [currentEx, setCurrentEx] = useState<Exercise>(exercise);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const allowsKnown = allowsKnown1RM(currentEx.charge);
  // Conv #11f — "Je teste" en mode par défaut : peu d'utilisateurs connaissent
  // précisément leur 1RM, l'écran doit d'abord proposer le test sub-maximal.
  const [mode, setMode] = useState<Mode>('submax');
  const [knownLoad, setKnownLoad] = useState<string>('');
  const [submaxLoad, setSubmaxLoad] = useState<string>('');
  const [submaxReps, setSubmaxReps] = useState<number>(5);
  const [submaxRpe, setSubmaxRpe] = useState<number>(8);

  // Phase 'work' : plafond gelé + séries de travail saisies.
  const [measuredE1rm, setMeasuredE1rm] = useState<number | null>(null);
  const [workEntries, setWorkEntries] = useState<readonly SetEntry[]>([]);

  const alternatives = useMemo(
    () => alternativeVariantsFor(currentEx.id, equipment, catalog, { expand: expanded }),
    [currentEx.id, equipment, catalog, expanded],
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

  const canValidateMeasure = liveE1rm !== null && liveE1rm > 0;

  function handleValidateMeasure() {
    if (!canValidateMeasure || liveE1rm === null) return;
    const presc = buildWorkingPrescription(liveE1rm, currentEx);
    const entries: SetEntry[] = [];
    for (let i = 0; i < workingSetsCount; i++) {
      entries.push({
        reps: presc.reps,
        load_kg: presc.load_kg,
        rpe: presc.rpe_target,
        done: false,
      });
    }
    setMeasuredE1rm(liveE1rm);
    setWorkEntries(entries);
    setPhase('work');
  }

  function handleEditPlafond() {
    setPhase('measure');
  }

  function handleSetChange(idx: number, patch: Partial<SetEntry>) {
    setWorkEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  }

  function handleCommit() {
    if (measuredE1rm === null) return;
    const sets: CalibrationWorkingSet[] = [];
    for (const e of workEntries) {
      if (!e.done) continue;
      if (e.reps === null || e.reps <= 0) continue;
      if (e.load_kg === null) continue;
      sets.push({
        reps_done: e.reps,
        load_kg: e.load_kg,
        rpe_perceived: e.rpe,
      });
    }
    onCommit({
      e1rm: measuredE1rm,
      finalExerciseId: currentEx.id,
      workingSets: sets,
    });
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
      data-phase={phase}
    >
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Exo {progress.index} / {progress.total}
        </span>
        <h2 className="font-display text-2xl leading-tight tracking-wide text-white">
          {currentEx.nom_fr}
        </h2>
      </header>

      {phase === 'measure' ? (
        <>
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
              {/* Conv #11f — "Je teste" en 1re position (mode par défaut). */}
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
                    : 'text-anthracite-300 hover:text-white')
                }
              >
                Je teste
              </button>
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
                    : 'text-anthracite-300 hover:text-white')
                }
              >
                Je le connais
              </button>
            </div>

            {mode === 'submax' ? (
              <p className="mt-3 text-xs leading-relaxed text-anthracite-300">
                Choisis une charge où tu penses tenir 3 à 8 reps propres. Fais
                les reps que tu peux, puis indique combien et l'effort perçu.
                On en déduit ton plafond — pas besoin de chercher la limite.
              </p>
            ) : null}

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
              <ChevronLeft />
              Précédent
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!canValidateMeasure}
              onClick={handleValidateMeasure}
              data-testid="btn-next"
            >
              Valider mon plafond
              <ChevronRight />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card data-testid="work-recap">
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-anthracite-300">
              Plafond mesuré :{' '}
              <span className="font-semibold text-white">
                {measuredE1rm !== null ? measuredE1rm.toFixed(1) : '—'} kg
              </span>
              <HelpButton topic="plafond" label="Aide : plafond" />
            </p>
            <p className="mt-2 text-sm text-anthracite-300">
              Maintenant, fais {workingSetsCount} série{workingSetsCount > 1 ? 's' : ''}{' '}
              de travail (effort cible {workEntries[0]?.rpe ?? 8}/10). Ajuste
              charge / reps si besoin, puis valide chaque série avec « ✓ ».
            </p>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-white">Séries de travail</h3>
            <div className="flex flex-col gap-2">
              {workEntries.map((entry, i) => (
                <SetInput
                  key={i}
                  index={i}
                  entry={entry}
                  chargeType={currentEx.charge}
                  onChange={(patch) => handleSetChange(i, patch)}
                />
              ))}
            </div>
          </Card>

          <div className="mt-auto flex gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={handleEditPlafond}
              data-testid="btn-work-back"
            >
              <ChevronLeft />
              Modifier le plafond
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleCommit}
              data-testid="btn-work-next"
            >
              {isLastStep ? 'Terminer la séance 0' : 'Exo suivant'}
              <ChevronRight />
            </Button>
          </div>
        </>
      )}

      <VariantPickerSheet
        open={sheetOpen}
        currentExerciseId={currentEx.id}
        alternatives={alternatives}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        onPick={handlePickVariant}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
