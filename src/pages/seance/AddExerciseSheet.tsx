/**
 * Conv #21b — Sheet pour ajouter un exercice ad-hoc à la séance en cours.
 *
 * Liste les exos du catalog (défauts + customs), recherche fuzzy par nom_fr
 * et synonymes. L'user tape, choisit le nombre de séries (3 par défaut), et
 * l'app appelle `engine.addExerciseToCurrentSession` qui pose une prescription
 * via `buildPrescription`.
 *
 * UX volontairement plus light que `CataloguePage` (pas de filtres avancés,
 * pas de carte détaillée) — on est en plein milieu d'une séance, le user
 * veut juste un sélecteur rapide.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import type { Catalog } from '@/engine/catalog';
import type { Exercise } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import {
  chargeLabel,
  displayExerciseName,
  extypeLabel,
  patternLabel,
} from '@/lib/catalog-filter';
import {
  addedVolumeOvershoot,
  buildMusclesOf,
  computeCoverageThisWeek,
  muscleLabel,
} from '@/lib/progress';
import { useCoachOsStore } from '@/store';
import { useGymBrand } from '@/store/selectors';
import { favoritesFirst } from '@/lib/custom-session';
import { ExerciseEyeButton } from '@/pages/catalogue/ExerciseEyeButton';

/** Normalisation simple (lowercase + retire accents) pour le search inline. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

interface AddExerciseSheetProps {
  readonly open: boolean;
  readonly catalog: Catalog | null;
  /** Ids d'exos déjà présents dans la séance — signalés mais ré-ajoutables
   *  (#7 : un doublon crée des séries en plus qui nourrissent le même plafond). */
  readonly existingExerciseIds: ReadonlySet<string>;
  readonly onClose: () => void;
  /** Optionnel — appelé après ajout réussi avec l'id de l'exo ajouté. */
  readonly onAdded?: (exerciseId: string) => void;
}

const DEFAULT_SETS = 3;

export function AddExerciseSheet({
  open,
  catalog,
  existingExerciseIds,
  onClose,
  onAdded,
}: AddExerciseSheetProps) {
  const engine = useEngine();
  const brand = useGymBrand() ?? undefined;
  const userState = useCoachOsStore((s) => s.userState);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const cycles = useCoachOsStore((s) => s.history.cycles);
  const currentSessionPlan = useCoachOsStore((s) => s.currentSessionPlan);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [nSets, setNSets] = useState(DEFAULT_SETS);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const musclesOf = useMemo(
    () => (catalog ? buildMusclesOf(catalog) : null),
    [catalog],
  );

  // Conv #30 — mise en garde volume : l'exo ajouté (nSets séries) ferait-il
  // dépasser le plafond hebdo (V_max/MRV) d'un de ses muscles ? Base = séries
  // pondérées déjà engagées cette semaine (séances faites + séance en cours).
  const overshoot = useMemo(() => {
    if (picked === null || userState === null || musclesOf === null) return [];
    const cycleStart =
      cycles.find((c) => c.cycle_index === userState.cycle_index)?.start_date ??
      null;
    const weekly: Record<string, number> = {};
    for (const cov of computeCoverageThisWeek(
      userState,
      feedbacks,
      musclesOf,
      new Date(),
      cycleStart,
    )) {
      weekly[cov.muscle] = cov.sets;
    }
    if (currentSessionPlan !== null) {
      for (const item of currentSessionPlan.items) {
        const mm = musclesOf[item.exercise_id] ?? {};
        const n = item.sets.length;
        for (const [m, c] of Object.entries(mm)) {
          weekly[m] = (weekly[m] ?? 0) + c * n;
        }
      }
    }
    return addedVolumeOvershoot(picked.muscles, nSets, weekly, userState);
  }, [picked, nSets, userState, feedbacks, cycles, currentSessionPlan, musclesOf]);

  const results = useMemo<readonly Exercise[]>(() => {
    if (catalog === null) return [];
    // Bloc G (Conv #32) — favoris d'abord, par-dessus le tri/recherche habituel.
    const favoriteIds = new Set(userState?.favorite_exercise_ids ?? []);
    const q = normalize(query);
    const all = catalog.all();
    if (q.length === 0) {
      // Sans recherche, tri stable par nom puis favoris remontés en tête.
      const sorted = [...all].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr));
      return favoritesFirst(sorted, favoriteIds);
    }
    const matched = all.filter((ex) => {
      if (normalize(ex.nom_fr).includes(q)) return true;
      for (const syn of ex.synonymes) {
        if (normalize(syn).includes(q)) return true;
      }
      return false;
    });
    return favoritesFirst(matched, favoriteIds);
  }, [catalog, query, userState]);

  function close() {
    setQuery('');
    setPicked(null);
    setNSets(DEFAULT_SETS);
    setSubmitting(false);
    setServerError(null);
    onClose();
  }

  async function confirmAdd() {
    if (picked === null) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await engine.addExerciseToCurrentSession(picked.id, nSets);
      onAdded?.(picked.id);
      close();
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // 1.17 — pas de `if (!open) return null` ici : on laisse `<Sheet>` gérer son
  // cycle de vie (animation de fermeture comprise). Un early-return démontait
  // le volet instantanément et court-circuitait le slide-down.
  return (
    <Sheet open={open} onClose={close} title="Ajouter un exercice">
      <div className="flex flex-col gap-3">
        {picked === null ? (
          <>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                data-testid="add-exo-search"
                type="search"
                autoFocus
                placeholder="Rechercher un exercice…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sang-700/60"
              />
            </div>
            <ul className="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto pr-1">
              {results.length === 0 ? (
                <li className="px-2 py-4 text-center text-sm text-anthracite-400">
                  Aucun exercice trouvé. Tu peux le créer depuis le Catalogue.
                </li>
              ) : (
                // 1.17 (D1) — plus de `.slice(0, 50)` : le catalogue compte
                // ~138 exos, le cap masquait toute la 2e moitié quand on
                // parcourait sans recherche (« la liste ne va pas au bout »).
                results.map((ex) => {
                  const already = existingExerciseIds.has(ex.id);
                  return (
                    <li key={ex.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        data-testid={`add-exo-pick-${ex.id}`}
                        onClick={() => setPicked(ex)}
                        className="flex min-w-0 flex-1 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-left text-sm text-white transition hover:border-sang-700/50"
                      >
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate">{displayExerciseName(ex, brand)}</span>
                          {already ? (
                            // #7 — exo déjà en séance : ré-ajoutable (le doublon
                            // crée une 2e instance = des séries en plus, qui
                            // nourrissent le même plafond). Simple info, plus un blocage.
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-anthracite-400">
                              déjà dans la séance
                            </span>
                          ) : null}
                        </div>
                      </button>
                      {/* Bloc F (Conv #31) — œil de visu, zone sœur (pas imbriqué). */}
                      <ExerciseEyeButton exercise={ex} brand={brand} />
                    </li>
                  );
                })
              )}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div data-testid="add-exo-preview" className="rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white">{displayExerciseName(picked, brand)}</div>
                  <div className="mt-1 text-xs text-anthracite-300">
                    {patternLabel(picked.pattern)} · {chargeLabel(picked.charge)} ·{' '}
                    {extypeLabel(picked.type)}
                  </div>
                </div>
                {/* Bloc F (Conv #31) — œil de visu sur l'exo choisi. */}
                <ExerciseEyeButton exercise={picked} brand={brand} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wide text-anthracite-300">
                Nombre de séries
              </span>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-anthracite-700">
                <button
                  type="button"
                  data-testid="add-exo-sets-dec"
                  onClick={() => setNSets((n) => Math.max(1, n - 1))}
                  className="w-8 bg-anthracite-800 text-anthracite-200"
                >
                  −
                </button>
                <span
                  data-testid="add-exo-sets-value"
                  className="flex w-10 items-center justify-center bg-anthracite-900 text-sm font-semibold tabular-nums text-white"
                >
                  {nSets}
                </span>
                <button
                  type="button"
                  data-testid="add-exo-sets-inc"
                  onClick={() => setNSets((n) => Math.min(10, n + 1))}
                  className="w-8 bg-anthracite-800 text-anthracite-200"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-snug text-anthracite-400">
              Kotsh propose charge et reps à partir de ton Plafond. Tu peux les
              ajuster avant chaque série.
            </p>
            {overshoot.length > 0 ? (
              <p
                data-testid="add-exo-volume-warning"
                className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs leading-snug text-amber-200"
              >
                <strong className="text-amber-100">Volume élevé.</strong> Ces{' '}
                {nSets} séries poussent{' '}
                {overshoot.map((o) => muscleLabel(o.muscle)).join(', ')} au-dessus
                du volume conseillé cette semaine.
              </p>
            ) : null}
            {serverError !== null ? (
              <p data-testid="add-exo-error" className="text-sm text-sang-400">
                {serverError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setPicked(null)}>
                Retour
              </Button>
              <Button
                variant="primary"
                fullWidth
                data-testid="add-exo-confirm"
                onClick={() => void confirmAdd()}
                disabled={submitting}
              >
                {submitting
                  ? 'Ajout…'
                  : `Ajouter ${nSets} série${nSets > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
