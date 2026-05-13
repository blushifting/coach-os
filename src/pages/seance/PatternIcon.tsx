import { cn } from '@/lib/cn';
import { Pattern } from '@/engine/models';

/**
 * Picto par pattern moteur — placeholder Conv #5b.
 *
 * Refonte visuelle en Conv #8 (cf. plan §3 Conv #8 — pictos différenciés).
 * Pour l'instant : pastille colorée + abréviation 2 lettres.
 */
interface PatternIconProps {
  readonly pattern: Pattern;
  readonly size?: 'sm' | 'md';
}

const PATTERN_ABBR: Record<Pattern, string> = {
  [Pattern.SQUAT]: 'SQ',
  [Pattern.HINGE]: 'HI',
  [Pattern.LUNGE]: 'LU',
  [Pattern.PUSH_H]: 'PH',
  [Pattern.PUSH_V]: 'PV',
  [Pattern.PULL_H]: 'TH',
  [Pattern.PULL_V]: 'TV',
  [Pattern.ISOLATION]: 'IS',
  [Pattern.CORE]: 'CO',
};

const PATTERN_TONE: Record<Pattern, string> = {
  [Pattern.SQUAT]: 'bg-anthracite-700 text-white',
  [Pattern.HINGE]: 'bg-anthracite-700 text-white',
  [Pattern.LUNGE]: 'bg-anthracite-700 text-white',
  [Pattern.PUSH_H]: 'bg-sang-900 text-white',
  [Pattern.PUSH_V]: 'bg-sang-900 text-white',
  [Pattern.PULL_H]: 'bg-anthracite-600 text-white',
  [Pattern.PULL_V]: 'bg-anthracite-600 text-white',
  [Pattern.ISOLATION]: 'bg-anthracite-800 text-anthracite-500 border border-anthracite-700',
  [Pattern.CORE]: 'bg-anthracite-800 text-anthracite-500 border border-anthracite-700',
};

export function PatternIcon({ pattern, size = 'md' }: PatternIconProps) {
  return (
    <span
      data-testid={`pattern-icon-${pattern}`}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold tabular-nums',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
        PATTERN_TONE[pattern],
      )}
      aria-label={`pattern ${pattern}`}
    >
      {PATTERN_ABBR[pattern]}
    </span>
  );
}
