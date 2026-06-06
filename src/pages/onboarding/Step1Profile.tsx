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
          On commence par toi
        </h1>
        <p className="text-sm leading-relaxed text-anthracite-200">
          Ces infos servent à fixer un point de départ raisonnable pour ton
          volume d'entraînement et tes charges. Kotsh affine ensuite ton
          programme cycle après cycle, selon ce que tu fais en vrai.
        </p>
      </header>

      <Card>
        <div className="mb-1 text-sm font-medium text-white">Sexe</div>
        <p className="mb-3 text-xs leading-relaxed text-anthracite-300">
          Sert à ajuster les volumes recommandés (les études montrent que les
          femmes tolèrent mieux un volume hebdo un peu plus haut sur le haut
          du corps).
        </p>
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
        <div className="mb-1 text-sm font-medium text-white">Âge</div>
        <p className="mb-3 text-xs leading-relaxed text-anthracite-300">
          Au-delà de 50 ans, Kotsh prévoit un peu plus de récupération et
          plafonne le volume max — la progression reste réelle mais plus
          progressive.
        </p>
        <Stepper
          value={draft.age}
          onChange={(v) => onChange({ age: v })}
          min={14}
          max={100}
          suffix=" ans"
        />
      </Card>

      <Card>
        <div className="mb-1 text-sm font-medium text-white">Poids</div>
        <p className="mb-3 text-xs leading-relaxed text-anthracite-300">
          Sert à estimer une charge de départ réaliste sur les exercices au
          poids du corps (tractions, dips, pompes) et à fixer un Plafond
          initial sur les exercices chargés.
        </p>
        <Stepper
          value={draft.bodyweightKg}
          onChange={(v) => onChange({ bodyweightKg: v })}
          min={35}
          max={200}
          suffix=" kg"
        />
      </Card>

      <Card>
        <div className="mb-1 text-sm font-medium text-white">
          Tes machines
        </div>
        <p className="mb-3 text-xs leading-relaxed text-anthracite-300">
          Si tu connais la marque des machines que tu utilises, indique-la
          ici. Les noms des exercices sur machine s'afficheront alors avec
          leur libellé commercial — celui que tu vois étiqueté sur la
          machine. Tu peux changer plus tard. Aucune incidence sur les
          exercices prescrits.
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
