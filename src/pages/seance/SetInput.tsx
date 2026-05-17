import { cn } from '@/lib/cn';
import type { SetEntry } from '@/lib/session-runner';

interface SetInputProps {
  readonly index: number;
  readonly entry: SetEntry;
  readonly onChange: (patch: Partial<SetEntry>) => void;
  /**
   * Le bouton "✓" est verrouillé tant que la série précédente n'est pas validée.
   * Les saisies reps/charge/effort restent éditables — on peut préparer ses
   * valeurs à l'avance, on ne peut juste pas cocher en désordre.
   */
  readonly checkLocked?: boolean;
}

const RPE_OPTIONS = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'] as const;

/**
 * Couleur du select Effort selon la valeur — gradient gris → ambre → rouge
 * pour matérialiser visuellement l'intensité (Conv #11c piste B).
 */
function effortTone(rpe: number): string {
  if (rpe <= 7) return 'border-anthracite-700 bg-anthracite-800 text-anthracite-100';
  if (rpe <= 8) return 'border-amber-700/60 bg-amber-900/30 text-amber-100';
  if (rpe <= 9) return 'border-sang-700/70 bg-sang-900/30 text-sang-100';
  return 'border-sang-500/80 bg-sang-800/40 text-white';
}

/**
 * Une ligne de saisie pour une série.
 *
 * Charge, reps et RPE pré-remplis depuis la consigne. Validation = bouton "✓".
 * Pas de timer (cf. 08 §115 : "ne lance plus de timer actif").
 *
 * Conv #11c :
 *  - Numéro de série (S1, S2, …) en `font-display` sang-400 (effet "affiche
 *    de salle de sport"), plus marqué quand la série est validée.
 *  - Select Effort coloré selon valeur (gris → ambre → rouge profond) pour
 *    matérialiser visuellement l'intensité prévue.
 *  - Bouton ✓ : gradient + halo sang quand done.
 */
export function SetInput({ index, entry, onChange, checkLocked = false }: SetInputProps) {
  return (
    <div
      data-testid={`set-row-${index}`}
      data-done={entry.done ? 'true' : 'false'}
      data-locked={checkLocked ? 'true' : 'false'}
      className={cn(
        'grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] items-center gap-2 rounded-lg border px-2 py-2 text-sm transition-colors',
        entry.done
          ? 'border-sang-700/70 bg-sang-900/25'
          : 'border-anthracite-700 bg-anthracite-900/70',
      )}
    >
      <span
        className={cn(
          'font-display text-lg leading-none tabular-nums tracking-wide',
          entry.done ? 'text-sang-400' : 'text-anthracite-300',
        )}
      >
        S{index + 1}
      </span>

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

      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-anthracite-300">
        Effort
        <select
          data-testid={`input-rpe-${index}`}
          data-rpe={entry.rpe}
          value={entry.rpe.toString()}
          onChange={(e) => onChange({ rpe: Number(e.target.value) })}
          className={cn(
            'h-8 rounded border px-1 text-sm tabular-nums transition-colors',
            effortTone(entry.rpe),
          )}
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
        aria-label={
          entry.done
            ? 'Annuler la série'
            : checkLocked
              ? 'Termine la série précédente d’abord'
              : 'Valider la série'
        }
        title={
          checkLocked && !entry.done
            ? 'Termine la série précédente d’abord'
            : undefined
        }
        disabled={checkLocked && !entry.done}
        onClick={() => onChange({ done: !entry.done })}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 active:scale-95',
          entry.done
            ? 'bg-gradient-to-b from-sang-500 to-sang-700 text-white shadow-glow-sang'
            : checkLocked
              ? 'cursor-not-allowed bg-anthracite-800 text-anthracite-500'
              : 'bg-anthracite-700 text-anthracite-300 hover:text-white',
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
    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-anthracite-300">
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
        className="h-8 w-full rounded border border-anthracite-700 bg-anthracite-800 px-2 text-sm tabular-nums text-white shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.35)] focus:border-sang-700/50 focus:outline-none"
      />
    </label>
  );
}
