/**
 * Onglet Profil.
 *
 * Quatre sections empilées :
 *   1. **Identité** — sexe/âge/poids/niveau/objectif/équipement (sheet, cosmétique).
 *   2. **Priorités & programme** — ouvre l'onboarding partiel (Step2→5)
 *      qui refait priorités + équilibre + programme + aperçu, puis termine
 *      prématurément le cycle en cours et démarre un nouveau cycle.
 *   3. **Aide** — tutos prise en main + glossaire 15 termes (sheet).
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
import { Sex, type Profile } from '@/engine/models';
import {
  goalsDraftFromState,
  profileDraftFromState,
} from '@/lib/profile-edit';
import { gymBrandLabel } from '@/lib/catalog-filter';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { AideSheet } from './profil/AideSheet';
import { CompteSection } from './profil/CompteSection';
import { EditProfileSheet } from './profil/EditProfileSheet';
import { MusclesCard } from './profil/MusclesCard';
import { ProgrammeCard } from './profil/ProgrammeCard';

const SEX_LABEL: Record<Sex, string> = {
  [Sex.HOMME]: 'Homme',
  [Sex.FEMME]: 'Femme',
};

export default function ProfilPage() {
  const userState = useCoachOsStore((s) => s.userState);
  const catalog = useCoachOsStore((s) => s.catalog);
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
          Profil pas encore configuré. Crée ton programme pour démarrer.
        </p>
      </section>
    );
  }

  const profileDraft = profileDraftFromState(userState);
  const goalsDraft = goalsDraftFromState(userState);

  // Édition Identité = save direct, jamais de reset cycle. Les
  // champs vraiment impactants (sessions/sem, programme guidé, priorités
  // musculaires) ne vivent plus dans cette sheet : ils se modifient via
  // "Modifier priorités & programme" qui lance l'onboarding partiel.
  async function onSaveProfile(p: Profile) {
    await updateProfile(p);
  }

  function openPrioritesProgramme() {
    navigate('/onboarding?restart=1');
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
          'Impossible de lire le fichier : ' + (e as Error).message,
        );
      }
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /**
   * Après une déconnexion ou une suppression de compte réussie,
   * l'appareil est vidé (l'envoi forcé a déjà été confirmé par le serveur) et
   * on repart de l'écran d'accueil. Même effacement que « Réinitialiser ».
   */
  async function handleLocalWipe() {
    setBusy('reset');
    try {
      await resetApp();
      navigate('/welcome');
    } finally {
      setBusy(null);
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
      {/* Bannière démo : avertit que les éditions sont gelées pour
          ne pas polluer le snapshot Alex. */}
      {demoActive && (
        <Card
          className="border-amber-700/40 bg-amber-900/20"
          data-testid="profil-demo-banner"
        >
          <p className="text-justify text-xs text-amber-100">
            Mode démo actif — les modifications de profil et l'import sont
            désactivés pour préserver les données d'Alex. Sors de la démo
            depuis l'accueil pour reprendre la main sur ton propre compte.
          </p>
        </Card>
      )}
      {/* Le compte n'est plus une option de sauvegarde parmi
          d'autres réglages : c'est qui tu es dans l'app. Il ouvre donc le
          Profil, en carte compacte. */}
      <CompteSection
        onLocalWipe={handleLocalWipe}
        onRestored={() => navigate('/programme')}
        disabled={busy !== null || demoActive}
      />

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
          />
          {/* Marque des machines : affichée en clair, modifiable
              via le bouton "Modifier" en haut de la Card. */}
          <SummaryRow
            label="Marque machines"
            value={gymBrandLabel(userState.profile.gym_brand)}
          />
          {/* Niveau et équipement retirés de l'identité (auto-
              calibration cycle / révélés par les choix d'exos). Conv #20 —
              Séances/sem gérées via "Priorités & programme". */}
        </dl>
      </Card>

      {/* « Modifier » relance l'onboarding partiel (priorités, rythme,
          programme) et démarre un nouveau cycle, annoncé à la fin du parcours. */}
      <MusclesCard
        develop={goalsDraft.priorities}
        maintain={goalsDraft.maintenance}
        onEdit={openPrioritesProgramme}
        editDisabled={demoActive}
      />

      {/* Édition des exos du cycle EN COURS, séparée des
          objectifs : ne touche que les exercices, garde la progression. */}
      <ProgrammeCard
        plan={userState.current_cycle_plan}
        buildMode={userState.build_mode ?? 'auto'}
        sessionsPerWeek={userState.profile.sessions_per_week}
        catalog={catalog}
        brand={userState.profile.gym_brand}
        onEdit={() => navigate('/programme/modifier')}
        editDisabled={demoActive}
      />

      {/* Card "Aide / Ouvrir" peu ergonomique → gros bouton
          secondary size=lg directement cliquable. La description courte reste
          sous le bouton pour donner du contexte. Les HelpButton "?" répartis
          dans l'app (ForceView, VolumeView, Widgets, Step2…) restent en place
          comme entrée contextuelle ; ce bouton-ci est l'entrée principale. */}
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

      <Card>
        <div className="mb-3 text-sm font-semibold text-white">
          Mes données
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleExport}
            disabled={busy !== null}
            data-testid="profil-export"
          >
            Exporter mes données en JSON
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
        title={"Réinitialiser l'app ?"}
        description={
          <>
            Efface <strong>toutes tes données</strong> (séances, cycles,
            Plafonds, objectifs). C'est irréversible — pense à exporter avant.
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
