import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Bandeau repliable du Catalogue — Bloc F (Conv #31).
 *
 * En-tête cliquable (picto/étoile + libellé + compteur + chevron) qui ouvre /
 * replie le corps. Utilisé pour le bandeau « Favoris » (en tête, doré) et un
 * bandeau par type d'équipement. L'état d'ouverture est piloté par le parent
 * (`CataloguePage`) pour pouvoir forcer l'ouverture quand un filtre est actif.
 */
interface CatalogueBandProps {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** Picto de tête : `ChargeBadge` pour un type, étoile dorée pour les favoris. */
  readonly leading: ReactNode;
  /** Accent doré sur la bordure (bandeau Favoris). */
  readonly favoris?: boolean;
  readonly children: ReactNode;
}

export function CatalogueBand({
  id,
  label,
  count,
  open,
  onToggle,
  leading,
  favoris = false,
  children,
}: CatalogueBandProps) {
  return (
    <div
      data-testid={`catalogue-band-${id}`}
      className={cn(
        'overflow-hidden rounded-2xl border bg-anthracite-800',
        favoris ? 'border-amber-400/25' : 'border-anthracite-700',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={`catalogue-band-toggle-${id}`}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-anthracite-700/40"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {leading}
          <span className="truncate font-display text-sm font-semibold text-white">
            {label}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          <span
            data-testid={`catalogue-band-count-${id}`}
            className="min-w-[26px] rounded-full border border-anthracite-700 bg-anthracite-900 px-2 py-0.5 text-center font-display text-xs tabular-nums text-anthracite-300"
          >
            {count}
          </span>
          <svg
            className={cn('text-anthracite-400 transition-transform', open && 'rotate-180')}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          data-testid={`catalogue-band-body-${id}`}
          className="flex flex-col gap-2 px-2.5 pb-3"
        >
          {children}
        </div>
      )}
    </div>
  );
}
