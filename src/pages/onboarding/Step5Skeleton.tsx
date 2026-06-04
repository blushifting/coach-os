/**
 * Conv #22 — Étape D : présentation du squelette généré par l'algo.
 *
 * Lecture seule. L'user voit pour chaque séance :
 *  - le label du split + focus muscles (item L des labels descriptifs)
 *  - la liste des patterns à remplir (sans encore d'exo concret)
 *
 * En bas : warnings remontés par l'algo (sous-utilisation, sur-engagement).
 * L'user clique "Continuer" pour passer à l'étape E (choix des variantes).
 *
 * Si l'user veut modifier ses prios / durée, il revient en arrière via le
 * bouton Précédent du wizard.
 */

import { Card } from '@/components/Card';
import type { SkeletonTemplate } from '@/engine/models';
import { buildSessionLabel } from '@/engine/skeleton_builder';

interface Step5SkeletonProps {
  readonly skeleton: SkeletonTemplate | null;
  readonly stepLabel?: string;
}

const PATTERN_LABEL: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Fente',
  push_h: 'Poussée horizontale',
  push_v: 'Poussée verticale',
  pull_h: 'Tirage horizontal',
  pull_v: 'Tirage vertical',
  isolation: 'Isolation',
  core: 'Gainage',
};

const MUSCLE_LABEL: Record<string, string> = {
  pectoraux: 'pectoraux',
  dos_largeur: 'dos largeur',
  dos_epaisseur: 'dos épaisseur',
  trapezes_hauts: 'trapèzes',
  quadriceps: 'quadriceps',
  ischios: 'ischios',
  fessiers: 'fessiers',
  mollets: 'mollets',
  deltos_lateraux: 'deltos latéraux',
  deltos_posterieurs: 'deltos postérieurs',
  biceps: 'biceps',
  triceps: 'triceps',
  abdos: 'abdos',
  obliques: 'obliques',
  lombaires: 'lombaires',
};

export function Step5Skeleton({ skeleton, stepLabel }: Step5SkeletonProps) {
  if (skeleton === null) {
    return (
      <div className="p-4">
        <p className="text-sm text-anthracite-300">
          Squelette en cours de génération…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="step5-skeleton">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {stepLabel ?? 'Étape · Squelette'}
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Voici la structure proposée
        </h1>
      </header>

      <p className="text-sm leading-relaxed text-anthracite-300">
        L'algo a dimensionné ton cycle selon tes priorités et la durée que
        tu as choisie. <span className="font-semibold text-white">{skeleton.split_name}</span>{' '}
        — {skeleton.days.length} séances par semaine.
      </p>

      <div className="flex flex-col gap-3">
        {skeleton.days.map((day) => {
          const label = buildSessionLabel(day);
          return (
            <Card key={day.day_index} data-testid={`skel-day-${day.day_index}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">
                  Séance {day.day_index + 1} · {label}
                </div>
                <div className="text-[11px] text-anthracite-400">
                  {day.cells.length} exo{day.cells.length > 1 ? 's' : ''}
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {day.cells.map((cell, ci) => {
                  const patternLbl = PATTERN_LABEL[cell.pattern] ?? cell.pattern;
                  const muscleLbl =
                    MUSCLE_LABEL[cell.primary_muscle] ?? cell.primary_muscle;
                  return (
                    <li
                      key={ci}
                      className="flex items-center gap-2 text-xs text-anthracite-200"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-sang-500" />
                      <span className="flex-1">
                        {patternLbl}{' '}
                        <span className="text-anthracite-400">— {muscleLbl}</span>
                      </span>
                      <span
                        className={
                          cell.role_hint === 'compound'
                            ? 'rounded-full border border-anthracite-600 px-2 py-0.5 text-[9px] uppercase tracking-wider text-anthracite-300'
                            : 'rounded-full border border-anthracite-700 px-2 py-0.5 text-[9px] uppercase tracking-wider text-anthracite-400'
                        }
                      >
                        {cell.role_hint === 'compound' ? 'compound' : 'iso'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      {skeleton.warnings.length > 0 && (
        <Card data-testid="skel-warnings">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-anthracite-400">
            À noter
          </div>
          <ul className="flex flex-col gap-1.5">
            {skeleton.warnings.map((w, i) => (
              <li
                key={i}
                className="text-xs leading-relaxed text-anthracite-300"
              >
                · {w}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-anthracite-400">
        Tu vas maintenant choisir quelles variantes d'exo tu préfères pour
        chaque case. L'algo finalisera ensuite la répartition des séries
        selon ton volume cible et ta durée max.
      </p>
    </div>
  );
}
