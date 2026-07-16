import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
import { TrendArrow } from '@/components/icons';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import { useEngine } from '@/hooks/useEngine';
import { useAnimateOnMount } from '@/hooks/useMotion';
import { useCoachOsStore } from '@/store';
import { selectCycles, useDemoMode } from '@/store/selectors';
import { MuscleStatus, SuggestedAction, type CycleReview } from '@/engine/models';
import {
  buildMusclesOf,
  computeCycleVolumeByMuscle,
  exerciseLabel,
  muscleLabel,
  type CoverageStatus,
  type MuscleCycleVolume,
} from '@/lib/progress';
import { pickReviewToDisplay, suggestedActionLabel } from './selectors';

/**
 * Page Bilan de cycle — Conv #5a.
 *
 * Affichage lecture seule de `CycleReview` (adhérence / volume / PR /
 * plafonds / muscles), suivi de deux actions : « Continuer pareil »
 * (`endOfCycle` direct) et « Ajuster les objectifs » (onboarding partiel).
 *
 * Source : `recherche/08_ux_decisions.md §5 Fin de programme / fin de cycle`.
 */
export default function CycleBilanPage() {
  const lastCycleReview = useCoachOsStore((s) => s.lastCycleReview);
  const cycles = useCoachOsStore(selectCycles);
  const catalog = useCoachOsStore((s) => s.catalog);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const userState = useCoachOsStore((s) => s.userState);
  const [search] = useSearchParams();
  // Conv #15-5 — Si on arrive avec `?cycle=N`, on cible explicitement le
  // bilan de ce cycle (ouvert depuis Progrès > Cycles). Sinon comportement
  // historique : dernier bilan disponible.
  const targetCycleParam = search.get('cycle');
  const targetCycleIndex =
    targetCycleParam !== null && Number.isFinite(Number(targetCycleParam))
      ? Number(targetCycleParam)
      : null;
  const review =
    targetCycleIndex !== null
      ? cycles.find((c) => c.cycle_index === targetCycleIndex)?.review ?? null
      : pickReviewToDisplay(lastCycleReview, cycles);
  // Si on a un cycle ciblé, on N'A PAS d'actions à proposer (c'est un bilan
  // archivé, pas une fin de cycle en cours).
  const isArchived = targetCycleIndex !== null;

  // #15 (E-3) — volume réalisé par muscle sur le cycle, calculé à la volée
  // (pas de champ persisté). Le nombre de séances alimente la tuile "Séances".
  const cycleVolume = useMemo<MuscleCycleVolume[]>(() => {
    if (review === null || userState === null || catalog === null) return [];
    return computeCycleVolumeByMuscle(
      feedbacks,
      review.cycle_index,
      userState,
      buildMusclesOf(catalog),
    );
  }, [review, userState, catalog, feedbacks]);
  const sessionCount =
    review === null
      ? 0
      : feedbacks.filter((f) => f.cycle_index === review.cycle_index).length;

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="cycle-bilan-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">
          {review === null ? 'Bilan de cycle' : `Bilan du cycle ${review.cycle_index}`}
        </h1>
      </header>

      {review === null ? (
        <Card data-testid="bilan-empty">
          <p className="text-sm text-anthracite-300">
            Aucun bilan disponible. Termine un cycle complet pour voir ta
            progression et ton assiduité s'afficher.
          </p>
          <div className="mt-3">
            <Link to="/programme">
              <Button variant="secondary" size="sm">
                Retour au programme
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <ReviewKeyMetrics review={review} sessionCount={sessionCount} />
          <ReviewVolume volume={cycleVolume} />
          <ReviewPlafonds review={review} catalog={catalog} />
          <ReviewMuscles review={review} />
          {review.warnings.length > 0 && <ReviewWarnings review={review} />}
          {isArchived ? (
            <Link to="/progres">
              <Button variant="secondary" fullWidth data-testid="back-to-progres">
                Retour aux cycles
              </Button>
            </Link>
          ) : (
            <ReviewActions review={review} />
          )}
        </>
      )}
    </section>
  );
}

function ReviewKeyMetrics({
  review,
  sessionCount,
}: {
  review: CycleReview;
  sessionCount: number;
}) {
  // Conv #11i — animation reveal-up staggered (cascade 0 / 80 ms).
  // #15 (E-3) — la tuile "Volume (kg)" est retirée (tonnage non fiable) : le
  // volume utile est montré par muscle vs cible (section dédiée ci-dessous).
  return (
    <Card data-testid="bilan-key-metrics" className="grid grid-cols-2 gap-3">
      <Metric
        label="Assiduité"
        helpTopic="adherence"
        value={`${Math.round(Math.min(1, review.adherence_pct) * 100)} %`}
        delay={0}
      />
      <Metric label="Séances" value={`${sessionCount}`} delay={80} />
    </Card>
  );
}

const VOLUME_STATUS_TEXT: Record<CoverageStatus, string> = {
  non_travaille: 'text-anthracite-300',
  sous_min: 'text-sang-400',
  ok: 'text-emerald-400',
  depassement: 'text-amber-400',
  hors_scope: 'text-anthracite-300',
};

const VOLUME_STATUS_BAR: Record<CoverageStatus, string> = {
  non_travaille: 'bg-anthracite-500',
  sous_min: 'bg-sang-500',
  ok: 'bg-emerald-500',
  depassement: 'bg-amber-500',
  hors_scope: 'bg-anthracite-500',
};

/** Moyenne de séries sans arrondi trompeur (cf. #11) : décimale si non entier. */
function formatSets(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * #15 (E-3) — volume réalisé par muscle sur le cycle (moy. séries/sem hors
 * déload) rapporté à la cible V_min–V_max. Remplace le tonnage total kg.
 */
function ReviewVolume({ volume }: { volume: ReadonlyArray<MuscleCycleVolume> }) {
  if (volume.length === 0) return null;
  return (
    <Card data-testid="bilan-volume" className="flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold text-white">
        Volume par muscle · moy./sem vs cible
      </h2>
      {volume.map((m, i) => (
        <CycleVolumeRow key={m.muscle} data={m} index={i} />
      ))}
    </Card>
  );
}

/**
 * Conv #66 — une ligne de volume du bilan de cycle. La barre se remplit depuis 0
 * (et non depuis une valeur précédente comme au bilan de SÉANCE : ici on montre
 * une moyenne sur le cycle, pas un incrément qu'on vient d'ajouter).
 */
function CycleVolumeRow({
  data,
  index,
}: {
  data: MuscleCycleVolume;
  index: number;
}) {
  const pct = data.vMax > 0 ? Math.min(100, (data.avgSetsPerWeek / data.vMax) * 100) : 0;
  const revealDelay = 120 + index * MOTION.stagger;
  const shownPct = useAnimateOnMount(0, pct);
  return (
    <div
      className="flex flex-col gap-1 motion-safe:animate-reveal-up"
      style={{ animationDelay: `${revealDelay}ms` }}
      data-testid={`bilan-volume-${data.muscle}`}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-anthracite-200">
          {muscleLabel(data.muscle)}
          {data.goalStatus === MuscleStatus.PRIORITAIRE && (
            <span className="ml-2 rounded bg-sang-900/40 px-1 py-0.5 text-[10px] text-sang-300">
              prioritaire
            </span>
          )}
        </span>
        <span className={cn('shrink-0 tabular-nums', VOLUME_STATUS_TEXT[data.status])}>
          {formatSets(data.avgSetsPerWeek)}
          <span className="text-anthracite-400">
            {' '}
            / {data.vMin.toFixed(0)}–{data.vMax.toFixed(0)}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-anthracite-700">
        <div
          className={cn(
            'h-full rounded-full motion-safe:transition-[width] motion-safe:ease-out',
            VOLUME_STATUS_BAR[data.status],
          )}
          style={{
            width: `${shownPct}%`,
            transitionDuration: `${MOTION.fill}ms`,
            // La barre part quand sa ligne a fini d'apparaître : deux mouvements
            // simultanés sur la même ligne se brouillent.
            transitionDelay: `${revealDelay + 200}ms`,
          }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  delay = 0,
  helpTopic,
}: {
  label: string;
  value: string;
  delay?: number;
  helpTopic?: import('@/lib/help-glossary').HelpTopic;
}) {
  return (
    // Conv #17 — items-center pour centrer label + valeur dans la cellule
    // grid. Avant : alignement gauche par défaut, le Volume (grosse valeur kg)
    // semblait flotter à gauche de sa colonne au lieu d'être centré entre
    // Adhérence et Records.
    <div
      className="flex flex-col items-center gap-0.5 text-center motion-safe:animate-reveal-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Conv #18 — min-h-5 réserve la hauteur du HelpButton (h-5) sur tous
          les labels, pour aligner les baselines même sans HelpButton. */}
      <span className="flex min-h-5 items-center gap-1 text-xs uppercase tracking-wide text-anthracite-300">
        {helpTopic ? <Concept topic={helpTopic}>{label}</Concept> : label}
      </span>
      {/* Conv #15 vague 3 — text-xl + whitespace-nowrap pour éviter
          que "kg" passe à la ligne sur des volumes 4-5 chiffres. */}
      <span className="font-display text-xl leading-none text-white tabular-nums whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

function ReviewPlafonds({
  review,
  catalog,
}: {
  review: CycleReview;
  catalog: import('@/engine/catalog').Catalog | null;
}) {
  const entries = Object.entries(review.plafonds_progression).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <Card data-testid="bilan-plafonds">
        <h2 className="mb-1 text-sm font-semibold text-white">
          Progression sur le cycle
        </h2>
        <p className="text-xs text-anthracite-300">Aucune variation enregistrée.</p>
      </Card>
    );
  }
  return (
    <Card data-testid="bilan-plafonds" className="flex flex-col gap-2">
      {/* Chantier C (plan 11) — "Records" retiré du bilan : cette section de
          deltas par exo (ex-"Évolution sur le cycle") devient LE bilan des
          progressions. */}
      <h2 className="text-sm font-semibold text-white">
        Progression sur le cycle (<Concept topic="plafond">Plafonds</Concept>)
      </h2>
      <ul className="flex flex-col gap-1">
        {entries.slice(0, 6).map(([exId, delta], i) => {
          // Conv #24 (D11) — feu tricolore aligné sur le bilan de séance :
          // vert = hausse, orange = stable, rouge = baisse, + flèche de tendance.
          const trend: 'up' | 'down' | 'flat' =
            delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
          const toneClass =
            trend === 'up'
              ? 'text-emerald-400'
              : trend === 'down'
              ? 'text-red-400'
              : 'text-amber-400';
          return (
            <li
              key={exId}
              className="flex items-center justify-between text-sm motion-safe:animate-reveal-up"
              style={{ animationDelay: `${200 + i * 60}ms` }}
              data-testid={`plafond-${exId}`}
              data-direction={trend}
            >
              {/* Conv #15-5 — exId brut → nom français via catalog. */}
              <span className="min-w-0 truncate pr-2 text-anthracite-300">
                {exerciseLabel(exId, catalog)}
              </span>
              <span className={cn('flex shrink-0 items-center gap-1 tabular-nums', toneClass)}>
                <TrendArrow trend={trend} className="text-[0.9em]" />
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)} kg
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ReviewMuscles({ review }: { review: CycleReview }) {
  return (
    <Card data-testid="bilan-muscles" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white">Muscles</h2>
      <MuscleRow label="Progrès" muscles={review.muscles_progresses} tone="ok" />
      <MuscleRow label="Plateau" muscles={review.muscles_plateau} tone="warn" />
      <MuscleRow label="Sous-stimulé" muscles={review.muscles_undertrained} tone="warn" />
      <MuscleRow label="Surchargé" muscles={review.muscles_overshoot} tone="warn" />
    </Card>
  );
}

function MuscleRow({
  label,
  muscles,
  tone,
}: {
  label: string;
  muscles: ReadonlyArray<string>;
  tone: 'ok' | 'warn';
}) {
  if (muscles.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-anthracite-300">{label}</span>
      <div className="flex flex-wrap gap-1">
        {muscles.map((m) => (
          <span
            key={m}
            className={
              tone === 'ok'
                ? 'rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white'
                : 'rounded bg-sang-900/60 px-2 py-0.5 text-xs text-sang-500'
            }
          >
            {muscleLabel(m)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewWarnings({ review }: { review: CycleReview }) {
  return (
    <Card data-testid="bilan-warnings" className="border-sang-700 bg-sang-900/30">
      <h2 className="mb-1 text-sm font-semibold text-white">À noter</h2>
      <ul className="list-inside list-disc text-xs text-anthracite-300">
        {review.warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewActions({ review }: { review: CycleReview }) {
  const engine = useEngine();
  const navigate = useNavigate();
  const demoActive = useDemoMode();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggested = suggestedActionLabel(review.suggested_action);

  async function continueAsIs() {
    setPending(true);
    setError(null);
    try {
      await engine.endOfCycle({ action: SuggestedAction.CONTINUER_PAREIL });
      navigate('/programme');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function startPartialRestart() {
    // Conv #18 — "Ajuster les objectifs" passe par le même onboarding partiel
    // (Step2→5) que celui lancé depuis Profil. À la finalisation, l'onboarding
    // appelle endOfCycle avec l'action AJUSTER_OBJECTIFS (+ le nouveau build_mode
    // si l'user a basculé sur-mesure ↔ programme libre).
    navigate('/onboarding?restart=1');
  }

  return (
    <Card data-testid="bilan-actions" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white">Et maintenant&nbsp;?</h2>
      <p className="text-xs text-anthracite-300">Kotsh te suggère&nbsp;: {suggested}.</p>
      <div className="mt-2 flex flex-col gap-2">
        {/* Conv #15 vague 3 — en mode démo, les boutons sont verrouillés :
            sinon l'utilisateur peut accidentellement valider le bilan d'Alex
            (= passer au cycle suivant dans le snapshot démo). */}
        <Button
          variant="primary"
          fullWidth
          disabled={pending || demoActive}
          onClick={continueAsIs}
          data-testid="action-continuer"
        >
          {pending ? 'Création du cycle suivant…' : 'Continuer pareil'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={pending || demoActive}
          onClick={startPartialRestart}
          data-testid="action-ajuster"
        >
          Ajuster les objectifs
        </Button>
      </div>
      {error !== null && (
        <div
          role="alert"
          data-testid="bilan-action-error"
          className="mt-2 rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-xs text-sang-300"
        >
          {error}
        </div>
      )}
    </Card>
  );
}
