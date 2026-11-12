/**
 * Onglet Progrès → vue "Force" (Conv #11g, refonte lisibilité Conv #14a).
 *
 * Pour chaque exercice présent dans l'historique avec ≥ 2 points : nom,
 * plafond actuel (kg), delta % depuis le 1er point, et une mini-courbe
 * SVG (polyline) qui visualise l'évolution chronologique de l'e1RM.
 *
 * Refonte #14a-1 : axe Y avec 3 ticks (min/mid/max) en kg, ligne pointillée
 * au plafond courant, polyline plus épaisse, étoiles sur les points record.
 *
 * Dump 2.4, étape 5 — l'axe horizontal suit les dates (n° 21) : une pause garde
 * sa vraie longueur, son segment passe en pointillé avec sa durée. Une étoile
 * marque une séance record (n° 9 : deux reps de mieux que la meilleure mesure
 * passée).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useCatalog, useGymBrand } from '@/store/selectors';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import { forceChartLayout } from '@/lib/progress';
import type { E1rmPoint, ExerciseE1rmSeries } from '@/lib/progress';

/**
 * B-2 — nombre de courbes affichées d'emblée, et pas d'un cran sur « Voir les
 * suivants ». L'ancien `topN = 8` du sélecteur coupait sans rien dire : sur un
 * catalogue réel (~20 exos travaillés), la moitié disparaissait et l'onglet
 * paraissait incomplet. On garde une liste courte à l'ouverture — mais le
 * bouton dit combien il en reste.
 */
const FORCE_PAGE_SIZE = 10;

/** Début de cycle, pour les repères verticaux. */
export interface CycleStart {
  readonly cycle_index: number;
  readonly start_date: string;
}

interface ForceViewProps {
  /** Séries déjà restreintes à la période choisie. */
  readonly series: ReadonlyArray<ExerciseE1rmSeries>;
  /**
   * Axe du temps commun à toutes les cartes (période « 3 derniers mois »), ou
   * `null` : chaque courbe va de sa première à sa dernière mesure (« Tout »).
   */
  readonly axis: { readonly from: string; readonly to: string } | null;
  readonly cycleStarts: ReadonlyArray<CycleStart>;
}

/** Bornes de l'axe du temps d'une carte. */
function axisOf(
  points: ReadonlyArray<E1rmPoint>,
  axis: ForceViewProps['axis'],
): { from: string; to: string } {
  return axis ?? { from: points[0]!.date, to: points[points.length - 1]!.date };
}

export function ForceView({ series, axis, cycleStarts }: ForceViewProps) {
  const catalog = useCatalog();
  const brand = useGymBrand() ?? undefined;
  const [visibleCount, setVisibleCount] = useState(FORCE_PAGE_SIZE);
  // Le catalogue d'exos suivis change (nouveau cycle, exo remplacé) → on
  // repart d'une liste courte plutôt que de garder une pagination héritée
  // d'une autre liste.
  useEffect(() => {
    setVisibleCount(FORCE_PAGE_SIZE);
  }, [series]);

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
          Pas encore assez de données. Dès qu'un exercice a été fait sur
          2&nbsp;séances, sa courbe de{' '}
          <Concept topic="plafond">Plafond</Concept> apparaît ici.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="force-view">
      <header>
        <h2 className="text-sm font-semibold text-white">
          <Concept topic="plafond">Plafond</Concept> par exercice
        </h2>
      </header>
      {series.slice(0, visibleCount).map((s) => (
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
                  // Dump 2.4, étape 5 — une baisse est un avertissement (ambre),
                  // pas un problème (rouge).
                  s.deltaPct > 0.5
                    ? 'text-emerald-400'
                    : s.deltaPct < -0.5
                      ? 'text-amber-400'
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
            points={s.points}
            current={s.current}
            axis={axisOf(s.points, axis)}
            cycleStarts={cycleStarts}
            testId={`force-chart-${s.exercise_id}`}
          />
        </Card>
      ))}

      {visibleCount < series.length && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setVisibleCount((n) => n + FORCE_PAGE_SIZE)}
          data-testid="force-show-more"
        >
          Voir {Math.min(FORCE_PAGE_SIZE, series.length - visibleCount)}&nbsp;exercices
          de plus · {series.length - visibleCount}&nbsp;restants
        </Button>
      )}
    </div>
  );
}

interface MiniLineProps {
  /** Points datés, déjà restreints à la période choisie. */
  readonly points: ReadonlyArray<E1rmPoint>;
  readonly current: number;
  /** Bornes de l'axe du temps (dates YYYY-MM-DD). */
  readonly axis: { readonly from: string; readonly to: string };
  readonly cycleStarts: ReadonlyArray<CycleStart>;
  readonly testId?: string;
}

/**
 * Mini-courbe avec axe Y (3 ticks en kg), ligne pointillée au plafond courant,
 * étoiles sur les séances record, axe du temps à l'échelle réelle (mois en bas,
 * repères de cycle en haut) et pauses en pointillé avec leur durée.
 *
 * Layout :
 *   viewBox 320×104. Marge gauche 34 px pour les labels de l'axe Y, marge haute
 *   16 px pour les étoiles et les repères de cycle, marge basse 24 px pour la
 *   durée des pauses et les mois.
 */
function MiniLine({ points, current, axis, cycleStarts, testId }: MiniLineProps) {
  const W = 320;
  const H = 104;
  const ML = 34; // marge gauche (labels Y)
  const MR = 4; // marge droite (le dernier point ne touche pas le bord)
  const MT = 16; // marge haute (étoiles records, repères de cycle)
  const MB = 24; // marge basse (durée des pauses, mois)
  const innerW = W - ML - MR;
  const innerH = H - MT - MB;
  if (points.length < 2) return null;

  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const layout = forceChartLayout(points, axis.from, axis.to, cycleStarts);

  /** Projette une valeur e1rm sur la coordonnée Y du SVG. */
  const yOf = (v: number) => MT + innerH - ((v - min) / range) * innerH;
  /** Projette une position 0–1 de l'axe du temps sur X. */
  const xOf = (f: number) => ML + f * innerW;

  const xy = values.map((v, i) => [xOf(layout.xs[i]!), yOf(v)] as const);
  const lastXy = xy[xy.length - 1];
  const gapAt = new Map(layout.gaps.map((g) => [g.index, g.weeks]));

  // Tracé continu découpé aux pauses : chaque morceau est une polyline pleine,
  // chaque pause un segment pointillé (aucune mesure entre les deux points).
  const runs: Array<Array<readonly [number, number]>> = [[xy[0]!]];
  for (let i = 1; i < xy.length; i++) {
    if (gapAt.has(i)) runs.push([xy[i]!]);
    else runs[runs.length - 1]!.push(xy[i]!);
  }

  // Ticks Y : extrémités + milieu, puis déduplication par LIBELLÉ affiché
  // (extrémités prioritaires). #63 — libellés à 1 décimale.
  const tickCandidates = min === max ? [min] : [max, min, (min + max) / 2];
  const seenTickLabels = new Set<string>();
  const tickValues = tickCandidates.filter((v) => {
    const label = v.toFixed(1);
    if (seenTickLabels.has(label)) return false;
    seenTickLabels.add(label);
    return true;
  });

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
            <line x1={ML} x2={W} y1={y} y2={y} stroke="rgba(154,160,170,0.10)" strokeWidth={1} />
            <text
              x={ML - 4}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              fill="#9aa0aa"
              className="tabular-nums"
            >
              {v.toFixed(1)} kg
            </text>
          </g>
        );
      })}

      {/* Conv #77 — repères de début de cycle, à leur vraie date, sous la courbe. */}
      {layout.cycleMarks.map(({ x: f, cycleIndex }) => {
        const x = xOf(f);
        const nearRightEdge = x > W - 20;
        return (
          <g key={`cycle-${cycleIndex}`} data-testid={`force-cycle-${cycleIndex}`}>
            <line
              x1={x}
              x2={x}
              y1={MT - 5}
              y2={MT + innerH}
              stroke="rgba(154,160,170,0.45)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={nearRightEdge ? x - 3 : x + 3}
              y={MT - 7}
              textAnchor={nearRightEdge ? 'end' : 'start'}
              fontSize="8"
              fill="#9aa0aa"
            >
              C{cycleIndex}
            </text>
          </g>
        );
      })}

      {/* Ligne pointillée au plafond courant (Conv #14a). */}
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

      {/* Pauses : segment pointillé, durée écrite dessous. */}
      {layout.gaps.map(({ index, weeks }) => {
        const [x1, y1] = xy[index - 1]!;
        const [x2, y2] = xy[index]!;
        return (
          <g key={`gap-${index}`} data-testid="force-gap">
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="3 4"
              strokeLinecap="round"
              opacity={0.6}
            />
            <text
              x={(x1 + x2) / 2}
              y={MT + innerH + 10}
              textAnchor="middle"
              fontSize="8"
              fill="#9aa0aa"
              className="tabular-nums"
            >
              {weeks}&nbsp;sem.
            </text>
          </g>
        );
      })}

      {/* Conv #11i — tracé animé `draw-line` via pathLength=1 + dasharray=1. */}
      {runs
        .filter((run) => run.length > 1)
        .map((run, r) => (
          <polyline
            key={`run-${r}`}
            points={run.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="#dc2626"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="motion-safe:animate-draw-line"
            style={{ strokeDasharray: 1 }}
          />
        ))}

      {/* Conv #20.5 — points en fondu, synchronisés sur le tracé. */}
      {xy.map(([x, y], i) => {
        const delayMs = layout.xs[i]! * MOTION.draw;
        const record = points[i]!.record;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={record ? 3.5 : 2.5}
            fill="#dc2626"
            stroke={record ? '#fff' : 'none'}
            strokeWidth={record ? 1 : 0}
            className="motion-safe:animate-point-fade-in"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        );
      })}

      {/* Conv #66 — onde sur le DERNIER point une fois le tracé arrivé. */}
      {lastXy !== undefined && (
        <circle
          cx={lastXy[0]}
          cy={lastXy[1]}
          r={2.5}
          fill="none"
          stroke="#dc2626"
          strokeWidth={1.5}
          className="motion-safe:animate-last-point-ping"
          style={{ animationDelay: `${MOTION.draw}ms` }}
          data-testid="force-last-point-ping"
        />
      )}

      {/* Étoiles « record » au-dessus des séances record. Conv #16 — deux niveaux
          de <g> : l'externe positionne, l'interne anime (sinon le transform CSS
          de l'animation écrase celui du SVG). */}
      {xy.map(([x, y], i) => {
        if (!points[i]!.record) return null;
        return (
          <g key={`pr-${i}`} transform={`translate(${x} ${y - 9})`} data-testid="force-pr-chip">
            <g
              className="motion-safe:animate-reveal-up"
              style={{ animationDelay: `${700 + i * 60}ms`, animationFillMode: 'both' }}
            >
              {/* Étoile record en doré : accent décoratif ponctuel (amber-400). */}
              <polygon
                points="0,-5 1.5,-1.5 5,-1.5 2.2,0.7 3.3,4.5 0,2.2 -3.3,4.5 -2.2,0.7 -5,-1.5 -1.5,-1.5"
                fill="#fbbf24"
                stroke="#fff"
                strokeWidth={0.6}
                strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })}

      {/* Mois sous la courbe, au premier du mois. */}
      {layout.monthTicks.map(({ x: f, label }) => {
        const x = xOf(f);
        return (
          <g key={`month-${label}-${f}`}>
            <line x1={x} x2={x} y1={MT + innerH} y2={MT + innerH + 3} stroke="rgba(154,160,170,0.45)" />
            <text
              x={x}
              y={H - 3}
              textAnchor={x > W - 16 ? 'end' : x < ML + 16 ? 'start' : 'middle'}
              fontSize="8"
              fill="#9aa0aa"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
