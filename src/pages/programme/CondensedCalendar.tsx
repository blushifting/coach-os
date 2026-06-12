import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
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
          Cycle {matrix.cycleIndex} — Semaine {Math.min(currentWeekInCycle, 5)}/5
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
    <div className="flex flex-col gap-1.5 text-[11px] text-anthracite-200">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <LegendDot color="bg-emerald-700/70 border-emerald-500" label="Séance faite" />
        <LegendDot color="bg-blue-800/60 border-blue-500" label="Séance prévue" />
        <LegendDot color="bg-anthracite-900/40 border-dashed border-anthracite-700" label="Jour libre" />
        <LegendDot color="bg-anthracite-900/60 border-anthracite-700" label="Repos conseillé (marqué Z)" />
        <LegendDot
          color="ring-2 ring-sang-500 bg-anthracite-800"
          label="Aujourd'hui"
        />
      </div>
      <span className="text-[10px] text-anthracite-300">
        D = semaine de <Concept topic="deload">Déload</Concept> (charges réduites)
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-3.5 w-3.5 shrink-0 rounded border', color)} />
      <span className="leading-tight">{label}</span>
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
