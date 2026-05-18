import { cn } from '@/lib/cn';
import { ChargeType } from '@/engine/models';
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
  /**
   * Détermine le rendu du champ charge :
   *  - `BODYWEIGHT` → badge "Poids du corps" non éditable, load_kg verrouillé à 0
   *  - `BODYWEIGHT_LOADED` / `BODYWEIGHT_ASSISTED` → input + chip "PdC" qui force
   *    la charge à 0 (utile pour les jours où on ne se leste pas).
   *  - autres → input kg standard.
   */
  readonly chargeType?: ChargeType;
}

const RPE_MIN = 6;
const RPE_MAX = 10;
const RPE_STEP = 0.5;

function effortTone(rpe: number): string {
  if (rpe <= 7) return 'border-anthracite-700 bg-anthracite-800 text-anthracite-100';
  if (rpe <= 8) return 'border-amber-700/60 bg-amber-900/30 text-amber-100';
  if (rpe <= 9) return 'border-sang-700/70 bg-sang-900/30 text-sang-100';
  return 'border-sang-500/80 bg-sang-800/40 text-white';
}

function isBodyweightOnly(charge: ChargeType | undefined): boolean {
  return charge === ChargeType.BODYWEIGHT;
}

function allowsBodyweightToggle(charge: ChargeType | undefined): boolean {
  return (
    charge === ChargeType.BODYWEIGHT_LOADED ||
    charge === ChargeType.BODYWEIGHT_ASSISTED
  );
}

/**
 * Conv #11e : tap targets >= 44px (h-11), steppers +/- pour reps et effort,
 * input vide ≠ 0 (state UI conserve la string vide), coche refusée tant qu'un
 * champ est vide, lock complet après done (anti-misclick) — décoche pour
 * réouvrir. Toggle "Poids du corps" pour les exos à charge ajoutée.
 */
export function SetInput({
  index,
  entry,
  onChange,
  checkLocked = false,
  chargeType,
}: SetInputProps) {
  const bodyweightOnly = isBodyweightOnly(chargeType);
  const bwToggle = allowsBodyweightToggle(chargeType);
  // Pour BW pur : load forcé à 0 si null/non-0 (cosmétique — on n'écrit qu'au
  // commit). Pour les autres modes, on laisse la valeur libre.
  const effectiveLoad: number | null = bodyweightOnly ? 0 : entry.load_kg;

  const canCheck =
    entry.reps !== null &&
    entry.reps > 0 &&
    (bodyweightOnly || entry.load_kg !== null);

  const locked = entry.done;
  const disableInputs = locked;
  const disableCheck = !entry.done && (checkLocked || !canCheck);

  const checkTitle = entry.done
    ? undefined
    : checkLocked
      ? 'Termine la série précédente d’abord'
      : !canCheck
        ? 'Renseigne reps et charge avant de valider'
        : undefined;

  return (
    <div
      data-testid={`set-row-${index}`}
      data-done={entry.done ? 'true' : 'false'}
      data-locked={checkLocked ? 'true' : 'false'}
      className={cn(
        'flex items-stretch gap-2 rounded-lg border px-2 py-2 text-sm transition-colors',
        entry.done
          ? 'border-sang-700/70 bg-sang-900/25'
          : 'border-anthracite-700 bg-anthracite-900/70',
      )}
    >
      <span
        className={cn(
          'flex w-6 items-center justify-center font-display text-lg leading-none tabular-nums tracking-wide',
          entry.done ? 'text-sang-400' : 'text-anthracite-300',
        )}
      >
        S{index + 1}
      </span>

      <Stepper
        testId={`reps-${index}`}
        label="reps"
        value={entry.reps}
        step={1}
        min={0}
        max={99}
        disabled={disableInputs}
        onChange={(v) => onChange({ reps: v })}
      />

      <LoadField
        index={index}
        load={effectiveLoad}
        bodyweightOnly={bodyweightOnly}
        bwToggle={bwToggle}
        disabled={disableInputs}
        onChange={(v) => onChange({ load_kg: v })}
      />

      <Stepper
        testId={`rpe-${index}`}
        label="effort"
        value={entry.rpe}
        step={RPE_STEP}
        min={RPE_MIN}
        max={RPE_MAX}
        disabled={disableInputs}
        toneClass={effortTone(entry.rpe)}
        onChange={(v) => onChange({ rpe: v ?? RPE_MIN })}
        dataAttr={{ 'data-rpe': entry.rpe }}
      />

      <button
        type="button"
        data-testid={`toggle-done-${index}`}
        aria-label={entry.done ? 'Annuler la série (déverrouille la saisie)' : 'Valider la série'}
        title={checkTitle}
        disabled={disableCheck}
        onClick={() => onChange({ done: !entry.done })}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full text-lg transition-all duration-200 active:scale-95',
          entry.done
            ? 'bg-gradient-to-b from-sang-500 to-sang-700 text-white shadow-glow-sang'
            : disableCheck
              ? 'cursor-not-allowed bg-anthracite-800 text-anthracite-500'
              : 'bg-anthracite-700 text-anthracite-300 hover:text-white',
        )}
      >
        ✓
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper : input numérique encadré par boutons - / +
// ─────────────────────────────────────────────────────────────────────────────

interface StepperProps {
  readonly testId: string;
  readonly label: string;
  readonly value: number | null;
  readonly step: number;
  readonly min: number;
  readonly max?: number;
  readonly disabled: boolean;
  readonly toneClass?: string;
  readonly onChange: (v: number | null) => void;
  readonly dataAttr?: Record<string, string | number>;
}

function Stepper({
  testId,
  label,
  value,
  step,
  min,
  max,
  disabled,
  toneClass,
  onChange,
  dataAttr,
}: StepperProps) {
  function clamp(v: number): number {
    if (Number.isNaN(v)) return min;
    if (v < min) return min;
    if (max !== undefined && v > max) return max;
    // Évite les artefacts de virgule flottante (0.1 + 0.2 = 0.30000000000004)
    return Math.round(v * 1000) / 1000;
  }

  function bump(delta: number) {
    const base = value ?? min;
    onChange(clamp(base + delta));
  }

  const displayValue = value === null ? '' : String(value);
  const isAtMin = value !== null && value <= min;
  const isAtMax = value !== null && max !== undefined && value >= max;

  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
        {label}
      </span>
      <div className="flex items-stretch overflow-hidden rounded border border-anthracite-700">
        <button
          type="button"
          data-testid={`stepper-dec-${testId}`}
          aria-label={`Diminuer ${label}`}
          disabled={disabled || isAtMin}
          onClick={() => bump(-step)}
          className="flex w-8 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
        >
          −
        </button>
        <input
          data-testid={`input-${testId}`}
          {...dataAttr}
          type="number"
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(null);
              return;
            }
            const parsed = Number.parseFloat(raw);
            if (!Number.isFinite(parsed)) {
              onChange(null);
              return;
            }
            onChange(clamp(parsed));
          }}
          className={cn(
            'h-11 flex-1 border-x border-anthracite-700 px-1 text-center text-base font-semibold tabular-nums outline-none transition disabled:opacity-60',
            toneClass ??
              'bg-anthracite-800 text-white focus:border-sang-700/50',
          )}
        />
        <button
          type="button"
          data-testid={`stepper-inc-${testId}`}
          aria-label={`Augmenter ${label}`}
          disabled={disabled || isAtMax}
          onClick={() => bump(step)}
          className="flex w-8 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoadField : input kg + variantes BW
// ─────────────────────────────────────────────────────────────────────────────

interface LoadFieldProps {
  readonly index: number;
  readonly load: number | null;
  readonly bodyweightOnly: boolean;
  readonly bwToggle: boolean;
  readonly disabled: boolean;
  readonly onChange: (v: number | null) => void;
}

function LoadField({
  index,
  load,
  bodyweightOnly,
  bwToggle,
  disabled,
  onChange,
}: LoadFieldProps) {
  if (bodyweightOnly) {
    return (
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
          charge
        </span>
        <div
          data-testid={`bw-badge-${index}`}
          className="flex h-11 items-center justify-center rounded border border-anthracite-700 bg-anthracite-800/60 px-1 text-center text-[11px] font-medium uppercase tracking-wide text-anthracite-200"
        >
          Poids du corps
        </div>
      </div>
    );
  }

  const bwActive = load === 0;
  const displayValue = load === null ? '' : String(load);

  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-1 text-[10px] uppercase tracking-wide text-anthracite-300">
        kg
        {bwToggle ? (
          <button
            type="button"
            data-testid={`toggle-bw-${index}`}
            aria-label="Poids du corps (charge = 0)"
            aria-pressed={bwActive}
            disabled={disabled}
            onClick={() => onChange(bwActive ? null : 0)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide transition',
              bwActive
                ? 'bg-sang-700 text-white'
                : 'bg-anthracite-700 text-anthracite-200 hover:text-white',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            PdC
          </button>
        ) : null}
      </span>
      <input
        data-testid={`input-load-${index}`}
        type="number"
        inputMode="decimal"
        step={0.5}
        disabled={disabled}
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const parsed = Number.parseFloat(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
        className="h-11 w-full rounded border border-anthracite-700 bg-anthracite-800 px-2 text-center text-base font-semibold tabular-nums text-white shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.35)] outline-none transition focus:border-sang-700/50 disabled:opacity-60"
      />
    </div>
  );
}
