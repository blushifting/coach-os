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
import { CoverageView } from './progres/CoverageView';
import { CyclesView } from './progres/CyclesView';
import { ForceView } from './progres/ForceView';
import { VolumeView } from './progres/VolumeView';

type Tab = 'couverture' | 'force' | 'volume' | 'cycles';

const TABS: ReadonlyArray<{ readonly id: Tab; readonly label: string }> = [
  { id: 'couverture', label: 'Couverture' },
  { id: 'force', label: 'Force' },
  { id: 'volume', label: 'Volume' },
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
  const [tab, setTab] = useState<Tab>('couverture');

  const data = useMemo(() => {
    if (userState === null || catalog === null) return null;
    const musclesOf = buildMusclesOf(catalog);
    return {
      coverage: computeCoverageThisWeek(userState, history.feedbacks, musclesOf),
      volume: computeVolumeHistory(
        userState,
        history.feedbacks,
        musclesOf,
        VOLUME_HISTORY_WEEKS,
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
        {tab === 'couverture' && <CoverageView coverage={data.coverage} />}
        {tab === 'force' && <ForceView series={data.force} />}
        {tab === 'volume' && <VolumeView series={data.volume} />}
        {tab === 'cycles' && <CyclesView items={data.cycles} catalog={catalog} />}
      </div>
    </section>
  );
}
