/**
 * Étape 1 de l'onboarding : profil utilisateur.
 *
 * Conv #22 — Simplifié : sexe, âge, poids uniquement.
 *  - Niveau retiré (auto-calibration cycle après cycle via `adjustVolumeBoundsAtCycleEnd`).
 *  - Équipement retiré (le mode custom co-construit révèle l'équipement
 *    implicitement par les choix d'exos ; le mode guidé tombe sur le
 *    preset salle complète par défaut, suffisant pour 95 % des cas).
 *
 * `sessions_per_week` est en Step4 (Conv #18).
 */

import { Sex } from '@/engine/models';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import type { OnboardingDraft } from '@/lib/onboarding-state';

interface Step1Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

export function Step1Profile({ draft, onChange, stepLabel }: Step1Props) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {stepLabel ?? 'Étape 1 · Profil'}
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Profil
        </h1>
      </header>
      <p className="text-sm leading-relaxed text-anthracite-200">
        Ces infos servent à calibrer ton volume cible et tes plafonds de départ.
        L'app affine ensuite ton programme cycle après cycle selon tes résultats.
      </p>

      <Card>
        <div className="mb-3 text-sm font-medium text-white">Sexe</div>
        <div className="flex gap-2" role="radiogroup" aria-label="Sexe">
          <ChipRadio
            label="Homme"
            selected={draft.sex === Sex.HOMME}
            onClick={() => onChange({ sex: Sex.HOMME })}
            testId="sex-homme"
          />
          <ChipRadio
            label="Femme"
            selected={draft.sex === Sex.FEMME}
            onClick={() => onChange({ sex: Sex.FEMME })}
            testId="sex-femme"
          />
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-sm font-medium text-white">Âge</div>
        <Stepper
          value={draft.age}
          onChange={(v) => onChange({ age: v })}
          min={14}
          max={100}
          suffix=" ans"
        />
      </Card>

      <Card>
        <div className="mb-3 text-sm font-medium text-white">Poids</div>
        <Stepper
          value={draft.bodyweightKg}
          onChange={(v) => onChange({ bodyweightKg: v })}
          min={35}
          max={200}
          suffix=" kg"
        />
      </Card>
    </div>
  );
}

interface ChipRadioProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly testId?: string;
}

function ChipRadio({ label, selected, onClick, testId }: ChipRadioProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition',
        selected
          ? 'border-sang-600 bg-sang-900/30 text-white'
          : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
      )}
    >
      {label}
    </button>
  );
}
