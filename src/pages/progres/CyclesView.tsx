import type { Catalog } from '@/engine/catalog';
import { Card } from '@/components/Card';
import { cn } from '@/lib/cn';
import {
  exerciseLabel,
  formatCycleDates,
  type CycleHistoryItem,
} from '@/lib/progress';

interface CyclesViewProps {
  readonly items: ReadonlyArray<CycleHistoryItem>;
  readonly catalog: Catalog | null;
}

/**
 * Historique des cycles terminés, du plus récent au plus ancien.
 *
 * Chaque card affiche le **nom du programme suivi + dates** (cf. 08 §529 :
 * remplacer "Cycle 1 / Cycle 2" par un libellé lisible), le top 3 des
 * progressions de plafond, et la comparaison volume + Δplafond vs cycle
 * précédent.
 */
export function CyclesView({ items, catalog }: CyclesViewProps) {
  if (items.length === 0) {
    return (
      <Card data-testid="cycles-empty">
        <p className="text-sm text-anthracite-500">
          Aucun cycle terminé pour le moment. Le premier bilan apparaîtra ici à
          la fin de ton cycle en cours.
        </p>
      </Card>
    );
  }
  return (
    <section className="flex flex-col gap-3" data-testid="cycles-view">
      <h2 className="text-sm font-semibold text-white">Historique des cycles</h2>
      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <CycleCard key={it.cycleIndex} item={it} catalog={catalog} />
        ))}
      </div>
    </section>
  );
}

interface CycleCardProps {
  readonly item: CycleHistoryItem;
  readonly catalog: Catalog | null;
}

function CycleCard({ item, catalog }: CycleCardProps) {
  const title = item.programName ?? `Cycle ${item.cycleIndex}`;
  return (
    <Card
      data-testid={`cycle-card-${item.cycleIndex}`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-xs text-anthracite-500">
          {formatCycleDates(item.startDate, item.endDate)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Volume total"
          value={`${Math.round(item.volumeTotalKg).toLocaleString('fr-FR')} kg`}
          delta={item.deltaVolumeKg}
          unit="kg"
        />
        <Metric
          label="Top plafond"
          value={
            item.plafondsTop.length > 0
              ? `${formatDelta(item.plafondsTop[0]![1])} kg`
              : '—'
          }
          delta={item.deltaTopPlafondKg}
          unit="kg"
        />
      </div>

      {item.plafondsTop.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-anthracite-500">
            Progressions plafonds
          </span>
          <ul className="flex flex-col gap-1">
            {item.plafondsTop.map(([exId, delta]) => (
              <li
                key={exId}
                className="flex items-center justify-between text-xs text-anthracite-400"
              >
                <span className="truncate">{exerciseLabel(exId, catalog)}</span>
                <span
                  className={cn(
                    'tabular-nums',
                    delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-sang-500' : 'text-anthracite-500',
                  )}
                >
                  {formatDelta(delta)} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly delta: number | null;
  readonly unit: string;
}

function Metric({ label, value, delta }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-anthracite-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
      {delta !== null && (
        <span
          className={cn(
            'text-[11px] tabular-nums',
            delta > 0
              ? 'text-emerald-400'
              : delta < 0
                ? 'text-sang-500'
                : 'text-anthracite-500',
          )}
        >
          {formatDelta(delta)} vs cycle préc.
        </span>
      )}
    </div>
  );
}

function formatDelta(n: number): string {
  if (n > 0) return `+${formatNum(n)}`;
  if (n < 0) return formatNum(n); // déjà préfixé "-"
  return '0';
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('fr-FR');
  return n.toFixed(1).replace(/\.0$/, '');
}
