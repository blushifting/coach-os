/**
 * Bloc G (Conv #32) — Création d'une séance custom (hors-programme).
 *
 * Entrée depuis le calendrier (`PlanDaySheet`, jour libre). On choisit un preset
 * (paquet de muscles) qui pré-remplit une base via le moteur de sélection
 * (favoris d'abord, volume plafonné par muscle), on renomme, on ajuste
 * (ajout/retrait, œil de visu), puis on démarre (aujourd'hui) ou on programme
 * (jour futur). Le preset « Vide » part d'une feuille blanche.
 *
 * Alertes non bloquantes : muscle déjà travaillé la veille, et dépassement du
 * volume hebdo conseillé par la séance entière.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import type { Catalog } from '@/engine/catalog';
import type { Exercise } from '@/engine/models';
import { exercisePrimaires } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useGymBrand, useToday } from '@/store/selectors';
import { displayExerciseName } from '@/lib/catalog-filter';
import { addDays, dateKey, parseDateKey } from '@/lib/dashboard';
import {
  addedVolumeOvershoot,
  buildMusclesOf,
  computeCoverageThisWeek,
  muscleLabel,
} from '@/lib/progress';
import {
  SESSION_PRESETS,
  buildCustomSessionSlots,
  favoritesFirst,
  musclesTrainedOn,
  presetById,
  type CustomSlot,
} from '@/lib/custom-session';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { ExerciseEyeButton } from '@/pages/catalogue/ExerciseEyeButton';
import { SetsStepper } from '@/components/SetsStepper';
import { cn } from '@/lib/cn';

const DEFAULT_ADDED_SETS = 3;

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

interface CreateSessionSheetProps {
  readonly open: boolean;
  readonly isToday: boolean;
  readonly seanceDate: string;
  readonly catalog: Catalog | null;
  readonly onClose: () => void;
  /**
   * Appelé après une séance PROGRAMMÉE (jour futur). Sert à fermer aussi la
   * sheet parente (PlanDaySheet) pour revenir au calendrier — qui affiche
   * désormais le jour comme « programmé » — au lieu de rester sur le choix de
   * séance (où l'on pourrait écraser la séance libre par erreur).
   */
  readonly onPlanned?: () => void;
}

export function CreateSessionSheet({
  open,
  isToday,
  seanceDate,
  catalog,
  onClose,
  onPlanned,
}: CreateSessionSheetProps) {
  const engine = useEngine();
  const navigate = useNavigate();
  const brand = useGymBrand() ?? undefined;
  const userState = useCoachOsStore((s) => s.userState);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const sessions = useCoachOsStore((s) => s.history.sessions);
  const cycles = useCoachOsStore((s) => s.history.cycles);
  const today = useToday();

  const [presetId, setPresetId] = useState<string | null>(null);
  const [slots, setSlots] = useState<CustomSlot[]>([]);
  const [name, setName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const musclesOf = useMemo(() => (catalog ? buildMusclesOf(catalog) : null), [catalog]);
  const favoriteIds = useMemo(
    () => new Set(userState?.favorite_exercise_ids ?? []),
    [userState],
  );

  function selectPreset(id: string) {
    const preset = presetById(id);
    setPresetId(id);
    setError(null);
    if (preset === null || userState === null || catalog === null) {
      setSlots([]);
      setName(preset?.label ?? '');
      return;
    }
    setSlots(buildCustomSessionSlots(preset, userState, catalog));
    setName(preset.label);
  }

  // Muscles primaires effectivement visés par la base courante (après édits).
  const sessionMuscles = useMemo(() => {
    const set = new Set<string>();
    if (musclesOf === null) return set;
    for (const slot of slots) {
      for (const [m, c] of Object.entries(musclesOf[slot.exerciseId] ?? {})) {
        if (c >= 1) set.add(m);
      }
    }
    return set;
  }, [slots, musclesOf]);

  // Volume hebdo déjà engagé (séances faites cette semaine).
  const weeklyBase = useMemo<Record<string, number>>(() => {
    if (userState === null || musclesOf === null) return {};
    const cycleStart =
      cycles.find((c) => c.cycle_index === userState.cycle_index)?.start_date ?? null;
    const out: Record<string, number> = {};
    // Conv #66 — `today` ancré sur la démo si active (cf. `useToday`).
    for (const cov of computeCoverageThisWeek(
      userState,
      feedbacks,
      musclesOf,
      today,
      cycleStart,
    )) {
      out[cov.muscle] = cov.sets;
    }
    return out;
  }, [userState, feedbacks, cycles, musclesOf, today]);

  // Alerte « travaillé la veille » : muscles de la base déjà tapés le jour d'avant.
  const veilleMuscles = useMemo<string[]>(() => {
    if (musclesOf === null) return [];
    const prev = dateKey(addDays(parseDateKey(seanceDate), -1));
    const trained = musclesTrainedOn(prev, feedbacks, sessions, musclesOf);
    return [...sessionMuscles].filter((m) => trained.has(m));
  }, [sessionMuscles, seanceDate, feedbacks, sessions, musclesOf]);

  // Alerte « volume hebdo dépassé » par la séance entière.
  const overshoot = useMemo(() => {
    if (userState === null || musclesOf === null || slots.length === 0) return [];
    const addedWeighted: Record<string, number> = {};
    for (const slot of slots) {
      for (const [m, c] of Object.entries(musclesOf[slot.exerciseId] ?? {})) {
        addedWeighted[m] = (addedWeighted[m] ?? 0) + c * slot.nSets;
      }
    }
    return addedVolumeOvershoot(addedWeighted, 1, weeklyBase, userState);
  }, [slots, weeklyBase, userState, musclesOf]);

  const totalSets = slots.reduce((a, s) => a + s.nSets, 0);
  const estMin = Math.round(totalSets * 4.3);

  const pickerResults = useMemo<readonly Exercise[]>(() => {
    if (catalog === null) return [];
    const existing = new Set(slots.map((s) => s.exerciseId));
    const q = normalize(query);
    const all = catalog.all().filter((ex) => !existing.has(ex.id));
    const matched =
      q.length === 0
        ? [...all].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr))
        : all.filter((ex) => {
            if (normalize(ex.nom_fr).includes(q)) return true;
            return ex.synonymes.some((syn) => normalize(syn).includes(q));
          });
    return favoritesFirst(matched, favoriteIds);
  }, [catalog, query, slots, favoriteIds]);

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }
  function setSlotSets(index: number, n: number) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, nSets: n } : s)));
  }
  function addExercise(ex: Exercise) {
    setSlots((prev) =>
      prev.some((s) => s.exerciseId === ex.id)
        ? prev
        : [...prev, { exerciseId: ex.id, nSets: DEFAULT_ADDED_SETS }],
    );
    setQuery('');
    setPickerOpen(false);
  }

  function close() {
    setPresetId(null);
    setSlots([]);
    setName('');
    setPickerOpen(false);
    setQuery('');
    setSubmitting(false);
    setError(null);
    onClose();
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const args = { seanceDate, slots, displayName: name };
      if (isToday) {
        await engine.startCustomSession(args);
        close();
        navigate('/seance/runner');
      } else {
        await engine.planCustomSessionForDay(args);
        close();
        // Ferme la PlanDaySheet parente → retour au calendrier (jour désormais
        // « programmé »), pas au choix de séance.
        onPlanned?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Créer une séance">
      {pickerOpen ? (
        <div className="flex flex-col gap-3">
          <input
            data-testid="create-add-search"
            type="search"
            autoFocus
            placeholder="Rechercher un exercice…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
          />
          <ul className="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto pr-1">
            {pickerResults.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-anthracite-400">
                Aucun exercice trouvé.
              </li>
            ) : (
              pickerResults.map((ex) => (
                <li key={ex.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    data-testid={`create-pick-${ex.id}`}
                    onClick={() => addExercise(ex)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-left text-sm text-white transition hover:border-sang-700/50"
                  >
                    {favoriteIds.has(ex.id) && (
                      <span aria-hidden className="shrink-0" style={{ color: '#d4a052' }}>
                        ★
                      </span>
                    )}
                    <span className="truncate">{displayExerciseName(ex, brand)}</span>
                  </button>
                  <ExerciseEyeButton exercise={ex} brand={brand} />
                </li>
              ))
            )}
          </ul>
          <Button variant="ghost" fullWidth onClick={() => setPickerOpen(false)}>
            Retour
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-anthracite-300">
              Quel groupe musculaire&nbsp;?
            </span>
            <div className="flex flex-wrap gap-2">
              {SESSION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`preset-${p.id}`}
                  onClick={() => selectPreset(p.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    presetId === p.id
                      ? 'border-sang-700 bg-sang-900/30 text-white'
                      : 'border-anthracite-700 bg-anthracite-900 text-anthracite-200 hover:border-sang-700/50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {presetId === null ? (
            <p className="text-justify text-sm leading-relaxed text-anthracite-400">
              Choisis un point de départ&nbsp;: un groupe musculaire, corps entier, ou une
              séance libre à composer toi-même.
            </p>
          ) : (
            <>
              {/* Bloc K (Conv #36) — « Séance » est le préfixe UI incompressible ;
                  le champ ne contient que le token (« Pecs », « Libre »…), pour se
                  lire comme les autres noms de séance. */}
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm font-semibold text-anthracite-300">
                  Séance
                </span>
                <input
                  data-testid="create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Nom de la séance"
                  className="min-w-0 flex-1 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-sang-700/60"
                />
                <i className="shrink-0 text-anthracite-400" aria-hidden>
                  ✎
                </i>
              </div>
              <p className="-mt-2 text-xs text-anthracite-400">
                {slots.length === 0
                  ? "Aucun exercice — pars d'une feuille blanche."
                  : `${slots.length} exercices · ${totalSets} séries · ~${estMin} min`}
              </p>

              {veilleMuscles.length > 0 && (
                <p
                  data-testid="create-warn-veille"
                  className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-justify text-xs leading-snug text-amber-200"
                >
                  Tu as travaillé{' '}
                  <strong className="text-amber-100">
                    {veilleMuscles.map(muscleLabel).join(', ')}
                  </strong>{' '}
                  hier. Travailler un autre groupe musculaire leur laisserait le temps de
                  récupérer — tu peux quand même continuer.
                </p>
              )}

              {overshoot.length > 0 && (
                <p
                  data-testid="create-warn-hebdo"
                  className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-justify text-xs leading-snug text-amber-200"
                >
                  <strong className="text-amber-100">Volume élevé.</strong> Ces séries
                  poussent {overshoot.map((o) => muscleLabel(o.muscle)).join(', ')}{' '}
                  au-dessus du volume hebdomadaire conseillé. Tu peux quand même continuer,
                  pense à bien récupérer.
                </p>
              )}

              <ul className="flex flex-col gap-2" data-testid="create-slots">
                {slots.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-anthracite-700 px-3 py-4 text-center text-sm text-anthracite-400">
                    Ajoute les exercices que tu veux faire.
                  </li>
                ) : (
                  slots.map((slot, i) => {
                    if (catalog === null || !catalog.has(slot.exerciseId)) return null;
                    const ex = catalog.get(slot.exerciseId);
                    const primaires = exercisePrimaires(ex).map(muscleLabel).join(', ');
                    return (
                      <li
                        key={`${slot.exerciseId}-${i}`}
                        data-testid={`create-slot-${slot.exerciseId}`}
                        className="flex items-center gap-2.5 rounded-lg border border-anthracite-700 bg-anthracite-900 p-2"
                      >
                        <ChargeBadge charge={ex.charge} size={24} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate text-sm font-medium text-white">
                            {displayExerciseName(ex, brand)}
                            {favoriteIds.has(ex.id) && (
                              <span aria-hidden style={{ color: '#d4a052' }} className="ml-1">
                                ★
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-anthracite-300">
                            <SetsStepper
                              value={slot.nSets}
                              onChange={(n) => setSlotSets(i, n)}
                              testid={`create-sets-${slot.exerciseId}`}
                              label={displayExerciseName(ex, brand)}
                            />
                            <span className="truncate">séries · {primaires || '—'}</span>
                          </div>
                        </div>
                        <ExerciseEyeButton exercise={ex} brand={brand} />
                        <button
                          type="button"
                          data-testid={`create-remove-${slot.exerciseId}`}
                          onClick={() => removeSlot(i)}
                          aria-label="Retirer"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-anthracite-300 transition hover:border-sang-700 hover:text-white"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              <Button
                variant="ghost"
                fullWidth
                data-testid="create-add-exo"
                onClick={() => setPickerOpen(true)}
              >
                + Ajouter un exercice
              </Button>

              {error !== null && (
                <p role="alert" className="text-sm text-sang-400">
                  {error}
                </p>
              )}

              <Button
                variant="primary"
                fullWidth
                data-testid="create-confirm"
                onClick={() => void confirm()}
                disabled={submitting}
              >
                {submitting
                  ? '…'
                  : isToday
                    ? 'Démarrer maintenant'
                    : 'Programmer pour ce jour'}
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * Bouton + sheet de création, à poser dans le bloc « jour libre » de
 * `PlanDaySheet`. Encapsule l'état d'ouverture.
 */
export function CreateSessionButton({
  isToday,
  seanceDate,
  catalog,
  onPlanned,
}: {
  readonly isToday: boolean;
  readonly seanceDate: string;
  readonly catalog: Catalog | null;
  /** Fermeture de la sheet parente après une séance programmée (jour futur). */
  readonly onPlanned?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="md"
        fullWidth
        data-testid="btn-create-session"
        onClick={() => setOpen(true)}
        className="mt-1"
      >
        + Créer une séance
      </Button>
      <CreateSessionSheet
        open={open}
        isToday={isToday}
        seanceDate={seanceDate}
        catalog={catalog}
        onClose={() => setOpen(false)}
        onPlanned={onPlanned}
      />
    </>
  );
}
