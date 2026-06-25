import { useState } from 'react';
import { cn } from '@/lib/cn';

interface StepperProps {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly disabled?: boolean;
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
}: StepperProps) {
  // `draft` non-null = saisie clavier en cours ; on ne remonte la valeur au
  // parent (clampée) qu'au blur/Enter. Permet de taper directement une valeur
  // très éloignée du départ sans marteler les boutons − / +.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const atMin = value <= min;
  const atMax = value >= max;

  function commit() {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  }

  const btn =
    'h-9 w-9 shrink-0 rounded-lg bg-anthracite-800 border border-anthracite-700 text-white flex items-center justify-center active:scale-95 transition disabled:opacity-30 disabled:active:scale-100';

  return (
    <div className={cn('flex items-center gap-2', disabled && 'opacity-50 pointer-events-none')}>
      <button type="button" onClick={dec} disabled={atMin} aria-label="Diminuer" className={btn}>
        −
      </button>
      <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Valeur"
          value={shown}
          onFocus={(e) => {
            setDraft(String(value));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          style={{ width: `${Math.max(1, shown.length)}ch` }}
          className="bg-transparent text-right font-semibold tabular-nums text-white outline-none"
        />
        {suffix ? <span className="shrink-0 text-sm text-anthracite-300">{suffix}</span> : null}
      </div>
      <button type="button" onClick={inc} disabled={atMax} aria-label="Augmenter" className={btn}>
        +
      </button>
    </div>
  );
}
