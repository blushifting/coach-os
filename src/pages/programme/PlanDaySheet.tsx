import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useEngine } from '@/hooks/useEngine';
import type { CalendarDay } from '@/lib/dashboard';
import type { WeeklyTemplate } from '@/engine/models';

interface PlanDaySheetProps {
  readonly open: boolean;
  readonly day: CalendarDay | null;
  readonly cyclePlan: WeeklyTemplate | null;
  readonly onClose: () => void;
}

/**
 * Sheet "Voir / planifier la séance de ce jour" (Conv #5a → câblage actif #5b).
 *
 * - Jour déjà fait / programmé / sauté / passé : message d'état.
 * - Jour libre futur : liste des `DayTemplate`, bouton "Démarrer" qui appelle
 *   `generateAndStoreSession({dayIndex, seanceDate})` puis navigue vers
 *   `/seance` (l'écran Séance bascule alors en État B exécution).
 */
export function PlanDaySheet({ open, day, cyclePlan, onClose }: PlanDaySheetProps) {
  const engine = useEngine();
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);

  if (day === null) return null;

  async function startSession(dayIndex: number) {
    if (day === null) return;
    setPending(dayIndex);
    try {
      await engine.generateAndStoreSession({ dayIndex, seanceDate: day.date });
      onClose();
      navigate('/seance');
    } finally {
      setPending(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={formatHumanDate(day.date)}>
      <div className="flex flex-col gap-4" data-testid="plan-day-sheet-content">
        {renderBody(day, cyclePlan, startSession, pending)}
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

function renderBody(
  day: CalendarDay,
  cyclePlan: WeeklyTemplate | null,
  startSession: (i: number) => void,
  pending: number | null,
) {
  if (day.status === 'completed') {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Séance <strong className="text-white">{day.sessionLabel}</strong> faite.{' '}
        {day.isDeload && <span className="text-sang-500">(déload)</span>}
      </p>
    );
  }
  if (day.status === 'planned') {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Séance <strong className="text-white">{day.sessionLabel}</strong> déjà
        programmée. Rends-toi sur l'onglet Séance pour la commencer.
      </p>
    );
  }
  if (day.status === 'skipped') {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Séance sautée — pas d'action disponible ici.
      </p>
    );
  }
  if (day.status === 'rest-past') {
    return (
      <p className="text-sm text-anthracite-300" data-testid="day-status-text">
        Jour de repos passé. Aucune séance enregistrée.
      </p>
    );
  }
  // free-future
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
              disabled={pending !== null}
              onClick={() => startSession(i)}
              data-testid={`plan-slot-${i}`}
            >
              {pending === i ? 'Démarrage…' : d.label}
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
