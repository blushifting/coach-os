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
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const atMin = value <= min;
  const atMax = value >= max;

  const btn =
    'h-9 w-9 rounded-lg bg-anthracite-800 border border-anthracite-700 text-white flex items-center justify-center active:scale-95 transition disabled:opacity-30 disabled:active:scale-100';

  return (
    <div className={cn('flex items-center gap-2', disabled && 'opacity-50 pointer-events-none')}>
      <button type="button" onClick={dec} disabled={atMin} aria-label="Diminuer" className={btn}>
        −
      </button>
      <div className="flex-1 text-center font-semibold tabular-nums text-white">
        {value}
        {suffix}
      </div>
      <button type="button" onClick={inc} disabled={atMax} aria-label="Augmenter" className={btn}>
        +
      </button>
    </div>
  );
}
