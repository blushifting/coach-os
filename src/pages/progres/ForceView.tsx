/**
 * Onglet Progrès → vue "Force" (Conv #11g, refonte lisibilité Conv #14a).
 *
 * Pour chaque exercice présent dans l'historique avec ≥ 2 points : nom,
 * plafond actuel (kg), delta % depuis le 1er point, et une mini-courbe
 * SVG (polyline) qui visualise l'évolution chronologique de l'e1RM.
 *
 * Refonte #14a-1 : axe Y avec 3 ticks (min/mid/max) en kg, ligne pointillée
 * au plafond courant, polyline plus épaisse, chips PR sur les points qui
 * battent le record précédent d'au moins +2 kg.
 */

import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useCatalog, useGymBrand } from '@/store/selectors';
import { cn } from '@/lib/cn';
import type { ExerciseE1rmSeries } from '@/lib/progress';

interface ForceViewProps {
  readonly series: ReadonlyArray<ExerciseE1rmSeries>;
}

export function ForceView({ series }: ForceViewProps) {
  const catalog = useCatalog();
  const brand = useGymBrand() ?? undefined;
  const resolveName = (s: ExerciseE1rmSeries): string => {
    if (catalog !== null && catalog.has(s.exercise_id)) {
      return displayExerciseName(catalog.get(s.exercise_id), brand);
    }
    return s.nom_fr;
  };

  if (series.length === 0) {
    return (
      <Card data-testid="force-empty">
        <p className="text-sm text-anthracite-300">
          Pas encore assez de données. Termine 2 séances avec un même exercice
          pour voir ta courbe de Plafond.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="force-view">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-anthracite-300">
        Plafond par exercice
        <HelpButton topic="plafond" label="Aide : Plafond" />
      </div>
      {series.map((s) => (
        <Card
          key={s.exercise_id}
          data-testid={`force-card-${s.exercise_id}`}
          data-exercise-id={s.exercise_id}
        >
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="text-sm font-medium text-white truncate">
                {resolveName(s)}
              </div>
              {/* Conv #17 — Affiche le nombre de séances ayant alimenté la
                  courbe. Évite la question "pourquoi cet exo a moins de
                  points" : exos accessoires (1×/sem) ou substitués en
                  cours de route ont mécaniquement moins de points. */}
              <div
                className="text-[10px] leading-none tabular-nums text-anthracite-400"
                data-testid={`force-points-${s.exercise_id}`}
              >
                {s.points.length} séance{s.points.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className="font-display text-base leading-none tabular-nums text-white"
                data-testid={`force-current-${s.exercise_id}`}
              >
                {s.current.toFixed(1)} {kgUnitLabel(s.charge)}
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
          <MiniLine
            points={s.points.map((p) => p.e1rm)}
            current={s.current}
            testId={`force-chart-${s.exercise_id}`}
          />
        </Card>
      ))}
    </div>
  );
}

interface MiniLineProps {
  readonly points: ReadonlyArray<number>;
  readonly current: number;
  readonly testId?: string;
}

/** Saut minimum (en kg) pour qu'un nouveau maximum soit qualifié de PR. */
const PR_THRESHOLD_KG = 2;

/**
 * Mini-courbe polyline avec axe Y (3 ticks en kg), ligne pointillée au
 * plafond courant, et chips "PR" sur chaque point qui bat le précédent
 * record d'au moins +2 kg.
 *
 * Layout :
 *   viewBox 320×80. Marge gauche 28 px réservée aux labels de l'axe Y,
 *   marge haute 12 px pour laisser respirer les chips PR au-dessus des
 *   points hauts. Marge basse 4 px pour le tick "min".
 */
function MiniLine({ points, current, testId }: MiniLineProps) {
  const W = 320;
  const H = 84;
  const ML = 28; // marge gauche (labels Y)
  const MT = 16; // marge haute (étoiles records — clearance constante au-dessus du point max)
  const MB = 4; // marge basse
  const innerW = W - ML;
  const innerH = H - MT - MB;
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  /** Projette une valeur e1rm sur la coordonnée Y du SVG. */
  const yOf = (v: number) => MT + innerH - ((v - min) / range) * innerH;
  /** Projette l'index temporel sur X. */
  const xOf = (i: number) => ML + (i / (points.length - 1)) * innerW;

  const xy = points.map((v, i) => [xOf(i), yOf(v)] as const);
  const polyline = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Détection des PR : un point est PR s'il dépasse strictement le max
  // running précédent d'au moins PR_THRESHOLD_KG. Le tout premier point
  // n'est jamais marqué (pas de "précédent").
  const prFlags: boolean[] = points.map(() => false);
  let runningMax = points[0]!;
  for (let i = 1; i < points.length; i++) {
    const v = points[i]!;
    if (v >= runningMax + PR_THRESHOLD_KG) {
      prFlags[i] = true;
    }
    if (v > runningMax) runningMax = v;
  }

  // Ticks Y : min, mid, max. Si min === max (courbe plate), on tasse les
  // ticks à la valeur courante pour éviter d'afficher trois fois la même.
  const flat = range === 1 && min === max;
  const tickValues = flat
    ? [min]
    : [max, (min + max) / 2, min];

  const currentY = yOf(current);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label="Courbe de progression du Plafond"
      data-testid={testId}
    >
      {/* Axe Y : labels kg + ticks horizontaux discrets. */}
      {tickValues.map((v, i) => {
        const y = yOf(v);
        return (
          <g key={`tick-${i}`}>
            <line
              x1={ML}
              x2={W}
              y1={y}
              y2={y}
              stroke="rgba(154,160,170,0.10)"
              strokeWidth={1}
            />
            <text
              x={ML - 4}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              fill="#9aa0aa"
              className="tabular-nums"
            >
              {v.toFixed(0)} kg
            </text>
          </g>
        );
      })}

      {/* Ligne pointillée au plafond courant (Conv #14a) — repère visuel
          du "niveau atteint aujourd'hui". */}
      <line
        x1={ML}
        x2={W}
        y1={currentY}
        y2={currentY}
        stroke="#cc4a59"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.55}
        data-testid="force-current-line"
      />

      {/* Conv #11i — tracé animé `draw-line` via pathLength=1 + dasharray=1.
          La ligne se trace progressivement à l'apparition de la card.
          Conv #14a — strokeWidth passé de 2.5 à 3 pour plus de présence. */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#dc2626"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className="animate-draw-line"
        style={{ strokeDasharray: 1 }}
      />

      {/* Conv #20.5 — Points de la courbe : fade-in opacité pure, synchronisé
          sur le tracé de la polyline (900 ms total). Chaque point apparaît en
          place quand la ligne le traverse — fini le "saut d'en bas" via
          reveal-up qui donnait l'impression que les points venaient d'un autre
          plan. Les étoiles records (plus bas) gardent reveal-up : leur slide
          marque visuellement le "PR célébré". */}
      {xy.map(([x, y], i) => {
        const tracePct = points.length > 1 ? i / (points.length - 1) : 0;
        const delayMs = tracePct * 900;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={prFlags[i] ? 3.5 : 2.5}
            fill="#dc2626"
            stroke={prFlags[i] ? '#fff' : 'none'}
            strokeWidth={prFlags[i] ? 1 : 0}
            className="animate-point-fade-in"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        );
      })}

      {/* Étoiles "record" — au-dessus de chaque point qui bat le précédent
          record d'au moins +2 kg. Étoile verte (réussite) pleine avec liseré
          pour ressortir sur la polyline.

          Conv #16 — fix positionnement : on wrappe l'animation `reveal-up`
          dans un <g> INTERNE. L'animation CSS pose un `transform` qui
          écrasait le `transform="translate(...)"` SVG si appliqué sur le
          même nœud, et toutes les étoiles s'empilaient en 0,0. Avec deux
          niveaux de <g> (externe = position, interne = animation), les
          transforms ne se marchent plus dessus. */}
      {xy.map(([x, y], i) => {
        if (!prFlags[i]) return null;
        const cx = x;
        const cy = y - 9;
        return (
          <g
            key={`pr-${i}`}
            transform={`translate(${cx} ${cy})`}
            data-testid="force-pr-chip"
          >
            <g
              className="animate-reveal-up"
              style={{ animationDelay: `${700 + i * 60}ms`, animationFillMode: 'both' }}
            >
              {/* 1.16 — étoile record en VERT de réussite (plus de doré : il
                  vire au jaune/warning en digital). green-500 = #22c55e. */}
              <polygon
                points="0,-5 1.5,-1.5 5,-1.5 2.2,0.7 3.3,4.5 0,2.2 -3.3,4.5 -2.2,0.7 -5,-1.5 -1.5,-1.5"
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={0.6}
                strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
