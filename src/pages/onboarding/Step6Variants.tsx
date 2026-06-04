/**
 * Conv #22 — Étape E : choix des variantes case par case.
 *
 * Pour chaque case du squelette, l'user clique pour ouvrir la sheet
 * `VariantCellSheet` qui propose 3 variantes canoniques + option "Voir plus".
 *
 * Le choix est mémorisé dans `chosenVariantsPerCell` (clé `dayIdx:cellIdx`).
 * Au mount, on auto-fill les cases vides avec les défauts pour donner un
 * point de départ déjà sensé (l'user peut tout swap).
 *
 * Bouton "Continuer" actif quand toutes les cases sont remplies.
 */

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { VariantCellSheet } from '@/components/VariantCellSheet';
import type { Catalog } from '@/engine/catalog';
import type { PatternCell, SkeletonTemplate } from '@/engine/models';
import { buildSessionLabel } from '@/engine/skeleton_builder';
import {
  applyChosenVariantsToSkeleton,
  autoFillSkeletonDefaults,
  cellKey,
  chosenVariantsFromSkeleton,
  filledCells,
  totalCells,
} from '@/lib/skeleton-onboarding';
import { cn } from '@/lib/cn';

interface Step6VariantsProps {
  readonly skeleton: SkeletonTemplate | null;
  readonly catalog: Catalog | null;
  readonly chosenVariantsPerCell: Readonly<Record<string, string>>;
  readonly favorites: Readonly<Record<string, string>>;
  readonly onChange: (next: Readonly<Record<string, string>>) => void;
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
  stepLabel,
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

  // Squelette enrichi pour affichage (chosen_exercise_id posé).
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
  function handleChoose(exerciseId: string) {
    if (sheet === null) return;
    const key = cellKey(sheet.dayIndex, sheet.cellIndex);
    const next = { ...chosenVariantsPerCell, [key]: exerciseId };
    onChange(next);
    setSheet(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="step6-variants">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {stepLabel ?? 'Étape · Variantes'}
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Choisis tes exos
        </h1>
      </header>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-anthracite-200">
            Cases remplies : <span className="font-semibold text-white">{filled}</span> / {total}
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

      <p className="text-xs leading-relaxed text-anthracite-300">
        Pour chaque case, on te propose 3 variantes courantes. Touche pour
        choisir ou parcourir d'autres options. Tu pourras encore swap des
        exos plus tard depuis le programme.
      </p>

      <div className="flex flex-col gap-3">
        {effectiveSkeleton?.days.map((day) => {
          const label = buildSessionLabel(day);
          return (
            <Card key={day.day_index} data-testid={`var-day-${day.day_index}`}>
              <div className="mb-2 text-sm font-semibold text-white">
                Séance {day.day_index + 1} · {label}
              </div>
              <ul className="flex flex-col gap-1.5">
                {day.cells.map((cell, ci) => {
                  const patternLbl =
                    PATTERN_LABEL[cell.pattern] ?? cell.pattern;
                  const muscleLbl =
                    MUSCLE_LABEL[cell.primary_muscle] ?? cell.primary_muscle;
                  const exId = cell.chosen_exercise_id;
                  let chosenName: string | null = null;
                  if (exId !== null && catalog.has(exId)) {
                    chosenName = catalog.get(exId).nom_fr;
                  }
                  return (
                    <li key={ci}>
                      <button
                        type="button"
                        onClick={() => openSheet(day.day_index, ci, cell)}
                        className={cn(
                          'w-full rounded-xl border bg-anthracite-950 px-3 py-2 text-left transition',
                          chosenName !== null
                            ? 'border-anthracite-700 hover:border-anthracite-500'
                            : 'border-sang-700/60 hover:border-sang-500',
                        )}
                        data-testid={`var-cell-${day.day_index}-${ci}`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-anthracite-400">
                          {patternLbl} · {muscleLbl}
                        </div>
                        <div className="text-sm text-white">
                          {chosenName ?? 'À choisir'}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <VariantCellSheet
        open={sheet !== null}
        cell={sheet?.cell ?? null}
        catalog={catalog}
        usedIds={usedIds}
        {...(favorites[sheet?.cell?.pattern ?? ''] !== undefined
          ? { favoriteId: favorites[sheet!.cell.pattern]! }
          : {})}
        onChoose={handleChoose}
        onClose={closeSheet}
      />
    </div>
  );
}

// Export du Button non utilisé ici, mais permet à OnboardingPage de coordonner.
export const _unusedButton = Button;
