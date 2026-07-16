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
import { Concept } from '@/components/Concept';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useCatalog, useGymBrand } from '@/store/selectors';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import { formatWeekLabel } from '@/lib/progress';
import type { E1rmPoint, ExerciseE1rmSeries } from '@/lib/progress';

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
          Pas encore assez de données. Dès qu'un exercice a été fait sur
          2&nbsp;séances, sa courbe de{' '}
          <Concept topic="plafond">Plafond</Concept> apparaît ici.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="force-view">
      <header className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">
          <Concept topic="plafond">Plafond</Concept> par exercice
        </h2>
      </header>
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
            points={s.points.slice(-FORCE_WINDOW_POINTS)}
            current={s.current}
            testId={`force-chart-${s.exercise_id}`}
          />
        </Card>
      ))}
    </div>
  );
}

interface MiniLineProps {
  /** #12 (E-3) — points datés (fenêtre glissante déjà appliquée par l'appelant). */
  readonly points: ReadonlyArray<E1rmPoint>;
  readonly current: number;
  readonly testId?: string;
}

/** Saut minimum (en kg) pour qu'un nouveau maximum soit qualifié de PR. */
const PR_THRESHOLD_KG = 2;

/**
 * #12 (E-3) — fenêtre glissante : nombre max de points affichés par courbe.
 * Au-delà, on ne garde que les plus récents. Sans borne, une courbe accumulait
 * tous ses points depuis le début (40-50 après quelques cycles, illisibles).
 * Le compteur « N séances » de l'en-tête garde, lui, le total réel.
 */
const FORCE_WINDOW_POINTS = 12;

/**
 * Mini-courbe polyline avec axe Y (3 ticks en kg), ligne pointillée au
 * plafond courant, chips "PR" au-dessus des points records, et labels de date
 * sous la courbe (1er / milieu / dernier point).
 *
 * Layout :
 *   viewBox 320×96. Marge gauche 28 px pour les labels de l'axe Y, marge haute
 *   16 px pour les étoiles records, marge basse 16 px pour les dates.
 */
function MiniLine({ points, current, testId }: MiniLineProps) {
  const W = 320;
  const H = 96;
  const ML = 28; // marge gauche (labels Y)
  const MT = 16; // marge haute (étoiles records — clearance constante au-dessus du point max)
  const MB = 16; // marge basse (labels de date)
  const innerW = W - ML;
  const innerH = H - MT - MB;
  if (points.length < 2) return null;

  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  /** Projette une valeur e1rm sur la coordonnée Y du SVG. */
  const yOf = (v: number) => MT + innerH - ((v - min) / range) * innerH;
  /** Projette l'index temporel sur X. */
  const xOf = (i: number) => ML + (i / (points.length - 1)) * innerW;

  const xy = values.map((v, i) => [xOf(i), yOf(v)] as const);
  const polyline = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const lastXy = xy[xy.length - 1];

  // Détection des PR : un point est PR s'il dépasse strictement le max
  // running précédent d'au moins PR_THRESHOLD_KG. Le tout premier point
  // n'est jamais marqué (pas de "précédent").
  const prFlags: boolean[] = values.map(() => false);
  let runningMax = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v >= runningMax + PR_THRESHOLD_KG) {
      prFlags[i] = true;
    }
    if (v > runningMax) runningMax = v;
  }

  // Ticks Y : extrémités + milieu, puis déduplication par LIBELLÉ affiché
  // (extrémités prioritaires). #63 — libellés à 1 décimale (avant : arrondi
  // à l'entier, qui masquait les petites variations de plafond ; l'user l'a
  // signalé). La dédup empêche deux ticks au même libellé sur une plage serrée.
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
              {v.toFixed(1)} kg
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
        className="motion-safe:animate-draw-line"
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
        const delayMs = tracePct * MOTION.draw;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={prFlags[i] ? 3.5 : 2.5}
            fill="#dc2626"
            stroke={prFlags[i] ? '#fff' : 'none'}
            strokeWidth={prFlags[i] ? 1 : 0}
            className="motion-safe:animate-point-fade-in"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        );
      })}

      {/* Conv #66 — onde sur le DERNIER point une fois le tracé arrivé : c'est
          le seul point qui répond à « où j'en suis maintenant », les autres sont
          de l'historique. Une seule fois, pas en boucle : sur un écran qu'on
          regarde longtemps, une pulsation perpétuelle devient un parasite. */}
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

      {/* Étoiles "record" — au-dessus de chaque point qui bat le précédent
          record d'au moins +2 kg. Étoile dorée pleine avec liseré pour
          ressortir sur la polyline.

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
              className="motion-safe:animate-reveal-up"
              style={{ animationDelay: `${700 + i * 60}ms`, animationFillMode: 'both' }}
            >
              {/* Étoile record en doré : petit accent décoratif ponctuel de
                  célébration (pas une couleur d'état) — toléré à cette échelle.
                  amber-400 = #fbbf24. */}
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
      {/* #12 (E-3) — labels de date sous la courbe : 1er, dernier, et milieu
          si ≥ 4 points. Situe la progression dans le temps (une pause se voit). */}
      {points.map((p, i) => {
        const show =
          i === 0 ||
          i === points.length - 1 ||
          (points.length >= 4 && i === Math.floor(points.length / 2));
        if (!show) return null;
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
        return (
          <text
            key={`date-${i}`}
            x={xOf(i)}
            y={H - 3}
            textAnchor={anchor}
            fontSize="8"
            fill="#9aa0aa"
            className="tabular-nums"
          >
            {formatWeekLabel(p.date)}
          </text>
        );
      })}
    </svg>
  );
}
