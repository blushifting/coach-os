import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/dashboard';

interface DayCellProps {
  readonly day: CalendarDay;
  readonly onClick: (day: CalendarDay) => void;
}

// Conv #15 / #29 — couleurs calendrier : vert = fait, bleu = prévue,
// anthracite dashed = libre, anthracite plein = passé. Concepts « sautée » et
// « repos recommandé » retirés (Conv #29).
const STATUS_BASE: Record<CalendarDay['status'], string> = {
  completed: 'bg-emerald-700/70 border-emerald-500 text-white',
  planned: 'bg-blue-800/60 border-blue-500 text-white',
  'rest-past': 'bg-anthracite-900 border-anthracite-800 text-anthracite-400',
  'free-future': 'bg-anthracite-900/40 border-dashed border-anthracite-700 text-anthracite-400',
};

// Conv #29 — jour libre à venir que le rythme conseille en repos : teinte
// calme (pas une alarme), juste pour suggérer la pause.
const SUGGESTED_REST = 'bg-anthracite-900/60 border-anthracite-700 text-anthracite-300';

const STATUS_BADGE_LABEL: Record<CalendarDay['status'], string> = {
  completed: 'séance faite',
  planned: 'séance prévue',
  'rest-past': 'jour passé',
  'free-future': 'jour libre',
};

export function DayCell({ day, onClick }: DayCellProps) {
  const dayOfMonth = Number(day.date.slice(-2));
  const statusClasses = day.suggestedRest
    ? SUGGESTED_REST
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
      data-rest-suggested={day.suggestedRest ? 'true' : 'false'}
      aria-label={`${day.date} — ${day.suggestedRest ? 'repos conseillé' : day.isDeload ? 'semaine allégée' : STATUS_BADGE_LABEL[day.status]}`}
    >
      <span className="text-[10px] uppercase tracking-wide leading-none">
        {WEEKDAY_LABELS[day.dayOfWeek]}
      </span>
      <span className="text-sm font-semibold tabular-nums leading-none">{dayOfMonth}</span>
      {day.isDeload && day.status !== 'completed' && (
        <span className="text-[9px] uppercase tracking-wide text-sang-500 leading-none">D</span>
      )}
      {day.suggestedRest && !day.isDeload && (
        <span className="text-[9px] uppercase tracking-wide text-anthracite-400 leading-none">Z</span>
      )}
    </button>
  );
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
