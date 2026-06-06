/**
 * Conv #22 — Étape E : choix des variantes case par case.
 *
 * Pour chaque case du squelette, on affiche directement les 3 premières
 * variantes en grille 3-cols (du plus guidé à gauche au plus libre à droite).
 * L'user tap pour sélectionner — un liseré rouge marque le choix actif.
 *
 * Un lien discret "Voir d'autres options" ouvre la `VariantCellSheet` qui
 * liste TOUTES les variantes triées de la même manière, pour explorer hors
 * du top 3.
 *
 * Au mount, on auto-fill les cases vides avec la 1re variante de la liste
 * triée (= la plus guidée + favori user en priorité).
 */

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { VariantCellSheet } from '@/components/VariantCellSheet';
import type { Catalog } from '@/engine/catalog';
import type { Exercise, PatternCell, SkeletonTemplate } from '@/engine/models';
import { ExType } from '@/engine/models';
import { buildSessionLabel } from '@/engine/skeleton_builder';
import { candidatesForCell } from '@/engine/pattern_grid';
import {
  applyChosenVariantsToSkeleton,
  autoFillSkeletonDefaults,
  cellKey,
  chosenVariantsFromSkeleton,
  filledCells,
  totalCells,
} from '@/lib/skeleton-onboarding';
import { cn } from '@/lib/cn';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';

interface Step6VariantsProps {
  readonly skeleton: SkeletonTemplate | null;
  readonly catalog: Catalog | null;
  readonly chosenVariantsPerCell: Readonly<Record<string, string>>;
  readonly favorites: Readonly<Record<string, string>>;
  readonly onChange: (next: Readonly<Record<string, string>>) => void;
  /** Conv #22 — gardé pour compat ; non affiché. */
  readonly stepLabel?: string;
}

const PATTERN_LABEL: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
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

interface SheetTarget {
  readonly dayIndex: number;
  readonly cellIndex: number;
  readonly cell: PatternCell;
}

export function Step6Variants({
  skeleton,
  catalog,
  chosenVariantsPerCell,
  favorites,
  onChange,
}: Step6VariantsProps) {
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  // Auto-fill au mount si rien n'est encore choisi.
  useEffect(() => {
    if (skeleton === null || catalog === null) return;
    if (Object.keys(chosenVariantsPerCell).length > 0) return;
    const seeded = autoFillSkeletonDefaults(skeleton, catalog, favorites);
    const filled = chosenVariantsFromSkeleton(seeded);
    if (Object.keys(filled).length > 0) {
      onChange(filled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skeleton, catalog]);

  const effectiveSkeleton = useMemo(() => {
    if (skeleton === null) return null;
    return applyChosenVariantsToSkeleton(skeleton, chosenVariantsPerCell);
  }, [skeleton, chosenVariantsPerCell]);

  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const id of Object.values(chosenVariantsPerCell)) s.add(id);
    return s;
  }, [chosenVariantsPerCell]);

  const filled = effectiveSkeleton ? filledCells(effectiveSkeleton) : 0;
  const total = effectiveSkeleton ? totalCells(effectiveSkeleton) : 0;

  if (skeleton === null || catalog === null) {
    return (
      <div className="p-4">
        <p className="text-sm text-anthracite-300">Chargement…</p>
      </div>
    );
  }

  function openSheet(dayIndex: number, cellIndex: number, cell: PatternCell) {
    setSheet({ dayIndex, cellIndex, cell });
  }
  function closeSheet() {
    setSheet(null);
  }
  function pickInline(dayIndex: number, cellIndex: number, exerciseId: string) {
    const key = cellKey(dayIndex, cellIndex);
    onChange({ ...chosenVariantsPerCell, [key]: exerciseId });
  }
  function handleChooseFromSheet(exerciseId: string) {
    if (sheet === null) return;
    pickInline(sheet.dayIndex, sheet.cellIndex, exerciseId);
    setSheet(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="step6-variants">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Choisis tes exercices
        </h1>
        <div className="space-y-2 text-sm leading-relaxed text-anthracite-300">
          <p>
            Pour chaque case, trois options à choisir : à{' '}
            <strong className="text-anthracite-100">gauche</strong> l'exo le plus
            guidé (machine), à <strong className="text-anthracite-100">droite</strong>{' '}
            le plus libre (barre, poids du corps). Pas de bonne ou mauvaise
            réponse — prends ce qui te convient.
          </p>
          <p className="text-anthracite-400">
            Tu peux modifier ces choix plus tard depuis ton programme.
          </p>
        </div>
      </header>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-anthracite-200">
            Cases remplies :{' '}
            <span className="font-semibold text-white">{filled}</span> / {total}
          </span>
          {filled === total && (
            <span className="rounded-full bg-sang-900/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sang-300">
              prêt
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-anthracite-800">
          <div
            className="h-full bg-sang-500 transition-all"
            style={{ width: total > 0 ? `${(filled / total) * 100}%` : '0%' }}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {effectiveSkeleton?.days.map((day) => {
          const label = buildSessionLabel(day);
          return (
            <Card key={day.day_index} data-testid={`var-day-${day.day_index}`}>
              <div className="mb-3 text-sm font-semibold text-white">
                Séance {day.day_index + 1} · {label}
              </div>
              <div className="flex flex-col gap-4">
                {day.cells.map((cell, ci) => (
                  <CellRow
                    key={ci}
                    dayIndex={day.day_index}
                    cellIndex={ci}
                    cell={cell}
                    catalog={catalog}
                    favoriteId={favorites[cell.pattern]}
                    usedIds={usedIds}
                    chosenId={cell.chosen_exercise_id}
                    onPick={(id) => pickInline(day.day_index, ci, id)}
                    onOpenSheet={() => openSheet(day.day_index, ci, cell)}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <VariantCellSheet
        open={sheet !== null}
        cell={sheet?.cell ?? null}
        catalog={catalog}
        usedIds={usedIds}
        {...(sheet !== null && favorites[sheet.cell.pattern] !== undefined
          ? { favoriteId: favorites[sheet.cell.pattern]! }
          : {})}
        onChoose={handleChooseFromSheet}
        onClose={closeSheet}
      />
    </div>
  );
}

interface CellRowProps {
  readonly dayIndex: number;
  readonly cellIndex: number;
  readonly cell: PatternCell;
  readonly catalog: Catalog;
  readonly favoriteId?: string;
  readonly usedIds: ReadonlySet<string>;
  readonly chosenId: string | null;
  readonly onPick: (exerciseId: string) => void;
  readonly onOpenSheet: () => void;
}

function CellRow({
  cell,
  catalog,
  favoriteId,
  usedIds,
  chosenId,
  onPick,
  onOpenSheet,
}: CellRowProps) {
  const allCandidates = useMemo<Exercise[]>(
    () =>
      candidatesForCell(cell, catalog, {
        ...(favoriteId !== undefined ? { favoriteId } : {}),
        excludeIds: usedIds,
      }),
    [cell, catalog, favoriteId, usedIds],
  );

  // Conv #22 — sécurité bug "case non remplissable" : si l'exo choisi
  // n'est pas dans les candidats (héritage obsolète), on ne plante pas,
  // on affiche juste les 3 premiers candidats.
  const top3 = allCandidates.slice(0, 3);
  const patternLbl = PATTERN_LABEL[cell.pattern] ?? cell.pattern;
  const muscleLbl = MUSCLE_LABEL[cell.primary_muscle] ?? cell.primary_muscle;
  const brand = useGymBrand() ?? undefined;

  if (top3.length === 0) {
    return (
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-anthracite-400">
          {patternLbl} · {muscleLbl}
        </div>
        <p className="rounded-xl border border-sang-700 bg-sang-900/20 px-3 py-2 text-xs text-sang-400">
          Aucune variante au catalogue. Tu pourras ajouter un exo personnalisé
          plus tard depuis le Catalogue.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-anthracite-400">
        {patternLbl} · {muscleLbl}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {top3.map((ex) => {
          const selected = chosenId === ex.id;
          const isCompound = ex.type === ExType.COMPOUND;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex.id)}
              className={cn(
                'flex h-full min-h-[60px] flex-col items-start gap-1 rounded-xl border bg-anthracite-950 px-2.5 py-2 text-left transition',
                selected
                  ? 'border-sang-500 ring-1 ring-sang-500/40'
                  : 'border-anthracite-700 hover:border-anthracite-500',
              )}
              data-testid={`variant-inline-${ex.id}`}
              aria-pressed={selected}
            >
              <span className="text-[12px] font-medium leading-tight text-white">
                {displayExerciseName(ex, brand)}
              </span>
              <span
                className={cn(
                  'rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider',
                  isCompound
                    ? 'border-anthracite-600 text-anthracite-300'
                    : 'border-anthracite-700 text-anthracite-400',
                )}
              >
                {isCompound ? 'compound' : 'iso'}
              </span>
            </button>
          );
        })}
      </div>
      {allCandidates.length > 3 && (
        <button
          type="button"
          onClick={onOpenSheet}
          className="mt-1.5 text-[11px] text-anthracite-400 underline-offset-2 hover:text-anthracite-200 hover:underline"
          data-testid="variant-open-other"
        >
          Voir d'autres variantes ({allCandidates.length - 3})
        </button>
      )}
    </div>
  );
}
