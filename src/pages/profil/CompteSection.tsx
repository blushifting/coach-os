/**
 * Chantier F-1 — section « Compte » du Profil.
 * Chantier F-2 — machine à remonter le temps : les 10 dernières sauvegardes
 * sont conservées côté serveur par la rétention, autant les rendre
 * accessibles. C'est le filet de sécurité de tout le reste : une manipulation
 * malheureuse se rattrape en trois taps.
 *
 * Entièrement absente quand la couche cloud n'est pas configurée : en dev, en
 * test et en e2e, ce composant ne rend rien du tout.
 *
 * Deux états : pas de compte lié (relance discrète + connexion Google), ou
 * compte lié (date de la dernière sauvegarde, envoi manuel, restauration,
 * déconnexion, suppression de compte).
 */

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { Sheet } from '@/components/Sheet';
import {
  backupNow,
  backupThenSignOut,
  deleteCloudAccount,
  restoreFromCloud,
  signInWithGoogle,
} from '@/lib/auth';
import { listSnapshots, type CloudSnapshotMeta } from '@/lib/backup';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface CompteSectionProps {
  /** Appelé après une déconnexion ou une suppression réussie. */
  readonly onLocalWipe: () => Promise<void>;
  /** Appelé après une restauration réussie (chantier F-2). */
  readonly onRestored: () => void;
  readonly disabled?: boolean;
}

export function CompteSection({
  onLocalWipe,
  onRestored,
  disabled = false,
}: CompteSectionProps) {
  const { userId, email, busy, error, lastBackupAt } = useAuthStore();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteTwice, setConfirmDeleteTwice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<readonly CloudSnapshotMeta[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pending, setPending] = useState<CloudSnapshotMeta | null>(null);

  if (!isSupabaseConfigured()) return null;

  const locked = disabled || busy;

  async function handleSignOut() {
    setConfirmSignOut(false);
    setNotice(null);
    const result = await backupThenSignOut();
    if (result.ok) await onLocalWipe();
  }

  async function handleDelete() {
    setConfirmDeleteTwice(false);
    setNotice(null);
    const result = await deleteCloudAccount();
    if (result.ok) await onLocalWipe();
  }

  async function handleBackupNow() {
    setNotice(null);
    const result = await backupNow();
    if (result.ok) setNotice('Sauvegarde envoyée.');
  }

  /**
   * La liste n'est chargée qu'à l'ouverture de la feuille : elle ne sert qu'ici
   * et personne ne doit payer une requête réseau pour afficher son profil.
   */
  async function handleOpenHistory() {
    setNotice(null);
    setHistoryError(null);
    setHistory(null);
    setHistoryOpen(true);
    const result = await listSnapshots();
    if (result.ok) setHistory(result.value);
    else setHistoryError(result.error);
  }

  async function handleRestore(meta: CloudSnapshotMeta) {
    setPending(null);
    setNotice(null);
    const result = await restoreFromCloud({ snapshotId: meta.id });
    if (result.ok) {
      setHistoryOpen(false);
      onRestored();
    }
  }

  return (
    <Card data-testid="profil-compte">
      <div className="mb-3 text-sm font-semibold text-white">
        Sauvegarde en ligne
      </div>

      {userId === null ? (
        <div className="flex flex-col gap-3">
          <p className="text-justify text-xs leading-relaxed text-anthracite-400">
            Sans compte, tes données ne vivent que sur ce téléphone&nbsp;: si tu
            supprimes l&apos;app, changes d&apos;appareil ou si ton navigateur
            fait le ménage, tout est perdu. Un compte sauvegarde
            automatiquement ta progression en ligne.
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={() => void signInWithGoogle()}
            disabled={locked}
            data-testid="compte-signin"
          >
            Créer un compte avec Google
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-1 gap-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-anthracite-300">Compte</dt>
              <dd
                className="min-w-0 truncate text-right font-medium text-white"
                data-testid="compte-email"
              >
                {email ?? '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-anthracite-300">Dernière sauvegarde</dt>
              <dd
                className="text-right font-medium text-white"
                data-testid="compte-last-backup"
              >
                {formatBackupDate(lastBackupAt)}
              </dd>
            </div>
          </dl>

          <p className="text-justify text-xs leading-relaxed text-anthracite-400">
            Ta progression part en ligne toute seule après chaque séance. On y
            stocke ce que tu as renseigné dans l&apos;app&nbsp;: sexe, âge,
            poids, objectifs et performances. Les serveurs sont en France, et
            les 10 dernières sauvegardes sont conservées&nbsp;— tu peux revenir
            à l&apos;une d&apos;elles à tout moment. Azur, qui héberge le
            service, peut techniquement les consulter. Supprimer ton compte les
            efface définitivement. Tu peux aussi garder une copie sur ton
            téléphone avec «&nbsp;Exporter mes données&nbsp;».
          </p>

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleBackupNow()}
              disabled={locked}
              data-testid="compte-backup-now"
            >
              Sauvegarder maintenant
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleOpenHistory()}
              disabled={locked}
              data-testid="compte-restore"
            >
              Restaurer une sauvegarde
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setConfirmSignOut(true)}
              disabled={locked}
              data-testid="compte-signout"
            >
              Me déconnecter de cet appareil
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => setConfirmDelete(true)}
              disabled={locked}
              data-testid="compte-delete"
            >
              Supprimer mon compte
            </Button>
          </div>
        </div>
      )}

      {notice !== null && (
        <p
          className="mt-3 text-xs text-anthracite-300"
          data-testid="compte-notice"
        >
          {notice}
        </p>
      )}
      {error !== null && (
        <div
          role="alert"
          data-testid="compte-error"
          className="mt-3 rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
        >
          {error}
        </div>
      )}

      <Sheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Restaurer une sauvegarde"
      >
        <p className="mb-4 text-justify text-xs leading-relaxed text-anthracite-400">
          Choisis une date&nbsp;: son contenu remplacera intégralement ce que
          contient cet appareil. La version que tu choisis redevient ta
          sauvegarde de référence.
        </p>
        {historyError !== null && (
          <div
            role="alert"
            data-testid="compte-history-error"
            className="rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
          >
            {historyError}
          </div>
        )}
        {historyError === null && history === null && (
          <p className="text-sm text-anthracite-300">Chargement…</p>
        )}
        {history !== null && history.length === 0 && (
          <p className="text-sm text-anthracite-300" data-testid="compte-history-empty">
            Aucune sauvegarde en ligne pour l&apos;instant.
          </p>
        )}
        {history !== null && history.length > 0 && (
          <ul className="flex flex-col gap-2" data-testid="compte-history-list">
            {history.map((meta, index) => (
              <li
                key={meta.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-anthracite-700 bg-anthracite-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">
                    {formatBackupDate(meta.createdAt)}
                  </div>
                  <div className="text-xs text-anthracite-400">
                    {index === 0 ? 'La plus récente · ' : ''}version{' '}
                    {meta.appVersion}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPending(meta)}
                  disabled={locked}
                >
                  Restaurer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Dialog
        open={pending !== null}
        title={'Remplacer les données de cet appareil ?'}
        description={
          <>
            Tout ce que contient cet appareil sera remplacé par la sauvegarde du{' '}
            {pending === null ? '' : formatBackupDate(pending.createdAt)}. Ce
            que tu as fait depuis sera perdu.
          </>
        }
        confirmLabel={busy ? 'Restauration…' : 'Remplacer et récupérer'}
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          if (pending !== null) void handleRestore(pending);
        }}
        onCancel={() => setPending(null)}
      />

      <Dialog
        open={confirmSignOut}
        title={"Me déconnecter de cet appareil ?"}
        description={
          <>
            Cet appareil sera <strong>vidé de toutes tes données</strong> pour
            pouvoir être prêté. On envoie d&apos;abord une sauvegarde&nbsp;: si
            elle échoue, rien ne sera effacé.
            <br />
            <br />
            Dernière sauvegarde&nbsp;: {formatBackupDate(lastBackupAt)}.
          </>
        }
        confirmLabel="Sauvegarder et me déconnecter"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => void handleSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      />

      <Dialog
        open={confirmDelete}
        title={"Supprimer ton compte ?"}
        description={
          <>
            Ton compte et toutes tes sauvegardes en ligne seront effacés
            définitivement, ainsi que les données de cet appareil.
          </>
        }
        confirmLabel="Continuer la suppression"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          setConfirmDeleteTwice(true);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <Dialog
        open={confirmDeleteTwice}
        title={"Confirmer la suppression ?"}
        description={
          <>
            C&apos;est <strong>irréversible</strong>. Pense à exporter tes
            données avant, si tu veux en garder une trace.
          </>
        }
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteTwice(false)}
      />
    </Card>
  );
}

function formatBackupDate(iso: string | null): string {
  if (iso === null) return 'jamais';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'jamais';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
