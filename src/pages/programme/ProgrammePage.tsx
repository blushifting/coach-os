import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { ChevronRight } from '@/components/icons';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { parseDateKey } from '@/lib/dashboard';
import {
  buildCalendarMatrix,
  computeCycleProgress,
  computeCycleTimeProgress,
  computeStreak,
  computeWeekSessions,
  isCycleFinished,
  nextCycleReviewDate,
  type CalendarDay,
} from '@/lib/dashboard';
import { CondensedCalendar } from './CondensedCalendar';
import { PlanDaySheet } from './PlanDaySheet';
import { WelcomeBanner } from './WelcomeBanner';
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
  const demoActive = useDemoMode();
  const currentSessionPlan = useCoachOsStore((s) => s.currentSessionPlan);
  const currentSessionId = useCoachOsStore((s) => s.currentSessionId);
  const navigate = useNavigate();
  const [openDay, setOpenDay] = useState<CalendarDay | null>(null);

  // Conv #15 vague 2 — si l'utilisateur clique sur la case du jour ET qu'une
  // séance est déjà en cours pour cette date, on saute la sheet "Démarrer"
  // et on rouvre direct la séance (entries du store déjà préservés).
  function handleDayClick(day: CalendarDay) {
    if (
      !demoActive &&
      currentSessionPlan !== null &&
      currentSessionId !== null &&
      currentSessionPlan.seance_date === day.date
    ) {
      navigate('/seance/runner');
      return;
    }
    setOpenDay(day);
  }

  const catalog = useCoachOsStore((s) => s.catalog);
  const dashboard = useMemo(() => {
    if (userState === null) return null;
    // Conv #16 — en mode démo, on ancre "now" sur la date de la séance du
    // jour Alex (snapshot) plutôt que sur la vraie date système. Sans ça,
    // le marqueur "today" du calendrier était posé à la vraie date (mardi
    // 19 mai pour Alex vs aujourd'hui réel pour l'utilisateur), créant
    // une incohérence avec le texte du tour ("Alex est mardi").
    const now =
      demoActive && currentSessionPlan !== null
        ? parseDateKey(currentSessionPlan.seance_date)
        : new Date();
    // Conv #11h — alignement streak sur les semaines du programme.
    const currentCycle = history.cycles.find(
      (c) => c.cycle_index === userState.cycle_index,
    );
    const cycleStart = currentCycle?.start_date ?? null;
    return {
      streak: computeStreak(history.feedbacks, now, cycleStart),
      cycleProgress: computeCycleProgress(userState, history.feedbacks),
      weekSessions: computeWeekSessions(userState, history.feedbacks),
      nextBilanDate: nextCycleReviewDate(userState, history.cycles),
      cycleTime: computeCycleTimeProgress(userState, history.cycles, now),
      cycleFinished: isCycleFinished(userState, history.feedbacks),
      matrix: buildCalendarMatrix(
        userState,
        history.cycles,
        history.sessions,
        history.feedbacks,
        now,
        catalog,
      ),
    };
  }, [userState, history, catalog, demoActive, currentSessionPlan]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (userState.current_cycle_plan === null) {
    return <Navigate to="/onboarding" replace />;
  }
  if (dashboard === null) return null;

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="programme-page">
      <WelcomeBanner feedbackCount={history.feedbacks.length} />

      <Widgets
        streak={dashboard.streak}
        cycleProgress={dashboard.cycleProgress}
        weekSessions={dashboard.weekSessions}
        nextBilanDate={dashboard.nextBilanDate}
        cycleTime={dashboard.cycleTime}
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
            Le cycle n'est pas encore initialisé. Termine l'onboarding pour démarrer.
          </p>
        </Card>
      ) : (
        <CondensedCalendar
          matrix={dashboard.matrix}
          currentWeekInCycle={userState.current_week_in_cycle}
          // Conv #16 — calendrier non-interactif en mode démo, sinon
          // l'utilisateur peut ouvrir la PlanDaySheet d'Alex et bloquer
          // le tour guidé (la sheet masque le bandeau démo).
          onDayClick={demoActive ? () => undefined : handleDayClick}
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
