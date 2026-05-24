/**
 * Sheet "Personnaliser les bornes d'équipement" — Conv #18.
 *
 * Permet de poser un `EquipmentOverride` pour un exo donné, quand le
 * matériel local diffère du catalogue (haltères qui s'incrémentent par 2 kg
 * au lieu de 2.5, cable stack capé à 80 kg…).
 *
 * Trois champs nullable :
 *  - `inc_kg`        : palier d'incrément (sinon `exercise.inc_kg` du catalog)
 *  - `min_load_kg`   : pile minimale (sinon pas de seuil bas hors `roundToIncrement`)
 *  - `max_load_kg`   : pile maximale (sinon pas de seuil haut)
 *
 * Bouton "Réinitialiser" pour supprimer l'override et retourner aux valeurs
 * du catalogue.
 */

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { useEngine } from '@/hooks/useEngine';
import { cn } from '@/lib/cn';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { ChargeType, type Exercise } from '@/engine/models';

interface EquipmentOverrideSheetProps {
  readonly open: boolean;
  readonly exercise: Exercise;
  readonly onClose: () => void;
}

interface FieldState {
  readonly enabled: boolean;
  readonly raw: string;
}

function parseField(field: FieldState): number | null {
  if (!field.enabled) return null;
  const v = parseFloat(field.raw.replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function EquipmentOverrideSheet({
  open,
  exercise,
  onClose,
}: EquipmentOverrideSheetProps) {
  const engine = useEngine();
  const demoActive = useDemoMode();
  const existing = useCoachOsStore(
    (s) => s.userState?.equipment_overrides[exercise.id] ?? null,
  );

  const [incField, setIncField] = useState<FieldState>(() => ({
    enabled: existing?.inc_kg != null,
    raw: existing?.inc_kg != null ? String(existing.inc_kg) : String(exercise.inc_kg),
  }));
  const [minField, setMinField] = useState<FieldState>(() => ({
    enabled: existing?.min_load_kg != null,
    raw: existing?.min_load_kg != null ? String(existing.min_load_kg) : '0',
  }));
  const [maxField, setMaxField] = useState<FieldState>(() => ({
    enabled: existing?.max_load_kg != null,
    raw: existing?.max_load_kg != null ? String(existing.max_load_kg) : '200',
  }));
  // Conv #20 — toggle PDC sticky, uniquement pour exos BW_LOADED / BW_ASSISTED.
  const [pdcOnly, setPdcOnly] = useState<boolean>(existing?.pdc_only === true);
  const allowsPdc =
    exercise.charge === ChargeType.BODYWEIGHT_LOADED ||
    exercise.charge === ChargeType.BODYWEIGHT_ASSISTED;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = existing !== null;

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const inc = parseField(incField);
      const min = parseField(minField);
      const max = parseField(maxField);
      const effectivePdc = allowsPdc && pdcOnly;
      if (inc === null && min === null && max === null && !effectivePdc) {
        // Tout vidé → équivaut à reset.
        if (hasOverride) await engine.clearEquipmentOverride(exercise.id);
        onClose();
        return;
      }
      if (min !== null && max !== null && min > max) {
        setError('Le minimum doit être inférieur au maximum.');
        return;
      }
      await engine.setEquipmentOverride(exercise.id, {
        inc_kg: inc,
        min_load_kg: min,
        max_load_kg: max,
        pdc_only: effectivePdc ? true : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function reset() {
    setSubmitting(true);
    setError(null);
    try {
      await engine.clearEquipmentOverride(exercise.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Bornes d'équipement">
      <div className="flex flex-col gap-3" data-testid="equip-override-sheet">
        <p className="text-sm text-anthracite-300">
          Personnalise les bornes pour <strong className="text-white">{exercise.nom_fr}</strong>{' '}
          si ton matériel diffère du catalogue (haltères par 2 kg, machine
          plafonnée…). Laisse une case décochée pour garder la valeur par
          défaut.
        </p>

        <FieldRow
          label="Palier d'incrément"
          suffix=" kg"
          hint={`Catalogue : ${exercise.inc_kg} kg`}
          field={incField}
          onChange={setIncField}
          testId="override-inc"
          disabled={demoActive || submitting}
        />
        <FieldRow
          label="Charge minimale"
          suffix=" kg"
          hint="Pile/charge la plus basse de ta machine"
          field={minField}
          onChange={setMinField}
          testId="override-min"
          disabled={demoActive || submitting}
        />
        <FieldRow
          label="Charge maximale"
          suffix=" kg"
          hint="Pile/charge la plus haute de ta machine"
          field={maxField}
          onChange={setMaxField}
          testId="override-max"
          disabled={demoActive || submitting}
        />

        {allowsPdc && (
          <Card className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-white">
                Poids du corps seulement
              </span>
              <input
                type="checkbox"
                checked={pdcOnly}
                disabled={demoActive || submitting}
                onChange={(e) => setPdcOnly(e.target.checked)}
                data-testid="override-pdc-only"
                className="h-4 w-4 accent-sang-600"
                aria-label="Forcer le poids du corps seulement"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-anthracite-300">
              Coche si tu fais cet exo uniquement au poids du corps (sans
              ajouter ou retirer de charge). L'app gardera la charge à 0 et
              adaptera le nombre de répétitions cibles à ton niveau.
            </p>
          </Card>
        )}

        {error !== null && (
          <div
            role="alert"
            data-testid="override-error"
            className="rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
          >
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 bg-anthracite-900 pt-3">
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={save}
              disabled={demoActive || submitting}
              data-testid="override-save"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {hasOverride && (
            <Button
              variant="ghost"
              fullWidth
              onClick={reset}
              disabled={demoActive || submitting}
              data-testid="override-reset"
            >
              Réinitialiser (catalogue par défaut)
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function FieldRow({
  label,
  suffix,
  hint,
  field,
  onChange,
  testId,
  disabled,
}: {
  readonly label: string;
  readonly suffix: string;
  readonly hint: string;
  readonly field: FieldState;
  readonly onChange: (next: FieldState) => void;
  readonly testId: string;
  readonly disabled: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-white">{label}</span>
        <input
          type="checkbox"
          checked={field.enabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...field, enabled: e.target.checked })}
          data-testid={`${testId}-enabled`}
          className="h-4 w-4 accent-sang-600"
          aria-label={`Activer ${label}`}
        />
      </label>
      <p className="text-[11px] text-anthracite-300">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.25"
          value={field.raw}
          disabled={!field.enabled || disabled}
          onChange={(e) => onChange({ ...field, raw: e.target.value })}
          data-testid={`${testId}-raw`}
          className={cn(
            'flex-1 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white tabular-nums',
            'disabled:opacity-40',
          )}
        />
        <span className="text-xs text-anthracite-300">{suffix.trim()}</span>
      </div>
    </Card>
  );
}
