import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AnatomicalSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
import { ChevronRight, TrendArrow } from '@/components/icons';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import { useEngine } from '@/hooks/useEngine';
import { useAnimateOnMount } from '@/hooks/useMotion';
import { useCoachOsStore } from '@/store';
import { selectCycles, useDemoMode, useToday } from '@/store/selectors';
import { MuscleStatus, SuggestedAction, type CycleReview } from '@/engine/models';
import {
  FORCE_DELTA_THRESHOLD,
  classifyForceDelta,
  muscleForceDeltas,
  type ForceOutcome,
} from '@/engine/lifecycle';
import {
  buildMusclesOf,
  computeCycleVolumeByMuscle,
  exerciseLabel,
  muscleLabel,
  type CoverageStatus,
  type MuscleCycleVolume,
} from '@/lib/progress';
import {
  overloadedMuscles,
  pickPendingCycleReview,
  pickReviewToDisplay,
} from './selectors';

/**
 * Page Bilan de cycle — Conv #5a.
 *
 * Lecture seule d'un `CycleReview`, dans un ordre qui raconte le cycle
 * (Conv #76) : ce que tu as fait (volume par muscle) → ce que ça a donné,
 * exercice par exercice (Plafonds) → le même résultat agrégé par muscle
 * (silhouette). Puis les deux actions de sortie.
 *
 * Source : `recherche/08_ux_decisions.md §5 Fin de programme / fin de cycle`.
 */
export default function CycleBilanPage() {
  const lastCycleReview = useCoachOsStore((s) => s.lastCycleReview);
  const cycles = useCoachOsStore(selectCycles);
  const catalog = useCoachOsStore((s) => s.catalog);
  const feedbacks = useCoachOsStore((s) => s.history.feedbacks);
  const userState = useCoachOsStore((s) => s.userState);
  const today = useToday();
  const [search] = useSearchParams();
  // Conv #15-5 — Si on arrive avec `?cycle=N`, on cible explicitement le
  // bilan de ce cycle (ouvert depuis Progrès > Cycles). Sinon comportement
  // historique : dernier bilan disponible.
  const targetCycleParam = search.get('cycle');
  const targetCycleIndex =
    targetCycleParam !== null && Number.isFinite(Number(targetCycleParam))
      ? Number(targetCycleParam)
      : null;

  // Conv #76 — bilan du cycle en cours, calculé à la volée tant qu'il n'a pas
  // été validé (cf. `pickPendingCycleReview`). Prioritaire sur le fallback
  // `pickReviewToDisplay`, qui remonterait sinon le bilan du cycle PRÉCÉDENT.
  const pendingReview = useMemo(
    () =>
      targetCycleIndex !== null
        ? null
        : pickPendingCycleReview({ userState, catalog, cycles, feedbacks, today }),
    [targetCycleIndex, userState, catalog, cycles, feedbacks, today],
  );

  const review =
    targetCycleIndex !== null
      ? cycles.find((c) => c.cycle_index === targetCycleIndex)?.review ?? null
      : pendingReview ?? pickReviewToDisplay(lastCycleReview, cycles);
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
          <ReviewMuscleForce review={review} catalog={catalog} />
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
 *
 * Conv #76 — seuls les muscles PRIORITAIRES sont dépliés d'entrée : ce sont
 * eux qui portent l'objectif du cycle, et la liste complète (jusqu'à ~15
 * lignes) noyait l'information. Le reste — muscles suivis non prioritaires,
 * puis muscles travaillés hors objectifs — se déplie à la demande.
 */
function ReviewVolume({ volume }: { volume: ReadonlyArray<MuscleCycleVolume> }) {
  const [expanded, setExpanded] = useState(false);
  const priority = volume.filter((m) => m.goalStatus === MuscleStatus.PRIORITAIRE);
  // Repli de sécurité : sans muscle prioritaire, on montre tout plutôt qu'une
  // carte vide surmontée d'un bouton « voir les autres ».
  const shown = expanded || priority.length === 0 ? volume : priority;
  const hiddenCount = volume.length - shown.length;
  if (volume.length === 0) return null;
  return (
    <Card data-testid="bilan-volume" className="flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold text-white">
        Volume par muscle · moy./sem vs cible
      </h2>
      {shown.map((m, i) => (
        <CycleVolumeRow key={m.muscle} data={m} index={i} />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          data-testid="bilan-volume-expand"
          className="mt-1 flex items-center justify-between rounded-lg border-t border-anthracite-700 pt-2.5 text-xs text-anthracite-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sang-500/60"
        >
          <span>
            Voir les {hiddenCount} autres muscles
          </span>
          <ChevronRight className="rotate-90 text-anthracite-400" />
        </button>
      )}
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
  // Muscle travaillé sans cible : l'échelle n'a pas de plafond de référence, on
  // se cale sur le volume réalisé (barre pleine, ton neutre).
  const tracked = data.vMax > 0;
  const scaleMax = tracked ? data.vMax : Math.max(data.avgSetsPerWeek, 1);
  const pct = Math.min(100, (data.avgSetsPerWeek / scaleMax) * 100);
  // Conv #76 — repère du minimum visé, posé sur la barre. C'est surtout utile
  // quand la cible n'est PAS atteinte : sans lui, une barre courte ne dit pas
  // s'il manque une demi-série ou la moitié du travail.
  const vMinPct = tracked ? Math.min(100, (data.vMin / scaleMax) * 100) : null;
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
            {tracked ? (
              <>
                {' '}
                / {data.vMin.toFixed(0)}–{data.vMax.toFixed(0)}
              </>
            ) : (
              ' séries/sem'
            )}
          </span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-anthracite-700">
        <div className="h-full overflow-hidden rounded-full">
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
        {vMinPct !== null && (
          <span
            aria-hidden="true"
            data-testid={`bilan-vmin-${data.muscle}`}
            className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-anthracite-100"
            style={{ left: `${vMinPct}%` }}
          />
        )}
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
  // Conv #76 — tous les exercices dont le Plafond a bougé, hausses d'abord puis
  // baisses. Avant : `slice(0, 6)`, qui coupait silencieusement — et coupait
  // en priorité les baisses, puisque le tri est décroissant. Les variations
  // sous le seuil de significativité (bruit d'EMA) sont écartées.
  const entries = Object.entries(review.plafonds_progression)
    .filter(([, delta]) => Math.abs(delta) >= FORCE_DELTA_THRESHOLD)
    .sort((a, b) => b[1] - a[1]);
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
        {entries.map(([exId, delta], i) => {
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

/**
 * Conv #76 — remplace l'ancienne carte « Muscles » (4 listes de puces :
 * Progrès / Plateau / Sous-stimulé / Surchargé), jugée illisible.
 *
 * Deux de ces listes doublonnaient les barres de volume ci-dessus
 * (sous-stimulé et surchargé sont du pur volume, en moins précis) : retirées.
 * Les deux autres mesurent la FORCE — c'est la seule information que la page
 * n'avait nulle part ailleurs, et elle est ici agrégée par muscle sur la
 * silhouette, juste après la même information exercice par exercice.
 *
 * Le mot « Plateau » disait par ailleurs faux : il désignait un Δ Plafond
 * NÉGATIF, pas une stagnation — et les muscles réellement stables
 * n'apparaissaient dans aucune des quatre listes. D'où trois états francs.
 *
 * Palette : le même feu tricolore que la liste des Plafonds au-dessus (vert
 * hausse / ambre stable / rouge baisse), via `TONE_FILL_LEGACY` de la
 * silhouette — `ok` y est vert, `high` ambre, `low` sang.
 */
const FORCE_TO_SILHOUETTE: Record<ForceOutcome, SilhouetteStatus> = {
  up: 'ok',
  flat: 'high',
  down: 'low',
};

function ReviewMuscleForce({
  review,
  catalog,
}: {
  review: CycleReview;
  catalog: import('@/engine/catalog').Catalog | null;
}) {
  const highlights = useMemo(() => {
    if (catalog === null) return {};
    const deltas = muscleForceDeltas(review.plafonds_progression, catalog);
    const h: Record<string, SilhouetteStatus> = {};
    for (const [muscle, avg] of Object.entries(deltas)) {
      h[muscle] = FORCE_TO_SILHOUETTE[classifyForceDelta(avg)];
    }
    return h;
  }, [review, catalog]);

  if (Object.keys(highlights).length === 0) return null;

  return (
    <Card data-testid="bilan-muscle-force" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-white">Progression par muscle</h2>
      <AnatomicalSilhouette
        highlights={highlights}
        view="both"
        className="mx-auto h-48"
        testId="bilan-force-silhouette"
      />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-anthracite-200">
        <ForceLegend tone="fill-emerald-700" label="en progrès" />
        <ForceLegend tone="fill-amber-700" label="stable" />
        <ForceLegend tone="fill-sang-800" label="en baisse" />
      </div>
    </Card>
  );
}

function ForceLegend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 10 10" aria-hidden="true">
        <rect width="10" height="10" rx="2" className={tone} />
      </svg>
      {label}
    </span>
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

function OverloadAlert({ muscles }: { muscles: ReadonlyArray<string> }) {
  return (
    <div
      role="status"
      data-testid="bilan-overload-alert"
      className="rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-2.5 text-xs leading-relaxed text-anthracite-200"
    >
      <p className="mb-1 font-semibold text-white">
        Trop de volume sur&nbsp;: {muscles.map(muscleLabel).join(', ')}
      </p>
      <p>
        Tu as fait plus de séries que prévu sur ces muscles, et leur{' '}
        <Concept topic="plafond">Plafond</Concept> a baissé. C'est le signe que
        tu en fais plus que tu ne récupères.
      </p>
      <p className="mt-1">
        Au prochain cycle, allège-les au lieu d'en ajouter. Passe-les en Force
        ou en Maintien depuis «&nbsp;Changer mes objectifs&nbsp;»&nbsp;: ces deux
        objectifs demandent moins de séries.
      </p>
    </div>
  );
}

function ReviewActions({ review }: { review: CycleReview }) {
  const engine = useEngine();
  const navigate = useNavigate();
  const demoActive = useDemoMode();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overloaded = overloadedMuscles(review);

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
      {overloaded.length > 0 && <OverloadAlert muscles={overloaded} />}
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
          {pending ? 'Création du cycle suivant…' : 'Garder ce programme'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={pending || demoActive}
          onClick={startPartialRestart}
          data-testid="action-ajuster"
        >
          Changer mes objectifs
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
