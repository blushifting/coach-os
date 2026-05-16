import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/dashboard';

interface DayCellProps {
  readonly day: CalendarDay;
  readonly onClick: (day: CalendarDay) => void;
}

const STATUS_BASE: Record<CalendarDay['status'], string> = {
  completed: 'bg-sang-800/60 border-sang-700 text-white',
  planned: 'bg-anthracite-700 border-anthracite-600 text-white',
  skipped: 'bg-anthracite-900 border-anthracite-800 text-anthracite-300 line-through',
  'rest-past': 'bg-anthracite-900 border-anthracite-800 text-anthracite-300',
  'free-future': 'bg-anthracite-800/60 border-dashed border-anthracite-700 text-anthracite-300',
};

const REST_SUGGESTED_OVERLAY =
  'bg-amber-900/20 border-amber-800/60 text-amber-100';

const STATUS_BADGE_LABEL: Record<CalendarDay['status'], string> = {
  completed: 'fait',
  planned: 'prévue',
  skipped: 'sautée',
  'rest-past': '',
  'free-future': '',
};

export function DayCell({ day, onClick }: DayCellProps) {
  const dayOfMonth = Number(day.date.slice(-2));
  return (
    <button
      type="button"
      onClick={() => onClick(day)}
      data-testid={`day-${day.date}`}
      data-status={day.status}
      data-deload={day.isDeload ? 'true' : 'false'}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition active:scale-95',
        STATUS_BASE[day.status],
        day.restSuggested && REST_SUGGESTED_OVERLAY,
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
