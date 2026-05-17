import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { UserState } from '@/engine/models';
import { listDayCandidates } from '@/lib/session-runner';
import type { FeedbackRow } from '@/db/schema';

interface StartSessionListProps {
  readonly userState: UserState;
  readonly feedbacks: ReadonlyArray<FeedbackRow>;
  readonly onStart: (dayIndex: number) => void;
  readonly starting: boolean;
}

/**
 * Écran "État A" — aucune séance en cours. Liste les `DayTemplate` du
 * `current_cycle_plan` avec un bouton "Commencer" par jour.
 *
 * Conv #11a : rotation forcée — un jour déjà fait cette semaine est verrouillé
 * tant qu'il reste un autre jour non fait. Quand tous ont été faits au moins
 * une fois, on déverrouille tout pour permettre un second tour.
 */
export function StartSessionList({
  userState,
  feedbacks,
  onStart,
  starting,
}: StartSessionListProps) {
  const plan = userState.current_cycle_plan;
  if (plan === null) {
    return (
      <Card data-testid="no-plan-card">
        <p className="text-sm text-anthracite-300">
          Aucun programme posé pour le moment.
        </p>
      </Card>
    );
  }
  const candidates = listDayCandidates(
    plan,
    feedbacks,
    userState.cycle_index,
    userState.current_week_in_cycle,
  );

  const allDoneAtLeastOnce =
    candidates.length > 0 && candidates.every((c) => c.doneCountThisWeek > 0);

  return (
    <Card className="flex flex-col gap-3" data-testid="start-session-list">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-white">Démarrer une séance</h2>
        <p className="text-xs text-anthracite-300">
          {allDoneAtLeastOnce
            ? 'Tour complet — tu peux refaire un jour si tu veux.'
            : 'Fais d’abord les séances non encore faites cette semaine.'}
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => {
          const lockedThisWeek = c.doneCountThisWeek > 0 && !allDoneAtLeastOnce;
          return (
            <li key={c.dayIndex}>
              <Button
                variant={c.doneCountThisWeek > 0 ? 'secondary' : 'primary'}
                size="md"
                fullWidth
                onClick={() => onStart(c.dayIndex)}
                disabled={starting || lockedThisWeek}
                title={
                  lockedThisWeek
                    ? 'Déjà fait cette semaine — enchaîne plutôt sur un autre jour'
                    : undefined
                }
                data-testid={`start-day-${c.dayIndex}`}
                data-locked={lockedThisWeek ? 'true' : 'false'}
              >
                <span className="flex w-full items-center justify-between">
                  <span>{c.label}</span>
                  {c.doneCountThisWeek > 0 && (
                    <span className="text-xs text-anthracite-300">
                      fait {c.doneCountThisWeek > 1 ? `×${c.doneCountThisWeek}` : ''} cette sem.
                    </span>
                  )}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
