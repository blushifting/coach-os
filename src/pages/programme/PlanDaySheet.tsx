import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { useEngine } from '@/hooks/useEngine';
import { getDb } from '@/db';
import type { SessionRow } from '@/db/schema';
import { dateKey, type CalendarDay } from '@/lib/dashboard';
import { formatSessionLabel, sessionDisplayName } from '@/lib/session-label';
import { CreateSessionButton } from './CreateSessionSheet';
import { useCoachOsStore } from '@/store';
import {
  suggestNextSession,
  type SessionSuggestion,
} from '@/lib/session-suggestion';
import type { Catalog } from '@/engine/catalog';
import type {
  SessionFeedback,
  SessionPlan,
  SetFeedback,
  WeeklyTemplate,
} from '@/engine/models';
import { displayExerciseName, kgUnitLabelShort } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';
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

  // Conv #30 — suggestion prédictive de séance / repos au planning. Rotation
  // stricte (A→B→C…) + cadence de repos selon la fréquence hebdo (cf.
  // `lib/session-suggestion`). Remplace l'ancien rythme imposé du calendrier,
  // la rotation par muscles et le nudge de périodicité. On n'alimente que les
  // séances faites + planifiées (date + label) ; la fonction ignore tout ce qui
  // est daté après le jour visé.
  const suggestion = useMemo<SessionSuggestion>(() => {
    if (day === null || userState === null) return null;
    const cyclePlan = userState.current_cycle_plan;
    if (cyclePlan === null) return null;
    if (day.status !== 'free-future') return null;
    const dayLabels = cyclePlan.days.map((d) => d.label);
    const todayKey = dateKey(new Date());
    const recent: { date: string; label: string }[] = [];
    for (const fb of feedbacks) {
      recent.push({ date: fb.feedback.seance_date, label: fb.feedback.label });
    }
    for (const s of sessions) {
      if (s.status !== 'planned') continue;
      // #63 — une séance planifiée mais déjà passée sans avoir été faite
      // (annulée, ou simplement non honorée) ne doit PAS compter comme une
      // séance effectuée : sinon la reco du lendemain enchaîne la rotation et
      // la cadence de repos comme si elle avait eu lieu. Seules comptent les
      // séances faites (feedbacks) et les séances planifiées encore à venir.
      if (s.seance_date < todayKey) continue;
      recent.push({ date: s.seance_date, label: s.plan.label });
    }
    return suggestNextSession(
      day.date,
      dayLabels,
      recent,
      userState.profile.sessions_per_week,
    );
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

        {day.status === 'rest-past' && (
          <p className="text-sm text-anthracite-300" data-testid="day-status-text">
            Jour passé. Aucune séance enregistrée.
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
            {suggestion?.kind === 'rest' && (
              <RestSuggestion recentLabels={suggestion.recentLabels} />
            )}
            <FreeFutureBlock
              cyclePlan={cyclePlan}
              catalog={catalog}
              isToday={isToday}
              seanceDate={day.date}
              pending={pending}
              suggestion={suggestion?.kind === 'session' ? suggestion : null}
              onPick={(dayIndex) => planSession(dayIndex, isToday)}
              onClose={onClose}
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
  const brand = useGymBrand();
  return (
    <div className="flex flex-col gap-3" data-testid="day-status-text">
      <p className="text-sm text-anthracite-100">
        La séance <strong className="text-white">{sessionDisplayName(plan)}</strong> est
        programmée
        {isFuture && ' pour ce jour'}
        {isToday && " aujourd'hui"}
        {isPast && ' (non faite)'}.
      </p>

      <Card className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-anthracite-300">
          Exercices prévus
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
                ? displayExerciseName(catalog.get(item.exercise_id), brand ?? undefined)
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
  seanceDate,
  pending,
  suggestion,
  onPick,
  onClose,
}: {
  readonly cyclePlan: WeeklyTemplate | null;
  readonly catalog: Catalog | null;
  readonly isToday: boolean;
  readonly seanceDate: string;
  readonly pending: number | null;
  readonly suggestion: {
    readonly dayIndex: number;
    readonly previousLabel: string | null;
  } | null;
  readonly onPick: (dayIndex: number) => void;
  readonly onClose: () => void;
}) {
  if (cyclePlan === null || cyclePlan.days.length === 0) {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Aucun programme pour le moment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="day-status-text">
      <p className="text-sm text-anthracite-300">
        {isToday
          ? 'Choisis la séance à démarrer maintenant'
          : 'Choisis la séance à programmer ce jour'}
        .
      </p>
      {suggestion !== null && suggestion.previousLabel !== null && (
        <p
          className="rounded-lg border border-sang-800/50 bg-sang-900/15 px-3 py-2 text-xs leading-relaxed text-anthracite-100"
          data-testid="session-suggestion"
        >
          Tu as fait la séance{' '}
          <strong className="text-white">
            {formatSessionLabel(suggestion.previousLabel)}
          </strong>{' '}
          récemment. Pour varier les muscles, passe sur la séance{' '}
          <strong className="text-sang-300">
            {sessionDisplayName(cyclePlan.days[suggestion.dayIndex] ?? { label: '' })}
          </strong>
          .
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {cyclePlan.days.map((d, i) => {
          const isSuggested = suggestion?.dayIndex === i;
          const nExos = d.exercises.length;
          const nSets = d.exercises.reduce((acc, e) => acc + e.base_sets, 0);
          const durationMin =
            catalog !== null ? Math.round(estimateDayDurationMinutes(d, catalog)) : 0;
          return (
            <li key={i} className="flex items-stretch gap-2">
              <Button
                variant={isSuggested ? 'primary' : 'secondary'}
                size="md"
                fullWidth
                disabled={pending !== null}
                onClick={() => onPick(i)}
                data-testid={`plan-slot-${i}`}
                className="!h-auto !min-h-[2.75rem] flex-col gap-0.5 py-2"
              >
                <span className="font-medium">
                  {pending === i ? '…' : sessionDisplayName(d)}
                  {isSuggested ? ' ★' : ''}
                </span>
                <span className="text-[11px] font-normal opacity-75 tabular-nums">
                  {nExos} exos · {nSets} séries
                  {durationMin > 0 ? ` · ~${durationMin} min` : ''}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      <CreateSessionButton
        isToday={isToday}
        seanceDate={seanceDate}
        catalog={catalog}
        onPlanned={onClose}
      />
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
        La séance{' '}
        {day.sessionLabel !== null && (
          <>
            <strong className="text-white">{formatSessionLabel(day.sessionLabel)}</strong>{' '}
          </>
        )}
        est faite.
      </p>
    );
  }
  const rollups = rollupByExercise(feedback.sets);
  const volume = totalVolumeKg(feedback.sets);
  const brand = useGymBrand();
  return (
    <div className="flex flex-col gap-3" data-testid="day-status-text">
      <p className="text-sm text-anthracite-100">
        La séance <strong className="text-white">{sessionDisplayName(feedback)}</strong> est
        faite.
      </p>
      {rollups.length > 0 && (
        <Card className="flex flex-col gap-1.5" data-testid="completed-session-rollup">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Exercices faits
          </span>
          <ul className="flex flex-col gap-1 text-sm text-anthracite-100">
            {rollups.map((r) => {
              const ex = catalog !== null && catalog.has(r.exerciseId)
                ? catalog.get(r.exerciseId)
                : null;
              const name = ex !== null ? displayExerciseName(ex, brand ?? undefined) : r.exerciseId;
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
                    réserve {(10 - r.avgRpe).toFixed(1)}
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

/**
 * Conv #30 — suggestion de repos quand les dernières séances consécutives ont
 * déjà couvert les muscles à venir. Ton calme (conseil, pas alerte) ; l'user
 * reste libre de lancer une séance via les boutons en dessous.
 */
function RestSuggestion({ recentLabels }: { readonly recentLabels: readonly string[] }) {
  const labels = recentLabels.map((l) => formatSessionLabel(l));
  const multiple = labels.length >= 2;
  const enchaine = multiple
    ? `${labels.slice(0, -1).join(', ')} puis ${labels[labels.length - 1]}`
    : labels[0] ?? '';
  return (
    <Card
      className="border-anthracite-700 bg-anthracite-900/60"
      data-testid="rest-suggestion"
    >
      <p className="text-sm text-anthracite-100">
        <strong>Repos conseillé.</strong> {multiple ? 'Tu as enchaîné' : 'Tu viens de faire'}{' '}
        <strong className="text-white">{enchaine}</strong>&nbsp;: une pause aiderait
        tes muscles à récupérer. Tu peux quand même lancer une séance si tu te
        sens en forme.
      </p>
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
