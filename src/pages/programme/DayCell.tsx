import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/dashboard';

interface DayCellProps {
  readonly day: CalendarDay;
  readonly onClick: (day: CalendarDay) => void;
}

const STATUS_BASE: Record<CalendarDay['status'], string> = {
  completed: 'bg-sang-800/60 border-sang-700 text-white',
  planned: 'bg-anthracite-700 border-anthracite-600 text-white',
  skipped: 'bg-anthracite-900 border-anthracite-800 text-anthracite-500 line-through',
  'rest-past': 'bg-anthracite-900 border-anthracite-800 text-anthracite-500',
  'free-future': 'bg-anthracite-800/60 border-dashed border-anthracite-700 text-anthracite-500',
};

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
        day.isToday && 'ring-2 ring-sang-500',
        day.isDeload && 'opacity-90',
      )}
      aria-label={`${day.date} — ${STATUS_BADGE_LABEL[day.status] || (day.isDeload ? 'déload' : 'repos')}`}
    >
      <span className="text-[10px] uppercase tracking-wide leading-none">
        {WEEKDAY_LABELS[day.dayOfWeek]}
      </span>
      <span className="text-sm font-semibold tabular-nums leading-none">{dayOfMonth}</span>
      {day.isDeload && day.status !== 'completed' && (
        <span className="text-[9px] uppercase tracking-wide text-sang-500 leading-none">D</span>
      )}
    </button>
  );
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
