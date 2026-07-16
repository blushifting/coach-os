import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  buildCycleHistory,
  buildMusclesOf,
  computeCoverageThisWeek,
  computeE1rmSeriesFromSnapshots,
  computeVolumeHistory,
} from '@/lib/progress';
import { useCoachOsStore } from '@/store';
import { useToday } from '@/store/selectors';
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
 * Onglet Progrès — Conv #6a, fusion Couverture+Volume Conv #17.
 *
 * 3 vues navigables par tabs :
 * - Volume : silhouette hebdo cliquable + courbes d'évolution du volume par
 *   muscle (bandes V_min/V_max).
 * - Force : courbe d'évolution du Plafond (e1RM) par exercice.
 * - Cycles : historique des cycles + dates, comparaison plafonds / volumes
 *   inter-cycles.
 */
export default function ProgresPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const history = useCoachOsStore((s) => s.history);
  const catalog = useCoachOsStore((s) => s.catalog);
  const today = useToday();
  const [tab, setTab] = useState<Tab>('volume');

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
    // Conv #11h — alignement des trackings sur les semaines du programme :
    // on récupère le start_date du cycle courant pour passer à
    // computeCoverageThisWeek + computeVolumeHistory. Null si pas de cycle
    // (fallback ISO).
    const currentCycle = history.cycles.find(
      (c) => c.cycle_index === userState.cycle_index,
    );
    const cycleStart = currentCycle?.start_date ?? null;
    return {
      // Conv #66 — `today` est ancré sur la démo quand elle est active. Ces deux
      // calculs sont des fenêtres glissantes : avec la date réelle, l'historique
      // d'Alex (figé) tombe hors fenêtre et tout s'affiche à 0.
      coverage: computeCoverageThisWeek(
        userState,
        history.feedbacks,
        musclesOf,
        today,
        cycleStart,
      ),
      volume: computeVolumeHistory(
        userState,
        history.feedbacks,
        musclesOf,
        VOLUME_HISTORY_WEEKS,
        today,
        cycleStart,
      ),
      cycles: buildCycleHistory(history.cycles),
      // #63 — la courbe Force lit désormais les SNAPSHOTS e1RM (= plafond du
      // bilan de séance), pas un recalcul Epley brut des feedbacks.
      force: computeE1rmSeriesFromSnapshots(history.e1rmSnapshots, catalog),
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
