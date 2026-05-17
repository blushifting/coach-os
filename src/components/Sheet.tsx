import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: ReactNode;
}

/**
 * Sheet bottom-attached avec backdrop semi-transparent.
 *
 * Conv #11c — refonte glassmorphism :
 *   - backdrop : noir 70 % + blur renforcé (12 px) → le contenu derrière reste
 *     deviné mais flouté
 *   - sheet : fond semi-transparent (anthracite-900/85) + blur 16 px,
 *     bordure haute sang-700/30 pour matérialiser la séparation,
 *     ombre extérieure haute pour décoller du fond
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          // Conv #11c — surface translucide + blur fort = effet "glass"
          'w-full rounded-t-3xl border-t border-sang-700/30 bg-anthracite-900/85 p-6 backdrop-blur-xl',
          'shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.6)]',
          'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-anthracite-800/80 text-anthracite-300 transition hover:bg-anthracite-700 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
