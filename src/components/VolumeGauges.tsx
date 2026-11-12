/**
 * Bloc O — jauges de volume « live » du mode « à la main ».
 *
 * Une barre par muscle qui a un objectif (à développer, puis à entretenir) :
 * séries pondérées par semaine du plan en cours, sur la barre commune (dump 2.4,
 * étape 3 : un seul repère, zone haute à 20, échelle commune). Guide
 * l'utilisateur qui remplit sa grille vide.
 */

import { useMemo } from 'react';
import type { Catalog } from '@/engine/catalog';
import type { UserState, WeeklyTemplate } from '@/engine/models';
import {
  classifyVolume,
  muscleLabel,
  volumeScale,
  weeklyMark,
  type CoverageStatus,
} from '@/lib/progress';
import { weightedWeeklyVolumeByMuscle } from '@/lib/onboarding-preview';
import { Card } from '@/components/Card';
import { formatSets, markLabel, statusLabel, VolumeBar, VOLUME_TEXT } from '@/components/VolumeBar';
import { cn } from '@/lib/cn';

type GaugeState = Pick<UserState, 'volume_min' | 'muscle_goals'>;

interface Props {
  readonly template: WeeklyTemplate;
  readonly state: GaugeState;
  readonly catalog: Catalog;
}

interface GaugeRow {
  readonly muscle: string;
  readonly sets: number;
  readonly mark: number | null;
  readonly status: CoverageStatus;
}

export function VolumeGauges({ template, state, catalog }: Props) {
  const rows = useMemo<readonly GaugeRow[]>(() => {
    const weighted = weightedWeeklyVolumeByMuscle(template, catalog);
    const out: GaugeRow[] = [];
    for (const muscle of Object.keys(state.muscle_goals)) {
      const mark = weeklyMark(state, muscle);
      if (mark === null) continue; // muscle inconnu des repères
      const sets = weighted[muscle] ?? 0;
      out.push({ muscle, sets, mark, status: classifyVolume(sets, mark) });
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
  const scale = volumeScale(rows.map((r) => r.sets));

  return (
    <Card className="flex flex-col gap-2" data-testid="volume-gauges">
      <div className="text-xs uppercase tracking-wide text-anthracite-300">
        Volume hebdomadaire par muscle
      </div>
      <p className="text-[11px] leading-relaxed text-anthracite-300">
        Une barre par muscle. Ajoute des exercices pour amener chacun à son
        repère.
      </p>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const intention = state.muscle_goals[r.muscle]?.intention ?? null;
          const status = statusLabel(r.status, intention);
          return (
            <li key={r.muscle} data-testid={`gauge-${r.muscle}`}>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate text-white">{muscleLabel(r.muscle)}</span>
                <span className="shrink-0 tabular-nums text-anthracite-300">
                  {formatSets(r.sets)} séries · {markLabel(intention, r.mark)}
                  {status !== null && (
                    <span className={cn('ml-1.5', VOLUME_TEXT[r.status])}>· {status}</span>
                  )}
                </span>
              </div>
              <VolumeBar sets={r.sets} mark={r.mark} status={r.status} scale={scale} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
