import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/dashboard';

interface DayCellProps {
  readonly day: CalendarDay;
  readonly onClick: (day: CalendarDay) => void;
}

// Conv #15 — refonte couleurs calendrier : familles de couleurs distinctes
// par statut, à fort contraste. Vert = fait, bleu = prévue, anthracite dashed
// = libre, sang barré = sautée, ambre = repos recommandé, opacité réduite pour
// le passé "rest-past".
const STATUS_BASE: Record<CalendarDay['status'], string> = {
  completed: 'bg-emerald-700/70 border-emerald-500 text-white',
  planned: 'bg-blue-800/60 border-blue-500 text-white',
  skipped: 'bg-sang-900/50 border-sang-700 text-sang-300 line-through',
  'rest-past': 'bg-anthracite-900 border-anthracite-800 text-anthracite-400',
  'free-future': 'bg-anthracite-900/40 border-dashed border-anthracite-700 text-anthracite-400',
};

const REST_SUGGESTED_OVERLAY =
  'bg-amber-900/40 border-amber-600 text-amber-100';

const STATUS_BADGE_LABEL: Record<CalendarDay['status'], string> = {
  completed: 'séance faite',
  planned: 'séance prévue',
  skipped: 'séance sautée',
  'rest-past': 'repos',
  'free-future': 'jour libre',
};

export function DayCell({ day, onClick }: DayCellProps) {
  const dayOfMonth = Number(day.date.slice(-2));
  // Conv #15 vague 2 — `cn()` simple ne fait pas de tailwind-merge, donc
  // accumuler `bg-anthracite-*` + `bg-amber-*` laisse Tailwind trancher par
  // ordre alphabétique (amber défini avant anthracite → anthracite gagne).
  // Si `restSuggested`, on remplace les classes de fond/bordure, sans cumul.
  const statusClasses = day.restSuggested
    ? REST_SUGGESTED_OVERLAY
    : STATUS_BASE[day.status];
  return (
    <button
      type="button"
      onClick={() => onClick(day)}
      data-testid={`day-${day.date}`}
      data-status={day.status}
      data-deload={day.isDeload ? 'true' : 'false'}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition active:scale-95',
        statusClasses,
        day.isToday && 'ring-2 ring-sang-500',
        day.isDeload && 'opacity-90',
      )}
      data-rest-suggested={day.restSuggested ? 'true' : 'false'}
      aria-label={`${day.date} — ${STATUS_BADGE_LABEL[day.status] || (day.restSuggested ? 'repos recommandé' : day.isDeload ? 'déload' : 'repos')}`}
    >
      <span className="text-[10px] uppercase tracking-wide leading-none">
        {WEEKDAY_LABELS[day.dayOfWeek]}
      </span>
      <span className="text-sm font-semibold tabular-nums leading-none">{dayOfMonth}</span>
      {day.isDeload && day.status !== 'completed' && (
        <span className="text-[9px] uppercase tracking-wide text-sang-500 leading-none">D</span>
      )}
      {day.restSuggested && !day.isDeload && (
        <span className="text-[9px] uppercase tracking-wide text-amber-400 leading-none">Z</span>
      )}
    </button>
  );
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
