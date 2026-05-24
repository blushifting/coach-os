import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { useEngine } from '@/hooks/useEngine';
import { getDb } from '@/db';
import type { SessionRow } from '@/db/schema';
import { dateKey, type CalendarDay } from '@/lib/dashboard';
import { muscleLabel } from '@/lib/progress';
import { cn } from '@/lib/cn';
import { useCoachOsStore } from '@/store';
import {
  detectPeriodicity,
  dayOfWeekLabel,
  suggestionForDay,
  type DayOfWeek,
  type PeriodicitySuggestion,
} from '@/lib/periodicity';
import type { Catalog } from '@/engine/catalog';
import type {
  SessionFeedback,
  SessionPlan,
  SetFeedback,
  WeeklyTemplate,
} from '@/engine/models';
import { kgUnitLabelShort } from '@/lib/catalog-filter';
import { estimateDayDurationMinutes } from '@/lib/onboarding-preview';

interface PlanDaySheetProps {
  readonly open: boolean;
  readonly day: CalendarDay | null;
  readonly cyclePlan: WeeklyTemplate | null;
  readonly onClose: () => void;
}

/**
 * Sheet "Voir / planifier la séance de ce jour" — Conv #10d.
 *
 * Distingue planification (jour futur ou aujourd'hui) du démarrage effectif :
 *  - **free-future** (futur) : choisir une séance + bouton "Programmer pour ce jour".
 *  - **free-future** (aujourd'hui) : choisir une séance + "Programmer et commencer".
 *  - **planned** (aujourd'hui) : preview des exos + bouton "Démarrer la séance".
 *  - **planned** (futur) : preview read-only + bouton "Annuler la séance".
 *  - **planned** (passé non fait) : message "Non faite" + "Annuler".
 *  - **completed / skipped / rest-past** : message d'état, pas d'action.
 *
 * Le démarrage est verrouillé hors-jour : impossible d'avancer une séance
 * planifiée si la date ne correspond pas à aujourd'hui (cf. `loadPlannedSessionForRunner`).
 */
export function PlanDaySheet({ open, day, cyclePlan, onClose }: PlanDaySheetProps) {
  const engine = useEngine();
  const navigate = useNavigate();
  const catalog = useCoachOsStore((s) => s.catalog);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const sessions = useCoachOsStore((s) => s.history.sessions);
  const userState = useCoachOsStore((s) => s.userState);
  const [pending, setPending] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [plannedSession, setPlannedSession] = useState<SessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Conv #14b-2 — feedback du jour pour status='completed' (mini-bilan inline).
  const completedFeedback = useMemo(() => {
    if (day === null || day.status !== 'completed') return null;
    return feedbacks.find((f) => f.feedback.seance_date === day.date) ?? null;
  }, [day, feedbacks]);

  // Conv #14b-4 — suggestion de périodicité (jour dominant pour une séance
  // récurrente). Ne s'affiche que sur les cases `free-future`.
  const periodicitySuggestion = useMemo(() => {
    if (day === null) return null;
    const suggestions = detectPeriodicity(feedbacks);
    return suggestionForDay(day, suggestions);
  }, [day, feedbacks]);

  // Conv #15 vague 2 — suggestion de variation de séance : si Alex a fait
  // "Full A" hier, on suggère "Full B" puis "Full C" plutôt qu'un nouveau
  // "Full A". Logic : prend le label de la dernière séance dans les 7j,
  // trouve son index dans `current_cycle_plan.days`, suggère le day suivant
  // (cyclique).
  //
  // Conv #18 — on inclut aussi les sessions `planned` (séance prévue mais
  // pas encore faite) : si tu planifies Full B mardi puis tu vas regarder
  // jeudi, on doit te suggérer Full C, pas Full B encore une fois.
  const variationSuggestion = useMemo(() => {
    const cyclePlan = userState?.current_cycle_plan ?? null;
    if (cyclePlan === null || day === null) return null;
    const dayDate = new Date(day.date + 'T00:00:00');
    let latest: { date: string; label: string } | null = null;
    function consider(date: string, label: string) {
      if (date >= day!.date) return;
      const diffDays =
        (dayDate.getTime() - new Date(date + 'T00:00:00').getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffDays > 7) return;
      if (latest === null || date > latest.date) {
        latest = { date, label };
      }
    }
    for (const fb of feedbacks) {
      consider(fb.feedback.seance_date, fb.feedback.label);
    }
    for (const s of sessions) {
      if (s.status === 'planned') {
        consider(s.seance_date, s.plan.label);
      }
    }
    if (latest === null) return null;
    const idx = cyclePlan.days.findIndex(
      (d) => d.label === (latest as { label: string }).label,
    );
    if (idx < 0) return null;
    const nextIdx = (idx + 1) % cyclePlan.days.length;
    return {
      suggestedDayIndex: nextIdx,
      previousLabel: (latest as { label: string }).label,
    };
  }, [day, feedbacks, sessions, userState]);

  // Charge la session planifiée correspondant à ce jour (si statut planned).
  useEffect(() => {
    if (day === null || (day.sessionId === null && day.status !== 'planned')) {
      setPlannedSession(null);
      return;
    }
    if (day.sessionId !== null) {
      void getDb().sessions.get(day.sessionId).then((row) => {
        setPlannedSession(row ?? null);
      });
    } else {
      setPlannedSession(null);
    }
  }, [day]);

  if (day === null) return null;

  const today = dateKey(new Date());
  const isToday = day.date === today;
  const isFuture = day.date > today;
  const isPast = day.date < today;

  async function planSession(dayIndex: number, startNow: boolean) {
    if (day === null) return;
    setPending(dayIndex);
    setError(null);
    try {
      if (startNow) {
        await engine.generateAndStoreSession({ dayIndex, seanceDate: day.date });
        onClose();
        navigate('/seance/runner');
      } else {
        await engine.planSessionForDay({ dayIndex, seanceDate: day.date });
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  async function startPlanned(sessionId: number) {
    setPending(-1);
    setError(null);
    try {
      await engine.loadPlannedSessionForRunner(sessionId);
      onClose();
      navigate('/seance/runner');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  async function cancelPlanned(sessionId: number) {
    setCancelling(true);
    setError(null);
    try {
      await engine.cancelPlannedSession(sessionId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={formatHumanDate(day.date)}>
      <div className="flex flex-col gap-4" data-testid="plan-day-sheet-content">
        {day.status === 'completed' && (
          <CompletedSessionBlock
            day={day}
            feedback={completedFeedback?.feedback ?? null}
            catalog={catalog}
          />
        )}

        {day.status === 'skipped' && (
          <p className="text-sm text-anthracite-300" data-testid="day-status-text">
            Séance sautée — pas d'action disponible ici.
          </p>
        )}

        {day.status === 'rest-past' && (
          <p className="text-sm text-anthracite-300" data-testid="day-status-text">
            Jour de repos passé. Aucune séance enregistrée.
          </p>
        )}

        {day.status === 'planned' && plannedSession !== null && (
          <PlannedSessionBlock
            session={plannedSession}
            catalog={catalog}
            isToday={isToday}
            isFuture={isFuture}
            isPast={isPast}
            pending={pending === -1}
            cancelling={cancelling}
            onStart={() => startPlanned(plannedSession.id!)}
            onCancel={() => cancelPlanned(plannedSession.id!)}
          />
        )}

        {day.status === 'free-future' && (
          <>
            {day.restSuggested && (
              <RestWarning recentMuscles={day.recentMuscles} />
            )}
            {periodicitySuggestion !== null && (
              <PeriodicityNudge suggestion={periodicitySuggestion} />
            )}
            <FixedRoutineBlock dayOfWeek={day.dayOfWeek as DayOfWeek} cyclePlan={cyclePlan} />
            <FreeFutureBlock
              cyclePlan={cyclePlan}
              catalog={catalog}
              isToday={isToday}
              isDeload={day.isDeload}
              pending={pending}
              suggestion={variationSuggestion}
              dayOfWeek={day.dayOfWeek as DayOfWeek}
              onPick={(dayIndex) => planSession(dayIndex, isToday)}
            />
          </>
        )}

        {error && (
          <p
            role="alert"
            data-testid="plan-day-error"
            className="text-sm text-sang-500"
          >
            {error}
          </p>
        )}

        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onClose}
          data-testid="plan-day-close"
        >
          Fermer
        </Button>
      </div>
    </Sheet>
  );
}

function PlannedSessionBlock({
  session,
  catalog,
  isToday,
  isFuture,
  isPast,
  pending,
  cancelling,
  onStart,
  onCancel,
}: {
  readonly session: SessionRow;
  readonly catalog: Catalog | null;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly isPast: boolean;
  readonly pending: boolean;
  readonly cancelling: boolean;
  readonly onStart: () => void;
  readonly onCancel: () => void;
}) {
  const plan: SessionPlan = session.plan;
  return (
    <div className="flex flex-col gap-3" data-testid="day-status-text">
      <p className="text-sm text-anthracite-100">
        Séance <strong className="text-white">{plan.label}</strong> programmée
        {isFuture && ' pour ce jour'}
        {isToday && " aujourd'hui"}
        {isPast && ' (non faite)'}.
      </p>

      <Card className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-anthracite-300">
          Exos prévus
        </span>
        <ul
          className="flex flex-col gap-1 text-sm text-anthracite-100"
          data-testid="planned-session-items"
        >
          {plan.items.map((item, i) => {
            // Conv #18 — nom FR depuis le catalog (fallback exercise_id si
            // absent). Cohérent avec l'affichage "séance faite" en dessous.
            const name =
              catalog !== null && catalog.has(item.exercise_id)
                ? catalog.get(item.exercise_id).nom_fr
                : item.exercise_id;
            return (
              <li
                key={`${item.exercise_id}-${i}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 truncate">{name}</span>
                <span className="shrink-0 tabular-nums text-anthracite-300">
                  {item.sets.length}×{item.sets[0]?.reps ?? 0}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {isToday && (
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={onStart}
          disabled={pending}
          data-testid="btn-start-planned"
        >
          {pending ? 'Démarrage…' : 'Démarrer la séance'}
        </Button>
      )}

      {isFuture && (
        <p className="text-xs text-anthracite-300">
          Tu pourras la démarrer le jour prévu.
        </p>
      )}

      <Button
        variant="secondary"
        size="md"
        fullWidth
        onClick={onCancel}
        disabled={cancelling}
        data-testid="btn-cancel-planned"
      >
        {cancelling ? 'Annulation…' : 'Annuler cette séance'}
      </Button>
    </div>
  );
}

function FreeFutureBlock({
  cyclePlan,
  catalog,
  isToday,
  isDeload,
  pending,
  suggestion,
  dayOfWeek,
  onPick,
}: {
  readonly cyclePlan: WeeklyTemplate | null;
  readonly catalog: Catalog | null;
  readonly isToday: boolean;
  readonly isDeload: boolean;
  readonly pending: number | null;
  readonly suggestion: { suggestedDayIndex: number; previousLabel: string } | null;
  readonly dayOfWeek: DayOfWeek;
  readonly onPick: (dayIndex: number) => void;
}) {
  // Conv #18 — bouton "📌 Fixer ce jour" sur chaque slot pour persister la
  // routine. La routine actuelle pour ce dayOfWeek est lue depuis le store
  // (pour styler le slot fixé).
  const engine = useEngine();
  const fixedRoutine = useCoachOsStore((s) => s.userState?.fixed_routine ?? {});
  const fixedDayIndex = fixedRoutine[String(dayOfWeek)];
  const [pinning, setPinning] = useState<number | null>(null);

  async function pinSlot(dayIndex: number) {
    setPinning(dayIndex);
    try {
      // Toggle : si déjà fixé sur ce slot → retire ; sinon pose.
      const target = fixedDayIndex === dayIndex ? null : dayIndex;
      await engine.setFixedRoutine(dayOfWeek, target);
    } finally {
      setPinning(null);
    }
  }

  if (cyclePlan === null || cyclePlan.days.length === 0) {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Aucun programme posé pour le moment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="day-status-text">
      <p className="text-sm text-anthracite-300">
        {isToday
          ? 'Choisis la séance à démarrer maintenant'
          : 'Choisis la séance à programmer ce jour'}
        {isDeload && <span className="text-sang-500"> (semaine de déload)</span>}.
      </p>
      {suggestion !== null && (
        <p
          className="rounded-lg border border-sang-800/50 bg-sang-900/15 px-3 py-2 text-xs leading-relaxed text-anthracite-100"
          data-testid="variation-suggestion"
        >
          💡 Tu as fait <strong className="text-white">{suggestion.previousLabel}</strong>{' '}
          récemment — pour varier, suggérée :{' '}
          <strong className="text-sang-300">
            {cyclePlan.days[suggestion.suggestedDayIndex]?.label}
          </strong>
          .
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {cyclePlan.days.map((d, i) => {
          const isSuggested = suggestion?.suggestedDayIndex === i;
          const isPinned = fixedDayIndex === i;
          const nExos = d.exercises.length;
          const nSets = d.exercises.reduce((acc, e) => acc + e.base_sets, 0);
          const durationMin =
            catalog !== null ? Math.round(estimateDayDurationMinutes(d, catalog)) : 0;
          return (
            <li key={i} className="flex items-stretch gap-2">
              <Button
                variant={isPinned ? 'primary' : isSuggested ? 'primary' : 'secondary'}
                size="md"
                fullWidth
                disabled={pending !== null || pinning !== null}
                onClick={() => onPick(i)}
                data-testid={`plan-slot-${i}`}
                className="!h-auto !min-h-[2.75rem] flex-col gap-0.5 py-2"
              >
                <span className="font-medium">
                  {pending === i ? '…' : d.label}
                  {isPinned ? ' 📌' : isSuggested ? ' ★' : ''}
                </span>
                <span className="text-[11px] font-normal opacity-75 tabular-nums">
                  {nExos} exos · {nSets} séries
                  {durationMin > 0 ? ` · ~${durationMin} min` : ''}
                </span>
              </Button>
              <button
                type="button"
                aria-label={
                  isPinned
                    ? `Retirer la routine fixe du ${dayOfWeekLabel(dayOfWeek)}`
                    : `Fixer ${d.label} le ${dayOfWeekLabel(dayOfWeek)}`
                }
                disabled={pending !== null || pinning !== null}
                onClick={() => pinSlot(i)}
                data-testid={`pin-slot-${i}`}
                className={cn(
                  'flex w-10 shrink-0 items-center justify-center rounded-xl border text-base transition',
                  isPinned
                    ? 'border-sang-600 bg-sang-900/40 text-sang-300 hover:text-white'
                    : 'border-anthracite-700 bg-anthracite-900 text-anthracite-400 hover:border-anthracite-500 hover:text-white',
                  (pending !== null || pinning !== null) && 'opacity-60',
                )}
              >
                {pinning === i ? '…' : '📌'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Bandeau "Routine fixée pour ce jour-of-week" — Conv #18.
 *
 * Affiché en haut du free-future si une routine est posée. Le slot
 * correspondant porte aussi le badge 📌 (cf. FreeFutureBlock). Si l'index
 * pointe sur un day inexistant (cycle plan régénéré), on n'affiche rien.
 */
function FixedRoutineBlock({
  dayOfWeek,
  cyclePlan,
}: {
  readonly dayOfWeek: DayOfWeek;
  readonly cyclePlan: WeeklyTemplate | null;
}) {
  const engine = useEngine();
  const fixedRoutine = useCoachOsStore((s) => s.userState?.fixed_routine ?? {});
  const idx = fixedRoutine[String(dayOfWeek)];
  const [busy, setBusy] = useState(false);
  if (cyclePlan === null || idx === undefined) return null;
  const day = cyclePlan.days[idx];
  if (day === undefined) return null;

  async function unpin() {
    setBusy(true);
    try {
      await engine.setFixedRoutine(dayOfWeek, null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="flex items-center justify-between gap-2 border-sang-700/40 bg-sang-900/15"
      data-testid="fixed-routine-banner"
    >
      <p className="text-sm text-anthracite-100">
        <span aria-hidden className="mr-1">📌</span>
        Routine fixée le {dayOfWeekLabel(dayOfWeek)} :{' '}
        <strong className="text-white">{day.label}</strong>
      </p>
      <button
        type="button"
        onClick={unpin}
        disabled={busy}
        data-testid="unpin-routine"
        className="text-xs text-anthracite-300 underline hover:text-white disabled:opacity-50"
      >
        {busy ? '…' : 'Retirer'}
      </button>
    </Card>
  );
}

// =============================================================================
// Bilan inline pour status='completed' (Conv #14b-2)
// =============================================================================

interface ExerciseRollup {
  readonly exerciseId: string;
  readonly setsDone: number;
  readonly repsTotal: number;
  readonly avgLoadKg: number;
  readonly avgRpe: number;
}

function rollupByExercise(sets: ReadonlyArray<SetFeedback>): ExerciseRollup[] {
  // Conserve l'ordre d'apparition des exos dans la séance.
  const buckets = new Map<
    string,
    { sets: number; reps: number; loadSum: number; rpeSum: number }
  >();
  const order: string[] = [];
  for (const s of sets) {
    if (s.reps_done <= 0) continue;
    let b = buckets.get(s.exercise_id);
    if (b === undefined) {
      b = { sets: 0, reps: 0, loadSum: 0, rpeSum: 0 };
      buckets.set(s.exercise_id, b);
      order.push(s.exercise_id);
    }
    b.sets += 1;
    b.reps += s.reps_done;
    b.loadSum += s.load_kg;
    b.rpeSum += s.rpe_perceived;
  }
  return order.map((id) => {
    const b = buckets.get(id)!;
    return {
      exerciseId: id,
      setsDone: b.sets,
      repsTotal: b.reps,
      avgLoadKg: b.loadSum / b.sets,
      avgRpe: b.rpeSum / b.sets,
    };
  });
}

function totalVolumeKg(sets: ReadonlyArray<SetFeedback>): number {
  let v = 0;
  for (const s of sets) {
    if (s.reps_done <= 0) continue;
    v += s.load_kg * s.reps_done;
  }
  return v;
}

function CompletedSessionBlock({
  day,
  feedback,
  catalog,
}: {
  readonly day: CalendarDay;
  readonly feedback: SessionFeedback | null;
  readonly catalog: Catalog | null;
}) {
  if (feedback === null) {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Séance <strong className="text-white">{day.sessionLabel}</strong> faite.{' '}
        {day.isDeload && <span className="text-sang-500">(déload)</span>}
      </p>
    );
  }
  const rollups = rollupByExercise(feedback.sets);
  const volume = totalVolumeKg(feedback.sets);
  return (
    <div className="flex flex-col gap-3" data-testid="day-status-text">
      <p className="text-sm text-anthracite-100">
        Séance <strong className="text-white">{feedback.label}</strong> faite
        {day.isDeload && <span className="text-sang-500"> (déload)</span>}.
      </p>
      {rollups.length > 0 && (
        <Card className="flex flex-col gap-1.5" data-testid="completed-session-rollup">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Exos faits
          </span>
          <ul className="flex flex-col gap-1 text-sm text-anthracite-100">
            {rollups.map((r) => {
              const ex = catalog !== null && catalog.has(r.exerciseId)
                ? catalog.get(r.exerciseId)
                : null;
              const name = ex !== null ? ex.nom_fr : r.exerciseId;
              const repsPerSet = Math.round(r.repsTotal / r.setsDone);
              // Conv #20 — kg/halt pour les exos DUMBBELL (load_kg stocké
              // est en per-haltère par convention catalogue).
              const unit = kgUnitLabelShort(ex?.charge);
              return (
                <li
                  key={r.exerciseId}
                  className="flex items-center justify-between gap-3"
                  data-testid={`completed-exo-${r.exerciseId}`}
                >
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="shrink-0 tabular-nums text-anthracite-300">
                    {r.setsDone}×{repsPerSet} @ {r.avgLoadKg.toFixed(1)} {unit} ·
                    effort {r.avgRpe.toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <div
        className="flex items-baseline justify-between text-xs text-anthracite-300"
        data-testid="completed-session-totals"
      >
        <span>Volume total</span>
        <span className="font-display text-sm font-semibold tabular-nums text-white">
          {Math.round(volume).toLocaleString('fr-FR')} kg
        </span>
      </div>
    </div>
  );
}

function PeriodicityNudge({
  suggestion,
}: {
  readonly suggestion: PeriodicitySuggestion;
}) {
  return (
    <Card
      className="border-sang-700/40 bg-sang-900/15"
      data-testid="periodicity-nudge"
    >
      <p className="text-sm text-anthracite-100">
        💡 Tu fais souvent{' '}
        <strong className="text-white">{suggestion.label}</strong> le{' '}
        <strong className="text-white">{dayOfWeekLabel(suggestion.dayOfWeek)}</strong>
        {' '}({suggestion.occurrences} fois sur les {suggestion.totalInWindow}{' '}
        dernières). C'est peut-être le bon créneau pour la (re)programmer.
      </p>
    </Card>
  );
}

function RestWarning({ recentMuscles }: { readonly recentMuscles: readonly string[] }) {
  return (
    <Card
      className="border-amber-800/60 bg-amber-900/20"
      data-testid="rest-warning"
    >
      <p className="text-sm text-amber-100">
        <strong>Repos recommandé :</strong> tu as une séance la veille.
      </p>
      {recentMuscles.length > 0 && (
        <p className="mt-1 text-xs text-amber-100/80">
          Muscles travaillés hier : {recentMuscles.map(muscleLabel).join(', ')}.
          Privilégie une séance ciblant d'autres muscles si tu enchaînes.
        </p>
      )}
    </Card>
  );
}

function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // Conv #18 — majuscule sur le jour de la semaine ("lundi 23 mai" →
  // "Lundi 23 mai") en titre de sheet. fr-FR renvoie en minuscules par
  // défaut, ce qui paraît bâclé en titre.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
