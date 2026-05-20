import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { useEngine } from '@/hooks/useEngine';
import { getDb } from '@/db';
import type { SessionRow } from '@/db/schema';
import { dateKey, type CalendarDay } from '@/lib/dashboard';
import { muscleLabel } from '@/lib/progress';
import type { SessionPlan, WeeklyTemplate } from '@/engine/models';

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
  const [pending, setPending] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [plannedSession, setPlannedSession] = useState<SessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <p className="text-sm text-anthracite-300" data-testid="day-status-text">
            Séance <strong className="text-white">{day.sessionLabel}</strong> faite.{' '}
            {day.isDeload && <span className="text-sang-500">(déload)</span>}
          </p>
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
            <FreeFutureBlock
              cyclePlan={cyclePlan}
              isToday={isToday}
              isDeload={day.isDeload}
              pending={pending}
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
  onPick,
}: {
  readonly cyclePlan: WeeklyTemplate | null;
  readonly isToday: boolean;
  readonly isDeload: boolean;
  readonly pending: number | null;
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
      <ul className="flex flex-col gap-2">
        {cyclePlan.days.map((d, i) => (
          <li key={i}>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled={pending !== null}
              onClick={() => onPick(i)}
              data-testid={`plan-slot-${i}`}
            >
              {pending === i ? '…' : d.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
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
