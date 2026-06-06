/**
 * Sheet d'édition du profil (sexe / âge / poids).
 *
 * Conv #22 — Simplifié : niveau et équipement retirés (cf. Step1Profile
 * onboarding). Le niveau était sujet à auto-déclaration imprécise et est
 * désormais auto-calibré cycle après cycle ; l'équipement est révélé
 * implicitement par les choix de variantes côté programme co-construit.
 *
 * Validation à la sauvegarde : `buildProfileFromDraft` qui appelle `makeProfile`
 * — toutes les bornes (âge 14-100, poids > 0) sont vérifiées.
 * En cas d'erreur, on affiche un message inline et on garde la sheet ouverte.
 */

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { GymBrand, Sex, type Profile } from '@/engine/models';
import { cn } from '@/lib/cn';
import { GYM_BRAND_LABEL_FR } from '@/lib/catalog-filter';
import {
  buildProfileFromDraft,
  type ProfileDraft,
} from '@/lib/profile-edit';

interface EditProfileSheetProps {
  readonly open: boolean;
  readonly initial: ProfileDraft;
  readonly onClose: () => void;
  readonly onSave: (profile: Profile) => Promise<void> | void;
}

export function EditProfileSheet({
  open,
  initial,
  onClose,
  onSave,
}: EditProfileSheetProps) {
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  // Réinitialise quand on ouvre (recharge depuis l'état courant)
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }

  function patch(p: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function save() {
    try {
      const profile = buildProfileFromDraft(draft);
      await onSave(profile);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Modifier mon profil">
      <div className="max-h-[75dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 text-sm font-medium text-white">Sexe</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Sexe">
              <ChipRadio
                label="Homme"
                selected={draft.sex === Sex.HOMME}
                onClick={() => patch({ sex: Sex.HOMME })}
                testId="profil-sex-homme"
              />
              <ChipRadio
                label="Femme"
                selected={draft.sex === Sex.FEMME}
                onClick={() => patch({ sex: Sex.FEMME })}
                testId="profil-sex-femme"
              />
            </div>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-medium text-white">Âge</div>
            <Stepper
              value={draft.age}
              onChange={(v) => patch({ age: v })}
              min={14}
              max={100}
              suffix=" ans"
            />
          </Card>

          <Card>
            <div className="mb-3 text-sm font-medium text-white">Poids</div>
            <Stepper
              value={draft.bodyweightKg}
              onChange={(v) => patch({ bodyweightKg: v })}
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
              Marque des machines que tu utilises. Sert juste à afficher
              les noms commerciaux à l'écran (par ex. « Aura Pulldown » au
              lieu de « Tirage vertical poulie haute »). Aucun effet sur
              les exos prescrits.
            </p>
            <label className="sr-only" htmlFor="profil-gym-brand">
              Marque des machines
            </label>
            <select
              id="profil-gym-brand"
              data-testid="profil-gym-brand-select"
              value={draft.gymBrand}
              onChange={(e) => patch({ gymBrand: e.target.value as GymBrand })}
              className="w-full rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white focus:border-sang-600 focus:outline-none"
            >
              {Object.entries(GYM_BRAND_LABEL_FR).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Card>

          {error !== null && (
            <div
              role="alert"
              data-testid="profil-error"
              className="rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
            >
              {error}
            </div>
          )}

          <div className="sticky bottom-0 -mx-1 flex gap-2 bg-anthracite-900 pt-3">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={save}
              data-testid="profil-save"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
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
