/**
 * Sheet "Je connais mon plafond" — Conv #12b.
 *
 * Saisie d'une charge à 1 rep pour un exo donné. Au validate :
 *   - `effectiveLoadForE1rm` pour intégrer le poids du corps si applicable
 *     (BW loaded → on ajoute le bw, BW assisted → on retranche).
 *   - `useEngine.setManualE1rm` pose la valeur + insère un snapshot daté.
 *
 * Le banner de calibration disparaît immédiatement après commit (la
 * confidence dérivée bascule en `'measured'` puisqu'on a un snapshot frais).
 */

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { useEngine } from '@/hooks/useEngine';
import { ChargeType, type Exercise } from '@/engine/models';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';

interface ManualE1rmSheetProps {
  readonly open: boolean;
  readonly exercise: Exercise;
  readonly bodyweightKg: number;
  readonly onClose: () => void;
}

function loadLabel(charge: ChargeType): string {
  switch (charge) {
    case ChargeType.BODYWEIGHT_LOADED:
      return 'Charge ajoutée à 1 rep (kg)';
    case ChargeType.BODYWEIGHT_ASSISTED:
      return 'Assistance à 1 rep (kg)';
    case ChargeType.BODYWEIGHT:
      return 'Poids du corps utilisé';
    case ChargeType.DUMBBELL:
      return 'Charge par haltère à 1 rep (kg)';
    default:
      return 'Charge à 1 rep (kg)';
  }
}

export function ManualE1rmSheet({
  open,
  exercise,
  bodyweightKg,
  onClose,
}: ManualE1rmSheetProps) {
  const engine = useEngine();
  const brand = useGymBrand() ?? undefined;
  const displayName = displayExerciseName(exercise, brand);
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset à chaque ouverture (un seul slot par exo).
  useEffect(() => {
    if (open) {
      setRaw('');
      setError(null);
    }
  }, [open, exercise.id]);

  const isBwPure = exercise.charge === ChargeType.BODYWEIGHT;
  const parsed = Number.parseFloat(raw);
  const canSubmit =
    isBwPure || (Number.isFinite(parsed) && parsed > 0);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const loadKg = isBwPure ? 0 : parsed;
      await engine.setManualE1rm({
        exerciseId: exercise.id,
        exercise,
        loadKg,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible d'enregistrer. Réessaie dans un instant.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Plafond — ${displayName}`}>
      <p className="mb-3 text-sm leading-relaxed text-anthracite-200">
        Saisis la charge maximale que tu peux soulever sur 1 rep propre. L'app
        l'utilisera pour caler tes séries de travail — tu pourras toujours
        l'affiner via ta Réserve saisie au fil des séances.
      </p>

      {isBwPure ? (
        <div className="mb-4 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-3 text-sm text-anthracite-200">
          Cet exercice est au poids du corps : ton Plafond est ton poids de
          corps ({bodyweightKg.toFixed(1)} kg). Pas de saisie supplémentaire.
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-1.5">
          <label
            htmlFor="manual-load"
            className="text-sm text-anthracite-300"
          >
            {loadLabel(exercise.charge)}
          </label>
          <input
            id="manual-load"
            data-testid={`input-manual-load-${exercise.id}`}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="h-12 rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 text-base text-white outline-none focus:border-sang-600"
          />
        </div>
      )}

      {error ? (
        <p
          role="alert"
          data-testid="manual-e1rm-error"
          className="mb-3 text-sm text-sang-500"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Annuler
        </Button>
        <Button
          variant="primary"
          fullWidth
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          data-testid={`btn-confirm-manual-e1rm-${exercise.id}`}
        >
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </Sheet>
  );
}
