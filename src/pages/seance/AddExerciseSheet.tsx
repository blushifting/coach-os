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
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';
import { cn } from '@/lib/cn';

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
  /** Ids d'exos déjà présents dans la séance — affichés mais grisés. */
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
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [nSets, setNSets] = useState(DEFAULT_SETS);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const results = useMemo<readonly Exercise[]>(() => {
    if (catalog === null) return [];
    const q = normalize(query);
    const all = catalog.all();
    if (q.length === 0) {
      // Sans recherche, on remonte d'abord les customs (souvent rares, on
      // veut qu'ils soient découvrables), puis le défaut. Tri stable par
      // nom dans chaque groupe.
      return [...all].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr));
    }
    return all.filter((ex) => {
      if (normalize(ex.nom_fr).includes(q)) return true;
      for (const syn of ex.synonymes) {
        if (normalize(syn).includes(q)) return true;
      }
      return false;
    });
  }, [catalog, query]);

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

  if (!open) return null;

  return (
    <Sheet open={open} onClose={close} title="Ajouter un exercice">
      <div className="flex max-h-[75dvh] flex-col gap-3">
        {picked === null ? (
          <>
            <input
              data-testid="add-exo-search"
              type="search"
              autoFocus
              placeholder="Rechercher (ex. curl, leg press, dips…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
              {results.length === 0 ? (
                <li className="px-2 py-4 text-center text-sm text-anthracite-400">
                  Aucun exo trouvé. Crée-le depuis le Catalogue.
                </li>
              ) : (
                results.slice(0, 50).map((ex) => {
                  const already = existingExerciseIds.has(ex.id);
                  return (
                    <li key={ex.id}>
                      <button
                        type="button"
                        data-testid={`add-exo-pick-${ex.id}`}
                        disabled={already}
                        onClick={() => setPicked(ex)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                          already
                            ? 'cursor-not-allowed border-anthracite-800 bg-anthracite-900/40 text-anthracite-500'
                            : 'border-anthracite-700 bg-anthracite-900 text-white hover:border-sang-700/50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{displayExerciseName(ex, brand)}</span>
                          {already ? (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-anthracite-400">
                              déjà dans la séance
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div data-testid="add-exo-preview" className="rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm">
              <div className="font-semibold text-white">{displayExerciseName(picked, brand)}</div>
              <div className="mt-1 text-xs text-anthracite-300">
                Pattern {picked.pattern} · {picked.charge} ·{' '}
                {picked.type === 'compound' ? 'polyarticulaire' : 'isolation'}
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
              L'app pose une charge et un nombre de reps prescrits à partir de
              ton plafond connu (ou d'une estimation si tu n'as jamais fait
              cet exo). Tu peux les ajuster avant de cocher chaque série.
            </p>
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
                {submitting ? 'Ajout…' : `Ajouter ${nSets} séries`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
