/**
 * Aperçu rapide du mouvement d'un exercice, en fenêtre par-dessus l'écran
 * (bouton « œil »), pour décider sans ouvrir la fiche.
 *
 * Utilisé depuis :
 *  - le choix d'une variante (`VariantPickerSheet`) ;
 *  - les listes d'exercices à choisir (`ExerciseEyeButton`) ;
 *  - le programme proposé à l'inscription (`Step5Preview`).
 *
 * Montre la même animation que la fiche (pose validée et WebGL présent), sinon
 * les deux photos de free-exercise-db en alternance. Croix, clic en dehors ou
 * Échap ferment.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { photosFor } from '@/data/exercise-photos';
import type { Exercise } from '@/engine/models';
import { poseValidee } from '@/visuels/poses';

interface ExercisePreviewPopinProps {
  readonly exercise: Exercise;
  readonly title?: string;
  readonly onClose: () => void;
}

const ANIMATION_INTERVAL_MS = 1400;

export function ExercisePreviewPopin({ exercise, title, onClose }: ExercisePreviewPopinProps) {
  const pose = poseValidee(exercise.id);
  const [indisponible, setIndisponible] = useState(false);
  const photos = photosFor(exercise.id);

  // Fermeture par Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portail vers `document.body` : ouvert depuis un Sheet dont le panneau porte
  // `backdrop-blur`, le `position: fixed` serait sinon contenu par le Sheet
  // (décalé en bas) au lieu d'être centré sur l'écran.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Aperçu du mouvement'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      data-testid={`exercise-preview-popin-${exercise.id}`}
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
          data-testid={`exercise-preview-popin-close-${exercise.id}`}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-anthracite-800/80 text-anthracite-300 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        {pose !== null && !indisponible ? (
          <ExerciseAnimation
            pose={pose}
            muscles={exercise.muscles}
            onIndisponible={() => setIndisponible(true)}
          />
        ) : photos !== null ? (
          <Photos startUrl={photos.startUrl} endUrl={photos.endUrl} />
        ) : (
          <p className="p-4 text-sm text-anthracite-200">Pas d'aperçu disponible pour cet exercice.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Photos({ startUrl, endUrl }: { readonly startUrl: string; readonly endUrl: string }) {
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), ANIMATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="relative aspect-square w-full bg-anthracite-950">
      <img
        src={startUrl}
        alt="Position de départ"
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          frame === 0 ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <img
        src={endUrl}
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
  );
}
