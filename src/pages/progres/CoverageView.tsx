import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import {
  AnatomicalSilhouette,
  statusToSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import { cn } from '@/lib/cn';
import {
  muscleLabel,
  type CoverageStatus,
  type MuscleCoverage,
} from '@/lib/progress';

interface CoverageViewProps {
  readonly coverage: ReadonlyArray<MuscleCoverage>;
}

/**
 * Heatmap "couverture cette semaine" — Conv #8b.
 *
 * Silhouette anatomique face + dos colorée par muscle selon le statut
 * (sous-min / ok / dépassement / non travaillé), complétée par une grille
 * de chips qui exposent les chiffres précis (séries réalisées vs V_min-V_max).
 */
export function CoverageView({ coverage }: CoverageViewProps) {
  // Exclut les muscles "hors_scope" du quadrillage principal pour réduire le
  // bruit, mais on les liste discrètement en bas (au cas où l'user en
  // travaille un par accident — sera comptabilisé dans la barre "depassement").
  const inScope = coverage.filter((c) => c.status !== 'hors_scope');
  const outOfScope = coverage.filter((c) => c.status === 'hors_scope');

  if (inScope.length === 0) {
    return (
      <Card data-testid="coverage-empty">
        <p className="text-sm text-anthracite-500">
          Aucun muscle ciblé pour le moment. Définis tes objectifs depuis l'onglet
          Profil.
        </p>
      </Card>
    );
  }

  const highlights: Record<string, SilhouetteStatus> = {};
  for (const c of coverage) {
    highlights[c.muscle] = statusToSilhouette(c.status);
  }

  return (
    <section className="flex flex-col gap-3" data-testid="coverage-view">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Couverture cette semaine</h2>
        <HelpButton topic="volumeHebdo" />
      </header>

      <Card className="flex justify-center" data-testid="coverage-silhouette">
        <AnatomicalSilhouette
          highlights={highlights}
          className="h-48 w-auto"
          testId="coverage-silhouette-svg"
        />
      </Card>

      <Legend />

      <Card className="grid grid-cols-2 gap-2" data-testid="coverage-grid">
        {inScope.map((m) => (
          <MuscleChip key={m.muscle} item={m} />
        ))}
      </Card>

      {outOfScope.length > 0 && (
        <details className="text-xs text-anthracite-500">
          <summary className="cursor-pointer">
            Muscles hors objectifs ({outOfScope.length})
          </summary>
          <p className="mt-1">
            {outOfScope.map((c) => muscleLabel(c.muscle)).join(', ')}
          </p>
        </details>
      )}
    </section>
  );
}

function MuscleChip({ item }: { readonly item: MuscleCoverage }) {
  const tone = STATUS_TONE[item.status];
  return (
    <div
      data-testid={`coverage-chip-${item.muscle}`}
      data-status={item.status}
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border px-3 py-2',
        tone.border,
        tone.bg,
      )}
    >
      <span className="text-xs font-medium text-white">{muscleLabel(item.muscle)}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-lg font-semibold tabular-nums', tone.text)}>
          {item.sets.toFixed(1)}
        </span>
        <span className="text-[10px] text-anthracite-500">
          / {item.vMin.toFixed(0)}–{item.vMax.toFixed(0)}
        </span>
      </div>
      <span className="text-[10px] text-anthracite-500">{STATUS_LABEL[item.status]}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-anthracite-500">
      {(['non_travaille', 'sous_min', 'ok', 'depassement'] as const).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span
            className={cn('inline-block h-2 w-2 rounded-full', STATUS_TONE[s].dot)}
          />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<CoverageStatus, string> = {
  non_travaille: 'pas touché',
  sous_min: 'sous le minimum',
  ok: 'dans la cible',
  depassement: 'au-dessus',
  hors_scope: 'hors objectifs',
};

interface ToneClasses {
  readonly border: string;
  readonly bg: string;
  readonly text: string;
  readonly dot: string;
}

const STATUS_TONE: Record<CoverageStatus, ToneClasses> = {
  non_travaille: {
    border: 'border-anthracite-700',
    bg: 'bg-anthracite-900',
    text: 'text-anthracite-500',
    dot: 'bg-anthracite-600',
  },
  sous_min: {
    border: 'border-sang-800',
    bg: 'bg-sang-900/30',
    text: 'text-sang-500',
    dot: 'bg-sang-700',
  },
  ok: {
    border: 'border-emerald-800',
    bg: 'bg-emerald-900/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-700',
  },
  depassement: {
    border: 'border-amber-800',
    bg: 'bg-amber-900/20',
    text: 'text-amber-400',
    dot: 'bg-amber-700',
  },
  hors_scope: {
    border: 'border-anthracite-700',
    bg: 'bg-anthracite-900',
    text: 'text-anthracite-500',
    dot: 'bg-anthracite-700',
  },
};
