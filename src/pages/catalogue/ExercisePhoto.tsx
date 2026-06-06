/**
 * Photo d'un exo, format GIF-like (Conv #23, item W).
 *
 * Sourcée depuis free-exercise-db (domaine public) — voir
 * `src/data/exercise-photos.ts`. Crop carré CSS centré sur le sujet,
 * lazy-load par le navigateur, mise en cache automatique par le Service
 * Worker pour offline-first à la salle après 1re vue.
 *
 * UX : masquée par défaut, l'user clique "Voir le mouvement" pour la
 * révéler. Les 2 frames (start/end) alternent toutes les 1.4 s pour
 * donner un aperçu du mouvement sans surcharger la fiche.
 */

import { useEffect, useState } from 'react';
import { photosFor } from '@/data/exercise-photos';

interface ExercisePhotoProps {
  readonly exerciseId: string;
  /** Délai entre les 2 frames, ms. Default 1400. */
  readonly intervalMs?: number;
}

const ANIMATION_INTERVAL_MS = 1400;

export function ExercisePhoto({
  exerciseId,
  intervalMs = ANIMATION_INTERVAL_MS,
}: ExercisePhotoProps) {
  const [revealed, setRevealed] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);
  const photos = photosFor(exerciseId);

  // Alternance entre frame 0 et frame 1
  useEffect(() => {
    if (!revealed) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [revealed, intervalMs]);

  if (photos === null) {
    return null;
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        data-testid={`exercise-photo-reveal-${exerciseId}`}
        className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-4 py-3 text-sm text-anthracite-200 transition hover:border-sang-700 hover:text-white"
      >
        Voir à quoi ressemble le mouvement
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(false)}
      aria-label="Masquer le mouvement"
      className="relative mx-auto block aspect-square w-full max-w-[280px] overflow-hidden rounded-xl border border-anthracite-700 bg-anthracite-900"
      data-testid={`exercise-photo-${exerciseId}`}
    >
      {/* Les deux images sont chargées en parallèle, on superpose et on
          fade entre les deux pour éviter un flash de chargement. */}
      <img
        src={photos.startUrl}
        alt="Position de départ"
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          frame === 0 ? 'opacity-100' : 'opacity-0'
        }`}
        data-testid={`exercise-photo-frame-0-${exerciseId}`}
      />
      <img
        src={photos.endUrl}
        alt="Position d'arrivée"
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          frame === 1 ? 'opacity-100' : 'opacity-0'
        }`}
        data-testid={`exercise-photo-frame-1-${exerciseId}`}
      />
      {/* Indicateur discret de cycle 2 frames + crédit photo */}
      <div className="pointer-events-none absolute bottom-1 right-2 text-[9px] leading-none text-anthracite-300/80">
        free-exercise-db · clic pour masquer
      </div>
    </button>
  );
}
