/**
 * Onglet Progrès → vue « Volume » — dump 2.4, étape 3 (n° 13, 18), version B
 * de la maquette (`Kotsh/maquettes/etape3_volume.html`).
 *
 *  1. Sélecteur de semaine : les semaines du cycle, puis « moyenne du cycle » ;
 *     les flèches passent d'un cycle à l'autre.
 *  2. Silhouette colorée selon la position choisie, cliquable.
 *  3. Une carte par muscle, groupées « À développer » (par rang), « À
 *     entretenir », « Autres muscles » : la barre commune (repère, zone haute,
 *     échelle commune) et, dessous, une colonne par semaine du cycle. Toucher
 *     une colonne affiche cette semaine.
 *
 * Remplace les mini-courbes d'évolution (historique trop ancien, non lissé) :
 * l'onglet Force garde les courbes, l'onglet Volume a ses barres.
 */

import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/Card';
import {
  AnatomicalSilhouette,
  statusToSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import {
  formatSets,
  markLabel,
  statusLabel,
  VolumeBar,
  VOLUME_FILL,
  VOLUME_TEXT,
} from '@/components/VolumeBar';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import {
  classifyVolume,
  muscleLabel,
  volumeScale,
  type CoverageStatus,
  type CycleVolume,
  type MuscleCycleVolume,
} from '@/lib/progress';
import { parseDateKey } from '@/lib/dashboard';
import { MUSCLES, MuscleIntention, type MuscleGoal } from '@/engine/models';

/** Conv #17b — certains muscles partagent une zone de la silhouette. */
const CLICK_ALIAS: Readonly<Record<string, string>> = {
  deltos_anterieurs: 'deltos_lateraux',
};

/** Position affichée : une semaine d'un cycle, ou la moyenne du cycle. */
interface Position {
  /** Index dans `cycles`. */
  readonly cycle: number;
  /** Numéro de semaine, ou `'moyenne'`. */
  readonly week: number | 'moyenne';
}

interface VolumeViewProps {
  /** Volume de chaque cycle, du plus ancien au plus récent (le dernier = en cours). */
  readonly cycles: ReadonlyArray<CycleVolume>;
  /** Semaine en cours du dernier cycle (position d'arrivée). */
  readonly currentWeek: number;
  readonly muscleGoals: Readonly<Record<string, MuscleGoal>>;
  /** B-1 — `muscle → YYYY-MM-DD` de la dernière séance qui l'a sollicité (ordre des cartes). */
  readonly lastWorked: Readonly<Record<string, string>>;
}

/** Toutes les positions navigables, dans l'ordre : semaines commencées puis moyenne, cycle par cycle. */
function positionsOf(cycles: ReadonlyArray<CycleVolume>): Position[] {
  const out: Position[] = [];
  cycles.forEach((c, i) => {
    for (const w of c.weeks) if (w.started) out.push({ cycle: i, week: w.week });
    out.push({ cycle: i, week: 'moyenne' });
  });
  return out;
}

const samePosition = (a: Position, b: Position): boolean =>
  a.cycle === b.cycle && a.week === b.week;

/** Séries, repère et statut d'un muscle à une position. */
function readAt(m: MuscleCycleVolume, week: number | 'moyenne') {
  if (week === 'moyenne') {
    return { sets: m.average, mark: m.averageMark, status: m.averageStatus };
  }
  const sets = m.perWeek[week - 1] ?? 0;
  const mark = m.markPerWeek[week - 1] ?? null;
  return { sets, mark, status: classifyVolume(sets, mark) };
}

function formatDay(key: string): string {
  return parseDateKey(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function VolumeView({ cycles, currentWeek, muscleGoals, lastWorked }: VolumeViewProps) {
  const positions = useMemo(() => positionsOf(cycles), [cycles]);
  const initial: Position = useMemo(() => {
    const last = cycles.length - 1;
    const target: Position = { cycle: last, week: currentWeek };
    return positions.find((p) => samePosition(p, target)) ?? positions[positions.length - 1] ?? target;
  }, [cycles, currentWeek, positions]);
  const [position, setPosition] = useState<Position>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const cycle = cycles[position.cycle];
  const posIndex = positions.findIndex((p) => samePosition(p, position));

  const byMuscle = useMemo(() => {
    const map = new Map<string, MuscleCycleVolume>();
    for (const m of cycle?.muscles ?? []) map.set(m.muscle, m);
    return map;
  }, [cycle]);

  // Échelle commune de l'écran : barres et colonnes du cycle affiché.
  const scale = useMemo(
    () =>
      volumeScale(
        (cycle?.muscles ?? []).flatMap((m) => [...m.perWeek, m.average]),
      ),
    [cycle],
  );

  const highlights = useMemo(() => {
    const h: Record<string, SilhouetteStatus> = {};
    for (const m of cycle?.muscles ?? []) {
      h[m.muscle] = statusToSilhouette(readAt(m, position.week).status);
    }
    return h;
  }, [cycle, position.week]);

  // Groupes : à développer (par rang), à entretenir, autres. À l'intérieur des
  // deux derniers, du muscle travaillé le plus récemment au plus ancien (B-1).
  // Un muscle sans objectif jamais travaillé sur le cycle tient sur une ligne.
  const groups = useMemo(() => {
    const byRecency = (a: string, b: string): number => {
      const la = lastWorked[a] ?? null;
      const lb = lastWorked[b] ?? null;
      if (la !== lb) {
        if (la === null) return 1;
        if (lb === null) return -1;
        return lb.localeCompare(la);
      }
      return a.localeCompare(b);
    };
    const known = MUSCLES.filter((m) => byMuscle.has(m));
    const develop = known
      .filter((m) => muscleGoals[m]?.intention === MuscleIntention.DEVELOPPER)
      .sort((a, b) => (muscleGoals[a]!.priority_rank - muscleGoals[b]!.priority_rank) || a.localeCompare(b));
    const maintain = known
      .filter((m) => muscleGoals[m]?.intention === MuscleIntention.ENTRETENIR)
      .sort(byRecency);
    const others = known.filter((m) => muscleGoals[m] === undefined);
    const othersWorked = others
      .filter((m) => byMuscle.get(m)!.perWeek.some((v) => v > 0))
      .sort(byRecency);
    const othersIdle = others.filter((m) => !othersWorked.includes(m));
    return { develop, maintain, othersWorked, othersIdle };
  }, [byMuscle, muscleGoals, lastWorked]);

  function handleSilhouetteClick(rawMuscle: string) {
    const muscle = CLICK_ALIAS[rawMuscle] ?? rawMuscle;
    setSelected(muscle);
    cardRefs.current[muscle]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (cycle === undefined) {
    return (
      <p className="text-sm text-anthracite-300" data-testid="volume-view">
        Pas encore de séance enregistrée.
      </p>
    );
  }

  let cardIndex = 0;
  const renderCards = (muscles: readonly string[]) =>
    muscles.map((muscle) => (
      <MuscleVolumeCard
        key={muscle}
        index={cardIndex++}
        data={byMuscle.get(muscle)!}
        cycle={cycle}
        week={position.week}
        scale={scale}
        isSelected={selected === muscle}
        onSelect={() => setSelected((prev) => (prev === muscle ? null : muscle))}
        onPickWeek={(w) => setPosition({ cycle: position.cycle, week: w })}
        cardRef={(el) => {
          cardRefs.current[muscle] = el;
        }}
      />
    ));

  return (
    <section className="flex flex-col gap-3" data-testid="volume-view">
      <h2 className="text-sm font-semibold text-white">Séries par muscle</h2>

      <Card className="flex flex-col items-center gap-2" data-testid="volume-silhouette">
        <AnatomicalSilhouette
          highlights={highlights}
          palette="volume"
          selectedMuscle={selected}
          onMuscleClick={handleSilhouetteClick}
          className="h-56 w-auto"
          testId="volume-silhouette-svg"
        />
        <Legend />
      </Card>

      <WeekNavigator
        cycle={cycle}
        position={position}
        isLatestCycle={position.cycle === cycles.length - 1}
        currentWeek={currentWeek}
        canPrev={posIndex > 0}
        canNext={posIndex >= 0 && posIndex < positions.length - 1}
        onPrev={() => setPosition(positions[posIndex - 1]!)}
        onNext={() => setPosition(positions[posIndex + 1]!)}
        onPick={(week) => setPosition({ cycle: position.cycle, week })}
      />

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
        {groups.develop.length > 0 && <GroupTitle>À développer</GroupTitle>}
        {renderCards(groups.develop)}
        {groups.maintain.length > 0 && <GroupTitle>À entretenir</GroupTitle>}
        {renderCards(groups.maintain)}
        {groups.othersWorked.length > 0 && <GroupTitle>Autres muscles</GroupTitle>}
        {renderCards(groups.othersWorked)}
        {groups.othersIdle.length > 0 && (
          <p className="px-1 text-xs text-anthracite-400" data-testid="volume-idle">
            Pas travaillés sur ce cycle&nbsp;: {groups.othersIdle.map(muscleLabel).join(', ')}.
          </p>
        )}
      </div>
    </section>
  );
}

function GroupTitle({ children }: { readonly children: string }) {
  return (
    <h3 className="mt-2 px-1 text-[10px] font-medium uppercase tracking-wide text-anthracite-400">
      {children}
    </h3>
  );
}

// =============================================================================
// Légende de la silhouette
// =============================================================================

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-anthracite-300">
      <LegendItem dotClass="bg-anthracite-500" label="pas travaillé" />
      <LegendItem dotClass="bg-sang-900 ring-1 ring-anthracite-600" label="travaillé" />
      <LegendItem dotClass="bg-sang-600" label="dans la cible" />
      <LegendItem dotClass="bg-sang-400" label="volume élevé" />
    </div>
  );
}

function LegendItem({ dotClass, label }: { readonly dotClass: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', dotClass)} />
      {label}
    </span>
  );
}

// =============================================================================
// Sélecteur de semaine
// =============================================================================

interface WeekNavigatorProps {
  readonly cycle: CycleVolume;
  readonly position: Position;
  readonly isLatestCycle: boolean;
  readonly currentWeek: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onPick: (week: number | 'moyenne') => void;
}

function WeekNavigator({
  cycle,
  position,
  isLatestCycle,
  currentWeek,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPick,
}: WeekNavigatorProps) {
  const week = position.week === 'moyenne' ? null : cycle.weeks[position.week - 1] ?? null;
  const isCurrentWeek =
    isLatestCycle && week !== null && week.week === currentWeek;

  let title: string;
  let subtitle: string;
  if (week === null) {
    const n = cycle.countedWeeks.length;
    const hasRecovery = cycle.weeks.some((w) => w.recovery && cycle.countedWeeks.includes(w.week));
    title = `Moyenne du cycle ${cycle.cycleIndex}`;
    subtitle =
      `${n} semaine${n > 1 ? 's' : ''}` + (hasRecovery ? ', récupération comprise' : '');
  } else {
    title = week.recovery ? `Semaine ${week.week} · récupération` : `Semaine ${week.week}`;
    const end = new Date(parseDateKey(week.start).getTime() + 6 * 86_400_000);
    subtitle =
      `du ${formatDay(week.start)} au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` +
      (isCurrentWeek ? ' · en cours' : '') +
      (isLatestCycle ? '' : ` · cycle ${cycle.cycleIndex}`);
  }

  return (
    <div data-testid="volume-week-nav">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-anthracite-700 bg-anthracite-800 p-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Semaine précédente"
          data-testid="volume-week-prev"
          className="h-11 w-11 rounded-xl bg-anthracite-700 text-lg text-anthracite-100 disabled:opacity-30"
        >
          ‹
        </button>
        <div className="min-w-0 text-center">
          <div className="text-sm font-semibold text-white" data-testid="volume-week-title">
            {title}
          </div>
          <div className="truncate text-[11px] text-anthracite-400">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Semaine suivante"
          data-testid="volume-week-next"
          className="h-11 w-11 rounded-xl bg-anthracite-700 text-lg text-anthracite-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        {cycle.weeks
          .filter((w) => w.started)
          .map((w) => (
            <button
              key={w.week}
              type="button"
              tabIndex={-1}
              onClick={() => onPick(w.week)}
              className={cn(
                'h-1.5 rounded-full',
                position.week === w.week ? 'w-4 bg-anthracite-200' : 'w-1.5 bg-anthracite-600',
              )}
            />
          ))}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onPick('moyenne')}
          className={cn(
            'ml-1 text-[10px] leading-none',
            position.week === 'moyenne' ? 'text-anthracite-100' : 'text-anthracite-400',
          )}
        >
          moyenne
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Carte d'un muscle : barre de la position + colonnes du cycle
// =============================================================================

interface MuscleVolumeCardProps {
  readonly data: MuscleCycleVolume;
  readonly cycle: CycleVolume;
  readonly week: number | 'moyenne';
  readonly scale: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onPickWeek: (week: number) => void;
  readonly cardRef: (el: HTMLDivElement | null) => void;
  /** Rang dans la liste — porte le décalage de la cascade d'apparition. */
  readonly index: number;
}

function MuscleVolumeCard({
  data,
  cycle,
  week,
  scale,
  isSelected,
  onSelect,
  onPickWeek,
  cardRef,
  index,
}: MuscleVolumeCardProps) {
  const { sets, mark, status } = readAt(data, week);
  const markText = markLabel(data.intention, mark);
  const label = statusLabel(status, data.intention);
  const unit = week === 'moyenne' ? 'séries / sem.' : 'séries';

  return (
    <div
      ref={cardRef}
      data-testid={`volume-card-${data.muscle}`}
      data-status={status}
      data-selected={isSelected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1.5 rounded-2xl border bg-anthracite-900 p-3 transition-all',
        isSelected
          ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(252,211,77,0.18)]'
          : 'border-anthracite-700',
        'motion-safe:animate-reveal-up',
      )}
      // Cascade bornée : au-delà de la 6ᵉ carte on est hors écran de toute façon.
      style={{ animationDelay: `${Math.min(index, 5) * MOTION.stagger}ms` }}
    >
      <header className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 truncate text-left text-sm font-medium text-white hover:text-amber-200"
        >
          {muscleLabel(data.muscle)}
        </button>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className={cn('font-display text-lg leading-none tabular-nums', VOLUME_TEXT[status])}>
            {formatSets(sets)}
          </span>
          <span className="text-[10px] tabular-nums text-anthracite-300">
            {markText === null ? unit : `${unit} · ${markText}`}
          </span>
        </div>
      </header>
      <VolumeBar
        sets={sets}
        mark={mark}
        status={status}
        scale={scale}
        size="md"
        testId={`volume-bar-${data.muscle}`}
      />
      {label !== null && (
        <span className={cn('text-[10px] uppercase tracking-wide', VOLUME_TEXT[status])}>
          {label}
        </span>
      )}
      <WeekColumns data={data} cycle={cycle} week={week} scale={scale} onPick={onPickWeek} />
    </div>
  );
}

const COLUMNS_HEIGHT_PX = 34;

/**
 * Une colonne par semaine du cycle, sur l'échelle de l'écran, colorée selon la
 * semaine ; le trait horizontal = le repère du muscle (aucun sans objectif).
 * Les semaines à venir restent vides. Volontairement petit : on y lit d'un coup
 * d'œil quelle semaine a été verte et laquelle a été rouge.
 */
function WeekColumns({
  data,
  cycle,
  week,
  scale,
  onPick,
}: {
  readonly data: MuscleCycleVolume;
  readonly cycle: CycleVolume;
  readonly week: number | 'moyenne';
  readonly scale: number;
  readonly onPick: (week: number) => void;
}) {
  const weeklyMark = data.markPerWeek.find((m, i) => m !== null && !cycle.weeks[i]!.recovery) ?? null;
  const px = (v: number): number => Math.min(COLUMNS_HEIGHT_PX, (v / scale) * COLUMNS_HEIGHT_PX);

  return (
    <div className="relative mt-1 flex items-end gap-2" data-testid={`volume-columns-${data.muscle}`}>
      {weeklyMark !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-anthracite-300/70"
          style={{ bottom: `${11 + px(weeklyMark)}px` }}
        />
      )}
      {cycle.weeks.map((w, i) => {
        const v = data.perWeek[i] ?? 0;
        const status: CoverageStatus = classifyVolume(v, data.markPerWeek[i] ?? null);
        const isCurrent = week === w.week;
        return (
          <button
            key={w.week}
            type="button"
            disabled={!w.started}
            onClick={() => onPick(w.week)}
            aria-label={`Semaine ${w.week}${w.recovery ? ' (récupération)' : ''} : ${formatSets(v)} séries`}
            data-testid={`volume-column-${data.muscle}-${w.week}`}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-end gap-0.5"
          >
            <span
              className={cn(
                'w-full rounded-t-[3px] rounded-b-[1px]',
                !w.started
                  ? 'border border-dashed border-anthracite-700'
                  : v > 0
                    ? VOLUME_FILL[status]
                    : 'bg-anthracite-700',
                isCurrent && 'outline outline-[1.5px] outline-offset-1 outline-anthracite-200',
              )}
              style={{ height: `${w.started ? Math.max(2, px(v)) : 6}px` }}
            />
            <span
              className={cn(
                'text-[9px] leading-none tabular-nums',
                isCurrent ? 'text-anthracite-100' : 'text-anthracite-400',
              )}
            >
              {w.recovery ? 'R' : `S${w.week}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
