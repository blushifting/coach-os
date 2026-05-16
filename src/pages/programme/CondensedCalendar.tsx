import { Card } from '@/components/Card';
import { cn } from '@/lib/cn';
import type { CalendarDay, CalendarMatrix } from '@/lib/dashboard';
import { DayCell } from './DayCell';

interface CondensedCalendarProps {
  readonly matrix: CalendarMatrix;
  readonly currentWeekInCycle: number;
  readonly onDayClick: (day: CalendarDay) => void;
}

export function CondensedCalendar({
  matrix,
  currentWeekInCycle,
  onDayClick,
}: CondensedCalendarProps) {
  return (
    <Card data-testid="condensed-calendar" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">
          Cycle {matrix.cycleIndex} — semaine {Math.min(currentWeekInCycle, 5)}/5
        </h2>
        <span className="text-xs text-anthracite-300">
          {formatRange(matrix.cycleStart, matrix.cycleEnd)}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {matrix.weeks.map((row, wi) => (
          <div
            key={wi}
            className={cn(
              'grid grid-cols-7 gap-1',
              wi + 1 === currentWeekInCycle && 'ring-1 ring-sang-700/40 rounded-lg p-0.5',
            )}
            data-testid={`week-row-${wi + 1}`}
          >
            {row.map((day) => (
              <DayCell key={day.date} day={day} onClick={onDayClick} />
            ))}
          </div>
        ))}
      </div>
      <Legend />
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-anthracite-300">
      <LegendDot color="bg-sang-800/60 border-sang-700" label="fait" />
      <LegendDot color="bg-anthracite-700 border-anthracite-600" label="prévue" />
      <LegendDot color="bg-anthracite-800/60 border-dashed border-anthracite-700" label="libre" />
      <span className="ml-1">D = déload</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('h-3 w-3 rounded border', color)} />
      {label}
    </span>
  );
}

function formatRange(start: string, end: string): string {
  return `${shortDate(start)} → ${shortDate(end)}`;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
