import { Link } from 'react-router-dom';
import type { Catalog } from '@/engine/catalog';
import { Card } from '@/components/Card';
import { cn } from '@/lib/cn';
import {
  exerciseLabel,
  formatCycleDates,
  muscleLabel,
  type CycleHistoryItem,
  type MuscleObjectiveOutcome,
  type MuscleOutcomeStatus,
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
        <p className="text-sm text-anthracite-300">
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
        <span className="text-xs text-anthracite-300">
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
          <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
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
                    delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-sang-500' : 'text-anthracite-300',
                  )}
                >
                  {formatDelta(delta)} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.objectivesByMuscle !== null && (
        <ObjectivesOutcomeSection items={item.objectivesByMuscle} />
      )}

      {/* Conv #15-5 — lien vers le bilan complet de ce cycle (vu depuis
          Progrès > Cycles, ouverture d'un bilan archivé). */}
      <Link
        to={`/cycle-bilan?cycle=${item.cycleIndex}`}
        className="mt-1 self-end text-xs text-sang-400 underline-offset-2 hover:underline"
        data-testid={`open-bilan-${item.cycleIndex}`}
      >
        Voir le bilan complet →
      </Link>
    </Card>
  );
}

// =============================================================================
// Visé vs fait par muscle (Conv #14c-7)
// =============================================================================

const OBJECTIVE_LABEL: Readonly<Record<string, string>> = {
  hypertrophie: 'Hypertrophie',
  force: 'Force',
  maintien: 'Maintien',
};

const OUTCOME_LABEL: Readonly<Record<MuscleOutcomeStatus, string>> = {
  progressed: 'progressé',
  plateau: 'plateau',
  undertrained: 'sous-volume',
  overshoot: 'sur-volume',
  unknown: '—',
};

const OUTCOME_TONE: Readonly<Record<MuscleOutcomeStatus, string>> = {
  progressed: 'text-emerald-400',
  plateau: 'text-amber-400',
  undertrained: 'text-sang-400',
  overshoot: 'text-amber-300',
  unknown: 'text-anthracite-400',
};

function ObjectivesOutcomeSection({
  items,
}: {
  readonly items: ReadonlyArray<MuscleObjectiveOutcome>;
}) {
  const prioritaires = items.filter((i) => i.status === 'PRIORITAIRE');
  // On affiche prioritaires d'abord. Le reste reste accessible mais
  // n'est pas le focus de la comparaison "visé vs fait".
  const visible = prioritaires.length > 0 ? prioritaires : items;
  if (visible.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-1 border-t border-anthracite-800 pt-2"
      data-testid="cycle-objectives-outcome"
    >
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
        Visé vs fait
      </span>
      <ul className="flex flex-col gap-1">
        {visible.map((o) => (
          <li
            key={o.muscle}
            className="flex items-center justify-between gap-2 text-xs text-anthracite-200"
          >
            <span className="min-w-0 truncate">
              {muscleLabel(o.muscle)}
              <span className="ml-1 text-anthracite-400">
                — {OBJECTIVE_LABEL[o.objective] ?? o.objective}
              </span>
            </span>
            <span
              className={cn('shrink-0 tabular-nums', OUTCOME_TONE[o.outcome])}
            >
              {OUTCOME_LABEL[o.outcome]}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
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
                : 'text-anthracite-300',
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
