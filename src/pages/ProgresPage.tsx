import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  buildCycleHistory,
  buildMusclesOf,
  computeCycleVolume,
  computeE1rmSeriesFromSnapshots,
  FORCE_WINDOW_DAYS,
  FORCE_WINDOW_SESSIONS,
  lastForceSeries,
  type ExerciseE1rmSeries,
  windowForceSeries,
  computeLastWorkedByMuscle,
} from '@/lib/progress';
import { addDays, dateKey, parseDateKey } from '@/lib/dashboard';
import { weekOfCycle } from '@/engine/cycle-week';
import { useCoachOsStore } from '@/store';
import { useToday } from '@/store/selectors';
import { CyclesView } from './progres/CyclesView';
import { ForceView } from './progres/ForceView';
import { VolumeView } from './progres/VolumeView';

// Conv #17 — fusion des anciens onglets Couverture + Volume en un seul
// onglet "Volume". Dump 2.4, étape 3 : silhouette + barres de la semaine et
// colonnes du cycle ; les courbes restent à l'onglet Force.
type Tab = 'volume' | 'force' | 'cycles';

const TABS: ReadonlyArray<{ readonly id: Tab; readonly label: string }> = [
  { id: 'volume', label: 'Volume' },
  { id: 'force', label: 'Force' },
  { id: 'cycles', label: 'Cycles' },
];

/**
 * Conv #76 — onglet d'arrivée réglable par `?tab=`. L'onglet vit dans un état
 * local : sans ce paramètre, tout lien vers `/progres` retombait sur Volume —
 * y compris le « Retour aux cycles » d'un bilan archivé, qui ramenait donc
 * l'utilisateur ailleurs que d'où il venait.
 */
function parseTab(raw: string | null): Tab | null {
  return TABS.some((t) => t.id === raw) ? (raw as Tab) : null;
}

/**
 * Onglet Progrès — Conv #6a, fusion Couverture+Volume Conv #17.
 *
 * 3 vues navigables par tabs :
 * - Volume : silhouette cliquable + barres de volume par muscle, semaine par
 *   semaine sur le cycle (dump 2.4, étape 3).
 * - Force : courbe d'évolution du Plafond (e1RM) par exercice.
 * - Cycles : historique des cycles + dates, comparaison plafonds / volumes
 *   inter-cycles.
 */
export default function ProgresPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const history = useCoachOsStore((s) => s.history);
  const catalog = useCoachOsStore((s) => s.catalog);
  const today = useToday();
  const [search] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(search.get('tab')) ?? 'volume');
  // B-3 — période des courbes Force. Un seul réglage pour tout l'écran plutôt
  // qu'un sélecteur par carte. (L'onglet Volume se lit par cycle depuis l'étape 3
  // du dump 2.4.)
  const [forceRange, setForceRange] = useState<ForceRange>('months');

  // Conv #66 — sens du glissement : on entre par la droite quand on va vers un
  // onglet situé plus à droite. `prevTabIdx` n'est mis à jour qu'en effet (donc
  // APRÈS le rendu), ce qui laisse le rendu courant lire l'onglet précédent.
  const tabIdx = TABS.findIndex((t) => t.id === tab);
  const prevTabIdx = useRef(tabIdx);
  const tabDirection: 'left' | 'right' = tabIdx >= prevTabIdx.current ? 'right' : 'left';
  useEffect(() => {
    prevTabIdx.current = tabIdx;
  }, [tabIdx]);

  const data = useMemo(() => {
    if (userState === null || catalog === null) return null;
    const musclesOf = buildMusclesOf(catalog);
    // Dump 2.4, étape 3 — volume de chaque cycle, semaine par semaine. Le cycle
    // en cours n'a pas de date de fin ; la récupération d'un cycle clos se lit
    // dans son bilan (`recovery_taken`, inconnu sur les anciens cycles).
    const todayKey = dateKey(today);
    const sorted = [...history.cycles].sort((x, y) => x.cycle_index - y.cycle_index);
    const volumeCycles = sorted.map((c, i) => {
      const isCurrent = c.cycle_index === userState.cycle_index;
      return computeCycleVolume(
        userState,
        history.feedbacks,
        musclesOf,
        {
          cycleIndex: c.cycle_index,
          startDate: c.start_date,
          endDate: isCurrent ? null : (c.end_date ?? sorted[i + 1]?.start_date ?? null),
          recoveryTaken: isCurrent
            ? userState.deload_decision === 'accepted'
            : (c.review?.recovery_taken ?? null),
        },
        todayKey,
      );
    });
    const currentCycle = sorted.find((c) => c.cycle_index === userState.cycle_index);
    return {
      volumeCycles,
      currentWeek:
        currentCycle === undefined ? 1 : weekOfCycle(todayKey, currentCycle.start_date),
      // B-1 — récence de travail par muscle, pour le tri des cartes Volume.
      lastWorked: computeLastWorkedByMuscle(history.feedbacks, musclesOf),
      cycles: buildCycleHistory(history.cycles),
      // #63 — la courbe Force lit désormais les SNAPSHOTS e1RM (= plafond du
      // bilan de séance), pas un recalcul Epley brut des feedbacks.
      force: computeE1rmSeriesFromSnapshots(
        history.e1rmSnapshots,
        catalog,
        history.feedbacks,
        userState.profile.bodyweight_kg,
      ),
      // Dump 2.4, étape 5 (n° 21) — périodes à axe du temps commun.
      monthsFrom: dateKey(addDays(parseDateKey(todayKey), -FORCE_WINDOW_DAYS)),
      cycleFrom: currentCycle?.start_date ?? todayKey,
      todayKey,
    };
  }, [userState, catalog, history, today]);

  if (userState === null) {
    return <Navigate to="/welcome" replace />;
  }
  if (data === null) return null;

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="progres-page">
      <nav
        className="flex gap-1 rounded-xl bg-anthracite-900 p-1"
        role="tablist"
        data-testid="progres-tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === t.id
                ? 'bg-anthracite-700 text-white'
                : 'text-anthracite-300 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'force' && (
        <div className="flex justify-end" data-testid="progres-range">
          <div className="inline-flex gap-0.5 rounded-lg bg-anthracite-900 p-0.5">
            {FORCE_RANGES.map((r) => (
              <RangeButton
                key={r.id}
                active={forceRange === r.id}
                onClick={() => setForceRange(r.id)}
                testId={`range-${r.id}`}
              >
                {r.label}
              </RangeButton>
            ))}
          </div>
        </div>
      )}

      <div
        role="tabpanel"
        data-testid={`panel-${tab}`}
        // `key` obligatoire : sans lui, revenir sur un onglet déjà visité garde
        // la même classe d'animation et le navigateur ne la rejoue pas.
        key={tab}
        className={cn(
          tabDirection === 'right'
            ? 'motion-safe:animate-subtab-in-right'
            : 'motion-safe:animate-subtab-in-left',
        )}
      >
        {tab === 'volume' && (
          <VolumeView
            cycles={data.volumeCycles}
            currentWeek={data.currentWeek}
            muscleGoals={userState.muscle_goals}
            lastWorked={data.lastWorked}
          />
        )}
        {tab === 'force' && (
          <ForceView {...forceViewData(forceRange, data)} cycleStarts={history.cycles} />
        )}
        {tab === 'cycles' && <CyclesView items={data.cycles} catalog={catalog} />}
      </div>
    </section>
  );
}

/** Dump 2.4, étape 5 (n° 21) — une période en séances, en mois, en cycle, et tout. */
type ForceRange = 'sessions' | 'months' | 'cycle' | 'all';

const FORCE_RANGES: ReadonlyArray<{ id: ForceRange; label: ReactNode }> = [
  { id: 'sessions', label: <>{FORCE_WINDOW_SESSIONS}&nbsp;séances</> },
  { id: 'months', label: <>3&nbsp;mois</> },
  { id: 'cycle', label: 'Ce cycle' },
  { id: 'all', label: 'Tout' },
];

/**
 * Séries et axe du temps selon la période. En séances et sur tout l'historique,
 * chaque courbe va de sa première à sa dernière mesure ; en mois et sur le cycle,
 * l'axe est commun à toutes les cartes et va jusqu'à aujourd'hui.
 */
function forceViewData(
  range: ForceRange,
  data: {
    force: ExerciseE1rmSeries[];
    monthsFrom: string;
    cycleFrom: string;
    todayKey: string;
  },
): { series: ExerciseE1rmSeries[]; axis: { from: string; to: string } | null } {
  switch (range) {
    case 'sessions':
      return { series: lastForceSeries(data.force, FORCE_WINDOW_SESSIONS), axis: null };
    case 'months':
      return {
        series: windowForceSeries(data.force, data.monthsFrom),
        axis: { from: data.monthsFrom, to: data.todayKey },
      };
    case 'cycle':
      return {
        series: windowForceSeries(data.force, data.cycleFrom),
        axis: { from: data.cycleFrom, to: data.todayKey },
      };
    case 'all':
      return { series: data.force, axis: null };
  }
}

interface RangeButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly testId: string;
  readonly children: ReactNode;
}

function RangeButton({ active, onClick, testId, children }: RangeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
        active
          ? 'bg-anthracite-700 text-white'
          : 'text-anthracite-400 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
