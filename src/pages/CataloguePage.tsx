import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import type { Exercise } from '@/engine/models';
import {
  applyFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
  type CatalogFilters,
} from '@/lib/catalog-filter';
import { peakE1rmFromSnapshots } from '@/lib/progress';
import { useCoachOsStore } from '@/store';
import { CatalogueDetailSheet } from './catalogue/CatalogueDetailSheet';
import { ExerciseCard } from './catalogue/ExerciseCard';
import { FiltersSheet } from './catalogue/FiltersSheet';

/**
 * Onglet Catalogue (Conv #6b).
 *
 * Liste filtrable des ~141 exos. Recherche fuzzy (id / nom_fr / synonymes) +
 * filtres (muscle / pattern / équipement / type / tag étirement). Card → sheet
 * de détail avec descriptif 1-2 phrases (cf. `buildDescription`).
 */
export default function CataloguePage() {
  const catalog = useCoachOsStore((s) => s.catalog);
  const userState = useCoachOsStore((s) => s.userState);
  const snapshots = useCoachOsStore((s) => s.history.e1rmSnapshots);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);

  // Conv #21 — Plafond affiché = pic des snapshots e1RM mesurés (hors
  // déload). Aligné sur la valeur "current" de la courbe Force, qui est
  // également un running max. Avant : on lisait `userState.e1rm`, voie EMA
  // utilisée par le moteur pour la prescription — elle pouvait baisser
  // ponctuellement (set perçu dur sur une charge déjà acquise) et créer
  // un écart visible avec la courbe Force, source de confusion.
  const e1rmMap = useMemo<Readonly<Record<string, number>>>(() => {
    const peak = peakE1rmFromSnapshots(snapshots);
    if (userState === null) return peak;
    // Fallback : si un exo a une mesure dans `state.e1rm` mais pas encore
    // de snapshot (cas saisie manuelle Catalogue, premier set en cours…),
    // on conserve la valeur courante. Sinon l'user verrait "—" partout
    // après une saisie manuelle qui n'a pas encore généré de snapshot.
    const merged: Record<string, number> = { ...peak };
    for (const [id, v] of Object.entries(userState.e1rm)) {
      if (!Number.isFinite(v) || v <= 0) continue;
      if (merged[id] === undefined) merged[id] = v;
    }
    return merged;
  }, [snapshots, userState]);

  // Conv #11h — contexte pour les filtres "habituels" / "avec plafond mesuré".
  // habitualIds = exos présents dans le programme courant.
  const habitualIds = useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    const plan = userState?.current_cycle_plan;
    if (plan === null || plan === undefined) return set;
    for (const day of plan.days) {
      for (const ex of day.exercises) set.add(ex.exercise_id);
    }
    return set;
  }, [userState]);

  const results = useMemo(() => {
    if (catalog === null) return [];
    return applyFilters(catalog, filters, { habitualIds, e1rmMap });
  }, [catalog, filters, habitualIds, e1rmMap]);

  if (catalog === null) {
    return (
      <Card>
        <p className="text-sm text-anthracite-300">Catalogue en chargement…</p>
      </Card>
    );
  }

  const active = hasActiveFilters(filters);
  const countLabel =
    results.length === 0
      ? 'Aucun exercice'
      : `${results.length} exercice${results.length > 1 ? 's' : ''}`;

  return (
    <section className="flex flex-col gap-3 pb-4" data-testid="catalogue-page">
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="catalogue-search">
          Rechercher un exercice
        </label>
        <input
          id="catalogue-search"
          type="search"
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
          placeholder="Rechercher (ex. développé, soulevé, squat…)"
          autoComplete="off"
          data-testid="catalogue-search"
          className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white placeholder:text-anthracite-300 focus:border-sang-700 focus:outline-none"
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            data-testid="catalogue-filters-toggle"
            className="flex items-center gap-2 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-1.5 text-sm text-white"
          >
            Filtres
            {active && (
              <span
                data-testid="catalogue-filters-badge"
                className="rounded-full bg-sang-900 px-1.5 text-[10px] text-white"
              >
                {activeChipsCount(filters)}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2 text-xs text-anthracite-300">
            <span data-testid="catalogue-count">{countLabel}</span>
            {active && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                data-testid="catalogue-clear"
                className="underline hover:text-white"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <Card data-testid="catalogue-empty">
          <p className="text-sm text-anthracite-300">
            Aucun exercice ne correspond à ces filtres. Essaie d'en retirer un ou
            de modifier la recherche.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="catalogue-list">
          {results.map((ex) => (
            <li key={ex.id}>
              <ExerciseCard
                exercise={ex}
                onClick={() => setSelected(ex)}
                e1rm={e1rmMap[ex.id] ?? null}
              />
            </li>
          ))}
        </ul>
      )}

      <FiltersSheet
        open={filtersOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <CatalogueDetailSheet
        open={selected !== null}
        exercise={selected}
        e1rm={selected === null ? null : (e1rmMap[selected.id] ?? null)}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function activeChipsCount(f: CatalogFilters): number {
  return (
    f.muscles.length +
    f.patterns.length +
    f.charges.length +
    f.types.length +
    (f.lengthenedBiasOnly ? 1 : 0)
  );
}
