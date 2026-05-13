import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { selectCycles } from '@/store/selectors';
import type { CycleReview } from '@/engine/models';
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
  const review = pickReviewToDisplay(lastCycleReview, cycles);

  return (
    <section className="flex flex-col gap-4 pb-4" data-testid="cycle-bilan-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">
          {review === null ? 'Bilan de cycle' : `Bilan du cycle ${review.cycle_index}`}
        </h1>
        <p className="text-sm text-anthracite-500">
          Récap de ton cycle, puis choisis la suite.
        </p>
      </header>

      {review === null ? (
        <Card data-testid="bilan-empty">
          <p className="text-sm text-anthracite-500">
            Aucun bilan disponible pour le moment. Termine un cycle complet pour
            voir s'afficher tes plafonds, PR, et l'adhérence.
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
          <ReviewPlafonds review={review} />
          <ReviewMuscles review={review} />
          {review.warnings.length > 0 && <ReviewWarnings review={review} />}
          <ReviewActions review={review} />
        </>
      )}
    </section>
  );
}

function ReviewKeyMetrics({ review }: { review: CycleReview }) {
  return (
    <Card data-testid="bilan-key-metrics" className="grid grid-cols-3 gap-3">
      <Metric label="Adhérence" value={`${Math.round(review.adherence_pct * 100)} %`} />
      <Metric label="Volume" value={`${Math.round(review.volume_total_kg).toLocaleString('fr-FR')} kg`} />
      <Metric label="PR" value={`${review.PRs.length}`} />
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-anthracite-500">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}

function ReviewPlafonds({ review }: { review: CycleReview }) {
  const entries = Object.entries(review.plafonds_progression).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <Card data-testid="bilan-plafonds">
        <h2 className="mb-1 text-sm font-semibold text-white">Plafonds</h2>
        <p className="text-xs text-anthracite-500">Aucune variation enregistrée.</p>
      </Card>
    );
  }
  return (
    <Card data-testid="bilan-plafonds" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white">Plafonds — Δ sur le cycle</h2>
      <ul className="flex flex-col gap-1">
        {entries.slice(0, 6).map(([exId, delta]) => (
          <li
            key={exId}
            className="flex items-center justify-between text-sm"
            data-testid={`plafond-${exId}`}
          >
            <span className="text-anthracite-500">{exId}</span>
            <span
              className={
                delta > 0
                  ? 'tabular-nums text-white'
                  : delta < 0
                  ? 'tabular-nums text-sang-500'
                  : 'tabular-nums text-anthracite-500'
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
      <span className="text-xs uppercase tracking-wide text-anthracite-500">{label}</span>
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
            {m}
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
      <ul className="list-inside list-disc text-xs text-anthracite-500">
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
      <p className="text-xs text-anthracite-500">Suggestion du moteur : {suggested}.</p>
      <div className="mt-2 flex flex-col gap-2">
        <Button
          variant="primary"
          fullWidth
          disabled={pending}
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
