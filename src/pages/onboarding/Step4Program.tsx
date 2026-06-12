/**
 * Étape 3 de l'onboarding (refonte Conv #28) : paramètres + choix programme.
 *
 * - Le sur-mesure est le choix prioritaire, mis en avant en grande carte.
 * - Les programmes guidés sont relégués dessous, en **tableau comparatif**
 *   (1 ligne = 1 programme ; colonnes courtes : séances/sem, niveau,
 *   objectif). Taper une ligne = la sélectionner ET déplier ses
 *   avantages / inconvénients — pas de cliquable dans cliquable.
 */

import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import {
  DurationCategory,
  EquipmentPreference,
  Level,
  MuscleObjective,
  type GuidedProgram,
} from '@/engine/models';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import type { OnboardingDraft } from '@/lib/onboarding-state';

interface Step4Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

const LEVEL_SHORT_FR: Record<Level, string> = {
  [Level.DEBUTANT]: 'Déb',
  [Level.INTERMEDIAIRE]: 'Int',
  [Level.AVANCE]: 'Av',
};

function levelsShort(levels: readonly Level[]): string {
  if (levels.length === 0) return '—';
  if (levels.length === 1) return LEVEL_SHORT_FR[levels[0]!];
  return `${LEVEL_SHORT_FR[levels[0]!]}–${LEVEL_SHORT_FR[levels[levels.length - 1]!]}`;
}

const OBJECTIVE_SHORT_FR: Record<MuscleObjective, string> = {
  [MuscleObjective.FORCE]: 'Force',
  [MuscleObjective.HYPERTROPHIE]: 'Hyper',
  [MuscleObjective.ENDURANCE]: 'Endu',
  [MuscleObjective.MAINTIEN]: 'Maintien',
};

function objectivesShort(objs: readonly MuscleObjective[]): string {
  return objs.map((o) => OBJECTIVE_SHORT_FR[o]).join(' + ');
}

export function Step4Program({ draft, onChange }: Step4Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Ton programme
        </h1>
        <p className="text-sm leading-relaxed text-anthracite-300">
          Quelques réglages, puis le choix du programme. Dans tous les cas,
          Kotsh suit tes performances séance après séance et ajuste les charges.
        </p>
      </header>

      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Combien de séances par semaine ?
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          3 à 4 est un bon point d'équilibre pour la plupart : assez pour
          étaler du volume, assez de repos pour récupérer.
        </p>
        <Stepper
          value={draft.sessionsPerWeek}
          onChange={(v) => onChange({ sessionsPerWeek: v })}
          min={2}
          max={6}
          suffix=" / sem"
        />
      </Card>

      {/* Conv #22 — Préférence d'équipement : oriente le choix auto des exos. */}
      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Tes préférences d'équipement
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-anthracite-300">
          On choisit tes exercices à ta place pour démarrer ; tu pourras tout
          modifier au récap final.
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              v: EquipmentPreference.MACHINES,
              label: 'Machines uniquement',
              sub: 'Guidées et poulies — trajectoire fixe, contrôle facile',
            },
            {
              v: EquipmentPreference.FREE_WEIGHTS,
              label: 'Poids libres uniquement',
              sub: 'Haltères et barre — meilleur transfert, plus technique',
            },
            {
              v: EquipmentPreference.BODYWEIGHT,
              label: 'Poids du corps uniquement',
              sub: 'Aucun matériel — partout, sans charges',
            },
            {
              v: EquipmentPreference.NO_PREFERENCE,
              label: 'Pas de préférence',
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
          C'est ta <strong className="text-white">limite haute</strong> :
          Kotsh dimensionne en dessous, selon tes priorités.
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

      {/* Conv #28 — sur-mesure mis en avant, choix prioritaire. */}
      <Card
        className={cn(
          'cursor-pointer transition',
          draft.programmeId === null
            ? 'border-sang-500 bg-sang-900/20'
            : 'hover:border-anthracite-500',
        )}
        onClick={() => onChange({ programmeId: null })}
        data-testid="program-custom"
        role="radio"
        aria-checked={draft.programmeId === null}
      >
        <div className="flex items-start gap-3">
          <RadioDot selected={draft.programmeId === null} />
          <div className="flex-1">
            <div className="text-base font-semibold text-white">
              Programme sur mesure
            </div>
            <p className="mt-1 text-xs leading-snug text-anthracite-200">
              Kotsh construit ton programme à partir de tes muscles cibles,
              de tes objectifs et de ton temps. Le choix recommandé.
            </p>
            <div className="mt-1 text-[11px] text-anthracite-300">
              {draft.sessionsPerWeek} séances / sem
            </div>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-anthracite-300">
          Ou un programme tout fait d'un coach reconnu
        </div>

        {/* Tableau comparatif : 1 ligne = 1 programme. Taper une ligne la
            sélectionne ET déplie ses détails (pour / contre). */}
        <div
          className="overflow-hidden rounded-xl border border-anthracite-700"
          role="radiogroup"
          aria-label="Programmes guidés"
          data-testid="guided-programs-table"
        >
          <div
            className="grid grid-cols-[1fr_3.2rem_3.4rem_3.6rem] items-center gap-x-2 border-b border-anthracite-700 bg-anthracite-900 px-3 py-1.5 text-[10px] uppercase tracking-wider text-anthracite-400"
            aria-hidden="true"
          >
            <span>Programme</span>
            <span className="text-center">Séances</span>
            <span className="text-center">Niveau</span>
            <span className="text-center">Objectif</span>
          </div>

          {ALL_GUIDED_PROGRAMS.map((p: GuidedProgram, idx) => {
            const selected = draft.programmeId === p.id;
            const mismatch = p.sessions_per_week !== draft.sessionsPerWeek;
            return (
              <div
                key={p.id}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => onChange({ programmeId: p.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ programmeId: p.id });
                  }
                }}
                data-testid={`program-${p.id}`}
                className={cn(
                  'cursor-pointer transition',
                  idx > 0 && 'border-t border-anthracite-700/70',
                  selected
                    ? 'bg-sang-900/20'
                    : 'bg-anthracite-950 hover:bg-anthracite-900',
                )}
              >
                <div className="grid grid-cols-[1fr_3.2rem_3.4rem_3.6rem] items-center gap-x-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <div
                      className={cn(
                        'truncate text-sm font-semibold',
                        selected ? 'text-white' : 'text-anthracite-100',
                      )}
                    >
                      {p.name}
                    </div>
                    <div className="truncate text-[11px] text-anthracite-400">
                      {p.author}
                    </div>
                  </div>
                  <span className="text-center text-xs text-anthracite-200 tabular-nums">
                    {p.sessions_per_week}/sem
                  </span>
                  <span className="text-center text-xs text-anthracite-200">
                    {levelsShort(p.public_cible)}
                  </span>
                  <span className="text-center text-xs text-anthracite-200">
                    {objectivesShort(p.objectifs_principaux)}
                  </span>
                </div>

                {/* Détails dépliés de la ligne sélectionnée. */}
                {selected && (
                  <div
                    className="border-t border-anthracite-800 px-3 py-2.5"
                    data-testid={`program-details-${p.id}`}
                  >
                    {p.short_pitch ? (
                      <p className="text-xs leading-snug text-anthracite-100">
                        {p.short_pitch}
                      </p>
                    ) : null}
                    {mismatch ? (
                      <div className="mt-2 rounded-lg border border-amber-700/60 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-500">
                        ⚠ Ce programme demande {p.sessions_per_week} séances/sem
                        (tu as choisi {draft.sessionsPerWeek}).
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {p.pour && p.pour.length > 0 ? (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-anthracite-300">
                            À choisir si
                          </div>
                          <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-anthracite-100">
                            {p.pour.map((s, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span className="text-sang-500">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {p.contre && p.contre.length > 0 ? (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-anthracite-300">
                            À éviter si
                          </div>
                          <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-anthracite-100">
                            {p.contre.map((s, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span className="text-anthracite-400">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RadioDot({ selected }: { readonly selected: boolean }) {
  return (
    <div
      className={cn(
        'mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 transition',
        selected
          ? 'border-sang-500 bg-sang-600'
          : 'border-anthracite-600 bg-anthracite-900',
      )}
    >
      {selected ? <div className="m-1 h-2 w-2 rounded-full bg-white" /> : null}
    </div>
  );
}
