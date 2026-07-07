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
import { sessionDisplayName } from '@/lib/session-label';
import { muscleLabel, type CoverageStatus } from '@/lib/progress';
import type {
  PlafondChange,
  SessionMuscleVolume,
  SessionSummaryData,
} from '@/lib/session-runner';

interface SessionSummaryProps {
  readonly label: string;
  /** Bloc G (Conv #32) — nom custom de la séance, s'il y en a un. */
  readonly customName?: string | null;
  readonly data: SessionSummaryData;
  readonly catalog: Catalog | null;
  /**
   * Chantier B — la séance a été enregistrée en semaine de récupération EFFECTIVE
   * (semaine 5 + déload accepté). Aucune mesure de plafond n'est faite : on
   * l'explique au lieu du message « aucune série assez intense ».
   */
  readonly deloadActive?: boolean;
  readonly onClose: () => void;
}

/**
 * Écran "État C" — bilan post-séance (cf. 08 §199).
 * Volume du jour, comparaison à la semaine dernière (même `label`), PR.
 */
export function SessionSummary({
  label,
  customName,
  data,
  catalog,
  deloadActive = false,
  onClose,
}: SessionSummaryProps) {
  const brand = useGymBrand() ?? undefined;
  return (
    <div className="flex flex-col gap-3" data-testid="session-summary">
      <Card>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Bilan — {sessionDisplayName({ custom_name: customName, label })}
          </span>
          <span className="text-lg font-semibold text-white">
            Séance bouclée.
          </span>
        </div>
      </Card>

      <Card
        className="flex items-baseline gap-3"
        data-testid="summary-sets"
      >
        <span className="font-display text-2xl font-semibold text-white tabular-nums">
          {data.setsCount}
        </span>
        <span className="text-sm text-anthracite-200">
          série{data.setsCount > 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-sm tabular-nums text-anthracite-300">
          {data.exerciseCount} exercice{data.exerciseCount > 1 ? 's' : ''}
        </span>
      </Card>

      {data.muscleVolume.length > 0 && (
        <Card className="flex flex-col gap-2.5" data-testid="summary-muscle-volume">
          <h3 className="text-sm font-semibold text-white">
            Volume par muscle · cette semaine
          </h3>
          {data.muscleVolume.map((m) => (
            <MuscleVolumeRow key={m.muscle} data={m} />
          ))}
        </Card>
      )}

      <Card data-testid="summary-plafonds" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-white">
          Évolution des <Concept topic="plafond">Plafonds</Concept>
        </h3>
        {data.plafondChanges.length === 0 ? (
          <p className="text-xs text-anthracite-300">
            {deloadActive
              ? 'Semaine de récupération : on ne mesure pas tes Plafonds cette semaine. Tu reprends la progression au prochain cycle.'
              : 'Aucune série assez intense cette séance pour mettre à jour tes Plafonds.'}
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

/** Série(s) pondérée(s) sans arrondi trompeur (cf. #11) : décimale si non entier. */
function formatSets(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const STATUS_TEXT: Record<CoverageStatus, string> = {
  non_travaille: 'text-anthracite-300',
  sous_min: 'text-sang-400',
  ok: 'text-emerald-400',
  depassement: 'text-amber-400',
  hors_scope: 'text-anthracite-300',
};

const STATUS_BAR: Record<CoverageStatus, string> = {
  non_travaille: 'bg-anthracite-500',
  sous_min: 'bg-sang-500',
  ok: 'bg-emerald-500',
  depassement: 'bg-amber-500',
  hors_scope: 'bg-anthracite-500',
};

/**
 * #13 (E-3) — ligne « volume d'un muscle ce jour » : contribution du jour (+X),
 * total hebdo rapporté à la cible V_min–V_max, et barre colorée par statut.
 * Un muscle non suivi (hors objectifs) montre sa contribution sans cible.
 */
function MuscleVolumeRow({ data }: { data: SessionMuscleVolume }) {
  const tracked = data.vMax > 0;
  const pct = tracked ? Math.min(100, (data.weekTotal / data.vMax) * 100) : 0;
  return (
    <div className="flex flex-col gap-1" data-testid={`summary-muscle-${data.muscle}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-anthracite-200">
          {muscleLabel(data.muscle)}
          <span className="ml-1 text-emerald-400 tabular-nums">
            +{formatSets(data.sessionSets)}
          </span>
        </span>
        {tracked ? (
          <span className={cn('shrink-0 tabular-nums', STATUS_TEXT[data.status])}>
            {formatSets(data.weekTotal)}
            <span className="text-anthracite-400">
              {' '}
              / {data.vMin.toFixed(0)}–{data.vMax.toFixed(0)}
            </span>
          </span>
        ) : (
          <span className="shrink-0 text-anthracite-400">hors objectifs</span>
        )}
      </div>
      {tracked && (
        <div className="h-1.5 overflow-hidden rounded-full bg-anthracite-700">
          <div
            className={cn('h-full rounded-full', STATUS_BAR[data.status])}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
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
