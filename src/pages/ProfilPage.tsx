/**
 * Onglet Profil (Conv #6c).
 *
 * Quatre sections empilées :
 *   1. **Identité** — sexe/âge/poids/niveau/objectif/équipement (sheet, cosmétique).
 *   2. **Priorités & programme** — ouvre l'onboarding partiel (Step2→5)
 *      qui refait priorités + équilibre + programme + aperçu, puis termine
 *      prématurément le cycle en cours et démarre un nouveau cycle (Conv #18).
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
import { KotshLogo } from '@/components/KotshLogo';
import {
  importDataFromJson,
  resetApp,
  updateProfile,
} from '@/hooks/useEngine';
import { ImportValidationError } from '@/io/import';
import { exportToJsonString } from '@/io/export';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import { Sex, type Profile } from '@/engine/models';
import { muscleLabel, objectiveLabel } from '@/lib/balance-reasons';
import {
  goalsDraftFromState,
  profileDraftFromState,
} from '@/lib/profile-edit';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { AideSheet } from './profil/AideSheet';
import { EditProfileSheet } from './profil/EditProfileSheet';

const SEX_LABEL: Record<Sex, string> = {
  [Sex.HOMME]: 'Homme',
  [Sex.FEMME]: 'Femme',
};

export default function ProfilPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const demoActive = useDemoMode();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [aideOpen, setAideOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'export' | 'import' | 'reset'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (userState === null) {
    return (
      <section className="p-2">
        <p className="text-sm text-anthracite-300">
          Profil non initialisé. Lance l'onboarding pour démarrer.
        </p>
      </section>
    );
  }

  const profileDraft = profileDraftFromState(userState);
  const goalsDraft = goalsDraftFromState(userState);

  // Conv #18 — édition Identité = save direct, jamais de reset cycle. Les
  // champs vraiment impactants (sessions/sem, programme guidé, priorités
  // musculaires) ne vivent plus dans cette sheet : ils se modifient via
  // "Modifier priorités & programme" qui lance l'onboarding partiel.
  async function onSaveProfile(p: Profile) {
    await updateProfile(p);
  }

  function openPrioritesProgramme() {
    navigate('/onboarding?restart=1');
  }

  const activeProgramme =
    userState.active_guided_program_id !== null
      ? ALL_GUIDED_PROGRAMS.find((p) => p.id === userState.active_guided_program_id) ?? null
      : null;

  async function handleExport() {
    setBusy('export');
    try {
      const json = await exportToJsonString();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `kotsh-export-${date}.json`;
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
      navigate('/welcome');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 pb-6" data-testid="profil-page">
      {/* Conv #11i bis — h1 "Profil" retiré : doublon du titre Header. */}
      {/* Conv #17 — Bannière démo : avertit que les éditions sont gelées pour
          ne pas polluer le snapshot Alex. */}
      {demoActive && (
        <Card
          className="border-amber-700/40 bg-amber-900/20"
          data-testid="profil-demo-banner"
        >
          <p className="text-xs text-amber-100">
            Mode démo actif — les modifications de profil et l'import sont
            désactivés pour préserver les données d'Alex. Sors de la démo
            depuis l'accueil pour reprendre la main sur ton propre compte.
          </p>
        </Card>
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Identité</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfileOpen(true)}
            disabled={demoActive}
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
            wide
          />
          {/* Conv #22 — Niveau et équipement retirés de l'identité (auto-
              calibration cycle / révélés par les choix d'exos). Conv #20 —
              Séances/sem + Objectif gérés via "Priorités & programme". */}
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            Priorités &amp; programme
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={openPrioritesProgramme}
            disabled={demoActive}
            data-testid="profil-edit-priorities-programme"
          >
            Modifier
          </Button>
        </div>
        {/* Conv #18 — Card combinée : priorités musculaires + programme actif
            + séances/sem. "Modifier" relance l'onboarding partiel (Step2→5)
            qui à la fin termine le cycle en cours et démarre un nouveau cycle
            avec les nouveaux paramètres. */}
        <div
          className="mb-3 flex items-baseline justify-between rounded-lg bg-anthracite-900 px-3 py-2 text-sm"
          data-testid="profil-programme-summary"
        >
          <span className="text-anthracite-300">Programme</span>
          <span className="text-right font-medium text-white">
            {activeProgramme !== null ? activeProgramme.name : 'Custom'} ·{' '}
            <span className="tabular-nums text-anthracite-300">
              {userState.profile.sessions_per_week} séances/sem
            </span>
          </span>
        </div>
        {goalsDraft.priorities.length === 0 ? (
          <p className="text-sm text-anthracite-300">
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
                <span className="text-xs text-anthracite-300">
                  {objectiveLabel(p.objective)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {goalsDraft.acceptedSuggestions.size > 0 && (
          <div
            className="mt-3 text-xs text-anthracite-300"
            data-testid="profil-suggested-summary"
          >
            Équilibre : {[...goalsDraft.acceptedSuggestions].map(muscleLabel).join(', ')}.
          </div>
        )}
      </Card>

      {/* Conv #17 — Card "Aide / Ouvrir" peu ergonomique → gros bouton
          secondary size=lg directement cliquable. La description courte reste
          sous le bouton pour donner du contexte. Les HelpButton "?" répartis
          dans l'app (ForceView, VolumeView, Widgets, Step2…) restent en place
          comme entrée contextuelle ; ce bouton-ci est l'entrée principale. */}
      <div className="flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => setAideOpen(true)}
          data-testid="profil-open-aide"
        >
          <span aria-hidden className="mr-2 text-xl leading-none">?</span>
          Aide &amp; glossaire
        </Button>
        <p className="px-1 text-xs text-anthracite-300">
          Tutos de prise en main + glossaire des termes utilisés dans l'app.
        </p>
      </div>

      <Card>
        <div className="mb-2 text-sm font-semibold text-white">
          Mes données
        </div>
        <p className="mb-3 text-xs text-anthracite-300">
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
            disabled={busy !== null || demoActive}
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


      <footer
        className="mt-4 flex items-center justify-center gap-3 pt-6 text-anthracite-400"
        data-testid="profil-footer"
      >
        <KotshLogo className="text-2xl" />
        <span className="text-sm tabular-nums">v{__APP_VERSION__}</span>
      </footer>
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
      <dt className="text-anthracite-300">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}
