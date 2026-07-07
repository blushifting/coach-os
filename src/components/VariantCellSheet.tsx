/**
 * Sheet de choix de variante pour une case du squelette (Conv #22, étape E).
 *
 * Présente :
 *  - 3 variantes canoniques en tête (favori user en 1er si dispo).
 *  - Bouton "Voir d'autres variantes" qui expand toute la liste filtrée.
 *  - Lien "Annuler" pour fermer sans choisir.
 *
 * Critères de filtrage des candidats (cf. `candidatesForCell`) :
 *  - Pattern match exact.
 *  - Muscle primaire de la case présent dans l'exo.
 *  - Pas dans `usedIds` (évite doublons stricts sur le cycle).
 *  - Trié par : favori, role_hint match, conflit d'angle, polyarticularité, dif.
 */

import { useMemo, useState } from 'react';
import type { Catalog } from '@/engine/catalog';
import type { PatternCell, Exercise } from '@/engine/models';
import { ExType } from '@/engine/models';
import {
  candidatesForCell,
  canonicalVariantsForCell,
} from '@/engine/pattern_grid';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';
import { ExercisePhotoPopin } from '@/pages/catalogue/ExercisePhotoPopin';
import { ExerciseNameStack } from '@/pages/catalogue/ExerciseNameStack';
import { photosFor } from '@/data/exercise-photos';

interface VariantCellSheetProps {
  readonly open: boolean;
  readonly cell: PatternCell | null;
  readonly catalog: Catalog | null;
  /** Exos déjà choisis dans d'autres cases du cycle (pour éviter doublons). */
  readonly usedIds: ReadonlySet<string>;
  /** Favori user pour ce pattern (issu de UserState). */
  readonly favoriteId?: string;
  readonly onChoose: (exerciseId: string) => void;
  readonly onClose: () => void;
}

const PATTERN_LABEL: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Charnière (hinge)',
  lunge: 'Fente',
  push_h: 'Poussée horizontale',
  push_v: 'Poussée verticale',
  pull_h: 'Tirage horizontal',
  pull_v: 'Tirage vertical',
  isolation: 'Isolation',
  core: 'Gainage',
};

const MUSCLE_LABEL: Record<string, string> = {
  pectoraux: 'pectoraux',
  dos_largeur: 'dos largeur',
  dos_epaisseur: 'dos épaisseur',
  trapezes_hauts: 'trapèzes',
  quadriceps: 'quadriceps',
  ischios: 'ischios',
  fessiers: 'fessiers',
  mollets: 'mollets',
  deltos_lateraux: 'deltos latéraux',
  deltos_posterieurs: 'deltos postérieurs',
  biceps: 'biceps',
  triceps: 'triceps',
  abdos: 'abdos',
  obliques: 'obliques',
  lombaires: 'lombaires',
};

export function VariantCellSheet({
  open,
  cell,
  catalog,
  usedIds,
  favoriteId,
  onChoose,
  onClose,
}: VariantCellSheetProps) {
  const [expanded, setExpanded] = useState(false);

  const allCandidates = useMemo(() => {
    if (!open || cell === null || catalog === null) return [] as Exercise[];
    return candidatesForCell(cell, catalog, {
      favoriteId,
      excludeIds: usedIds,
    });
  }, [open, cell, catalog, usedIds, favoriteId]);

  const canonical = useMemo(() => {
    if (!open || cell === null || catalog === null) return [] as Exercise[];
    return canonicalVariantsForCell(
      cell,
      catalog,
      { favoriteId, excludeIds: usedIds },
      3,
    );
  }, [open, cell, catalog, usedIds, favoriteId]);

  // À chaque ouverture, repartir en mode "non-expand".
  useMemoOnOpen(open, () => setExpanded(false));

  if (cell === null) {
    return <Sheet open={open} onClose={onClose} title="Choix" >{null}</Sheet>;
  }

  const patternLabel = PATTERN_LABEL[cell.pattern] ?? cell.pattern;
  const muscleLabel = MUSCLE_LABEL[cell.primary_muscle] ?? cell.primary_muscle;
  const hintLabel =
    cell.role_hint === 'compound' ? 'compound' : 'isolation';

  const others = expanded
    ? allCandidates.filter((c) => !canonical.some((k) => k.id === c.id))
    : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Choix de variante — ${patternLabel}`}
    >
      <header className="mb-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {hintLabel}
        </div>
        <h2 className="font-display text-xl tracking-wide text-white">
          {patternLabel}
        </h2>
        <p className="text-xs text-anthracite-300">
          Muscle ciblé&nbsp;: {muscleLabel}
        </p>
      </header>

      {canonical.length === 0 ? (
        <p className="rounded-xl border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-500">
          Aucune variante disponible pour cette case. Tu pourras modifier
          ton programme plus tard.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="variant-canonical-list">
          {canonical.map((ex) => (
            <VariantRow
              key={ex.id}
              exercise={ex}
              isFavorite={favoriteId === ex.id}
              onChoose={() => onChoose(ex.id)}
            />
          ))}
        </ul>
      )}

      {allCandidates.length > canonical.length && (
        <>
          {!expanded ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-anthracite-700 bg-anthracite-950 px-3 py-2 text-sm font-medium text-anthracite-200 hover:border-anthracite-500"
              onClick={() => setExpanded(true)}
              data-testid="variant-expand"
            >
              Voir d'autres variantes ({allCandidates.length - canonical.length})
            </button>
          ) : (
            <>
              <div className="mt-4 mb-2 text-[11px] uppercase tracking-wider text-anthracite-400">
                Autres variantes
              </div>
              <ul className="flex flex-col gap-2" data-testid="variant-other-list">
                {others.map((ex) => (
                  <VariantRow
                    key={ex.id}
                    exercise={ex}
                    isFavorite={favoriteId === ex.id}
                    onChoose={() => onChoose(ex.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose} data-testid="variant-cancel">
          Annuler
        </Button>
      </div>
    </Sheet>
  );
}

interface VariantRowProps {
  readonly exercise: Exercise;
  readonly isFavorite: boolean;
  readonly onChoose: () => void;
}

function VariantRow({ exercise, isFavorite, onChoose }: VariantRowProps) {
  const brand = useGymBrand() ?? undefined;
  const isCompound = exercise.type === ExType.COMPOUND;
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPhoto = photosFor(exercise.id) !== null;
  return (
    <li>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className={cn(
            'flex-1 rounded-xl border bg-anthracite-950 px-3 py-2 text-left transition',
            isFavorite
              ? 'border-sang-500/70 hover:border-sang-500'
              : 'border-anthracite-700 hover:border-anthracite-500',
          )}
          onClick={onChoose}
          data-testid={`variant-pick-${exercise.id}`}
        >
          <div className="flex items-center gap-2">
            <ExerciseNameStack exercise={exercise} size="sm" className="flex-1" />
            {isFavorite && (
              <span className="rounded-full bg-sang-900/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sang-300">
                favori
              </span>
            )}
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider',
                isCompound
                  ? 'border-anthracite-600 text-anthracite-300'
                  : 'border-anthracite-700 text-anthracite-400',
              )}
            >
              {isCompound ? 'compound' : 'iso'}
            </span>
          </div>
        </button>
        {hasPhoto && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="Voir le mouvement"
            data-testid={`variant-preview-${exercise.id}`}
            className="flex w-10 shrink-0 items-center justify-center rounded-xl border border-anthracite-700 bg-anthracite-900 text-anthracite-300 transition hover:border-sang-700 hover:text-white"
            title="Voir le mouvement"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
      </div>
      {previewOpen && (
        <ExercisePhotoPopin
          exerciseId={exercise.id}
          title={displayExerciseName(exercise, brand)}
          open={true}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </li>
  );
}

// Petit helper pour reset expanded à chaque (re-)ouverture sans useEffect lourd.
function useMemoOnOpen(open: boolean, cb: () => void) {
  useMemo(() => {
    if (open) cb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
