import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { selectCycles, useDemoMode } from '@/store/selectors';
import type { CycleReview } from '@/engine/models';
import { exerciseLabel, muscleLabel } from '@/lib/progress';
import { pickReviewToDisplay, suggestedActionLabel } from './selectors';

/**
 * Page Bilan de cycle — Conv #5a.
 *
 * Affichage lecture seule de `CycleReview` (adhérence / volume / PR /
 * plafonds / muscles). Les 3 boutons d'action (Continuer / Ajuster /
 * Changer) sont des stubs : le câblage `endOfCycle({nextProgrammeId})`
 * et la navigation associée arrivent en Conv #5b ou #6c.
 *
 * Source : `recherche/08_ux_decisions.md §5 Fin de programme / fin de cycle`.
 */
export default function CycleBilanPage() {
  const lastCycleReview = useCoachOsStore((s) => s.lastCycleReview);
  const cycles = useCoachOsStore(selectCycles);
  const catalog = useCoachOsStore((s) => s.catalog);
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

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="cycle-bilan-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">
          {review === null ? 'Bilan de cycle' : `Bilan du cycle ${review.cycle_index}`}
        </h1>
        <p className="text-sm text-anthracite-300">
          Récap de ton cycle, puis choisis la suite.
        </p>
      </header>

      {review === null ? (
        <Card data-testid="bilan-empty">
          <p className="text-sm text-anthracite-300">
            Aucun bilan disponible pour le moment. Termine un cycle complet pour
            voir s'afficher tes plafonds, tes records et l'adhérence.
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
          <ReviewKeyMetrics review={review} />
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

function ReviewKeyMetrics({ review }: { review: CycleReview }) {
  // Conv #11i — animation reveal-up staggered (cascade 0 / 80 / 160 ms).
  // Conv #15-6 — HelpButton sur Adhérence (notion peu intuitive).
  return (
    <Card data-testid="bilan-key-metrics" className="grid grid-cols-3 gap-3">
      <Metric
        label="Adhérence"
        helpTopic="adherence"
        value={`${Math.round(review.adherence_pct * 100)} %`}
        delay={0}
      />
      <Metric
        label="Volume"
        value={`${Math.round(review.volume_total_kg).toLocaleString('fr-FR')} kg`}
        delay={80}
      />
      {/* Conv #15 vague 3 — "PR" → "Records" (terme FR explicite). */}
      <Metric label="Records" value={`${review.PRs.length}`} delay={160} />
    </Card>
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
    <div
      className="flex animate-reveal-up flex-col gap-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-anthracite-300">
        {label}
        {helpTopic && <HelpButton topic={helpTopic} label={`Aide : ${label}`} />}
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
        <h2 className="mb-1 text-sm font-semibold text-white">Plafonds</h2>
        <p className="text-xs text-anthracite-300">Aucune variation enregistrée.</p>
      </Card>
    );
  }
  return (
    <Card data-testid="bilan-plafonds" className="flex flex-col gap-2">
      {/* Conv #15-5 — "Δ sur le cycle" → "Évolution sur le cycle" (mot FR). */}
      <h2 className="text-sm font-semibold text-white">
        Plafonds — Évolution sur le cycle
      </h2>
      <ul className="flex flex-col gap-1">
        {entries.slice(0, 6).map(([exId, delta], i) => (
          <li
            key={exId}
            className="flex animate-reveal-up items-center justify-between text-sm"
            style={{ animationDelay: `${200 + i * 60}ms` }}
            data-testid={`plafond-${exId}`}
          >
            {/* Conv #15-5 — exId brut → nom français via catalog. */}
            <span className="min-w-0 truncate pr-2 text-anthracite-300">
              {exerciseLabel(exId, catalog)}
            </span>
            <span
              className={
                delta > 0
                  ? 'shrink-0 tabular-nums text-white'
                  : delta < 0
                  ? 'shrink-0 tabular-nums text-sang-500'
                  : 'shrink-0 tabular-nums text-anthracite-300'
              }
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} kg
            </span>
          </li>
        ))}
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
  const suggested = suggestedActionLabel(review.suggested_action);

  async function continueAsIs() {
    setPending(true);
    try {
      await engine.endOfCycle({});
      navigate('/programme');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card data-testid="bilan-actions" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white">Et maintenant ?</h2>
      <p className="text-xs text-anthracite-300">Suggestion du moteur : {suggested}.</p>
      <div className="mt-2 flex flex-col gap-2">
        {/* Conv #15 vague 3 — en mode démo, "Continuer" est verrouillé :
            sinon l'utilisateur peut accidentellement valider le bilan
            d'Alex (= passer au cycle suivant dans le snapshot démo). */}
        <Button
          variant="primary"
          fullWidth
          disabled={pending || demoActive}
          onClick={continueAsIs}
          data-testid="action-continuer"
        >
          {pending ? 'Création du cycle suivant…' : 'Continuer pareil'}
        </Button>
        <Button variant="secondary" fullWidth disabled data-testid="action-ajuster">
          Ajuster les objectifs
          <span className="ml-2 text-xs opacity-70">Conv #6c</span>
        </Button>
        <Button variant="secondary" fullWidth disabled data-testid="action-changer">
          Changer de programme
          <span className="ml-2 text-xs opacity-70">Conv #6c</span>
        </Button>
      </div>
    </Card>
  );
}
