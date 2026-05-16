import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import type { HelpTopic } from '@/lib/help-glossary';
import type { CycleProgress, WeekSessions } from '@/lib/dashboard';

interface WidgetsProps {
  readonly streak: number;
  readonly cycleProgress: CycleProgress;
  readonly weekSessions: WeekSessions;
  readonly nextBilanDate: string | null;
}

export function Widgets({
  streak,
  cycleProgress,
  weekSessions,
  nextBilanDate,
}: WidgetsProps) {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="programme-widgets">
      <WidgetTile
        testId="widget-streak"
        label="Série"
        value={streak === 0 ? '—' : `${streak}`}
        unit={streak > 0 ? (streak === 1 ? 'sem' : 'sem') : ''}
        hint={streak === 0 ? 'commence cette semaine' : 'consécutives'}
      />
      <WidgetTile
        testId="widget-week-sessions"
        label="Cette semaine"
        value={`${weekSessions.done}`}
        unit={weekSessions.planned > 0 ? `/ ${weekSessions.planned}` : ''}
        hint="séances"
      />
      <WidgetTile
        testId="widget-cycle-pct"
        label="Cycle"
        helpTopic="cycle"
        value={`${cycleProgress.pct}`}
        unit="%"
        hint={
          cycleProgress.planned > 0
            ? `${cycleProgress.done} / ${cycleProgress.planned} séances`
            : 'pas de cycle posé'
        }
        progressPct={cycleProgress.pct}
      />
      <WidgetTile
        testId="widget-next-bilan"
        label="Prochain bilan"
        value={nextBilanDate === null ? '—' : formatShortDate(nextBilanDate)}
        unit=""
        hint={nextBilanDate === null ? 'cycle non démarré' : 'fin de cycle'}
      />
    </div>
  );
}

interface WidgetTileProps {
  readonly testId: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly hint: string;
  readonly progressPct?: number;
  readonly helpTopic?: HelpTopic;
}

function WidgetTile({
  testId,
  label,
  value,
  unit,
  hint,
  progressPct,
  helpTopic,
}: WidgetTileProps) {
  return (
    <Card className="flex flex-col gap-1" data-testid={testId}>
      <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-anthracite-300">
        {label}
        {helpTopic && <HelpButton topic={helpTopic} label={`Aide : ${label}`} />}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-white tabular-nums">{value}</span>
        {unit !== '' && <span className="text-sm text-anthracite-300">{unit}</span>}
      </div>
      <span className="text-xs text-anthracite-300">{hint}</span>
      {progressPct !== undefined && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-anthracite-700">
          <div
            className={cn('h-full bg-sang-700 transition-[width]')}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}
    </Card>
  );
}

function formatShortDate(iso: string): string {
  // YYYY-MM-DD → "07/06"
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
