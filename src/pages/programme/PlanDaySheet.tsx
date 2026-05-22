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
import { useCoachOsStore } from '@/store';
import {
  detectPeriodicity,
  dayOfWeekLabel,
  suggestionForDay,
  type PeriodicitySuggestion,
} from '@/lib/periodicity';
import type { Catalog } from '@/engine/catalog';
import type {
  SessionFeedback,
  SessionPlan,
  SetFeedback,
  WeeklyTemplate,
} from '@/engine/models';

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
  // "Full A". Logic : prend le label de la dernière séance complétée dans
  // les 7 derniers jours, trouve son index dans `current_cycle_plan.days`,
  // suggère le day suivant (cyclique).
  const variationSuggestion = useMemo(() => {
    const cyclePlan = userState?.current_cycle_plan ?? null;
    if (cyclePlan === null || day === null) return null;
    const dayDate = new Date(day.date + 'T00:00:00');
    // Cherche la dernière séance faite avant `day.date`, dans les 7j.
    let latest: { date: string; label: string } | null = null;
    for (const fb of feedbacks) {
      const fbDate = fb.feedback.seance_date;
      if (fbDate >= day.date) continue;
      const diffMs = dayDate.getTime() - new Date(fbDate + 'T00:00:00').getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 7) continue;
      if (latest === null || fbDate > latest.date) {
        latest = { date: fbDate, label: fb.feedback.label };
      }
    }
    if (latest === null) return null;
    const idx = cyclePlan.days.findIndex((d) => d.label === latest!.label);
    if (idx < 0) return null;
    const nextIdx = (idx + 1) % cyclePlan.days.length;
    return { suggestedDayIndex: nextIdx, previousLabel: latest.label };
  }, [day, feedbacks, userState]);

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
            <FreeFutureBlock
              cyclePlan={cyclePlan}
              isToday={isToday}
              isDeload={day.isDeload}
              pending={pending}
              suggestion={variationSuggestion}
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
  isToday,
  isFuture,
  isPast,
  pending,
  cancelling,
  onStart,
  onCancel,
}: {
  readonly session: SessionRow;
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
          {plan.items.map((item, i) => (
            <li key={`${item.exercise_id}-${i}`} className="flex justify-between">
              <span>{item.exercise_id}</span>
              <span className="tabular-nums text-anthracite-300">
                {item.sets.length}×{item.sets[0]?.reps ?? 0}
              </span>
            </li>
          ))}
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
  isToday,
  isDeload,
  pending,
  suggestion,
  onPick,
}: {
  readonly cyclePlan: WeeklyTemplate | null;
  readonly isToday: boolean;
  readonly isDeload: boolean;
  readonly pending: number | null;
  readonly suggestion: { suggestedDayIndex: number; previousLabel: string } | null;
  readonly onPick: (dayIndex: number) => void;
}) {
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
          ? "Choisis une séance à programmer et démarrer maintenant"
          : 'Choisis une séance à programmer ce jour'}
        {isDeload && <span className="text-sang-500"> (semaine de déload)</span>} :
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
          return (
            <li key={i}>
              <Button
                variant={isSuggested ? 'primary' : 'secondary'}
                size="md"
                fullWidth
                disabled={pending !== null}
                onClick={() => onPick(i)}
                data-testid={`plan-slot-${i}`}
              >
                {pending === i ? '…' : d.label}
                {isSuggested ? ' ★' : ''}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
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
              const name =
                catalog !== null && catalog.has(r.exerciseId)
                  ? catalog.get(r.exerciseId).nom_fr
                  : r.exerciseId;
              const repsPerSet = Math.round(r.repsTotal / r.setsDone);
              return (
                <li
                  key={r.exerciseId}
                  className="flex items-center justify-between gap-3"
                  data-testid={`completed-exo-${r.exerciseId}`}
                >
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="shrink-0 tabular-nums text-anthracite-300">
                    {r.setsDone}×{repsPerSet} @ {r.avgLoadKg.toFixed(1)} kg ·
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
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
