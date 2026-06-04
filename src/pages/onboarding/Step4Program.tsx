/**
 * Étape 4 de l'onboarding : choix d'un programme guidé ou du mode custom.
 *
 * Pour chaque programme guidé, on indique :
 *  - nom + auteur,
 *  - séances/sem (avec warning si ≠ choix profil),
 *  - public cible,
 *  - objectif principal.
 *
 * Le mode "custom" ne sélectionne aucun programmeId : le moteur génère un
 * programme à partir des `muscle_goals` via split + cycle_planner.
 */

import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import {
  DurationCategory,
  Level,
  type GuidedProgram,
  type MuscleObjective,
} from '@/engine/models';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import { objectiveLabel } from '@/lib/balance-reasons';
import type { OnboardingDraft } from '@/lib/onboarding-state';

interface Step4Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

const LEVEL_LABEL_FR: Record<Level, string> = {
  [Level.DEBUTANT]: 'Débutant',
  [Level.INTERMEDIAIRE]: 'Intermédiaire',
  [Level.AVANCE]: 'Avancé',
};

function levelsToFr(levels: readonly Level[]): string {
  return levels.map((l) => LEVEL_LABEL_FR[l]).join(' / ');
}

function objectivesToFr(objs: readonly MuscleObjective[]): string {
  return objs.map(objectiveLabel).join(' + ');
}

export function Step4Program({ draft, onChange }: Step4Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Ton programme
        </h1>
        <div className="space-y-2 text-sm leading-relaxed text-anthracite-300">
          <p>
            Tu peux <strong className="text-white">construire ton programme</strong>{' '}
            avec l'app (custom) ou prendre un <strong className="text-white">programme tout fait</strong>{' '}
            d'un coach reconnu. Dans les deux cas, l'app suit tes performances
            séance après séance et ajuste les charges.
          </p>
        </div>
      </header>

      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Combien de séances par semaine ?
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          Plus tu en fais, plus tu peux étaler du volume sur la semaine et
          progresser vite — mais il faut récupérer entre les séances. 3 à 4
          est un bon point d'équilibre pour la plupart.
        </p>
        <Stepper
          value={draft.sessionsPerWeek}
          onChange={(v) => onChange({ sessionsPerWeek: v })}
          min={2}
          max={6}
          suffix=" / sem"
        />
        <p className="mt-2 text-[11px] text-anthracite-400">
          Les programmes guidés ont leur propre fréquence ; un avertissement
          s'affiche si elle ne correspond pas à ton choix.
        </p>
      </Card>

      {/* Conv #22 — Durée limite par séance, sert au dimensionnement co-construit. */}
      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Combien de temps maximum par séance ?
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          C'est ta <strong className="text-white">limite haute</strong> : l'app
          dimensionne ton programme en dessous, selon tes priorités. Si tes
          prios tiennent en moins de temps, tes séances seront plus courtes
          que ta limite — l'app te le dira.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: DurationCategory.SHORT, label: '≤ 1h', sub: '~4 exos max' },
            { v: DurationCategory.MEDIUM, label: '≤ 1h30', sub: '~6 exos max' },
            { v: DurationCategory.LONG, label: '≤ 2h', sub: '~8 exos max' },
          ].map((opt) => {
            const selected = draft.durationCategory === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => onChange({ durationCategory: opt.v })}
                className={cn(
                  'rounded-xl border px-3 py-2 text-center transition',
                  selected
                    ? 'border-sang-500 bg-sang-900/30 text-white'
                    : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:border-anthracite-500',
                )}
                data-testid={`duration-${opt.v}`}
                role="radio"
                aria-checked={selected}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-[11px] opacity-80">{opt.sub}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <ProgramRow
        id={null}
        title="Programme custom"
        subtitle="Généré à partir de tes muscles cibles + objectifs"
        meta={`${draft.sessionsPerWeek} séances / sem`}
        selected={draft.programmeId === null}
        onSelect={() => onChange({ programmeId: null })}
      />

      <div className="mt-2 text-xs uppercase tracking-wider text-anthracite-300">
        Programmes guidés
      </div>

      {ALL_GUIDED_PROGRAMS.map((p: GuidedProgram) => {
        const mismatch = p.sessions_per_week !== draft.sessionsPerWeek;
        return (
          <ProgramRow
            key={p.id}
            id={p.id}
            title={p.name}
            subtitle={`${p.author} — ${levelsToFr(p.public_cible)}`}
            meta={`${p.sessions_per_week} séances / sem · ${objectivesToFr(p.objectifs_principaux)}`}
            warning={
              mismatch
                ? `Ce programme demande ${p.sessions_per_week} séances/sem (tu as choisi ${draft.sessionsPerWeek}).`
                : null
            }
            selected={draft.programmeId === p.id}
            onSelect={() => onChange({ programmeId: p.id })}
          />
        );
      })}
    </div>
  );
}

interface ProgramRowProps {
  readonly id: string | null;
  readonly title: string;
  readonly subtitle: string;
  readonly meta: string;
  readonly warning?: string | null;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

function ProgramRow({
  id,
  title,
  subtitle,
  meta,
  warning,
  selected,
  onSelect,
}: ProgramRowProps) {
  const testId = id === null ? 'program-custom' : `program-${id}`;
  return (
    <Card
      className={cn(
        'cursor-pointer transition',
        selected
          ? 'border-sang-600 bg-sang-900/20'
          : 'hover:border-anthracite-600',
      )}
      onClick={onSelect}
      data-testid={testId}
      role="radio"
      aria-checked={selected}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 transition',
            selected
              ? 'border-sang-500 bg-sang-600'
              : 'border-anthracite-600 bg-anthracite-900',
          )}
        >
          {selected ? (
            <div className="m-1 h-2 w-2 rounded-full bg-white" />
          ) : null}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-anthracite-300">{subtitle}</div>
          <div className="mt-1 text-[11px] text-anthracite-300">{meta}</div>
          {warning ? (
            <div className="mt-2 rounded-lg border border-sang-700/60 bg-sang-900/20 px-2 py-1 text-[11px] text-sang-500">
              ⚠ {warning}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
