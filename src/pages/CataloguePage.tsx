import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { ChargeType, type Exercise } from '@/engine/models';
import {
  applyFilters,
  CHARGE_LABEL_FR,
  EMPTY_FILTERS,
  hasActiveFilters,
  type CatalogFilters,
} from '@/lib/catalog-filter';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { CatalogueBand } from './catalogue/CatalogueBand';
import { CatalogueDetailSheet } from './catalogue/CatalogueDetailSheet';
import { ChargeBadge } from './catalogue/ChargeBadge';
import { CustomExerciseSheet } from './catalogue/CustomExerciseSheet';
import { ExerciseCard } from './catalogue/ExerciseCard';
import { FavoriteStar } from './catalogue/FavoriteStar';
import { FiltersSheet } from './catalogue/FiltersSheet';

/**
 * Bloc F (Conv #31) — ordre des bandeaux par type d'équipement (machines
 * d'abord, poids libres ensuite, dérivés du poids du corps en dernier).
 */
const CHARGE_ORDER: readonly ChargeType[] = [
  ChargeType.MACHINE_STACK,
  ChargeType.CABLE,
  ChargeType.BARBELL,
  ChargeType.DUMBBELL,
  ChargeType.BODYWEIGHT,
  ChargeType.BODYWEIGHT_LOADED,
  ChargeType.BODYWEIGHT_ASSISTED,
] as const;

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
  // Bloc F (Conv #31) — filtres persistés dans le store (survivent à la
  // navigation, reset au relancement de l'app).
  const filters = useCoachOsStore((s) => s.catalogFilters);
  const setFilters = useCoachOsStore((s) => s.setCatalogFilters);
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

  // Bloc F (Conv #31) — favoris unifiés + état d'ouverture des bandeaux.
  const engine = useEngine();
  const demoActive = useDemoMode();
  const favoriteIds = useMemo<ReadonlySet<string>>(
    () => new Set(userState?.favorite_exercise_ids ?? []),
    [userState],
  );
  // Favoris ouvert par défaut, bandeaux de type repliés. Quand un filtre /
  // une recherche est actif, l'ouverture est forcée (cf. `active` plus bas).
  const [openBands, setOpenBands] = useState<Record<string, boolean>>({
    favoris: true,
  });
  const toggleBand = (key: string) =>
    setOpenBands((s) => ({ ...s, [key]: !(s[key] ?? key === 'favoris') }));

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

  // Bloc F — bandeau Favoris + un bandeau par type d'équipement. Dans chaque
  // type, les favoris remontent en tête (tri stable). Recherche/filtre actif :
  // les bandeaux non vides sont forcés ouverts (cf. `active` ci-dessous), les
  // vides masqués.
  const favItems = results.filter((ex) => favoriteIds.has(ex.id));
  const groups = CHARGE_ORDER.map((charge) => ({
    charge,
    items: [...results.filter((ex) => ex.charge === charge)].sort(
      (a, b) => (favoriteIds.has(a.id) ? 0 : 1) - (favoriteIds.has(b.id) ? 0 : 1),
    ),
  })).filter((g) => g.items.length > 0);

  const renderCard = (ex: Exercise) => (
    <ExerciseCard
      key={ex.id}
      exercise={ex}
      onClick={() => setSelected(ex)}
      e1rm={e1rmMap[ex.id] ?? null}
      isFavorite={favoriteIds.has(ex.id)}
      onToggleFavorite={
        demoActive ? undefined : () => void engine.toggleFavorite(ex.id)
      }
    />
  );

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
        <div className="flex flex-col gap-2.5" data-testid="catalogue-list">
          {(!active || favItems.length > 0) && (
            <CatalogueBand
              id="favoris"
              label="Favoris"
              count={favItems.length}
              open={active ? true : (openBands.favoris ?? true)}
              onToggle={() => toggleBand('favoris')}
              favoris
              leading={
                <span className="text-amber-400">
                  <FavoriteStar filled size={18} />
                </span>
              }
            >
              {favItems.length > 0 ? (
                favItems.map(renderCard)
              ) : (
                <p
                  data-testid="catalogue-favoris-empty"
                  className="px-2 py-1.5 text-xs leading-snug text-anthracite-400"
                >
                  Aucun favori pour l'instant. Touche l'étoile d'un exercice
                  pour l'ajouter ici.
                </p>
              )}
            </CatalogueBand>
          )}
          {groups.map((g) => (
            <CatalogueBand
              key={g.charge}
              id={g.charge}
              label={CHARGE_LABEL_FR[g.charge]}
              count={g.items.length}
              open={active ? true : (openBands[g.charge] ?? false)}
              onToggle={() => toggleBand(g.charge)}
              leading={<ChargeBadge charge={g.charge} size={22} />}
            >
              {g.items.map(renderCard)}
            </CatalogueBand>
          ))}
        </div>
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
