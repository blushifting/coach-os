import { cn } from '@/lib/cn';

interface StepIndicatorProps {
  readonly current: number;
  readonly total: number;
  readonly labels?: readonly string[];
}

export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  const indices = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="px-4 pt-3 pb-2" aria-label={`Étape ${current} sur ${total}`}>
      <div className="flex items-center gap-1.5">
        {indices.map((i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                done && 'bg-sang-600',
                active && 'bg-sang-500',
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
        <div className="mt-2 flex justify-between text-[11px] text-anthracite-500">
          {labels.map((lbl, idx) => (
            <span
              key={lbl}
              className={cn(
                'flex-1 text-center',
                idx + 1 === current && 'text-white font-medium',
              )}
            >
              {lbl}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-anthracite-500">
          Étape <span className="text-white font-medium">{current}</span> sur {total}
        </div>
      )}
    </div>
  );
}
