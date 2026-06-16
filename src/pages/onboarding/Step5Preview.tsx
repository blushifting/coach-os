/**
 * Étape 5 de l'onboarding : aperçu **éditable** du programme (Conv #11b, refondu
 * Bloc G Conv #32).
 *
 * Composant **contrôlé** : il affiche le `template` (déjà effectif) et remonte
 * chaque édition au parent via callbacks (`onSwap`/`onAdd`/`onRemove`/
 * `onRename`). Le parent (`OnboardingPage`) tient un snapshot éditable unique et
 * le persiste tel quel à la finalisation — plus de réconciliation d'index
 * fragile entre swaps et ajouts/retraits.
 *
 * L'utilisateur peut : remplacer un exo par une variante, **ajouter** un exo
 * (assistant favoris d'abord), **retirer** un exo, **renommer** la séance.
 * Le panneau Volume hebdo et la durée estimée se recalculent en direct et font
 * office de garde-fou (un retrait fait baisser le volume du muscle, visible).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import type { Catalog } from '@/engine/catalog';
import { exercisePrimaires, type Exercise, type WeeklyTemplate } from '@/engine/models';
import {
  analyzeProgramTension,
  estimateDayDurationMinutes,
  SESSION_DURATION_WARN_MIN,
  weeklyVolumeByMuscle,
  type ProgramTension,
} from '@/lib/onboarding-preview';
import { alternativeVariantsFor } from '@/lib/calibration';
import { displayExerciseName } from '@/lib/catalog-filter';
import { favoritesFirst } from '@/lib/custom-session';
import { useCoachOsStore } from '@/store';
import { useGymBrand } from '@/store/selectors';
import { cn } from '@/lib/cn';
import { muscleLabel } from '@/lib/progress';
import { sessionDisplayName } from '@/lib/session-label';
import { ExercisePhotoPopin } from '@/pages/catalogue/ExercisePhotoPopin';
import { photosFor } from '@/data/exercise-photos';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { ExerciseEyeButton } from '@/pages/catalogue/ExerciseEyeButton';
import { VariantPickerSheet } from '@/components/VariantPickerSheet';

interface Step5Props {
  readonly template: WeeklyTemplate | null;
  readonly blocking: readonly string[];
  readonly catalog: Catalog | null;
  readonly equipment: ReadonlySet<string>;
  /** Conv #23 — marque déclarée dans le draft (avant persistance du profil). */
  readonly gymBrand?: import('@/engine/models').GymBrand;
  readonly onSwap: (dayIndex: number, slotIndex: number, newExerciseId: string) => void;
  readonly onAdd: (dayIndex: number, exerciseId: string) => void;
  readonly onRemove: (dayIndex: number, slotIndex: number) => void;
  readonly onRename: (dayIndex: number, name: string) => void;
}

interface SlotPickerState {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly currentExerciseId: string;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function Step5Preview({
  template,
  blocking,
  catalog,
  equipment,
  gymBrand,
  onSwap,
  onAdd,
  onRemove,
  onRename,
}: Step5Props) {
  const [picker, setPicker] = useState<SlotPickerState | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [pedagogyOpen, setPedagogyOpen] = useState(false);
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const storeBrand = useGymBrand();
  const favoriteIds = useMemo(
    () => new Set(useCoachOsStore.getState().userState?.favorite_exercise_ids ?? []),
    [],
  );
  const brand = gymBrand ?? storeBrand ?? undefined;

  // Récap volume hebdo par muscle primaire — calculé sur le plan effectif.
  const volumeByMuscle = useMemo<Record<string, number>>(() => {
    if (template === null || catalog === null) return {};
    return weeklyVolumeByMuscle(template, catalog);
  }, [template, catalog]);

  const tension = useMemo<ProgramTension | null>(() => {
    if (template === null || catalog === null) return null;
    return analyzeProgramTension(template, catalog);
  }, [template, catalog]);

  const pickerAlternatives = useMemo(() => {
    if (picker === null || catalog === null) return [];
    return alternativeVariantsFor(picker.currentExerciseId, equipment, catalog, {
      expand: expanded,
    });
  }, [picker, catalog, equipment, expanded]);

  const addResults = useMemo<readonly Exercise[]>(() => {
    if (catalog === null || addDay === null || template === null) return [];
    const existing = new Set(
      template.days[addDay]?.exercises.map((e) => e.exercise_id) ?? [],
    );
    const q = normalize(addQuery);
    const all = catalog.all().filter((ex) => !existing.has(ex.id));
    const matched =
      q.length === 0
        ? [...all].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr))
        : all.filter((ex) => {
            if (normalize(ex.nom_fr).includes(q)) return true;
            return ex.synonymes.some((syn) => normalize(syn).includes(q));
          });
    return favoritesFirst(matched, favoriteIds);
  }, [catalog, addDay, addQuery, template, favoriteIds]);

  if (blocking.length > 0) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="step5-blocking">
        <h1 className="text-xl font-semibold text-white">Programme non compatible</h1>
        <p className="text-sm text-anthracite-300">
          Ton équipement ne couvre pas tous les exercices de ce programme :
        </p>
        <Card className="border-sang-700/60 bg-sang-900/20">
          <ul className="flex flex-col gap-1 text-sm text-sang-500">
            {blocking.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </Card>
        <p className="text-xs text-anthracite-300">
          Reviens à l'étape précédente pour choisir un autre programme ou
          une sélection d'exercices sur mesure.
        </p>
      </div>
    );
  }

  if (template === null || catalog === null) {
    return (
      <div className="p-4" data-testid="step5-loading">
        <p className="text-sm text-anthracite-300">Génération du programme…</p>
      </div>
    );
  }

  function openPicker(dayIndex: number, slotIndex: number, currentExerciseId: string) {
    setPicker({ dayIndex, slotIndex, currentExerciseId });
  }

  function handlePick(newExerciseId: string) {
    if (picker === null) return;
    onSwap(picker.dayIndex, picker.slotIndex, newExerciseId);
    setPicker(null);
  }

  function handleAdd(ex: Exercise) {
    if (addDay === null) return;
    onAdd(addDay, ex.id);
    setAddDay(null);
    setAddQuery('');
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="step5-preview">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Ton programme
        </h1>
        <p className="text-sm leading-relaxed text-anthracite-300">
          Voici les séances générées d'après tes choix. Touche un exercice pour
          le remplacer, retire ou ajoute ce que tu veux, renomme une séance.
        </p>
      </header>

      <VolumeRecap volumeByMuscle={volumeByMuscle} />

      {tension !== null && <TensionPanel tension={tension} />}

      <PedagogyPanel open={pedagogyOpen} onToggle={() => setPedagogyOpen((v) => !v)} />

      <div className="flex flex-col gap-3">
        {template.days.map((day, di) => {
          const dayMin = estimateDayDurationMinutes(day, catalog);
          const nSets = day.exercises.reduce((acc, e) => acc + e.base_sets, 0);
          return (
            <Card key={di} className="flex flex-col gap-2" data-testid={`day-card-${di}`}>
              <header className="flex items-center justify-between gap-2">
                {editingDay === di ? (
                  <input
                    data-testid={`step5-rename-${di}`}
                    autoFocus
                    value={nameDraft}
                    placeholder={sessionDisplayName(day)}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      onRename(di, nameDraft);
                      setEditingDay(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename(di, nameDraft);
                        setEditingDay(null);
                      }
                      if (e.key === 'Escape') setEditingDay(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-anthracite-700 bg-anthracite-900 px-2 py-1 text-sm font-semibold text-white outline-none focus:border-sang-700/60"
                  />
                ) : (
                  <button
                    type="button"
                    data-testid={`btn-rename-${di}`}
                    onClick={() => {
                      setNameDraft(day.custom_name ?? '');
                      setEditingDay(di);
                    }}
                    className="flex items-center gap-2 text-sm font-semibold text-white"
                  >
                    {sessionDisplayName(day)}
                    <span aria-hidden className="text-anthracite-400">
                      ✎
                    </span>
                  </button>
                )}
                <span
                  className="shrink-0 text-[11px] text-anthracite-300"
                  data-testid={`day-duration-${di}`}
                >
                  {day.exercises.length} exos · {nSets} séries · ~{Math.round(dayMin)} min
                </span>
              </header>

              {day.target_muscles_focus.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {day.target_muscles_focus.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-anthracite-700 px-2 py-0.5 text-[10px] text-anthracite-100"
                    >
                      {muscleLabel(m)}
                    </span>
                  ))}
                </div>
              )}

              <ul className="flex flex-col gap-2">
                {day.exercises.map((planned, pi) => {
                  let exNomFr = planned.exercise_id;
                  let charge: import('@/engine/models').ChargeType | null = null;
                  let primaires: readonly string[] = [];
                  try {
                    const ex = catalog!.get(planned.exercise_id);
                    exNomFr = displayExerciseName(ex, brand);
                    charge = ex.charge;
                    primaires = exercisePrimaires(ex);
                  } catch {
                    /* exo inconnu — on garde l'id brut */
                  }
                  return (
                    <li key={`${di}-${pi}-${planned.exercise_id}`} data-testid={`slot-${di}-${pi}`}>
                      <div className="flex items-center gap-2.5 rounded-lg border border-anthracite-700 bg-anthracite-900 p-2">
                        {charge !== null && <ChargeBadge charge={charge} size={24} />}
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-medium text-white">{exNomFr}</span>
                          <span className="text-[11px] text-anthracite-300">
                            {planned.base_sets} séries ·{' '}
                            {primaires.length > 0
                              ? primaires.map(muscleLabel).join(', ')
                              : '—'}
                          </span>
                        </div>
                        {photosFor(planned.exercise_id) !== null && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({ id: planned.exercise_id, title: exNomFr })
                            }
                            aria-label="Voir le mouvement"
                            data-testid={`btn-preview-${di}-${pi}`}
                            title="Voir le mouvement"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-anthracite-300 transition hover:border-sang-700 hover:text-white"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openPicker(di, pi, planned.exercise_id)}
                          data-testid={`btn-variants-${di}-${pi}`}
                        >
                          Variantes
                        </Button>
                        <button
                          type="button"
                          data-testid={`btn-remove-${di}-${pi}`}
                          onClick={() => onRemove(di, pi)}
                          aria-label="Retirer cet exercice"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-anthracite-300 transition hover:border-sang-700 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
                {day.exercises.length === 0 && (
                  <li className="rounded-lg border border-dashed border-anthracite-700 px-3 py-3 text-center text-xs text-anthracite-400">
                    Aucun exercice — ajoute-en un.
                  </li>
                )}
              </ul>

              <Button
                variant="ghost"
                size="sm"
                fullWidth
                data-testid={`btn-add-${di}`}
                onClick={() => {
                  setAddQuery('');
                  setAddDay(di);
                }}
              >
                + Ajouter un exercice
              </Button>
            </Card>
          );
        })}
      </div>

      {picker !== null && (
        <VariantPickerSheet
          open={picker !== null}
          currentExerciseId={picker.currentExerciseId}
          alternatives={pickerAlternatives}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
          onPick={handlePick}
          onClose={() => setPicker(null)}
          title="Choisir une variante"
          brandOverride={brand}
        />
      )}

      <Sheet open={addDay !== null} onClose={() => setAddDay(null)} title="Ajouter un exercice">
        <div className="flex flex-col gap-3">
          <input
            data-testid="step5-add-search"
            type="search"
            autoFocus
            placeholder="Rechercher un exercice…"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
          />
          <ul className="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto pr-1">
            {addResults.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-anthracite-400">
                Aucun exercice trouvé.
              </li>
            ) : (
              addResults.map((ex) => (
                <li key={ex.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    data-testid={`step5-add-pick-${ex.id}`}
                    onClick={() => handleAdd(ex)}
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
        </div>
      </Sheet>

      {preview !== null && (
        <ExercisePhotoPopin
          exerciseId={preview.id}
          title={preview.title}
          open={true}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Sous-composants
// =============================================================================

function TensionPanel({ tension }: { readonly tension: ProgramTension }) {
  const avg = Math.round(tension.avgMin);
  const max = Math.round(tension.maxMin);
  return (
    <Card
      data-testid="tension-panel"
      className={cn(
        'flex flex-col gap-2',
        tension.tooLong && 'border-sang-700/50 bg-sang-900/15',
      )}
    >
      <header className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-anthracite-300">
          Durée estimée par séance
        </span>
        <span
          className="font-display text-lg tabular-nums text-white"
          data-testid="tension-avg"
        >
          ~{avg} min
        </span>
      </header>
      {tension.tooLong ? (
        <>
          <p className="text-xs leading-relaxed text-sang-200">
            Au moins une séance dépasse {SESSION_DURATION_WARN_MIN} min
            (max ~{max} min). Pour rester dans tes créneaux, tu peux :
          </p>
          <ul className="ml-4 flex list-disc flex-col gap-1 text-xs leading-relaxed text-anthracite-100">
            <li>
              <span className="font-medium text-white">Plus de séances par
              semaine</span>.
            </li>
            <li>
              <span className="font-medium text-white">Moins de muscles
              cibles</span>.
            </li>
            <li>
              <span className="font-medium text-white">Accepter des séances
              plus longues</span> et continuer comme prévu.
            </li>
          </ul>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-anthracite-300">
          La séance la plus chargée tient en {max} min max. Cohérent avec
          ton rythme de séances par semaine.
        </p>
      )}
    </Card>
  );
}

function VolumeRecap({ volumeByMuscle }: { readonly volumeByMuscle: Record<string, number> }) {
  const entries = Object.entries(volumeByMuscle)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2" data-testid="volume-recap">
      <header className="text-xs uppercase tracking-wide text-anthracite-300">
        Volume hebdomadaire par muscle (semaine 1)
      </header>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-anthracite-100">
        {entries.map(([muscle, n]) => (
          <li key={muscle} className="flex justify-between">
            <span>{muscleLabel(muscle)}</span>
            <span className="tabular-nums text-anthracite-300">{n} séries</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PedagogyPanel({
  open,
  onToggle,
}: {
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <Card
      className="flex flex-col gap-2 border-l-2 border-l-violet-700/50"
      data-testid="pedagogy-panel"
    >
      <button
        type="button"
        onClick={onToggle}
        data-testid="btn-pedagogy-toggle"
        className="flex items-center justify-between text-left text-xs uppercase tracking-wide text-violet-300 hover:text-violet-200"
      >
        <span>Comment ça marche ?</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-anthracite-100">
          <p>
            Chaque séance cible plusieurs muscles avec un nombre de séries
            calculé pour rester dans une zone de progression efficace : ni
            trop peu, ni trop. À chaque série, tu notes ta{' '}
            <strong>Réserve</strong> — le nombre de reps que tu aurais encore
            pu faire — et Kotsh ajuste les charges et le Volume hebdo pour
            la suite.
          </p>
          <p>
            Le Cycle dure 5 semaines : 4 semaines où on monte
            progressivement en volume, puis 1 semaine de Récupération plus
            légère pour laisser la fatigue redescendre. Cette Récupération
            n'est pas un cadeau, c'est ce qui fait que ton corps
            progresse.
          </p>
          <p>
            Tu peux à tout moment remplacer un exercice pendant une séance — par
            exemple si la machine est prise. Kotsh reporte ce qui n'a pas
            été fait sur les autres séances de la semaine quand c'est
            possible.
          </p>
        </div>
      )}
    </Card>
  );
}
