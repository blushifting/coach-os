import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
import { TrendArrow } from '@/components/icons';
import type { Catalog } from '@/engine/catalog';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';
import { GymBrand } from '@/engine/models';
import { cn } from '@/lib/cn';
import type { PlafondChange, SessionSummaryData } from '@/lib/session-runner';

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
  const brand = useGymBrand() ?? undefined;
  return (
    <div className="flex flex-col gap-3" data-testid="session-summary">
      <Card>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Bilan — {label}
          </span>
          <span className="text-lg font-semibold text-white">
            Séance bouclée.
          </span>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-3" data-testid="summary-volume">
        <Metric
          label="Volume du jour"
          value={`${Math.round(data.volumeKgToday).toLocaleString('fr-FR')} kg`}
        />
        <Metric
          label="vs semaine dernière"
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

      <Card data-testid="summary-plafonds" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-white">
          Évolution des <Concept topic="plafond">Plafonds</Concept>
        </h3>
        {data.plafondChanges.length === 0 ? (
          <p className="text-xs text-anthracite-300">
            Aucune série assez intense cette séance pour mettre à jour tes
            Plafonds.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.plafondChanges.map((c) => (
              <PlafondRow
                key={c.exerciseId}
                change={c}
                name={nameOf(catalog, c.exerciseId, brand)}
                chargeLabel={chargeLabelOf(catalog, c.exerciseId)}
              />
            ))}
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

function nameOf(catalog: Catalog | null, exerciseId: string, brand?: GymBrand): string {
  if (catalog === null) return exerciseId;
  try {
    return displayExerciseName(catalog.get(exerciseId), brand);
  } catch {
    return exerciseId;
  }
}

function chargeLabelOf(catalog: Catalog | null, exerciseId: string): string {
  if (catalog === null) return 'kg';
  try {
    return kgUnitLabel(catalog.get(exerciseId).charge);
  } catch {
    return 'kg';
  }
}

/**
 * Conv #21 — Ligne d'évolution plafond pour un exo. Quatre rendus :
 *   - première calibration : "X kg · 1re mesure" (vert — on a un repère)
 *   - hausse : "X → Y kg (+Δ) ↑" (vert : progression)
 *   - stable : "X → Y kg →" (orange : plateau, on signale sans alarmer)
 *   - baisse : "X → Y kg (−Δ) ↓" (rouge : régression)
 *
 * Conv #24 (D11) — passage au code couleur feu tricolore (vert/orange/rouge),
 * aligné sur le bilan de cycle, et doublé d'une flèche de tendance pour ne pas
 * reposer sur la seule couleur (accessibilité). Avant, une hausse s'affichait
 * en sang (rouge) — contre-intuitif pour une bonne nouvelle.
 */
function PlafondRow({
  change,
  name,
  chargeLabel,
}: {
  change: PlafondChange;
  name: string;
  chargeLabel: string;
}) {
  const { exerciseId, oldE, newE, deltaKg } = change;
  const isFirst = oldE === null;
  const isUp = deltaKg !== null && deltaKg > 0.05;
  const isDown = deltaKg !== null && deltaKg < -0.05;
  const trend: 'up' | 'down' | 'flat' = isUp ? 'up' : isDown ? 'down' : 'flat';
  const toneClass = isUp
    ? 'text-emerald-400'
    : isDown
      ? 'text-red-400'
      : 'text-amber-400';

  return (
    <li
      data-testid={`plafond-${exerciseId}`}
      data-direction={isFirst ? 'first' : trend}
      className="flex items-baseline justify-between gap-2 text-sm"
    >
      <span className="min-w-0 flex-1 truncate text-white">{name}</span>
      {isFirst ? (
        <span className="shrink-0 tabular-nums text-emerald-400">
          {newE.toFixed(1)} {chargeLabel} · 1re mesure
        </span>
      ) : (
        <span className={cn('flex shrink-0 items-baseline gap-1 tabular-nums', toneClass)}>
          <TrendArrow trend={trend} className="self-center text-[0.9em]" />
          {oldE!.toFixed(1)} → {newE.toFixed(1)} {chargeLabel}
          {deltaKg !== null && Math.abs(deltaKg) >= 0.05 ? (
            <span className="text-xs">
              ({deltaKg > 0 ? '+' : ''}
              {deltaKg.toFixed(1)})
            </span>
          ) : null}
        </span>
      )}
    </li>
  );
}
