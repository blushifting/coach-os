import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly padded?: boolean;
  /**
   * Conv #11c — si `true`, dessine une fine barre verticale rouge sang à
   * gauche de la card (effet "marqueur de chapitre"). Utilisé pour
   * accentuer la card de séance principale, le bilan, etc.
   */
  readonly accent?: boolean;
}

export function Card({
  className,
  children,
  padded = true,
  accent = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        // Conv #11c — surface des cards :
        //   - dégradé top→bottom très subtil (anthracite-800 → 900) pour
        //     simuler un éclairage par dessus (effet "plaque").
        //   - bordure légèrement plus claire et translucide (anthracite-600/55).
        //   - shadow-card-soft = ombre extérieure douce + inset clair.
        'relative rounded-2xl border border-anthracite-600/55 bg-gradient-to-b from-anthracite-800 to-anthracite-900 shadow-card-soft',
        padded && 'p-4',
        accent && 'pl-5', // marge gauche pour ne pas écraser le texte
        className,
      )}
      {...rest}
    >
      {accent && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-sang-500 via-sang-600 to-sang-800"
        />
      )}
      {children}
    </div>
  );
}
