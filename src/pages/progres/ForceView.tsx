/**
 * Onglet Progrès → vue "Force" (Conv #11g).
 *
 * Pour chaque exercice présent dans l'historique avec ≥ 2 points : nom,
 * plafond actuel (kg), delta % depuis le 1er point, et une mini-courbe
 * SVG (polyline) qui visualise l'évolution chronologique de l'e1RM.
 *
 * Donne enfin la lecture "ma progression en charge dans le temps" qui était
 * dans la maquette v2 (`ForceView` + `MiniLine`) mais qui n'avait pas été
 * portée dans les premières conv.
 */

import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import type { ExerciseE1rmSeries } from '@/lib/progress';

interface ForceViewProps {
  readonly series: ReadonlyArray<ExerciseE1rmSeries>;
}

export function ForceView({ series }: ForceViewProps) {
  if (series.length === 0) {
    return (
      <Card data-testid="force-empty">
        <p className="text-sm text-anthracite-300">
          Pas encore assez de données. Termine 2 séances avec un même exo
          pour voir ta courbe de plafond.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="force-view">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-anthracite-300">
        Plafond par exo
        <HelpButton topic="plafond" label="Aide : plafond" />
      </div>
      {series.map((s) => (
        <Card
          key={s.exercise_id}
          data-testid={`force-card-${s.exercise_id}`}
          data-exercise-id={s.exercise_id}
        >
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <div className="min-w-0 text-sm font-medium text-white truncate">
              {s.nom_fr}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className="font-display text-base leading-none tabular-nums text-white"
                data-testid={`force-current-${s.exercise_id}`}
              >
                {s.current.toFixed(1)} kg
              </span>
              <span
                className={cn(
                  'text-[10px] leading-none tabular-nums',
                  s.deltaPct > 0.5
                    ? 'text-emerald-400'
                    : s.deltaPct < -0.5
                      ? 'text-sang-400'
                      : 'text-anthracite-300',
                )}
                data-testid={`force-delta-${s.exercise_id}`}
              >
                {s.deltaPct > 0 ? '+' : ''}
                {s.deltaPct.toFixed(1)} %
              </span>
            </div>
          </header>
          <MiniLine points={s.points.map((p) => p.e1rm)} />
        </Card>
      ))}
    </div>
  );
}

interface MiniLineProps {
  readonly points: ReadonlyArray<number>;
}

/**
 * Mini-courbe polyline. ViewBox 280×60. Si tous les points sont égaux,
 * on trace une ligne horizontale au milieu. Marges verticales 10 % pour
 * éviter que les points extrêmes touchent les bordures.
 */
function MiniLine({ points }: MiniLineProps) {
  const w = 280;
  const h = 60;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const margin = h * 0.1;
  const innerH = h - margin * 2;
  const xy = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - margin - ((v - min) / range) * innerH;
    return [x, y] as const;
  });
  const polyline = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height: h }}
      role="img"
      aria-label="Courbe de progression du plafond"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#dc2626" />
      ))}
    </svg>
  );
}
