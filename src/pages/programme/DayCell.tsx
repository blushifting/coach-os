import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/dashboard';

interface DayCellProps {
  readonly day: CalendarDay;
  readonly onClick: (day: CalendarDay) => void;
}

// Conv #15 / #29 / #30 — couleurs calendrier : vert = fait, bleu = prévue,
// anthracite dashed = libre, anthracite plein = passé. Concepts « sautée »,
// « repos recommandé » et rythme imposé retirés (le calendrier n'impose plus
// de rythme : la suggestion repos/séance vit dans la feuille de planification).
const STATUS_BASE: Record<CalendarDay['status'], string> = {
  completed: 'bg-emerald-700/70 border-emerald-500 text-white',
  planned: 'bg-blue-800/60 border-blue-500 text-white',
  'rest-past': 'bg-anthracite-900 border-anthracite-800 text-anthracite-400',
  'free-future': 'bg-anthracite-900/40 border-dashed border-anthracite-700 text-anthracite-400',
};

const STATUS_BADGE_LABEL: Record<CalendarDay['status'], string> = {
  completed: 'séance faite',
  planned: 'séance prévue',
  'rest-past': 'jour passé',
  'free-future': 'jour libre',
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
      aria-label={`${day.date} — ${day.isDeload ? 'semaine de récupération' : STATUS_BADGE_LABEL[day.status]}`}
    >
      <span className="text-[10px] uppercase tracking-wide leading-none">
        {WEEKDAY_LABELS[day.dayOfWeek]}
      </span>
      <span className="text-sm font-semibold tabular-nums leading-none">{dayOfMonth}</span>
      {day.isDeload && day.status !== 'completed' && (
        <span className="text-[9px] uppercase tracking-wide text-sang-500 leading-none">R</span>
      )}
    </button>
  );
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
