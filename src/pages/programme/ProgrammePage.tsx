import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { ChevronRight } from '@/components/icons';
import { useCoachOsStore } from '@/store';
import {
  buildCalendarMatrix,
  computeCycleProgress,
  computeStreak,
  computeWeekSessions,
  isCycleFinished,
  nextCycleReviewDate,
  type CalendarDay,
} from '@/lib/dashboard';
import { CondensedCalendar } from './CondensedCalendar';
import { PlanDaySheet } from './PlanDaySheet';
import { Widgets } from './Widgets';

/**
 * Onglet Programme — Dashboard Coach OS (Conv #5a).
 *
 * Composition :
 * 1. 4 widgets (streak / cette semaine / % cycle / prochain bilan).
 * 2. Bandeau "Cycle terminé" si applicable (lien vers /cycle-bilan).
 * 3. Calendrier condensé 5 sem × 7 jours avec badges intégrés.
 * 4. Sheet "Planifier" sur tap d'une case (stub 5a — démarrage en 5b).
 */
export default function ProgrammePage() {
  const userState = useCoachOsStore((s) => s.userState);
  const history = useCoachOsStore((s) => s.history);
  const [openDay, setOpenDay] = useState<CalendarDay | null>(null);

  const dashboard = useMemo(() => {
    if (userState === null) return null;
    return {
      streak: computeStreak(history.feedbacks),
      cycleProgress: computeCycleProgress(userState, history.feedbacks),
      weekSessions: computeWeekSessions(userState, history.feedbacks),
      nextBilanDate: nextCycleReviewDate(userState, history.cycles),
      cycleFinished: isCycleFinished(userState, history.feedbacks),
      matrix: buildCalendarMatrix(
        userState,
        history.cycles,
        history.sessions,
        history.feedbacks,
      ),
    };
  }, [userState, history]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (userState.current_cycle_plan === null || userState.current_cycle_plan.requires_calibration) {
    return <Navigate to="/seance-0" replace />;
  }
  if (dashboard === null) return null;

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="programme-page">
      <Widgets
        streak={dashboard.streak}
        cycleProgress={dashboard.cycleProgress}
        weekSessions={dashboard.weekSessions}
        nextBilanDate={dashboard.nextBilanDate}
      />

      {dashboard.cycleFinished && (
        <Link to="/cycle-bilan" data-testid="cycle-finished-banner" className="block">
          <Card className="flex items-center justify-between border-sang-700 bg-sang-900/40">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white">Cycle terminé</span>
              <span className="text-xs text-anthracite-300">
                Voir le bilan et choisir la suite
              </span>
            </div>
            <ChevronRight className="text-sang-500" />
          </Card>
        </Link>
      )}

      {dashboard.matrix === null ? (
        <Card data-testid="no-cycle-card">
          <p className="text-sm text-anthracite-300">
            Le cycle n'est pas encore initialisé. Termine la séance 0 pour démarrer.
          </p>
        </Card>
      ) : (
        <CondensedCalendar
          matrix={dashboard.matrix}
          currentWeekInCycle={userState.current_week_in_cycle}
          onDayClick={setOpenDay}
        />
      )}

      <PlanDaySheet
        open={openDay !== null}
        day={openDay}
        cyclePlan={userState.current_cycle_plan}
        onClose={() => setOpenDay(null)}
      />
    </section>
  );
}
