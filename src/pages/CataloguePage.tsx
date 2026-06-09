import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import type { Exercise } from '@/engine/models';
import {
  applyFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
  type CatalogFilters,
} from '@/lib/catalog-filter';
import { useCoachOsStore } from '@/store';
import { CatalogueDetailSheet } from './catalogue/CatalogueDetailSheet';
import { CustomExerciseSheet } from './catalogue/CustomExerciseSheet';
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
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);

  // Conv #21bis — Plafond affiché = `state.e1rm[id]`, la dernière valeur
  // calculée par le moteur (EMA des mesures fiables). Aligné avec le
  // dernier point de la courbe Force, qui correspond au snapshot inséré
  // au moment de la dernière séance non-déload (= state.e1rm de l'époque).
  // Les semaines de déload (S5) n'updatent plus state.e1rm côté engine —
  // cf. `recordFeedback`. Donc une séance de déload ne crée plus d'écart
  // visible entre les deux vues.
  const e1rmMap: Readonly<Record<string, number>> = userState?.e1rm ?? {};

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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
            {/* Conv #21b — Création d'un exo custom. Bouton secondaire à côté
                des filtres pour rester discret (action peu fréquente, mais
                accessible). */}
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              data-testid="catalogue-custom-open"
              className="rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-1.5 text-sm text-white"
            >
              + Créer
            </button>
          </div>
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
      <CustomExerciseSheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
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
