import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import {
  formatWeekLabel,
  muscleLabel,
  type MuscleVolumeSeries,
} from '@/lib/progress';

interface VolumeViewProps {
  readonly series: ReadonlyArray<MuscleVolumeSeries>;
}

/**
 * Volume hebdo par muscle, N dernières semaines.
 *
 * Chaque ligne = un muscle. Mini-graphe à barres horizontales avec :
 * - ligne pointillée rouge = V_max (cap)
 * - ligne pointillée gris clair = V_min (seuil)
 * - barre colorée = volume réalisé la semaine (rouge sous, vert dans, ambre sur)
 *
 * Conv #11a : les lignes pointillées remplacent l'ancienne bande grise qui se
 * fondait dans le fond du tableau (illisible).
 *
 * Référence : 10_plan §3 Conv #6a, infobulle help "V_min / V_max".
 */
export function VolumeView({ series }: VolumeViewProps) {
  if (series.length === 0) {
    return (
      <Card data-testid="volume-empty">
        <p className="text-sm text-anthracite-300">
          Aucune donnée de volume — termine une séance pour voir tes barres.
        </p>
      </Card>
    );
  }

  // Échelle X commune : max sur l'ensemble (max(sets, vMax) × 1.1) pour comparer.
  let maxScale = 0;
  for (const s of series) {
    maxScale = Math.max(maxScale, s.vMax, ...s.points.map((p) => p.sets));
  }
  maxScale = Math.max(1, Math.ceil(maxScale * 1.1));

  const weekLabels = series[0]!.points.map((p) => formatWeekLabel(p.weekStart));

  return (
    <section className="flex flex-col gap-3" data-testid="volume-view">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Volume hebdo par muscle</h2>
        <HelpButton topic="vminmax" />
      </header>

      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2 p-3">
          <div />
          <div className="flex justify-between text-[9px] text-anthracite-300">
            {weekLabels.map((lbl, i) => (
              <span key={i}>{lbl}</span>
            ))}
          </div>

          {series.map((s) => (
            <MuscleRow key={s.muscle} series={s} maxScale={maxScale} />
          ))}
        </div>
      </Card>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-anthracite-300">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0 w-4 border-t border-dashed border-anthracite-200/70" />
          V_min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0 w-4 border-t border-dashed border-sang-400/80" />
          V_max
        </span>
        <span>Entre les deux = volume idéal. Sous : sous-dosé. Au-dessus : sur-volume.</span>
      </p>
    </section>
  );
}

interface MuscleRowProps {
  readonly series: MuscleVolumeSeries;
  readonly maxScale: number;
}

function MuscleRow({ series, maxScale }: MuscleRowProps) {
  const { muscle, vMin, vMax, points } = series;
  const hasTarget = vMax > 0;
  const minPct = hasTarget ? (vMin / maxScale) * 100 : 0;
  const maxPct = hasTarget ? (vMax / maxScale) * 100 : 0;
  return (
    <>
      <span className="truncate text-xs font-medium text-white">
        {muscleLabel(muscle)}
      </span>
      <div
        data-testid={`volume-row-${muscle}`}
        className="relative flex h-6 items-end gap-1"
      >
        {hasTarget && (
          <>
            <div
              aria-hidden="true"
              data-testid={`vmax-line-${muscle}`}
              className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-sang-400/80"
              style={{ bottom: `${maxPct}%` }}
            />
            <div
              aria-hidden="true"
              data-testid={`vmin-line-${muscle}`}
              className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-anthracite-200/60"
              style={{ bottom: `${minPct}%` }}
            />
          </>
        )}
        {points.map((p, i) => {
          const pct = (p.sets / maxScale) * 100;
          const tone = barTone(p.sets, vMin, vMax);
          return (
            <div
              key={i}
              className="relative h-full flex-1 rounded-sm bg-anthracite-900"
              data-testid={`volume-cell-${muscle}-${i}`}
              title={`${formatWeekLabel(p.weekStart)} · ${p.sets.toFixed(1)} séries`}
            >
              <div
                aria-hidden="true"
                className={cn('absolute bottom-0 left-0 right-0 rounded-sm', tone)}
                style={{ height: `${Math.min(100, pct)}%` }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

function barTone(sets: number, vMin: number, vMax: number): string {
  if (vMax === 0) return 'bg-anthracite-600';
  if (sets === 0) return 'bg-anthracite-600';
  if (sets < vMin) return 'bg-sang-700';
  if (sets > vMax) return 'bg-amber-600';
  return 'bg-emerald-600';
}
