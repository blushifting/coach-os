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

  return (
    <Card className="flex flex-col gap-3" data-testid="start-session-list">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-white">Démarrer une séance</h2>
        <p className="text-xs text-anthracite-300">
          Choisis le jour à faire — pas forcément dans l'ordre.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => (
          <li key={c.dayIndex}>
            <Button
              variant={c.doneCountThisWeek > 0 ? 'secondary' : 'primary'}
              size="md"
              fullWidth
              onClick={() => onStart(c.dayIndex)}
              disabled={starting}
              data-testid={`start-day-${c.dayIndex}`}
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
        ))}
      </ul>
    </Card>
  );
}
