/**
 * Étape Programme de l'onboarding (Bloc O).
 *
 * Réglages (séances/sem, préférence d'équipement, durée max) puis choix du
 * MODE de construction :
 *  - « Sur-mesure » : Kotsh construit le programme depuis tes muscles cibles.
 *  - « À la main »  : grille vide ; tu ajoutes les exos toi-même, guidé par les
 *    jauges de volume du récap.
 *
 * Les programmes « tout faits » ont été retirés (Bloc O) : le custom les
 * recouvrait déjà, et leurs progressions d'auteur n'étaient pas RPE.
 */

import { DurationCategory, EquipmentPreference } from '@/engine/models';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import type { OnboardingDraft } from '@/lib/onboarding-state';

interface Step4Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

export function Step4Program({ draft, onChange }: Step4Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Ton programme
        </h1>
      </header>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">Séances par semaine</span>
          <div className="w-44">
            <Stepper
              value={draft.sessionsPerWeek}
              onChange={(v) => onChange({ sessionsPerWeek: v })}
              min={2}
              max={6}
            />
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-anthracite-300">
          Si tu hésites, 3 ou 4 est un bon repère.
        </p>
      </Card>

      {/* Conv #22 — Préférence d'équipement : oriente le choix auto des exos. */}
      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Tes préférences d'équipement
        </div>
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
              sub: 'Haltères et barre — naturel, un peu plus technique',
            },
            {
              v: EquipmentPreference.BODYWEIGHT,
              label: 'Poids du corps uniquement',
              sub: 'Aucun matériel — partout, sans charges',
            },
            {
              v: EquipmentPreference.NO_PREFERENCE,
              label: 'Pas de préférence',
              sub: 'Kotsh choisit le plus adapté à chaque exercice',
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
          Combien de temps maximum par séance&nbsp;?
        </div>
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

      {/* Bloc O — choix du mode de construction (sur-mesure vs à la main). */}
      <div role="radiogroup" aria-label="Mode de construction">
        <div className="mb-2 text-xs uppercase tracking-wider text-anthracite-300">
          Comment veux-tu construire ton programme&nbsp;?
        </div>
        <div className="flex flex-col gap-2">
          <ModeCard
            selected={draft.buildMode === 'auto'}
            onSelect={() => onChange({ buildMode: 'auto' })}
            testId="program-custom"
            title="Sur-mesure (recommandé)"
            desc="Kotsh construit ton programme automatiquement."
          />
          <ModeCard
            selected={draft.buildMode === 'manual'}
            onSelect={() => onChange({ buildMode: 'manual' })}
            testId="program-manual"
            title="Programme libre"
            desc="Tu choisis tes exercices toi-même."
          />
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  testId,
  title,
  desc,
}: {
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly testId: string;
  readonly title: string;
  readonly desc: string;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition',
        selected ? 'border-sang-500 bg-sang-900/20' : 'hover:border-anthracite-500',
      )}
      onClick={onSelect}
      data-testid={testId}
      role="radio"
      aria-checked={selected}
    >
      <div className="flex items-start gap-3">
        <RadioDot selected={selected} />
        <div className="flex-1">
          <div className="text-base font-semibold text-white">{title}</div>
          <p className="mt-1 text-xs leading-snug text-anthracite-200">{desc}</p>
        </div>
      </div>
    </Card>
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
