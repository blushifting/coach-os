/**
 * Onglet Profil (Conv #6c).
 *
 * Quatre sections empilées :
 *   1. **Identité** — sexe/âge/poids/niveau/objectif/sessions/équipement (sheet).
 *   2. **Objectifs musculaires** — priorités + ranking + objectifs (sheet).
 *   3. **Aide** — tutos prise en main + glossaire 13 termes (sheet).
 *   4. **Données** — boutons Exporter / Importer / Réinitialiser.
 *
 * Toute mutation passe par `useEngine` (jamais d'écriture directe au store).
 * Le bouton Réinitialiser efface la DB et redirige vers `/onboarding`.
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import {
  importDataFromJson,
  resetApp,
  updateMuscleGoals,
  updateProfile,
} from '@/hooks/useEngine';
import { ImportValidationError } from '@/io/import';
import { exportToJsonString } from '@/io/export';
import { Level, Sex } from '@/engine/models';
import { muscleLabel, objectiveLabel } from '@/lib/balance-reasons';
import {
  buildGoalsFromDraft,
  explicitNonCoveredFromState,
  goalsDraftFromState,
  profileDraftFromState,
  type GoalsDraft,
} from '@/lib/profile-edit';
import { useCoachOsStore } from '@/store';
import { AideSheet } from './profil/AideSheet';
import { EditGoalsSheet } from './profil/EditGoalsSheet';
import { EditProfileSheet } from './profil/EditProfileSheet';

const LEVEL_LABEL: Record<Level, string> = {
  [Level.DEBUTANT]: 'Débutant',
  [Level.INTERMEDIAIRE]: 'Intermédiaire',
  [Level.AVANCE]: 'Avancé',
};

const SEX_LABEL: Record<Sex, string> = {
  [Sex.HOMME]: 'Homme',
  [Sex.FEMME]: 'Femme',
};

const OBJECTIVE_LABEL_GLOBAL: Record<string, string> = {
  hypertrophie: 'Hypertrophie',
  force: 'Force',
  endurance: 'Endurance',
};

export default function ProfilPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [aideOpen, setAideOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'export' | 'import' | 'reset'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (userState === null) {
    return (
      <section className="p-2">
        <p className="text-sm text-anthracite-500">
          Profil non initialisé. Lance l'onboarding pour démarrer.
        </p>
      </section>
    );
  }

  const profileDraft = profileDraftFromState(userState);
  const goalsDraft = goalsDraftFromState(userState);
  const explicitNonCovered = explicitNonCoveredFromState(userState);

  async function onSaveProfile(p: Parameters<typeof updateProfile>[0]) {
    await updateProfile(p);
  }

  async function onSaveGoals(draft: GoalsDraft) {
    const goals = buildGoalsFromDraft(draft, explicitNonCovered);
    await updateMuscleGoals(goals);
  }

  async function handleExport() {
    setBusy('export');
    try {
      const json = await exportToJsonString();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `coach-os-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  function handleImportClick() {
    setImportError(null);
    fileRef.current?.click();
  }

  async function handleImportFile(file: File) {
    setBusy('import');
    setImportError(null);
    try {
      const json = await file.text();
      await importDataFromJson(json);
    } catch (e) {
      if (e instanceof ImportValidationError) {
        setImportError(e.message);
      } else {
        setImportError(
          'Impossible de lire le fichier : ' + (e as Error).message,
        );
      }
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    setBusy('reset');
    try {
      await resetApp();
      navigate('/onboarding');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 pb-6" data-testid="profil-page">
      <h1 className="text-xl font-semibold text-white">Profil</h1>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Identité</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfileOpen(true)}
            data-testid="profil-edit-identity"
          >
            Modifier
          </Button>
        </div>
        <dl
          className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm"
          data-testid="profil-identity-summary"
        >
          <SummaryRow label="Sexe" value={SEX_LABEL[userState.profile.sex]} />
          <SummaryRow label="Âge" value={`${userState.profile.age} ans`} />
          <SummaryRow
            label="Poids"
            value={`${userState.profile.bodyweight_kg} kg`}
          />
          <SummaryRow
            label="Niveau"
            value={LEVEL_LABEL[userState.profile.level]}
          />
          <SummaryRow
            label="Objectif"
            value={
              OBJECTIVE_LABEL_GLOBAL[userState.profile.objective] ??
              userState.profile.objective
            }
          />
          <SummaryRow
            label="Séances/sem"
            value={String(userState.profile.sessions_per_week)}
          />
          <SummaryRow
            label="Équipements"
            value={
              userState.profile.available_equip.size === 0
                ? 'Aucun'
                : `${userState.profile.available_equip.size} cochés`
            }
            wide
          />
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            Objectifs musculaires
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGoalsOpen(true)}
            data-testid="profil-edit-goals"
          >
            Modifier
          </Button>
        </div>
        {goalsDraft.priorities.length === 0 ? (
          <p className="text-sm text-anthracite-500">
            Aucun muscle prioritaire pour l'instant.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-1.5"
            data-testid="profil-goals-summary"
          >
            {goalsDraft.priorities.map((p, i) => (
              <li
                key={p.muscle}
                data-testid={`profil-goal-summary-${p.muscle}`}
                className="flex items-center justify-between rounded-lg bg-anthracite-900 px-3 py-2 text-sm"
              >
                <span className="text-white">
                  <span className="mr-2 font-semibold text-sang-500 tabular-nums">
                    #{i + 1}
                  </span>
                  {muscleLabel(p.muscle)}
                </span>
                <span className="text-xs text-anthracite-500">
                  {objectiveLabel(p.objective)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {goalsDraft.acceptedSuggestions.size > 0 && (
          <div
            className="mt-3 text-xs text-anthracite-500"
            data-testid="profil-suggested-summary"
          >
            Équilibre : {[...goalsDraft.acceptedSuggestions].map(muscleLabel).join(', ')}.
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Aide</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAideOpen(true)}
            data-testid="profil-open-aide"
          >
            Ouvrir
          </Button>
        </div>
        <p className="mt-1 text-xs text-anthracite-500">
          Tutos de prise en main + glossaire des 13 termes utilisés dans l'app.
        </p>
      </Card>

      <Card>
        <div className="mb-2 text-sm font-semibold text-white">
          Mes données
        </div>
        <p className="mb-3 text-xs text-anthracite-500">
          Tout reste sur ton téléphone (IndexedDB). Exporte régulièrement pour
          ne rien perdre.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleExport}
            disabled={busy !== null}
            data-testid="profil-export"
          >
            Exporter mes données (JSON)
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleImportClick}
            disabled={busy !== null}
            data-testid="profil-import"
          >
            Importer un fichier JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="profil-import-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />
          {importError !== null && (
            <div
              role="alert"
              data-testid="profil-import-error"
              className="rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
            >
              {importError}
            </div>
          )}
          <Button
            variant="danger"
            fullWidth
            onClick={() => setConfirmReset(true)}
            disabled={busy !== null}
            data-testid="profil-reset"
          >
            Réinitialiser l'app
          </Button>
        </div>
      </Card>

      <EditProfileSheet
        open={profileOpen}
        initial={profileDraft}
        onClose={() => setProfileOpen(false)}
        onSave={onSaveProfile}
      />
      <EditGoalsSheet
        open={goalsOpen}
        initial={goalsDraft}
        onClose={() => setGoalsOpen(false)}
        onSave={onSaveGoals}
      />
      <AideSheet open={aideOpen} onClose={() => setAideOpen(false)} />

      <Dialog
        open={confirmReset}
        title="Réinitialiser l'app ?"
        description={
          <>
            Cette action efface <strong>toutes tes données</strong> (séances,
            feedbacks, cycles, plafonds, objectifs). Cette opération est
            irréversible. Pense à exporter avant.
          </>
        }
        confirmLabel="Tout effacer"
        cancelLabel="Annuler"
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}

interface SummaryRowProps {
  readonly label: string;
  readonly value: string;
  readonly wide?: boolean;
}

function SummaryRow({ label, value, wide = false }: SummaryRowProps) {
  return (
    <div className={wide ? 'col-span-2 flex justify-between' : 'flex justify-between'}>
      <dt className="text-anthracite-500">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}
