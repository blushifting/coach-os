/**
 * Sheet d'édition du profil (sexe / âge / poids / niveau / objectif / séances / équipement).
 *
 * Reprend les mêmes widgets que `OnboardingStep1Profile` mais piloté par un
 * `ProfileDraft` reconstruit depuis le `UserState` courant.
 *
 * Validation à la sauvegarde : `buildProfileFromDraft` qui appelle `makeProfile`
 * — toutes les bornes (âge 14-100, sessions 2-6, poids > 0) sont vérifiées.
 * En cas d'erreur, on affiche un message inline et on garde la sheet ouverte.
 */

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Level, Objective, Sex, type Profile } from '@/engine/models';
import { cn } from '@/lib/cn';
import {
  EQUIPMENT_CHIPS,
  EQUIPMENT_PRESET_FULL_GYM,
  EQUIPMENT_PRESET_HOME_BASIC,
  activeChipIds,
  toggleChip,
} from '@/lib/onboarding-state';
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

  const active = activeChipIds(draft.equipment);

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
            <div className="mb-3 text-sm font-medium text-white">Niveau</div>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label="Niveau"
            >
              {[
                { v: Level.DEBUTANT, lbl: 'Débutant', sub: '< 1 an' },
                { v: Level.INTERMEDIAIRE, lbl: 'Intermédiaire', sub: '1 à 3 ans' },
                { v: Level.AVANCE, lbl: 'Avancé', sub: '3 ans et plus' },
              ].map(({ v, lbl, sub }) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={draft.level === v}
                  data-testid={`profil-level-${v}`}
                  onClick={() => patch({ level: v })}
                  className={cn(
                    'flex flex-col items-start rounded-xl border px-3 py-2 text-left transition',
                    draft.level === v
                      ? 'border-sang-600 bg-sang-900/30 text-white'
                      : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
                  )}
                >
                  <span className="text-sm font-medium">{lbl}</span>
                  <span className="text-xs">{sub}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-medium text-white">Objectif global</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Objectif">
              {[
                { v: Objective.HYPERTROPHIE, lbl: 'Hypertrophie' },
                { v: Objective.FORCE, lbl: 'Force' },
                { v: Objective.ENDURANCE, lbl: 'Endurance' },
              ].map(({ v, lbl }) => (
                <ChipRadio
                  key={v}
                  label={lbl}
                  selected={draft.objective === v}
                  onClick={() => patch({ objective: v })}
                  testId={`profil-objective-${v}`}
                />
              ))}
            </div>
          </Card>

          {/* Conv #18 — Séances/sem retiré : déplacé dans le flux "Modifier
              priorités & programme" (Step4), parce qu'il impacte directement
              la structure du plan. La sheet Identité ne contient plus que des
              champs cosmétiques (volume_min/max recalculés mais cycle plan
              intact). */}

          <Card>
            <div className="mb-3 text-sm font-medium text-white">
              Équipement disponible
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  patch({ equipment: new Set(EQUIPMENT_PRESET_FULL_GYM) })
                }
                data-testid="profil-equip-preset-gym"
              >
                Salle complète
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  patch({ equipment: new Set(EQUIPMENT_PRESET_HOME_BASIC) })
                }
                data-testid="profil-equip-preset-home"
              >
                Maison basique
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ equipment: new Set() })}
                data-testid="profil-equip-clear"
              >
                Tout décocher
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_CHIPS.map((chip) => {
                const selected = active.has(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    role="switch"
                    aria-checked={selected}
                    data-testid={`profil-equip-${chip.id}`}
                    onClick={() =>
                      patch({ equipment: toggleChip(draft.equipment, chip) })
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      selected
                        ? 'border-sang-600 bg-sang-900/40 text-white'
                        : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
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
