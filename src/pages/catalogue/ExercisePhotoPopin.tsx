/**
 * Popin (modal) qui affiche la photo d'un exo en aperçu (Conv #23 retour
 * Azur).
 *
 * Utilisée depuis :
 *  - la sélection de variantes (VariantPickerSheet / VariantCellSheet) :
 *    pour décider sans avoir à valider la variante d'abord ;
 *  - la liste d'exos du programme co-construit (Step5Preview) : voir le
 *    mouvement d'un exo prévu, sans ouvrir la fiche détail.
 *
 * Affiche les 2 frames de free-exercise-db en alternance (cf.
 * `ExercisePhoto`) sur fond noir transparent, avec une croix pour
 * fermer. Clic en dehors ou Échap ferme aussi.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { photosFor } from '@/data/exercise-photos';

interface ExercisePhotoPopinProps {
  readonly exerciseId: string;
  readonly title?: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

const ANIMATION_INTERVAL_MS = 1400;

export function ExercisePhotoPopin({
  exerciseId,
  title,
  open,
  onClose,
}: ExercisePhotoPopinProps) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const photos = photosFor(exerciseId);

  // Alternance entre frame 0 et frame 1
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0));
    }, ANIMATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [open]);

  // Fermeture par Échap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (photos === null) {
    // Bloc I (Conv #34) — portail vers `document.body` : ouvert depuis un Sheet
    // dont le panneau porte `backdrop-blur`, le `position: fixed` serait sinon
    // contenu par le Sheet (décalé en bas) au lieu d'être centré sur le viewport.
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
        data-testid={`exercise-photo-popin-${exerciseId}`}
      >
        <div
          className="max-w-sm rounded-xl border border-anthracite-700 bg-anthracite-900 p-4 text-sm text-anthracite-200"
          onClick={(e) => e.stopPropagation()}
        >
          Pas de photo dispo pour cet exo.
          <button
            type="button"
            onClick={onClose}
            className="mt-3 block w-full rounded-lg border border-anthracite-700 bg-anthracite-800 py-1.5 text-xs text-anthracite-300 hover:text-white"
          >
            Fermer
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Aperçu du mouvement'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      data-testid={`exercise-photo-popin-${exerciseId}`}
    >
      <div
        className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-anthracite-700 bg-anthracite-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-anthracite-700 px-3 py-2 pr-10 text-sm font-medium text-white">
            {title}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          data-testid={`exercise-photo-popin-close-${exerciseId}`}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-anthracite-800/80 text-anthracite-300 transition hover:text-white"
        >
          {/* Croix simple SVG */}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <div className="relative aspect-square w-full bg-anthracite-950">
          <img
            src={photos.startUrl}
            alt="Position de départ"
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              frame === 0 ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <img
            src={photos.endUrl}
            alt="Position d'arrivée"
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              frame === 1 ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="pointer-events-none absolute bottom-1 right-2 text-[9px] leading-none text-anthracite-300/80">
            free-exercise-db
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
