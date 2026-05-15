import { cn } from '@/lib/cn';
import { Pattern } from '@/engine/models';

/**
 * Picto par pattern moteur — Conv #8b.
 *
 * SVG inline minimalistes, trait `currentColor` sur fond pastille discret.
 * 9 patterns différenciés visuellement (squat / hinge / lunge / push-h /
 * push-v / pull-h / pull-v / isolation / core).
 *
 * Convention de design : viewBox 24×24, stroke-width 1.75, linecap/join round.
 * Lisible jusqu'à 16 px de côté.
 */
interface PatternIconProps {
  readonly pattern: Pattern;
  readonly size?: 'sm' | 'md';
}

const SIZE_PX: Record<NonNullable<PatternIconProps['size']>, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
};

const PATTERN_TONE: Record<Pattern, string> = {
  [Pattern.SQUAT]: 'bg-anthracite-700 text-anthracite-50',
  [Pattern.HINGE]: 'bg-anthracite-700 text-anthracite-50',
  [Pattern.LUNGE]: 'bg-anthracite-700 text-anthracite-50',
  [Pattern.PUSH_H]: 'bg-sang-900/80 text-sang-400',
  [Pattern.PUSH_V]: 'bg-sang-900/80 text-sang-400',
  [Pattern.PULL_H]: 'bg-anthracite-600 text-anthracite-50',
  [Pattern.PULL_V]: 'bg-anthracite-600 text-anthracite-50',
  [Pattern.ISOLATION]: 'bg-anthracite-800 text-anthracite-300 border border-anthracite-700',
  [Pattern.CORE]: 'bg-anthracite-800 text-anthracite-300 border border-anthracite-700',
};

export function PatternIcon({ pattern, size = 'md' }: PatternIconProps) {
  return (
    <span
      data-testid={`pattern-icon-${pattern}`}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        SIZE_PX[size],
        PATTERN_TONE[pattern],
      )}
      aria-label={`pattern ${pattern}`}
    >
      <Glyph pattern={pattern} />
    </span>
  );
}

function Glyph({ pattern }: { readonly pattern: Pattern }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="60%"
      height="60%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[pattern]}
    </svg>
  );
}

// Paths dessinés en SVG inline. Chaque pattern a un visuel mnémonique
// indépendant — pas de réutilisation accidentelle (un picto = un sens).
const PATHS: Record<Pattern, JSX.Element> = {
  // SQUAT : bonhomme accroupi (tête + barre + jambes pliées en V)
  [Pattern.SQUAT]: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M4 9 H20" />
      <path d="M7 22 L12 13 L17 22" />
      <path d="M12 9 V13" />
    </>
  ),
  // HINGE : tronc plié vers l'avant (hip hinge / deadlift)
  [Pattern.HINGE]: (
    <>
      <circle cx="5.5" cy="6" r="2" />
      <path d="M7 7 L19 11" />
      <path d="M7 7 V22" />
      <path d="M3 22 H21" />
    </>
  ),
  // LUNGE : 2 jambes décalées, une devant pliée
  [Pattern.LUNGE]: (
    <>
      <circle cx="14" cy="4.5" r="2" />
      <path d="M14 7 V12" />
      <path d="M14 12 L18 22" />
      <path d="M14 12 L8 17 L11 22" />
    </>
  ),
  // PUSH_H : 2 flèches divergentes horizontales (bench / dips chest)
  [Pattern.PUSH_H]: (
    <>
      <path d="M12 6 V18" />
      <path d="M12 9 L4 12 L12 15" />
      <path d="M12 9 L20 12 L12 15" />
    </>
  ),
  // PUSH_V : flèche montante (overhead press)
  [Pattern.PUSH_V]: (
    <>
      <path d="M4 20 H20" />
      <path d="M12 17 V5" />
      <path d="M7 10 L12 5 L17 10" />
    </>
  ),
  // PULL_H : flèches convergentes horizontales (row)
  [Pattern.PULL_H]: (
    <>
      <path d="M12 6 V18" />
      <path d="M4 9 L12 12 L4 15" />
      <path d="M20 9 L12 12 L20 15" />
    </>
  ),
  // PULL_V : flèche descendante vers le corps (pull-up / lat pulldown)
  [Pattern.PULL_V]: (
    <>
      <path d="M4 4 H20" />
      <path d="M12 7 V19" />
      <path d="M7 14 L12 19 L17 14" />
    </>
  ),
  // ISOLATION : pivot d'articulation (arc + axe)
  [Pattern.ISOLATION]: (
    <>
      <circle cx="8" cy="16" r="1.5" />
      <path d="M8 16 L20 8" />
      <path d="M8 16 A 12 12 0 0 0 18 19" strokeDasharray="2 2" />
    </>
  ),
  // CORE : tronc avec abdos (rectangle + bandes horizontales)
  [Pattern.CORE]: (
    <>
      <rect x="7" y="4" width="10" height="16" rx="2" />
      <path d="M7 10 H17" />
      <path d="M7 14 H17" />
      <path d="M12 4 V20" />
    </>
  ),
};
