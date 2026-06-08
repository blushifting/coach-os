import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { ChargeType } from '@/engine/models';
import { kgUnitLabelShort } from '@/lib/catalog-filter';
import { triggerHaptic } from '@/lib/haptics';
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
  /**
   * Conv #20 — mode "Poids du corps seulement" sticky pour cet exo. Active
   * le rendu "PdC figé" (badge non éditable, load_kg verrouillé à 0) même
   * sur les exos BW_LOADED / BW_ASSISTED. La prescription arrive en outre
   * avec load_kg=0 et reps adaptées (cf. `buildPrescription` PDC branch).
   */
  readonly pdcOnly?: boolean;
  /**
   * Conv #24 (D3) — exo unilatéral (`Exercise.uni`). On affiche alors « reps/côté »
   * sur le label des reps pour rappeler que la prescription est par côté (on
   * répète la série de chaque côté). N'affecte pas le calcul de volume.
   */
  readonly unilateral?: boolean;
  /** Cible RPE de la prescription, affichée discrètement à côté du label "effort". */
  readonly rpeTarget?: number;
}

const RPE_MIN = 6;
const RPE_MAX = 10;
const RPE_STEP = 0.5;
const RPE_DEFAULT = 8;

function isBodyweightOnly(charge: ChargeType | undefined): boolean {
  return charge === ChargeType.BODYWEIGHT;
}

/**
 * Conv #20 — refonte layout :
 *  - rangée haute : [Série N] [reps ±] [kg ±] [✓]
 *  - rangée basse : slider RPE avec dégradé sang à gauche du curseur
 *    (vif à RPE 10), valeur courante affichée + cible RPE.
 *
 * Le slider remplace le stepper RPE (case ±) précédent : 1 geste pour
 * tout (range 6→10 par 0.5), avec ressenti visuel direct de l'intensité.
 * Aligné sur la recherche : Borg/Helms RIR encodé comme grade continu
 * 6-10, le slider est plus naturel qu'un input numérique pour ce type
 * d'échelle subjective.
 */
export function SetInput({
  index,
  entry,
  onChange,
  checkLocked = false,
  chargeType,
  pdcOnly = false,
  unilateral = false,
  rpeTarget,
}: SetInputProps) {
  // Conv #20 — pdcOnly traite l'exo comme un BW pur (badge figé, charge=0).
  const bodyweightOnly = isBodyweightOnly(chargeType) || pdcOnly;
  const effectiveLoad: number | null = bodyweightOnly ? 0 : entry.load_kg;

  const canCheck =
    entry.reps !== null &&
    entry.reps > 0 &&
    (bodyweightOnly || entry.load_kg !== null) &&
    entry.rpe !== null;

  const locked = entry.done;
  const disableInputs = locked;
  const disableCheck = !entry.done && (checkLocked || !canCheck);

  const checkTitle = entry.done
    ? undefined
    : checkLocked
      ? 'Termine la série précédente d’abord'
      : !canCheck
        ? 'Renseigne reps, charge et effort avant de valider'
        : undefined;

  const [justChecked, setJustChecked] = useState(false);
  const prevDone = useRef(entry.done);
  useEffect(() => {
    if (entry.done && !prevDone.current) {
      setJustChecked(true);
      triggerHaptic('set-done');
      const t = setTimeout(() => setJustChecked(false), 600);
      prevDone.current = true;
      return () => clearTimeout(t);
    }
    if (!entry.done && prevDone.current) {
      triggerHaptic('set-undone');
    }
    prevDone.current = entry.done;
  }, [entry.done]);

  return (
    <div
      data-testid={`set-row-${index}`}
      data-done={entry.done ? 'true' : 'false'}
      data-locked={checkLocked ? 'true' : 'false'}
      className={cn(
        'rounded-lg border px-2 py-2 text-sm transition-colors duration-300',
        // 1.16 — série validée = VERT (« c'est fait »), plus de rouge (réservé
        // aux problèmes dans la grille sémantique).
        entry.done
          ? 'border-green-700/70 bg-green-900/25'
          : 'border-anthracite-700 bg-anthracite-900/70',
        justChecked && 'animate-validate-flash',
      )}
    >
      {/* Conv #20 — Rangée haute : Série N · reps · kg · ✓, tous alignés
          sur la même hauteur. Reps et kg ont des +/-. Le tick ✓ est à
          droite et atteignable du pouce. */}
      <div className="flex items-end gap-1.5">
        <div className="flex w-10 shrink-0 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
            série
          </span>
          <span
            className={cn(
              'flex h-11 items-center justify-center font-display text-base leading-none tabular-nums tracking-wide',
              entry.done ? 'text-green-500' : 'text-anthracite-200',
            )}
          >
            {index + 1}
          </span>
        </div>

        <Stepper
          testId={`reps-${index}`}
          label={unilateral ? 'reps/côté' : 'reps'}
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
          chargeType={chargeType}
          disabled={disableInputs}
          onChange={(v) => onChange({ load_kg: v })}
        />

        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-anthracite-300 opacity-0">
            .
          </span>
          <button
            type="button"
            data-testid={`toggle-done-${index}`}
            aria-label={entry.done ? 'Annuler la série (déverrouille la saisie)' : 'Valider la série'}
            title={checkTitle}
            disabled={disableCheck}
            onClick={() => onChange({ done: !entry.done })}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full text-lg transition-all duration-200 active:scale-95',
              entry.done
                ? 'bg-gradient-to-b from-green-600 to-green-800 text-white shadow-glow-green'
                : disableCheck
                  ? 'cursor-not-allowed bg-anthracite-800 text-anthracite-500'
                  : 'bg-anthracite-700 text-anthracite-300 hover:text-white',
              justChecked && 'animate-tick-pop',
            )}
          >
            ✓
          </button>
        </div>
      </div>

      {/* Conv #20 — Rangée basse : slider RPE 6→10, dégradé sang à gauche
          du curseur (atteint le vif à RPE 10), grisé à droite. La valeur
          courante s'affiche à côté du label + la cible si fournie. */}
      <RpeSlider
        index={index}
        value={entry.rpe}
        target={rpeTarget}
        disabled={disableInputs}
        onChange={(v) => onChange({ rpe: v })}
      />
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
  readonly onChange: (v: number | null) => void;
}

function Stepper({
  testId,
  label,
  value,
  step,
  min,
  max,
  disabled,
  onChange,
}: StepperProps) {
  function clamp(v: number): number {
    if (Number.isNaN(v)) return min;
    if (v < min) return min;
    if (max !== undefined && v > max) return max;
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
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-anthracite-300">
        {label}
      </span>
      <div className="flex h-11 items-stretch overflow-hidden rounded border border-anthracite-700">
        <button
          type="button"
          data-testid={`stepper-dec-${testId}`}
          aria-label={`Diminuer ${label}`}
          disabled={disabled || isAtMin}
          onClick={() => bump(-step)}
          className="flex w-8 shrink-0 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
        >
          −
        </button>
        <input
          data-testid={`input-${testId}`}
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
          className="min-w-0 flex-1 border-x border-anthracite-700 bg-anthracite-800 px-1 text-center text-sm font-semibold tabular-nums text-white outline-none transition focus:border-sang-700/50 disabled:opacity-60"
        />
        <button
          type="button"
          data-testid={`stepper-inc-${testId}`}
          aria-label={`Augmenter ${label}`}
          disabled={disabled || isAtMax}
          onClick={() => bump(step)}
          className="flex w-8 shrink-0 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoadField : Stepper kg + variantes BW
// ─────────────────────────────────────────────────────────────────────────────

interface LoadFieldProps {
  readonly index: number;
  readonly load: number | null;
  readonly bodyweightOnly: boolean;
  readonly chargeType?: ChargeType;
  readonly disabled: boolean;
  readonly onChange: (v: number | null) => void;
}

function LoadField({
  index,
  load,
  bodyweightOnly,
  chargeType,
  disabled,
  onChange,
}: LoadFieldProps) {
  if (bodyweightOnly) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

  // Conv #20 — pour les exos DUMBBELL, on affiche "kg/halt" pour rappeler
  // que la saisie est par haltère (pas le total bilatéral). Voir
  // `kgUnitLabelShort` + convention dans `bootstrapE1rmIfMissing`.
  const kgLabel = kgUnitLabelShort(chargeType);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
        {kgLabel}
      </span>
      <KgStepper
        index={index}
        value={load}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

interface KgStepperProps {
  readonly index: number;
  readonly value: number | null;
  readonly disabled: boolean;
  readonly onChange: (v: number | null) => void;
}

function KgStepper({ index, value, disabled, onChange }: KgStepperProps) {
  // Conv #21 — +/- sur kg toujours en pas de 1 kg, indépendamment de l'inc_kg
  // de l'exo. Si l'user appuie sur "+", il s'attend à voir la charge augmenter
  // de 1 — pas de 1,25 ni de 2,5. Un "+" qui ne fait pas +1 est déroutant.
  // L'incrément spécifique à l'équipement reste utilisé par le moteur pour
  // l'arrondi des prescriptions (cf. effectiveIncrement).
  const STEP = 1;

  function bump(delta: number) {
    const base = value ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    onChange(next);
  }

  const displayValue = value === null ? '' : String(value);
  const isAtMin = value !== null && value <= 0;

  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded border border-anthracite-700">
      <button
        type="button"
        data-testid={`stepper-dec-load-${index}`}
        aria-label="Diminuer la charge"
        disabled={disabled || isAtMin}
        onClick={() => bump(-STEP)}
        className="flex w-8 shrink-0 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
      >
        −
      </button>
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
        className="min-w-0 flex-1 border-x border-anthracite-700 bg-anthracite-800 px-1 text-center text-sm font-semibold tabular-nums text-white shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.35)] outline-none transition focus:border-sang-700/50 disabled:opacity-60"
      />
      <button
        type="button"
        data-testid={`stepper-inc-load-${index}`}
        aria-label="Augmenter la charge"
        disabled={disabled}
        onClick={() => bump(STEP)}
        className="flex w-8 shrink-0 items-center justify-center bg-anthracite-800 text-base text-anthracite-200 transition active:scale-95 disabled:cursor-not-allowed disabled:text-anthracite-500"
      >
        +
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conv #20 — RpeSlider : slider de RPE avec dégradé sang à gauche du curseur
// ─────────────────────────────────────────────────────────────────────────────

interface RpeSliderProps {
  readonly index: number;
  readonly value: number | null;
  readonly target?: number;
  readonly disabled: boolean;
  readonly onChange: (v: number | null) => void;
}

function RpeSlider({ index, value, target, disabled, onChange }: RpeSliderProps) {
  // Quand pas encore saisi : thumb visuellement positionné au défaut (8) mais
  // atténué (data-unset='true'), label affiche "—" pour ne pas suggérer une
  // valeur. La première interaction commit la valeur réelle.
  const isUnset = value === null;
  const visualValue = value ?? RPE_DEFAULT;
  const pct = ((visualValue - RPE_MIN) / (RPE_MAX - RPE_MIN)) * 100;

  const trackStyle = {
    '--rpe-fill': isUnset ? '0%' : `${pct}%`,
  } as CSSProperties;

  return (
    <div className="mt-3 px-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
          effort
          {target !== undefined ? (
            <span className="ml-1 normal-case tracking-normal text-anthracite-500">
              vise ~{target}
            </span>
          ) : null}
        </span>
        <span
          data-testid={`rpe-value-${index}`}
          className={cn(
            'font-display text-base leading-none tabular-nums tracking-wide',
            isUnset ? 'text-anthracite-400' : 'text-white',
          )}
        >
          {isUnset ? '—' : value}
        </span>
      </div>
      <input
        data-testid={`rpe-slider-${index}`}
        data-rpe={isUnset ? undefined : value}
        data-unset={isUnset ? 'true' : 'false'}
        type="range"
        min={RPE_MIN}
        max={RPE_MAX}
        step={RPE_STEP}
        value={visualValue}
        disabled={disabled}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : null);
        }}
        className="rpe-slider"
        style={trackStyle}
        aria-label={`Effort, de ${RPE_MIN} à ${RPE_MAX}`}
      />
      <div
        aria-hidden="true"
        className="mt-0.5 flex justify-between px-0.5 text-[9px] tabular-nums text-anthracite-500"
      >
        <span>6</span>
        <span>7</span>
        <span>8</span>
        <span>9</span>
        <span>10</span>
      </div>
    </div>
  );
}
