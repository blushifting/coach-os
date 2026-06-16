/**
 * Bloc G (Conv #32) — « Modifier le programme » : édition du cycle EN COURS.
 *
 * Reprend l'esprit du récap d'onboarding (jours + exos), mais persiste
 * **chirurgicalement** sur `current_cycle_plan` (ajout / retrait / renommage),
 * SANS régénérer le plan → la progression (charges, e1RM, historique) est
 * conservée. On avertit mais on ne contraint pas : aucune validation
 * d'équilibre bloquante.
 */

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import type { Exercise } from '@/engine/models';
import { exercisePrimaires } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useDemoMode, useGymBrand } from '@/store/selectors';
import { displayExerciseName } from '@/lib/catalog-filter';
import { muscleLabel } from '@/lib/progress';
import { sessionDisplayName } from '@/lib/session-label';
import { favoritesFirst } from '@/lib/custom-session';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { ExerciseEyeButton } from '@/pages/catalogue/ExerciseEyeButton';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export default function EditCyclePage() {
  const navigate = useNavigate();
  const engine = useEngine();
  const catalog = useCoachOsStore((s) => s.catalog);
  const userState = useCoachOsStore((s) => s.userState);
  const demoActive = useDemoMode();
  const brand = useGymBrand() ?? undefined;
  const favoriteIds = useMemo(
    () => new Set(userState?.favorite_exercise_ids ?? []),
    [userState],
  );

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const plan = userState?.current_cycle_plan ?? null;

  // Garde : pas de cycle / catalog / ou démo → on rebondit sur le Programme.
  if (userState === null || plan === null || catalog === null || demoActive) {
    return <Navigate to="/programme" replace />;
  }

  async function commitRename(dayIndex: number) {
    setEditingDay(null);
    try {
      await engine.renameCycleDay(dayIndex, nameDraft);
    } catch {
      /* non bloquant */
    }
  }

  async function removeExo(dayIndex: number, slotIndex: number) {
    setBusy(true);
    try {
      await engine.removeExerciseFromCycleDay(dayIndex, slotIndex);
    } finally {
      setBusy(false);
    }
  }

  async function addExo(ex: Exercise) {
    if (pickerDay === null) return;
    setBusy(true);
    try {
      await engine.addExerciseToCycleDay(pickerDay, ex.id);
      setPickerDay(null);
      setQuery('');
    } finally {
      setBusy(false);
    }
  }

  const pickerResults = useMemo<readonly Exercise[]>(() => {
    if (catalog === null || pickerDay === null || plan === null) return [];
    const day = plan.days[pickerDay];
    const existing = new Set(day?.exercises.map((e) => e.exercise_id) ?? []);
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
  }, [catalog, pickerDay, query, plan, favoriteIds]);

  return (
    <div
      className="flex h-full flex-1 flex-col bg-anthracite-950"
      data-testid="edit-cycle-page"
    >
      <header
        className="flex items-center gap-2 border-b border-anthracite-800 px-3 py-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/profil')}
          data-testid="edit-cycle-back"
        >
          ← Profil
        </Button>
        <span className="font-display text-lg tracking-wide text-white">
          Modifier le programme
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-3">
        <p className="mb-3 rounded-lg border border-blue-800/40 bg-blue-950/30 px-3 py-2 text-xs leading-relaxed text-blue-200">
          Ajoute ou retire des exercices librement. Ta progression (charges,
          Plafonds, historique) est conservée. Tu peux modifier l'équilibre
          d'un jour sans contrainte.
        </p>

        <div className="flex flex-col gap-3">
          {plan.days.map((day, di) => {
            const nSets = day.exercises.reduce((a, e) => a + e.base_sets, 0);
            return (
              <Card key={di} className="flex flex-col gap-2" data-testid={`edit-day-${di}`}>
                <header className="flex items-center justify-between gap-2">
                  {editingDay === di ? (
                    <input
                      data-testid={`edit-day-name-${di}`}
                      autoFocus
                      value={nameDraft}
                      placeholder={sessionDisplayName(day)}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => void commitRename(di)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(di);
                        if (e.key === 'Escape') setEditingDay(null);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-anthracite-700 bg-anthracite-900 px-2 py-1 text-sm font-semibold text-white outline-none focus:border-sang-700/60"
                    />
                  ) : (
                    <button
                      type="button"
                      data-testid={`edit-day-rename-${di}`}
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
                  <span className="shrink-0 text-[11px] text-anthracite-300">
                    {day.exercises.length} exos · {nSets} séries
                  </span>
                </header>

                <ul className="flex flex-col gap-2">
                  {day.exercises.map((planned, pi) => {
                    if (!catalog.has(planned.exercise_id)) return null;
                    const ex = catalog.get(planned.exercise_id);
                    const primaires = exercisePrimaires(ex).map(muscleLabel).join(', ');
                    return (
                      <li
                        key={`${planned.exercise_id}-${pi}`}
                        data-testid={`edit-slot-${di}-${pi}`}
                        className="flex items-center gap-2.5 rounded-lg border border-anthracite-700 bg-anthracite-900 p-2"
                      >
                        <ChargeBadge charge={ex.charge} size={24} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-white">
                            {displayExerciseName(ex, brand)}
                          </span>
                          <span className="text-[11px] text-anthracite-300">
                            {planned.base_sets} séries · {primaires || '—'}
                          </span>
                        </div>
                        <ExerciseEyeButton exercise={ex} brand={brand} />
                        <button
                          type="button"
                          data-testid={`edit-remove-${di}-${pi}`}
                          disabled={busy}
                          onClick={() => void removeExo(di, pi)}
                          aria-label="Retirer du programme"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-anthracite-300 transition hover:border-sang-700 hover:text-white disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                  {day.exercises.length === 0 && (
                    <li className="rounded-lg border border-dashed border-anthracite-700 px-3 py-3 text-center text-xs text-anthracite-400">
                      Ce jour n'a plus d'exercice.
                    </li>
                  )}
                </ul>

                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  data-testid={`edit-add-${di}`}
                  onClick={() => {
                    setQuery('');
                    setPickerDay(di);
                  }}
                >
                  + Ajouter un exercice
                </Button>
              </Card>
            );
          })}
        </div>
      </main>

      <footer
        className="border-t border-anthracite-800 bg-anthracite-950 p-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <Button
          variant="primary"
          fullWidth
          data-testid="edit-cycle-done"
          onClick={() => navigate('/profil')}
        >
          Terminé
        </Button>
      </footer>

      <Sheet
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        title="Ajouter un exercice"
      >
        <div className="flex flex-col gap-3">
          <input
            data-testid="edit-add-search"
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
                    data-testid={`edit-pick-${ex.id}`}
                    disabled={busy}
                    onClick={() => void addExo(ex)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-left text-sm text-white transition hover:border-sang-700/50 disabled:opacity-50"
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
    </div>
  );
}
