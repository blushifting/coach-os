/**
 * Étape 1 de l'onboarding : profil utilisateur.
 *
 * Collecte : sexe, âge, poids, niveau, équipement (chips).
 *
 * Conv #18 — `sessions_per_week` déplacé en Step4 (seul paramètre vraiment
 * impactant côté programme : avant, il était ici par convention mais ça
 * rendait l'onboarding partiel ambigu — l'user veut paramétrer ses séances
 * au même endroit que le choix du programme).
 */

import { Level, Sex } from '@/engine/models';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/cn';
import {
  EQUIPMENT_CHIPS,
  EQUIPMENT_PRESET_FULL_GYM,
  EQUIPMENT_PRESET_HOME_BASIC,
  activeChipIds,
  toggleChip,
  type EquipmentChip,
  type OnboardingDraft,
} from '@/lib/onboarding-state';

interface Step1Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

export function Step1Profile({ draft, onChange, stepLabel }: Step1Props) {
  const active = activeChipIds(draft.equipment);

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
      </p>

      {/* --- Sexe --- */}
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

      {/* --- Âge --- */}
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

      {/* --- Poids --- */}
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

      {/* --- Niveau --- */}
      <Card>
        <div className="mb-3 text-sm font-medium text-white">Niveau</div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Niveau">
          {[
            { v: Level.DEBUTANT, lbl: 'Débutant', sub: '< 1 an de pratique régulière' },
            { v: Level.INTERMEDIAIRE, lbl: 'Intermédiaire', sub: '1 à 3 ans' },
            { v: Level.AVANCE, lbl: 'Avancé', sub: '3 ans et plus' },
          ].map(({ v, lbl, sub }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={draft.level === v}
              data-testid={`level-${v}`}
              onClick={() => onChange({ level: v })}
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

      {/* --- Équipement --- */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Équipement disponible</span>
        </div>
        <div className="mb-3 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({ equipment: new Set(EQUIPMENT_PRESET_FULL_GYM) })
            }
            data-testid="equip-preset-gym"
          >
            Salle complète
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({ equipment: new Set(EQUIPMENT_PRESET_HOME_BASIC) })
            }
            data-testid="equip-preset-home"
          >
            Maison basique
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ equipment: new Set() })}
            data-testid="equip-preset-clear"
          >
            Tout décocher
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_CHIPS.map((chip) => (
            <EquipChip
              key={chip.id}
              chip={chip}
              selected={active.has(chip.id)}
              onToggle={() =>
                onChange({ equipment: toggleChip(draft.equipment, chip) })
              }
            />
          ))}
        </div>
        {draft.equipment.size === 0 && (
          <p
            className="mt-3 rounded-lg border border-amber-800/60 bg-amber-900/20 px-3 py-2 text-[11px] leading-relaxed text-amber-100"
            data-testid="equip-empty-warning"
          >
            Aucun équipement coché : seuls les exercices au poids du corps
            (pompes, tractions, dips libres, fentes…) seront proposés.
          </p>
        )}
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

interface EquipChipProps {
  readonly chip: EquipmentChip;
  readonly selected: boolean;
  readonly onToggle: () => void;
}

function EquipChip({ chip, selected, onToggle }: EquipChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      data-testid={`equip-${chip.id}`}
      onClick={onToggle}
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
}
