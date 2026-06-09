import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Durée de l'animation de fermeture (doit matcher `sheet-down` /
// `backdrop-fade-out` dans tailwind.config.ts).
const CLOSE_MS = 240;

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
 *
 * Conv #24 (D12) — hauteur plafonnée à 90 dvh : le panneau est un `flex-col`
 * dont le header (titre + croix) reste figé en haut (`shrink-0`) tandis que le
 * corps défile en interne (`overflow-y-auto`). Sans ça, une fiche longue (exo
 * détaillé, a fortiori photo dépliée) poussait le titre et sa croix au-dessus
 * de l'écran → impossible à fermer.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  // 1.17 — état « closing » : quand `open` repasse à false, on garde le volet
  // monté le temps de l'animation de sortie (slide-down + fade), puis on
  // démonte. `rendered` reste vrai pendant cette fenêtre.
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        'fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-md',
        closing
          ? 'motion-safe:animate-backdrop-fade-out'
          : 'motion-safe:animate-backdrop-fade',
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          // Conv #11c — surface translucide + blur fort = effet "glass"
          // Conv #24 — flex-col + max-h pour header figé / corps scrollable.
          'flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-sang-700/30 bg-anthracite-900/85 backdrop-blur-xl',
          'shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.6)]',
          // Bloc C 1.16 — le volet glisse depuis le bas ; 1.17 — et redescend
          // à la fermeture (motion-safe).
          closing ? 'motion-safe:animate-sheet-down' : 'motion-safe:animate-sheet-up',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-anthracite-800/70 px-6 pb-3 pt-6">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-anthracite-800/80 text-xl leading-none text-anthracite-300 transition hover:bg-anthracite-700 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
