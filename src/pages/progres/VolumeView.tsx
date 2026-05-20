/**
 * Volume hebdo par muscle (Conv #6a, refonte #14c-6).
 *
 * Refonte #14c-6 :
 *  - Filtre par défaut sur les muscles `PRIORITAIRE`. Toggle "Tout afficher"
 *    pour repasser sur l'ensemble du profil.
 *  - Palette nettoyée : plus d'orange. Les barres "dans la cible" sont en
 *    anthracite sobre, les barres hors-cible (sous V_min ou au-dessus de
 *    V_max) sont accentuées en sang. L'œil n'attrape que les anomalies.
 *  - Lignes V_min / V_max conservées en pointillé (repère).
 *
 * Référence : 10_plan §3 Conv #6a, infobulle help "V_min / V_max".
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import {
  formatWeekLabel,
  muscleLabel,
  type MuscleVolumeSeries,
} from '@/lib/progress';

interface VolumeViewProps {
  readonly series: ReadonlyArray<MuscleVolumeSeries>;
}

type ScopeFilter = 'prio' | 'all';

export function VolumeView({ series }: VolumeViewProps) {
  const [scope, setScope] = useState<ScopeFilter>('prio');

  const prioritaires = useMemo(
    () => series.filter((s) => s.status === 'PRIORITAIRE'),
    [series],
  );
  // Si l'utilisateur n'a aucun PRIORITAIRE (cas profil minimal), on bascule
  // automatiquement sur "Tout afficher" pour ne pas montrer un onglet vide.
  const effectiveScope: ScopeFilter =
    scope === 'prio' && prioritaires.length === 0 ? 'all' : scope;
  const filtered = effectiveScope === 'prio' ? prioritaires : series;

  if (series.length === 0) {
    return (
      <Card data-testid="volume-empty">
        <p className="text-sm text-anthracite-300">
          Aucune donnée de volume — termine une séance pour voir tes barres.
        </p>
      </Card>
    );
  }

  // Échelle X commune : max sur le sous-ensemble affiché.
  let maxScale = 0;
  for (const s of filtered) {
    maxScale = Math.max(maxScale, s.vMax, ...s.points.map((p) => p.sets));
  }
  maxScale = Math.max(1, Math.ceil(maxScale * 1.1));

  const weekLabels =
    filtered[0]?.points.map((p) => formatWeekLabel(p.weekStart)) ?? [];

  return (
    <section className="flex flex-col gap-3" data-testid="volume-view">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Volume hebdo par muscle</h2>
        <HelpButton topic="vminmax" />
      </header>

      <ScopeToggle
        scope={effectiveScope}
        onChange={setScope}
        disabled={prioritaires.length === 0}
        prioCount={prioritaires.length}
        totalCount={series.length}
      />

      {filtered.length === 0 ? (
        <Card data-testid="volume-empty-scope">
          <p className="text-sm text-anthracite-300">
            Aucun muscle prioritaire pour l'instant. Bascule sur "Tout afficher"
            ou ajuste tes objectifs depuis le Profil.
          </p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2 p-3">
            <div />
            <div className="flex justify-between text-[9px] text-anthracite-300">
              {weekLabels.map((lbl, i) => (
                <span key={i}>{lbl}</span>
              ))}
            </div>

            {filtered.map((s) => (
              <MuscleRow key={s.muscle} series={s} maxScale={maxScale} />
            ))}
          </div>
        </Card>
      )}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-anthracite-300">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0 w-4 border-t border-dashed border-anthracite-200/70" />
          V_min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0 w-4 border-t border-dashed border-sang-400/80" />
          V_max
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-3 rounded-sm bg-sang-500"
          />
          hors cible
        </span>
      </p>
    </section>
  );
}

function ScopeToggle({
  scope,
  onChange,
  disabled,
  prioCount,
  totalCount,
}: {
  readonly scope: ScopeFilter;
  readonly onChange: (s: ScopeFilter) => void;
  readonly disabled: boolean;
  readonly prioCount: number;
  readonly totalCount: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filtre du volume affiché"
      className="inline-flex w-full rounded-lg border border-anthracite-700 bg-anthracite-900 p-0.5 text-xs"
      data-testid="volume-scope-toggle"
    >
      <ScopeButton
        active={scope === 'prio'}
        onClick={() => onChange('prio')}
        disabled={disabled}
        testId="volume-scope-prio"
      >
        Prioritaires
        <span className="ml-1 text-anthracite-400 tabular-nums">({prioCount})</span>
      </ScopeButton>
      <ScopeButton
        active={scope === 'all'}
        onClick={() => onChange('all')}
        testId="volume-scope-all"
      >
        Tout afficher
        <span className="ml-1 text-anthracite-400 tabular-nums">({totalCount})</span>
      </ScopeButton>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  disabled = false,
  testId,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly testId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'flex-1 rounded-md px-2 py-1.5 transition-colors',
        active
          ? 'bg-sang-700/30 text-white font-medium'
          : 'text-anthracite-300 hover:text-white',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  );
}

interface MuscleRowProps {
  readonly series: MuscleVolumeSeries;
  readonly maxScale: number;
}

function MuscleRow({ series, maxScale }: MuscleRowProps) {
  const { muscle, vMin, vMax, points } = series;
  const hasTarget = vMax > 0;
  const minPct = hasTarget ? (vMin / maxScale) * 100 : 0;
  const maxPct = hasTarget ? (vMax / maxScale) * 100 : 0;
  return (
    <>
      <span className="truncate text-xs font-medium text-white">
        {muscleLabel(muscle)}
      </span>
      <div
        data-testid={`volume-row-${muscle}`}
        className="relative flex h-6 items-end gap-1"
      >
        {hasTarget && (
          <>
            <div
              aria-hidden="true"
              data-testid={`vmax-line-${muscle}`}
              className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-sang-400/80"
              style={{ bottom: `${maxPct}%` }}
            />
            <div
              aria-hidden="true"
              data-testid={`vmin-line-${muscle}`}
              className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-anthracite-200/60"
              style={{ bottom: `${minPct}%` }}
            />
          </>
        )}
        {points.map((p, i) => {
          const pct = (p.sets / maxScale) * 100;
          const tone = barTone(p.sets, vMin, vMax);
          return (
            <div
              key={i}
              className="relative h-full flex-1 rounded-sm bg-anthracite-900"
              data-testid={`volume-cell-${muscle}-${i}`}
              title={`${formatWeekLabel(p.weekStart)} · ${p.sets.toFixed(1)} séries`}
            >
              <div
                aria-hidden="true"
                className={cn('absolute bottom-0 left-0 right-0 rounded-sm', tone)}
                style={{ height: `${Math.min(100, pct)}%` }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Tonalité d'une barre (Conv #14c-6) :
 *  - vide / pas de cible posée → anthracite mat.
 *  - dans la cible [vMin, vMax] → anthracite clair (neutre, n'attrape pas l'œil).
 *  - hors cible (sous V_min ou au-dessus V_max) → sang vif (signal).
 */
function barTone(sets: number, vMin: number, vMax: number): string {
  if (vMax === 0) return 'bg-anthracite-600';
  if (sets === 0) return 'bg-anthracite-600';
  if (sets < vMin || sets > vMax) return 'bg-sang-500';
  return 'bg-anthracite-200';
}
