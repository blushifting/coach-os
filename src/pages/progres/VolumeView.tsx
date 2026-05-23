/**
 * Onglet Progrès → vue "Volume" — Conv #17.
 *
 * Refonte qui fusionne l'ancienne Couverture (silhouette de la semaine en
 * cours) et l'ancien Volume (barres hebdo) en une seule vue cohérente :
 *
 *  1. Silhouette anatomique colorée selon le statut hebdo en cours
 *     (sous_min / ok / depassement / non_travaille) — **cliquable**.
 *  2. Légende couleur (3 états quanti : sous / cible / sur).
 *  3. Liste de cartes muscle, triées :
 *       - PRIORITAIRES (par rank user croissant)
 *       - puis SUGGERE
 *       - puis NON_COUVERT
 *     Chaque carte affiche une mini-courbe de l'évolution semainière du
 *     volume (séries/sem), V_min/V_max franches, dernier point (semaine en
 *     cours) **en pointillé** car incomplet.
 *  4. Click muscle silhouette → scrollIntoView vers sa carte + liseré gold
 *     temporaire pour le repérer.
 */

import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import {
  AnatomicalSilhouette,
  statusToSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import { cn } from '@/lib/cn';
import {
  formatWeekLabel,
  muscleLabel,
  type CoverageStatus,
  type MuscleCoverage,
  type MuscleVolumeSeries,
} from '@/lib/progress';
import type { MuscleGoal } from '@/engine/models';

interface VolumeViewProps {
  readonly coverage: ReadonlyArray<MuscleCoverage>;
  readonly volume: ReadonlyArray<MuscleVolumeSeries>;
  readonly muscleGoals: Readonly<Record<string, MuscleGoal>>;
}

export function VolumeView({ coverage, volume, muscleGoals }: VolumeViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Map coverage par muscle pour lookup O(1).
  const coverageByMuscle = useMemo(() => {
    const m = new Map<string, MuscleCoverage>();
    for (const c of coverage) m.set(c.muscle, c);
    return m;
  }, [coverage]);

  // Highlights pour la silhouette : on s'appuie sur la couverture hebdo
  // **en cours**. hors_scope → off (gris discret).
  const highlights = useMemo(() => {
    const h: Record<string, SilhouetteStatus> = {};
    for (const c of coverage) {
      h[c.muscle] = statusToSilhouette(c.status);
    }
    return h;
  }, [coverage]);

  // Liste triée des muscles affichés : PRIORITAIRE (rank croissant) →
  // SUGGERE → NON_COUVERT. On exclut hors_scope (= aucune cible posée) pour
  // ne pas polluer la liste de cartes vides.
  const sortedSeries = useMemo(() => {
    const statusOrder: Record<string, number> = {
      PRIORITAIRE: 0,
      SUGGERE: 1,
      NON_COUVERT: 2,
    };
    const rankOf = (m: string): number =>
      muscleGoals[m]?.priority_rank ?? 99;
    return [...volume]
      .filter((s) => {
        // Exclut les muscles sans cible (vMin === 0 && vMax === 0) qui
        // n'ont rien à dire — sauf si l'utilisateur a effectivement
        // travaillé ce muscle cette semaine (alors on l'affiche pour
        // documenter le volume "hors cible").
        const cov = coverageByMuscle.get(s.muscle);
        if (cov === undefined) return false;
        if (cov.status === 'hors_scope' && cov.sets === 0) return false;
        return true;
      })
      .sort((a, b) => {
        const sA = statusOrder[a.status] ?? 3;
        const sB = statusOrder[b.status] ?? 3;
        if (sA !== sB) return sA - sB;
        if (a.status === 'PRIORITAIRE') {
          return rankOf(a.muscle) - rankOf(b.muscle);
        }
        return a.muscle.localeCompare(b.muscle);
      });
  }, [volume, coverageByMuscle, muscleGoals]);

  function handleSilhouetteClick(muscle: string) {
    const cov = coverageByMuscle.get(muscle);
    // Pour un muscle absent de la liste (hors_scope, 0 séries) on bascule
    // quand même la sélection pour donner un feedback visuel — mais on ne
    // scrolle pas car il n'y a pas de carte.
    if (cov === undefined || (cov.status === 'hors_scope' && cov.sets === 0)) {
      setSelected(muscle);
      return;
    }
    setSelected(muscle);
    const node = cardRefs.current[muscle];
    if (node !== null && node !== undefined) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (coverage.length === 0) {
    return (
      <Card data-testid="volume-empty">
        <p className="text-sm text-anthracite-300">
          Aucun muscle ciblé pour le moment. Définis tes objectifs depuis l'onglet
          Profil.
        </p>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3" data-testid="volume-view">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Volume par muscle</h2>
        <HelpButton topic="volumeHebdo" />
      </header>

      <Card className="flex justify-center" data-testid="volume-silhouette">
        <AnatomicalSilhouette
          highlights={highlights}
          selectedMuscle={selected}
          onMuscleClick={handleSilhouetteClick}
          className="h-56 w-auto"
          testId="volume-silhouette-svg"
        />
      </Card>

      <Legend />

      {selected !== null && (
        <button
          type="button"
          onClick={() => setSelected(null)}
          data-testid="volume-clear-selection"
          className="self-start rounded-full bg-anthracite-800 px-3 py-1 text-[11px] text-anthracite-200 hover:text-white"
        >
          ← Tous les muscles ({muscleLabel(selected)} sélectionné)
        </button>
      )}

      <div className="flex flex-col gap-2" data-testid="volume-cards">
        {sortedSeries.map((s) => (
          <MuscleVolumeCard
            key={s.muscle}
            series={s}
            coverage={coverageByMuscle.get(s.muscle)!}
            cardRef={(el) => {
              cardRefs.current[s.muscle] = el;
            }}
            isSelected={selected === s.muscle}
            onSelect={() =>
              setSelected((prev) => (prev === s.muscle ? null : s.muscle))
            }
          />
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Légende
// =============================================================================

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-anthracite-300">
      <LegendItem dotClass="bg-sang-700" label="sous le minimum" />
      <LegendItem dotClass="bg-emerald-700" label="dans la cible" />
      <LegendItem dotClass="bg-amber-700" label="au-dessus" />
      <LegendItem dotClass="bg-anthracite-600" label="pas touché" />
    </div>
  );
}

function LegendItem({
  dotClass,
  label,
}: {
  readonly dotClass: string;
  readonly label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', dotClass)} />
      {label}
    </span>
  );
}

// =============================================================================
// Carte par muscle : header (statut hebdo) + mini-courbe d'évolution
// =============================================================================

interface MuscleVolumeCardProps {
  readonly series: MuscleVolumeSeries;
  readonly coverage: MuscleCoverage;
  readonly cardRef: (el: HTMLDivElement | null) => void;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

function MuscleVolumeCard({
  series,
  coverage,
  cardRef,
  isSelected,
  onSelect,
}: MuscleVolumeCardProps) {
  const tone = STATUS_TONE[coverage.status];
  return (
    <div
      ref={cardRef}
      data-testid={`volume-card-${series.muscle}`}
      data-status={coverage.status}
      data-selected={isSelected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border bg-anthracite-900 p-3 transition-all',
        isSelected
          ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(252,211,77,0.18)]'
          : 'border-anthracite-700',
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 truncate text-left text-sm font-medium text-white hover:text-amber-200"
        >
          {muscleLabel(series.muscle)}
        </button>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className={cn('font-display text-lg leading-none tabular-nums', tone.text)}>
            {coverage.sets.toFixed(1)}
          </span>
          <span className="text-[10px] text-anthracite-300 tabular-nums">
            / {coverage.vMin.toFixed(0)}–{coverage.vMax.toFixed(0)} séries
          </span>
        </div>
      </header>
      <span className="text-[10px] uppercase tracking-wide text-anthracite-300">
        {STATUS_LABEL[coverage.status]}
        {series.status === 'PRIORITAIRE' && (
          <span className="ml-2 rounded bg-sang-900/40 px-1 py-0.5 text-sang-300">
            prioritaire
          </span>
        )}
      </span>
      {series.points.length > 0 && (
        <MiniVolumeChart series={series} testId={`volume-chart-${series.muscle}`} />
      )}
    </div>
  );
}

// =============================================================================
// Mini-courbe d'évolution semainière (séries pondérées par semaine)
// =============================================================================

interface MiniVolumeChartProps {
  readonly series: MuscleVolumeSeries;
  readonly testId?: string;
}

function MiniVolumeChart({ series, testId }: MiniVolumeChartProps) {
  const W = 320;
  const H = 80;
  const ML = 28;
  const MT = 10;
  const MB = 14; // marge basse pour labels semaines
  const innerW = W - ML;
  const innerH = H - MT - MB;

  const { points, vMin, vMax } = series;
  if (points.length === 0) return null;

  // Échelle Y : max(point max, vMax) + 10 % de marge, min 0.
  const dataMax = Math.max(...points.map((p) => p.sets), vMax);
  const yMax = Math.max(1, Math.ceil(dataMax * 1.1));
  const yOf = (v: number) => MT + innerH - (v / yMax) * innerH;
  const xOf = (i: number) =>
    points.length === 1 ? ML + innerW / 2 : ML + (i / (points.length - 1)) * innerW;

  // La dernière semaine est considérée "en cours" (incomplète) → dernier
  // point en pointillé. Le segment qui la rejoint est aussi en pointillé.
  const lastIdx = points.length - 1;
  const solidPath = points
    .slice(0, lastIdx + 1)
    .map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.sets).toFixed(1)}`);
  const fullPolyline = solidPath.join(' ');
  const solidPart = points.length >= 2 ? solidPath.slice(0, lastIdx).join(' ') : '';
  const dashedSegment =
    points.length >= 2
      ? `${xOf(lastIdx - 1).toFixed(1)},${yOf(points[lastIdx - 1]!.sets).toFixed(1)} ${xOf(
          lastIdx,
        ).toFixed(1)},${yOf(points[lastIdx]!.sets).toFixed(1)}`
      : '';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label={`Évolution du volume hebdo (${points.length} semaines)`}
      data-testid={testId}
    >
      {/* Zone cible légèrement teintée entre V_min et V_max */}
      {vMax > 0 && vMin <= vMax && (
        <rect
          x={ML}
          y={yOf(vMax)}
          width={innerW}
          height={Math.max(0, yOf(vMin) - yOf(vMax))}
          fill="rgba(16,185,129,0.10)"
          data-testid="volume-target-band"
        />
      )}

      {/* Lignes V_min / V_max + labels */}
      {vMax > 0 && (
        <>
          <line
            x1={ML}
            x2={W}
            y1={yOf(vMax)}
            y2={yOf(vMax)}
            stroke="rgba(251,191,36,0.55)"
            strokeWidth={1}
            strokeDasharray="3 3"
            data-testid="vmax-line"
          />
          <text
            x={ML - 4}
            y={yOf(vMax)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="9"
            fill="#fbbf24"
            className="tabular-nums"
          >
            {vMax.toFixed(0)}
          </text>
        </>
      )}
      {vMin > 0 && vMin !== vMax && (
        <>
          <line
            x1={ML}
            x2={W}
            y1={yOf(vMin)}
            y2={yOf(vMin)}
            stroke="rgba(154,160,170,0.5)"
            strokeWidth={1}
            strokeDasharray="3 3"
            data-testid="vmin-line"
          />
          <text
            x={ML - 4}
            y={yOf(vMin)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="9"
            fill="#9aa0aa"
            className="tabular-nums"
          >
            {vMin.toFixed(0)}
          </text>
        </>
      )}

      {/* Polyline historique : tronçon plein (sem complètes) + tronçon
          pointillé (sem en cours). On dessine d'abord la polyline complète
          en mode "plein" pour les segments antérieurs, puis on superpose
          le dernier segment en pointillé pour le distinguer. */}
      {points.length >= 2 && (
        <>
          {solidPart && (
            <polyline
              points={solidPart}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {dashedSegment && (
            <polyline
              points={dashedSegment}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.7}
            />
          )}
        </>
      )}
      {points.length === 1 && (
        // Un seul point : pas de polyline, juste le marqueur ci-dessous.
        <text
          x={ML + innerW / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize="8"
          fill="#9aa0aa"
        >
          {fullPolyline ? '' : ''}
        </text>
      )}

      {/* Points : tous pleins sauf le dernier (semaine en cours) en contour. */}
      {points.map((p, i) => {
        const cx = xOf(i);
        const cy = yOf(p.sets);
        const isLast = i === lastIdx;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={isLast ? 3.5 : 2.8}
              fill={isLast ? '#0c0e12' : '#cbd5e1'}
              stroke="#cbd5e1"
              strokeWidth={isLast ? 1.5 : 0}
            />
            {/* Valeur numérique au-dessus du point (sauf si trop tassé). */}
            {(i === 0 || i === lastIdx || points.length <= 6) && (
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize="8"
                fill="#e5e7eb"
                className="tabular-nums"
              >
                {p.sets.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}

      {/* Labels semaines : 1re, dernière, et milieu si ≥ 4 points. */}
      {points.map((p, i) => {
        const showLabel =
          i === 0 ||
          i === lastIdx ||
          (points.length >= 4 && i === Math.floor(points.length / 2));
        if (!showLabel) return null;
        return (
          <text
            key={`lbl-${i}`}
            x={xOf(i)}
            y={H - 2}
            textAnchor="middle"
            fontSize="8"
            fill="#9aa0aa"
          >
            {i === lastIdx ? 'en cours' : formatWeekLabel(p.weekStart)}
          </text>
        );
      })}
    </svg>
  );
}

// =============================================================================
// Tones & labels par statut
// =============================================================================

const STATUS_LABEL: Record<CoverageStatus, string> = {
  non_travaille: 'pas touché cette semaine',
  sous_min: 'sous le minimum',
  ok: 'dans la cible',
  depassement: 'au-dessus de la cible',
  hors_scope: 'hors objectifs',
};

interface ToneClasses {
  readonly text: string;
}

const STATUS_TONE: Record<CoverageStatus, ToneClasses> = {
  non_travaille: { text: 'text-anthracite-300' },
  sous_min: { text: 'text-sang-400' },
  ok: { text: 'text-emerald-400' },
  depassement: { text: 'text-amber-400' },
  hors_scope: { text: 'text-anthracite-300' },
};
