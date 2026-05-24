import { cn } from '@/lib/cn';

interface StepIndicatorProps {
  readonly current: number;
  readonly total: number;
  readonly labels?: readonly string[];
}

/**
 * Étapes d'un wizard — Conv #11c : étape courante en gradient sang + halo
 * lumineux (`shadow-glow-sang-lg`), étapes passées en sang plein, étapes à
 * venir en anthracite-700. Le label actif passe en sang-400 pour matcher.
 */
export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  const indices = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="px-1 pt-3 pb-2" aria-label={`Étape ${current} sur ${total}`}>
      <div className="flex items-center gap-1.5">
        {indices.map((i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                done && 'bg-sang-700',
                active &&
                  'bg-gradient-to-r from-sang-500 to-sang-700 shadow-glow-sang-lg',
                !done && !active && 'bg-anthracite-700',
              )}
              data-testid={`step-bar-${i}`}
              data-active={active}
              data-done={done}
            />
          );
        })}
      </div>
      {labels && labels.length === total ? (
        <div className="mt-2 flex justify-between text-[11px] text-anthracite-300">
          {labels.map((lbl, idx) => (
            <span
              key={lbl}
              className={cn(
                'flex-1 text-center',
                idx + 1 === current && 'font-medium text-sang-400',
              )}
            >
              {lbl}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-anthracite-300">
          Étape <span className="font-medium text-sang-400">{current}</span> sur {total}
        </div>
      )}
    </div>
  );
}
