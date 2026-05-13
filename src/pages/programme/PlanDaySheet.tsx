import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import type { CalendarDay } from '@/lib/dashboard';
import type { WeeklyTemplate } from '@/engine/models';

interface PlanDaySheetProps {
  readonly open: boolean;
  readonly day: CalendarDay | null;
  readonly cyclePlan: WeeklyTemplate | null;
  readonly onClose: () => void;
}

/**
 * Sheet "Planifier ou voir la séance de ce jour" — version 5a (MVP affichage).
 *
 * - Si le jour a déjà une séance (`completed` / `planned` / `skipped`) :
 *   affiche le label de la séance et le statut.
 * - Si le jour est libre (`free-future`) : propose les `DayTemplate` du cycle
 *   comme slots à planifier (boutons désactivés en 5a, câblage en 5b avec
 *   `useEngine.generateAndStoreSession` + navigation vers /seance).
 * - Jour passé sans séance (`rest-past`) : message neutre.
 */
export function PlanDaySheet({ open, day, cyclePlan, onClose }: PlanDaySheetProps) {
  if (day === null) return null;

  const title = formatHumanDate(day.date);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4" data-testid="plan-day-sheet-content">
        {renderBody(day, cyclePlan)}
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

function renderBody(day: CalendarDay, cyclePlan: WeeklyTemplate | null) {
  if (day.status === 'completed') {
    return (
      <p className="text-sm text-anthracite-500" data-testid="day-status-text">
        Séance <strong className="text-white">{day.sessionLabel}</strong> faite.{' '}
        {day.isDeload && <span className="text-sang-500">(déload)</span>}
      </p>
    );
  }
  if (day.status === 'planned') {
    return (
      <p className="text-sm text-anthracite-500" data-testid="day-status-text">
        Séance <strong className="text-white">{day.sessionLabel}</strong> déjà
        programmée pour ce jour. Démarrage depuis l'onglet Séance (Conv #5b).
      </p>
    );
  }
  if (day.status === 'skipped') {
    return (
      <p className="text-sm text-anthracite-500" data-testid="day-status-text">
        Séance sautée — pas d'action disponible ici.
      </p>
    );
  }
  if (day.status === 'rest-past') {
    return (
      <p className="text-sm text-anthracite-500" data-testid="day-status-text">
        Jour de repos passé. Aucune séance enregistrée.
      </p>
    );
  }
  // free-future
  if (cyclePlan === null || cyclePlan.days.length === 0) {
    return (
      <p className="text-sm text-anthracite-500" data-testid="day-status-text">
        Aucun programme posé pour le moment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="day-status-text">
      <p className="text-sm text-anthracite-500">
        Choisis une séance à planifier ce jour
        {day.isDeload && <span className="text-sang-500"> (semaine de déload)</span>} :
      </p>
      <ul className="flex flex-col gap-2">
        {cyclePlan.days.map((d, i) => (
          <li key={i}>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled
              data-testid={`plan-slot-${i}`}
              title="Disponible Conv #5b"
            >
              {d.label}
              <span className="ml-2 text-xs text-anthracite-500">Conv #5b</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
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
