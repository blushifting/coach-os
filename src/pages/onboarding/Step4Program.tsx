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

import { useState } from 'react';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import {
  DurationCategory,
  EquipmentPreference,
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
            avec Kotsh (sur mesure) ou prendre un <strong className="text-white">programme tout fait</strong>{' '}
            d'un coach reconnu. Dans les deux cas, Kotsh suit tes performances
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

      {/* Conv #22 — Préférence d'équipement : oriente le choix auto des exos. */}
      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Tes préférences d'équipement
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          On choisit tes exercices à ta place pour démarrer. Tu pourras tout
          modifier au récap final.{' '}
          <strong className="text-anthracite-100">Machines guidées</strong> =
          plus accessible (trajectoire fixe, idéal débutants).{' '}
          <strong className="text-anthracite-100">Poids libres</strong> =
          haltères / barre / poids du corps (meilleur transfert sportif,
          plus technique).
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              v: EquipmentPreference.MACHINES,
              label: 'Machines guidées',
              sub: 'Trajectoire fixe, contrôle facile',
            },
            {
              v: EquipmentPreference.FREE_WEIGHTS,
              label: 'Poids libres',
              sub: 'Haltères, barre, poids du corps',
            },
            {
              v: EquipmentPreference.NO_PREFERENCE,
              label: 'Aucune préférence',
              sub: 'Kotsh choisit la convention salle (polyarticulaires en libre, isolations en machine)',
            },
          ].map((opt) => {
            const selected = draft.equipmentPreference === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => onChange({ equipmentPreference: opt.v })}
                className={cn(
                  'flex flex-col items-start rounded-xl border px-3 py-2 text-left transition',
                  selected
                    ? 'border-sang-500 bg-sang-900/30 text-white'
                    : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:border-anthracite-500',
                )}
                data-testid={`equip-pref-${opt.v}`}
                role="radio"
                aria-checked={selected}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-[11px] opacity-80">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Conv #22 — Durée limite par séance, sert au dimensionnement co-construit. */}
      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Combien de temps maximum par séance ?
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          C'est ta <strong className="text-white">limite haute</strong> : Kotsh
          dimensionne ton programme en dessous, selon tes priorités. Si tes
          prios tiennent en moins de temps, tes séances seront plus courtes
          que ta limite — Kotsh te le dira.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: DurationCategory.SHORT, label: '≤ 1h', sub: '~4 exercices max' },
            { v: DurationCategory.MEDIUM, label: '≤ 1h30', sub: '~6 exercices max' },
            { v: DurationCategory.LONG, label: '≤ 2h', sub: '~8 exercices max' },
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
        title="Programme sur mesure"
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
            shortPitch={p.short_pitch ?? null}
            pour={p.pour ?? null}
            contre={p.contre ?? null}
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
  readonly shortPitch?: string | null;
  readonly pour?: readonly string[] | null;
  readonly contre?: readonly string[] | null;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

function ProgramRow({
  id,
  title,
  subtitle,
  meta,
  warning,
  shortPitch,
  pour,
  contre,
  selected,
  onSelect,
}: ProgramRowProps) {
  const testId = id === null ? 'program-custom' : `program-${id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails =
    (pour && pour.length > 0) || (contre && contre.length > 0);
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
          {shortPitch ? (
            <p className="mt-1 text-xs leading-snug text-anthracite-100">
              {shortPitch}
            </p>
          ) : null}
          <div className="mt-1 text-[11px] text-anthracite-300">{meta}</div>
          {warning ? (
            <div className="mt-2 rounded-lg border border-sang-700/60 bg-sang-900/20 px-2 py-1 text-[11px] text-sang-500">
              ⚠ {warning}
            </div>
          ) : null}
          {hasDetails ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsOpen((v) => !v);
                }}
                data-testid={`program-details-toggle-${id ?? 'custom'}`}
                className="mt-2 text-[11px] font-medium text-anthracite-300 underline-offset-2 hover:text-white hover:underline"
              >
                {detailsOpen ? 'Masquer les détails' : 'Pour qui c\'est fait ?'}
              </button>
              {detailsOpen ? (
                <div
                  className="mt-2 space-y-2"
                  data-testid={`program-details-${id ?? 'custom'}`}
                >
                  {pour && pour.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-anthracite-300">
                        À choisir si
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-anthracite-100">
                        {pour.map((s, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="text-sang-500">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {contre && contre.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-anthracite-300">
                        À éviter si
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-anthracite-100">
                        {contre.map((s, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="text-anthracite-400">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
