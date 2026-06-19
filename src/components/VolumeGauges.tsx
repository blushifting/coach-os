/**
 * Bloc O — jauges de volume « live » du mode « à la main ».
 *
 * Une barre par muscle ciblé (prios + maintien des objectifs peints à l'étape
 * Muscles) : séries pondérées par semaine du plan en cours vs la bande cible
 * [V_min, V_max]. La couleur reflète le statut (à compléter, sous la cible,
 * dans la cible, au-dessus). Guide l'utilisateur qui remplit sa grille vide.
 */

import { useMemo } from 'react';
import type { Catalog } from '@/engine/catalog';
import type { UserState, WeeklyTemplate } from '@/engine/models';
import { effectiveVolumeBounds } from '@/engine/volume';
import { classifyVolume, muscleLabel, type CoverageStatus } from '@/lib/progress';
import { weightedWeeklyVolumeByMuscle } from '@/lib/onboarding-preview';
import { Card } from '@/components/Card';
import { cn } from '@/lib/cn';

type GaugeState = Pick<UserState, 'volume_min' | 'volume_max' | 'muscle_goals'>;

interface Props {
  readonly template: WeeklyTemplate;
  readonly state: GaugeState;
  readonly catalog: Catalog;
}

const FILL_TONE: Record<CoverageStatus, string> = {
  non_travaille: 'bg-anthracite-500',
  sous_min: 'bg-amber-500',
  ok: 'bg-emerald-500',
  depassement: 'bg-sang-500',
  hors_scope: 'bg-anthracite-500',
};

const STATUS_LABEL: Record<CoverageStatus, string> = {
  non_travaille: 'à compléter',
  sous_min: 'sous la cible',
  ok: 'dans la cible',
  depassement: 'au-dessus',
  hors_scope: '',
};

const STATUS_TEXT_TONE: Record<CoverageStatus, string> = {
  non_travaille: 'text-anthracite-400',
  sous_min: 'text-amber-400',
  ok: 'text-emerald-400',
  depassement: 'text-sang-400',
  hors_scope: 'text-anthracite-400',
};

interface GaugeRow {
  readonly muscle: string;
  readonly sets: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly status: CoverageStatus;
}

export function VolumeGauges({ template, state, catalog }: Props) {
  const rows = useMemo<readonly GaugeRow[]>(() => {
    const weighted = weightedWeeklyVolumeByMuscle(template, catalog);
    const out: GaugeRow[] = [];
    for (const muscle of Object.keys(state.muscle_goals)) {
      const [vMin, vMax] = effectiveVolumeBounds(state as UserState, muscle);
      if (vMax <= 0) continue; // muscle hors scope (pas de plafond)
      const sets = weighted[muscle] ?? 0;
      out.push({ muscle, sets, vMin, vMax, status: classifyVolume(sets, vMin, vMax) });
    }
    out.sort((a, b) => {
      const ra = state.muscle_goals[a.muscle]?.priority_rank ?? 99;
      const rb = state.muscle_goals[b.muscle]?.priority_rank ?? 99;
      if (ra !== rb) return ra - rb;
      return a.muscle.localeCompare(b.muscle);
    });
    return out;
  }, [template, state, catalog]);

  if (rows.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2" data-testid="volume-gauges">
      <div className="text-sm font-medium text-white">Séries par semaine</div>
      <p className="text-[11px] leading-relaxed text-anthracite-300">
        Chaque barre montre tes séries par muscle. Ajoute des exercices
        pour atteindre la zone verte.
      </p>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <GaugeBar key={r.muscle} {...r} />
        ))}
      </ul>
    </Card>
  );
}

function GaugeBar({ muscle, sets, vMin, vMax, status }: GaugeRow) {
  const scaleMax = Math.max(vMax, sets, 1);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;
  const bandLeft = pct(vMin);
  const bandWidth = `${Math.min(100, Math.max(0, ((vMax - vMin) / scaleMax) * 100))}%`;
  const fillWidth = pct(sets);

  return (
    <li data-testid={`gauge-${muscle}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-white">{muscleLabel(muscle)}</span>
        <span className="shrink-0 tabular-nums text-anthracite-300">
          {Math.round(sets)} / {Math.round(vMin)}–{Math.round(vMax)} séries
          {STATUS_LABEL[status] ? (
            <span className={cn('ml-1.5', STATUS_TEXT_TONE[status])}>
              · {STATUS_LABEL[status]}
            </span>
          ) : null}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-anthracite-800">
        {/* Bande cible [V_min, V_max]. */}
        <div
          className="absolute inset-y-0 bg-anthracite-700"
          style={{ left: bandLeft, width: bandWidth }}
          aria-hidden="true"
        />
        {/* Remplissage = séries pondérées réalisées. */}
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', FILL_TONE[status])}
          style={{ width: fillWidth }}
          aria-hidden="true"
        />
      </div>
    </li>
  );
}
