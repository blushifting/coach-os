import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { ChargeType } from '@/engine/models';
import { kgUnitLabelShort } from '@/lib/catalog-filter';
import { triggerHaptic } from '@/lib/haptics';
import { type SetEntry, DEFAULT_RPE } from '@/lib/session-runner';

interface SetInputProps {
  readonly index: number;
  readonly entry: SetEntry;
  readonly onChange: (patch: Partial<SetEntry>) => void;
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
}

const RPE_MIN = 6;
const RPE_MAX = 10;
const RPE_STEP = 0.5;

/**
 * Bloc I (Conv #34) — repères de l'échelle Réserve, positionnés en `%` dans le
 * MÊME repère que le thumb (0 % = RPE 6 = « 4+ » … 100 % = RPE 10 = « échec »)
 * pour que chaque cran tombe pile sous son libellé.
 */
const RESERVE_TICKS = [
  { pct: 0, label: '4+' },
  { pct: 25, label: '3' },
  { pct: 50, label: '2' },
  { pct: 75, label: '1' },
  { pct: 100, label: 'ECHEC' },
] as const;

/**
 * 1.17 — l'UI affiche les « reps en réserve » (Réserve), plus un effort. Le
 * moteur garde le RPE en interne ; conversion : réserve = 10 − RPE.
 *  - RPE 6  → 4 en réserve → « 4+ » (plancher de l'échelle, on ne descend pas
 *    plus bas : tout ce qui est ≥ 4 en réserve = trop facile pour mesurer)
 *  - RPE 10 → 0 en réserve → « échec »
 *  - demi-crans : 2,5 en réserve… (virgule décimale FR)
 */
function reserveLabel(rpe: number): string {
  const rir = 10 - rpe;
  if (rir <= 0) return 'ECHEC';
  if (rir >= 4) return '4+';
  return Number.isInteger(rir) ? String(rir) : String(rir).replace('.', ',');
}

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
  chargeType,
  pdcOnly = false,
  unilateral = false,
}: SetInputProps) {
  // Conv #20 — pdcOnly traite l'exo comme un BW pur (badge figé, charge=0).
  const bodyweightOnly = isBodyweightOnly(chargeType) || pdcOnly;
  const effectiveLoad: number | null = bodyweightOnly ? 0 : entry.load_kg;

  // Bloc S (Conv #45) — plus aucun « lock » : ni ordre des séries, ni curseur.
  // Le ✓ ne se grise QUE si une valeur est vide (reps/charge), seul cas =
  // 1re séance d'un exo (calibration, reps à saisir). La Réserve démarrant
  // toujours à « 4+ », elle ne bloque jamais la validation.
  const canCheck =
    entry.reps !== null &&
    entry.reps > 0 &&
    (bodyweightOnly || entry.load_kg !== null);

  const locked = entry.done;
  const disableInputs = locked;
  const disableCheck = !entry.done && !canCheck;

  const checkTitle =
    entry.done || canCheck
      ? undefined
      : 'Renseigne reps et charge avant de valider';

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
            onClick={() =>
              // Validation : si la Réserve n'a jamais été posée (rpe null,
              // ex. ancienne séance ou exo fraîchement remplacé), on fige le
              // défaut « 4+ » pour que la série ne soit pas écartée du feedback.
              onChange(
                !entry.done && entry.rpe === null
                  ? { done: true, rpe: DEFAULT_RPE }
                  : { done: !entry.done },
              )
            }
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
  readonly disabled: boolean;
  readonly onChange: (v: number | null) => void;
}

function RpeSlider({ index, value, disabled, onChange }: RpeSliderProps) {
  // Bloc S (Conv #45) — curseur sur-mesure, refondu : le POUCE (thumb) est
  // l'unique poignée de drag. La piste est totalement inerte au pointeur — un
  // tap ne pose plus aucune valeur, et le scroll vertical de la page passe
  // librement par-dessus la barre. Pour régler sa Réserve, l'utilisateur
  // attrape le pouce là où il est et le glisse jusqu'au cran voulu. Le pouce
  // porte `touch-action: none` (drag fluide, jamais hijacké par le scroll) et
  // une zone de prise élargie (~44 px, pseudo `before`) sans grossir son rendu.
  // L'`<input type=range>` natif reste caché (`pointer-events:none`) pour
  // l'a11y clavier (flèches) + le pilotage e2e (`fill`). Thumb et libellés
  // partagent le même repère % → alignement exact des crans.
  const rpe = value ?? DEFAULT_RPE;
  const pct = ((rpe - RPE_MIN) / (RPE_MAX - RPE_MIN)) * 100;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (el === null) return rpe;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    const snapped =
      Math.round((RPE_MIN + clamped * (RPE_MAX - RPE_MIN)) / RPE_STEP) * RPE_STEP;
    return Math.min(RPE_MAX, Math.max(RPE_MIN, snapped));
  }

  function onThumbPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture best-effort */
    }
  }
  function onThumbPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || !draggingRef.current) return;
    // Un tap pur sur le pouce ne bouge rien : valueFromClientX à sa position
    // courante renvoie ~la valeur actuelle.
    const v = valueFromClientX(e.clientX);
    if (v !== value) onChange(v);
  }
  function onThumbPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="mt-3 px-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
          reps en réserve
        </span>
        <span
          data-testid={`rpe-value-${index}`}
          className="font-display text-base leading-none tabular-nums tracking-wide text-white"
        >
          {reserveLabel(rpe)}
        </span>
      </div>

      {/* px-2.5 = marge pour que le thumb et les libellés aux extrêmes (0 %/100 %)
          ne soient pas rognés (le thumb déborde de sa moitié via -translate-x). */}
      <div className={cn('relative px-2.5', disabled && 'opacity-50')}>
        <div
          ref={trackRef}
          className={cn(
            'relative h-3 w-full select-none rounded-full border border-anthracite-700',
            disabled && 'cursor-not-allowed',
          )}
        >
          {/* Dégradé plein : la couleur à une position donnée ne dépend pas du
              remplissage (constante le long de la piste). */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sang-900 to-sang-500" />
          {/* Partie « non atteinte » (réserve plus grande) à droite du thumb. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 rounded-r-full bg-anthracite-800"
            style={{ left: `${pct}%` }}
          />
          {/* Thumb = unique poignée de drag (Bloc S). Zone de prise élargie
              ~44 px via le pseudo `before` transparent (sans grossir le rendu) ;
              `touch-none` pour un drag fluide. Tout le reste de la barre reste
              scrollable. */}
          <div
            aria-hidden="true"
            onPointerDown={disabled ? undefined : onThumbPointerDown}
            onPointerMove={disabled ? undefined : onThumbPointerMove}
            onPointerUp={disabled ? undefined : onThumbPointerEnd}
            onPointerCancel={disabled ? undefined : onThumbPointerEnd}
            className={cn(
              "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sang-600 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] before:absolute before:-inset-3 before:content-['']",
              disabled
                ? 'cursor-not-allowed'
                : 'cursor-grab touch-none transition-transform active:scale-110 active:cursor-grabbing',
            )}
            style={{ left: `${pct}%` }}
          />
          {/* Input natif caché : a11y clavier + pilotage e2e (`fill`).
              `pointer-events:none` → ne capte aucun tap/clic. */}
          <input
            data-testid={`rpe-slider-${index}`}
            data-rpe={value ?? undefined}
            type="range"
            min={RPE_MIN}
            max={RPE_MAX}
            step={RPE_STEP}
            value={rpe}
            disabled={disabled}
            onChange={(e) => {
              const v = Number.parseFloat(e.target.value);
              onChange(Number.isFinite(v) ? v : null);
            }}
            style={{ pointerEvents: 'none' }}
            className="absolute inset-0 h-full w-full opacity-0"
            aria-label="Reps en réserve : de 4+ (facile) à l'échec"
          />
        </div>

        <div
          aria-hidden="true"
          className="relative mt-1 h-3 text-[9px] tabular-nums text-anthracite-500"
        >
          {RESERVE_TICKS.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
