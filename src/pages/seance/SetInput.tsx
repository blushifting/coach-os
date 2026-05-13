import { cn } from '@/lib/cn';
import type { SetEntry } from '@/lib/session-runner';

interface SetInputProps {
  readonly index: number;
  readonly entry: SetEntry;
  readonly onChange: (patch: Partial<SetEntry>) => void;
}

const RPE_OPTIONS = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'] as const;

/**
 * Une ligne de saisie pour une série.
 *
 * Charge, reps et RPE pré-remplis depuis la consigne. Validation = bouton "✓".
 * Pas de timer (cf. 08 §115 : "ne lance plus de timer actif").
 */
export function SetInput({ index, entry, onChange }: SetInputProps) {
  return (
    <div
      data-testid={`set-row-${index}`}
      data-done={entry.done ? 'true' : 'false'}
      className={cn(
        'grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] items-center gap-2 rounded-lg border px-2 py-2 text-sm',
        entry.done
          ? 'border-sang-700 bg-sang-900/30'
          : 'border-anthracite-700 bg-anthracite-900',
      )}
    >
      <span className="text-xs text-anthracite-500">S{index + 1}</span>

      <NumField
        testId={`input-reps-${index}`}
        label="reps"
        value={entry.reps}
        step={1}
        min={0}
        onChange={(v) => onChange({ reps: v })}
      />

      <NumField
        testId={`input-load-${index}`}
        label="kg"
        value={entry.load_kg}
        step={0.5}
        min={0}
        onChange={(v) => onChange({ load_kg: v })}
      />

      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-anthracite-500">
        RPE
        <select
          data-testid={`input-rpe-${index}`}
          value={entry.rpe.toString()}
          onChange={(e) => onChange({ rpe: Number(e.target.value) })}
          className="h-8 rounded border border-anthracite-700 bg-anthracite-800 px-1 text-sm text-white"
        >
          {RPE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        data-testid={`toggle-done-${index}`}
        aria-label={entry.done ? 'Annuler la série' : 'Valider la série'}
        onClick={() => onChange({ done: !entry.done })}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95',
          entry.done
            ? 'bg-sang-700 text-white'
            : 'bg-anthracite-700 text-anthracite-500 hover:text-white',
        )}
      >
        ✓
      </button>
    </div>
  );
}

interface NumFieldProps {
  readonly testId: string;
  readonly label: string;
  readonly value: number;
  readonly step: number;
  readonly min: number;
  readonly onChange: (v: number) => void;
}

function NumField({ testId, label, value, step, min, onChange }: NumFieldProps) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-anthracite-500">
      {label}
      <input
        data-testid={testId}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className="h-8 w-full rounded border border-anthracite-700 bg-anthracite-800 px-2 text-sm tabular-nums text-white"
      />
    </label>
  );
}
