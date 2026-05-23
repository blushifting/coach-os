import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import { cn } from '@/lib/cn';
import {
  buildCycleHistory,
  buildMusclesOf,
  computeCoverageThisWeek,
  computeE1rmHistory,
  computeVolumeHistory,
} from '@/lib/progress';
import { useCoachOsStore } from '@/store';
import { CyclesView } from './progres/CyclesView';
import { ForceView } from './progres/ForceView';
import { VolumeView } from './progres/VolumeView';

// Conv #17 — fusion des anciens onglets Couverture + Volume en un seul
// onglet "Volume" : silhouette anatomique cliquable (statut hebdo en cours)
// + liste des courbes d'évolution par muscle. Plus cohérent : un seul écran
// répond aux questions "où en suis-je cette semaine ?" et "où en suis-je
// dans le temps ?".
type Tab = 'volume' | 'force' | 'cycles';

const TABS: ReadonlyArray<{ readonly id: Tab; readonly label: string }> = [
  { id: 'volume', label: 'Volume' },
  { id: 'force', label: 'Force' },
  { id: 'cycles', label: 'Cycles' },
];

const VOLUME_HISTORY_WEEKS = 8;

/**
 * Onglet Progrès — Conv #6a.
 *
 * 3 vues navigables par tabs :
 * - Couverture : heatmap muscles touchés cette semaine (placeholder grille,
 *   silhouette propre prévue Conv #8).
 * - Volume : barres hebdo par muscle avec bandes V_min/V_max grises.
 * - Cycles : historique nommé par programme + dates, comparaison plafonds /
 *   volumes inter-cycles.
 */
export default function ProgresPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const history = useCoachOsStore((s) => s.history);
  const catalog = useCoachOsStore((s) => s.catalog);
  const [tab, setTab] = useState<Tab>('volume');

  const data = useMemo(() => {
    if (userState === null || catalog === null) return null;
    const musclesOf = buildMusclesOf(catalog);
    // Conv #11h — alignement des trackings sur les semaines du programme :
    // on récupère le start_date du cycle courant pour passer à
    // computeCoverageThisWeek + computeVolumeHistory. Null si pas de cycle
    // (fallback ISO).
    const currentCycle = history.cycles.find(
      (c) => c.cycle_index === userState.cycle_index,
    );
    const cycleStart = currentCycle?.start_date ?? null;
    return {
      coverage: computeCoverageThisWeek(
        userState,
        history.feedbacks,
        musclesOf,
        undefined,
        cycleStart,
      ),
      volume: computeVolumeHistory(
        userState,
        history.feedbacks,
        musclesOf,
        VOLUME_HISTORY_WEEKS,
        undefined,
        cycleStart,
      ),
      cycles: buildCycleHistory(history.cycles, ALL_GUIDED_PROGRAMS),
      force: computeE1rmHistory(history.feedbacks, catalog),
    };
  }, [userState, catalog, history]);

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

      <div role="tabpanel" data-testid={`panel-${tab}`}>
        {tab === 'volume' && (
          <VolumeView
            coverage={data.coverage}
            volume={data.volume}
            muscleGoals={userState.muscle_goals}
          />
        )}
        {tab === 'force' && <ForceView series={data.force} />}
        {tab === 'cycles' && <CyclesView items={data.cycles} catalog={catalog} />}
      </div>
    </section>
  );
}
