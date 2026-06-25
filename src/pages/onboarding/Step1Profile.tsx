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

import { GymBrand, Sex } from '@/engine/models';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import { GYM_BRAND_LABEL_FR } from '@/lib/catalog-filter';
import type { OnboardingDraft } from '@/lib/onboarding-state';

interface Step1Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  /** Conv #22 — gardé pour compat ascendante ; non affiché. */
  readonly stepLabel?: string;
}

export function Step1Profile({ draft, onChange }: Step1Props) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Commençons par toi
        </h1>
      </header>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">Sexe</span>
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
        </div>
        <p className="mt-2 text-xs leading-relaxed text-anthracite-300">
          Pour ajuster le volume recommandé.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">Âge</span>
          <div className="w-44">
            <Stepper
              value={draft.age}
              onChange={(v) => onChange({ age: v })}
              min={14}
              max={100}
              suffix=" ans"
            />
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-anthracite-300">
          Pour adapter ta récupération.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">Poids</span>
          <div className="w-44">
            <Stepper
              value={draft.bodyweightKg}
              onChange={(v) => onChange({ bodyweightKg: v })}
              min={35}
              max={200}
              suffix=" kg"
            />
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-anthracite-300">
          Pour estimer tes charges de départ.
        </p>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Tes machines</span>
          <span className="rounded-full border border-anthracite-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-anthracite-400">
            Optionnel
          </span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-anthracite-300">
          Pour afficher les exercices avec le nom écrit sur tes machines.
        </p>
        <label className="sr-only" htmlFor="onboarding-gym-brand">
          Marque des machines
        </label>
        <select
          id="onboarding-gym-brand"
          data-testid="onboarding-gym-brand-select"
          value={draft.gymBrand}
          onChange={(e) => onChange({ gymBrand: e.target.value as GymBrand })}
          className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white focus:border-sang-600 focus:outline-none"
        >
          {Object.entries(GYM_BRAND_LABEL_FR).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
        'rounded-xl border px-3 py-2 text-sm font-medium transition',
        selected
          ? 'border-sang-600 bg-sang-900/30 text-white'
          : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
      )}
    >
      {label}
    </button>
  );
}
