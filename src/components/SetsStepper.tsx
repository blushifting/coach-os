/**
 * Bloc I (Conv #34) — petit pas-à-pas −/+ pour choisir le nombre de séries d'un
 * exercice. Mutualisé partout où l'on ajoute/édite un exo dans une séance ou un
 * programme : éditeur de cycle (`EditCyclePage`), création de séance custom
 * (`CreateSessionSheet`). Bornes 1–10 (la règle fine 3–5 viendra au Bloc L).
 *
 * Rend uniquement `[−] N [+]` ; le libellé « séries » et le reste sont fournis
 * par l'appelant pour rester souple selon le contexte.
 */

import { cn } from '@/lib/cn';

interface SetsStepperProps {
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly disabled?: boolean;
  /** Préfixe de data-testid : `${testid}-minus` / `-value` / `-plus`. */
  readonly testid?: string;
  /** Décrit l'exo concerné pour l'aria-label des boutons. */
  readonly label?: string;
}

export function SetsStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled = false,
  testid,
  label,
}: SetsStepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const suffix = label ? ` (${label})` : '';
  const btn =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-anthracite-700 text-base leading-none text-anthracite-200 transition hover:border-sang-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-anthracite-700 disabled:hover:text-anthracite-200';
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        data-testid={testid ? `${testid}-minus` : undefined}
        aria-label={`Une série de moins${suffix}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={btn}
      >
        −
      </button>
      <span
        data-testid={testid ? `${testid}-value` : undefined}
        className={cn('min-w-[1.25rem] text-center text-sm font-semibold tabular-nums text-white')}
      >
        {value}
      </span>
      <button
        type="button"
        data-testid={testid ? `${testid}-plus` : undefined}
        aria-label={`Une série de plus${suffix}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={btn}
      >
        +
      </button>
    </span>
  );
}
