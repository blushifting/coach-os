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

export function Step4Program({ draft, onChange, stepLabel }: Step4Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {stepLabel ?? 'Étape 4 · Programme'}
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Choix du programme
        </h1>
      </header>
      <p className="text-sm text-anthracite-300">
        Pars sur un programme guidé éprouvé ou laisse l'app générer un programme
        custom adapté à tes muscles cibles.
      </p>

      {/* Conv #18 — `sessions_per_week` déplacé ici depuis Step1 (seul
          paramètre profil qui impacte vraiment la structure du programme).
          Les programmes guidés ont chacun leur fréquence imposée et
          poseront un warning si l'user a une autre valeur. */}
      <Card>
        <div className="mb-3 text-sm font-medium text-white">Séances par semaine</div>
        <Stepper
          value={draft.sessionsPerWeek}
          onChange={(v) => onChange({ sessionsPerWeek: v })}
          min={2}
          max={6}
          suffix=" / sem"
        />
        <p className="mt-2 text-[11px] text-anthracite-300">
          Sert au mode custom. Les programmes guidés imposent leur propre
          fréquence (un avertissement s'affiche si ça diffère).
        </p>
      </Card>

      {/* Conv #22 — Durée MAX par séance, plafond du nouveau path co-construit. */}
      <Card>
        <div className="mb-3 text-sm font-medium text-white">
          Durée maximale par séance
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: DurationCategory.SHORT, label: '≤ 1h', sub: '4 exos max' },
            { v: DurationCategory.MEDIUM, label: '≤ 1h30', sub: '6 exos max' },
            { v: DurationCategory.LONG, label: '≤ 2h', sub: '8 exos max' },
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
        <p className="mt-2 text-[11px] text-anthracite-300">
          Plafond : le programme est dimensionné selon tes priorités et peut
          être plus court. L'app prévient si tu réserves beaucoup plus que
          nécessaire.
        </p>
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
