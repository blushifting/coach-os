/**
 * Chantier F-1 — dialogue de réconciliation à la connexion.
 * Chantier F-2 — la branche « récupérer le cloud » existe enfin.
 *
 * Monté au niveau du shell parce que la connexion Google passe par une
 * redirection pleine page : au retour, l'app repart de son écran d'accueil,
 * pas de l'écran d'où l'utilisateur est parti. Le point de décision doit donc
 * être unique et global.
 *
 * Trois situations, trois issues chacune, **jamais silencieuses** :
 *   - **cas B** — cet appareil est vide, le compte a une sauvegarde. La voie
 *     attendue est la restauration ; repartir de zéro reste possible.
 *   - **cas C** — les deux ont des données. Récupérer le cloud écrase des
 *     données locales qui, elles, ne sont peut-être nulle part ailleurs
 *     → seconde confirmation.
 *   - **cas D** — le compte est neuf, mais l'appareil porte la progression
 *     d'un autre compte (téléphone prêté). Rien à restaurer, tout à trancher.
 *
 * Dans les trois cas, la dernière issue est la sortie de secours : se
 * déconnecter sans rien toucher (« je me suis trompé de compte »).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/Dialog';
import {
  abortSignIn,
  keepThisDevice,
  restoreFromCloud,
  startFreshOnThisDevice,
} from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

export function CloudConflictDialog() {
  const navigate = useNavigate();
  const conflict = useAuthStore((s) => s.conflict);
  const error = useAuthStore((s) => s.error);
  const busy = useAuthStore((s) => s.busy);
  const [confirmRestore, setConfirmRestore] = useState(false);

  if (conflict === null) return null;

  const when = conflict.cloud === null ? '' : formatCloudDate(conflict.cloud.at);

  async function handleRestore() {
    if (busy) return;
    setConfirmRestore(false);
    const result = await restoreFromCloud();
    // Au retour d'OAuth on est sur l'écran d'accueil : sans ça, l'utilisateur
    // resterait devant un « Commencer » alors que son programme est revenu.
    if (result.ok) navigate('/programme');
  }

  function handleKeep() {
    if (busy) return;
    void keepThisDevice();
  }

  async function handleFresh() {
    if (busy) return;
    const result = await startFreshOnThisDevice();
    if (result.ok) navigate('/welcome');
  }

  function handleAbort() {
    if (busy) return;
    setConfirmRestore(false);
    void abortSignIn();
  }

  if (confirmRestore) {
    return (
      <Dialog
        open
        title={'Remplacer les données de cet appareil ?'}
        description={
          <>
            Tout ce que tu as fait sur cet appareil sera écrasé par la
            sauvegarde du {when}. Si tes séances récentes ne sont pas dedans,
            elles seront perdues.
            <ErrorBlock message={error} />
          </>
        }
        confirmLabel={busy ? 'Restauration…' : 'Remplacer et récupérer'}
        cancelLabel="Revenir en arrière"
        destructive
        onConfirm={() => void handleRestore()}
        onCancel={() => setConfirmRestore(false)}
      />
    );
  }

  if (conflict.cloud === null) {
    // Cas D — compte neuf sur un appareil qui porte les données d'un autre.
    return (
      <Dialog
        open
        title="Cet appareil contient déjà une progression"
        description={
          <>
            Ton compte n&apos;a encore aucune sauvegarde, mais cet appareil
            porte la progression d&apos;un autre compte. Si ce téléphone
            t&apos;a été prêté, repars de zéro&nbsp;: son contenu ne
            t&apos;appartient pas.
            <ErrorBlock message={error} />
          </>
        }
        confirmLabel={busy ? 'Effacement…' : 'Repartir de zéro'}
        cancelLabel="Me déconnecter"
        destructive
        extraAction={{
          label: 'Ce sont mes données, les garder',
          onClick: handleKeep,
          testId: 'cloud-conflict-keep',
        }}
        onConfirm={() => void handleFresh()}
        onCancel={handleAbort}
      />
    );
  }

  if (!conflict.localHasData) {
    // Cas B — appareil vide : rien à perdre, la restauration est directe.
    return (
      <Dialog
        open
        title="Ta progression t'attend en ligne"
        description={
          <>
            Ton compte contient une sauvegarde du {when}. Cet appareil est
            vide&nbsp;: on peut la remettre en place tout de suite.
            <ErrorBlock message={error} />
          </>
        }
        confirmLabel={busy ? 'Restauration…' : 'Récupérer ma progression'}
        cancelLabel="Me déconnecter"
        extraAction={{
          label: 'Repartir de zéro ici',
          onClick: () => void handleFresh(),
          testId: 'cloud-conflict-fresh',
        }}
        onConfirm={() => void handleRestore()}
        onCancel={handleAbort}
      />
    );
  }

  // Cas C — les deux côtés ont des données.
  return (
    <Dialog
      open
      title="Une sauvegarde existe déjà en ligne"
      description={
        <>
          Ton compte contient une sauvegarde du {when}, et cet appareil a ses
          propres données. Garde celles d&apos;ici et elles partiront en
          ligne&nbsp;: les 10 dernières sauvegardes sont conservées, donc rien
          n&apos;est perdu définitivement.
          <ErrorBlock message={error} />
        </>
      }
      confirmLabel={busy ? 'Envoi…' : 'Garder cet appareil'}
      cancelLabel="Me déconnecter"
      extraAction={{
        label: 'Récupérer la sauvegarde en ligne',
        onClick: () => setConfirmRestore(true),
        destructive: true,
        testId: 'cloud-conflict-restore',
      }}
      onConfirm={handleKeep}
      onCancel={handleAbort}
    />
  );
}

function ErrorBlock({ message }: { readonly message: string | null }) {
  if (message === null) return null;
  return (
    <div
      role="alert"
      data-testid="cloud-conflict-error"
      className="mt-3 rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
    >
      {message}
    </div>
  );
}

function formatCloudDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'jour inconnu';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
