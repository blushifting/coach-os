import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Catalog } from '@/engine/catalog';
import type { SessionSummaryData } from '@/lib/session-runner';

interface SessionSummaryProps {
  readonly label: string;
  readonly data: SessionSummaryData;
  readonly catalog: Catalog | null;
  readonly onClose: () => void;
}

/**
 * Écran "État C" — bilan post-séance (cf. 08 §199).
 * Volume du jour, comparaison à la semaine dernière (même `label`), PR.
 */
export function SessionSummary({ label, data, catalog, onClose }: SessionSummaryProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="session-summary">
      <Card>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Séance terminée — {label}
          </span>
          <span className="text-lg font-semibold text-white">
            Bon boulot.
          </span>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-3" data-testid="summary-volume">
        <Metric
          label="Volume du jour"
          value={`${Math.round(data.volumeKgToday).toLocaleString('fr-FR')} kg`}
        />
        <Metric
          label="vs sem dernière"
          value={
            data.volumeDeltaPct === null
              ? '—'
              : `${data.volumeDeltaPct >= 0 ? '+' : ''}${data.volumeDeltaPct.toFixed(0)}%`
          }
          tone={
            data.volumeDeltaPct === null
              ? 'neutral'
              : data.volumeDeltaPct >= 0
              ? 'positive'
              : 'negative'
          }
        />
      </Card>

      <Card data-testid="summary-prs" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-white">PR du jour</h3>
        {data.prs.length === 0 ? (
          <p className="text-xs text-anthracite-300">
            Pas de plafond cassé aujourd'hui — c'est normal, ça vient.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.prs.map((pr) => {
              const name = nameOf(catalog, pr.exerciseId);
              return (
                <li
                  key={pr.exerciseId}
                  data-testid={`pr-${pr.exerciseId}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-white">{name}</span>
                  <span className="tabular-nums text-sang-500">
                    +{pr.deltaKg.toFixed(1)} kg
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <Link to="/programme">
          <Button variant="primary" fullWidth onClick={onClose} data-testid="btn-back-programme">
            Retour au programme
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-anthracite-300">{label}</span>
      <span
        className={
          tone === 'positive'
            ? 'text-lg font-semibold text-white tabular-nums'
            : tone === 'negative'
            ? 'text-lg font-semibold text-sang-500 tabular-nums'
            : 'text-lg font-semibold text-white tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  );
}

function nameOf(catalog: Catalog | null, exerciseId: string): string {
  if (catalog === null) return exerciseId;
  try {
    return catalog.get(exerciseId).nom_fr;
  } catch {
    return exerciseId;
  }
}
