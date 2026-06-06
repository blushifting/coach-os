import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import type { Exercise } from '@/engine/models';
import { ExercisePhotoPopin } from '@/pages/catalogue/ExercisePhotoPopin';
import { ExerciseNameStack } from '@/pages/catalogue/ExerciseNameStack';
import { photosFor } from '@/data/exercise-photos';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';

interface VariantPickerSheetProps {
  readonly open: boolean;
  readonly currentExerciseId: string;
  readonly alternatives: readonly Exercise[];
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly onPick: (newExerciseId: string) => void;
  readonly onClose: () => void;
  readonly title?: string;
}

export function VariantPickerSheet({
  open,
  currentExerciseId,
  alternatives,
  expanded,
  onToggleExpand,
  onPick,
  onClose,
  title = 'Changer de variante',
}: VariantPickerSheetProps) {
  const brand = useGymBrand() ?? undefined;
  const [previewExo, setPreviewExo] = useState<Exercise | null>(null);

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs text-anthracite-300">
            {expanded
              ? 'Tous les exos ciblant le(s) même(s) muscle(s).'
              : 'Variantes proches (même mouvement).'}
          </span>
          <button
            type="button"
            onClick={onToggleExpand}
            data-testid="btn-toggle-expand"
            className="rounded-lg border border-anthracite-700 px-2 py-1 text-xs text-anthracite-300 hover:text-white"
          >
            {expanded ? 'Voir seulement les variantes' : 'Voir tous les exos ciblant ce muscle'}
          </button>
        </div>
        {alternatives.length === 0 ? (
          <p
            className="text-sm text-anthracite-300"
            data-testid="variant-picker-empty"
          >
            {expanded
              ? 'Aucun remplaçant ne correspond à ton équipement.'
              : 'Aucune variante alternative dispo avec ton équipement.'}
          </p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto" data-testid="variant-picker-list">
            {alternatives.map((alt) => {
              const hasPhoto = photosFor(alt.id) !== null;
              return (
                <li key={alt.id} className="mb-2 flex items-stretch gap-2 last:mb-0">
                  <button
                    type="button"
                    onClick={() => onPick(alt.id)}
                    disabled={alt.id === currentExerciseId}
                    data-testid={`variant-option-${alt.id}`}
                    className="flex-1 rounded-xl border border-anthracite-700 bg-anthracite-800 px-4 py-3 text-left transition hover:border-sang-700 active:scale-[0.99] disabled:opacity-50"
                  >
                    <ExerciseNameStack exercise={alt} size="sm" />
                    <div className="mt-0.5 text-xs text-anthracite-300">
                      {alt.equip.length > 0 ? alt.equip.join(', ') : 'Poids du corps'}
                    </div>
                  </button>
                  {hasPhoto && (
                    <button
                      type="button"
                      onClick={() => setPreviewExo(alt)}
                      aria-label={`Voir le mouvement de ${displayExerciseName(alt, brand)}`}
                      data-testid={`variant-preview-${alt.id}`}
                      className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-anthracite-700 bg-anthracite-800 text-anthracite-300 transition hover:border-sang-700 hover:text-white"
                      title="Voir le mouvement"
                    >
                      {/* Pictogramme œil */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Annuler
          </Button>
        </div>
      </Sheet>
      {previewExo && (
        <ExercisePhotoPopin
          exerciseId={previewExo.id}
          title={displayExerciseName(previewExo, brand)}
          open={true}
          onClose={() => setPreviewExo(null)}
        />
      )}
    </>
  );
}
