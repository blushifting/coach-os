/**
 * Glyphes SVG inline réutilisables (Conv #10c).
 *
 * Tracés `stroke-currentColor`, alignés avec le texte via `align-text-bottom`,
 * en remplacement des caractères Unicode `←` / `→` qui rendent mal selon la
 * fonte et l'OS.
 */

import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';

const BASE = 'inline-block h-[1em] w-[1em] align-text-bottom';

export function ChevronLeft({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(BASE, className)}
      {...rest}
    >
      <path d="M10 12.5 5.5 8 10 3.5" />
    </svg>
  );
}

export function ChevronRight({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(BASE, className)}
      {...rest}
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

/**
 * Flèche de tendance (Conv #24) — hausse / baisse / stable. Hérite la couleur
 * du parent (`currentColor`) : double visuellement le code couleur feu
 * tricolore des évolutions de Plafond (couleur jamais seule, cf. accessibilité).
 */
export function TrendArrow({
  trend,
  className,
  ...rest
}: { trend: 'up' | 'down' | 'flat' } & SVGProps<SVGSVGElement>) {
  const path =
    trend === 'up' ? 'M4 10.5 8 6l4 4.5' : trend === 'down' ? 'M4 5.5 8 10l4-4.5' : 'M4 8h8';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block h-[1em] w-[1em]', className)}
      {...rest}
    >
      <path d={path} />
    </svg>
  );
}
