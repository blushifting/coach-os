/**
 * Chantier F-1 — dialogue de réconciliation à la connexion.
 *
 * Monté au niveau du shell parce que la connexion Google passe par une
 * redirection pleine page : au retour, l'app repart de son écran d'accueil,
 * pas de l'écran d'où l'utilisateur est parti. Le point de décision doit donc
 * être unique et global.
 *
 * Cas B (appareil vierge, cloud plein) et cas C (les deux ont des données)
 * partagent la même mécanique : garder cet appareil, ou se déconnecter.
 * Rien n'est jamais silencieux.
 */

import { Dialog } from '@/components/Dialog';
import { abortSignIn, keepThisDevice } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

export function CloudConflictDialog() {
  const conflict = useAuthStore((s) => s.conflict);
  if (conflict === null) return null;

  const when = formatCloudDate(conflict.cloudAt);

  return (
    <Dialog
      open
      title={
        conflict.localHasData
          ? 'Une sauvegarde existe déjà en ligne'
          : 'Tes données sont en ligne, pas encore ici'
      }
      description={
        conflict.localHasData ? (
          <>
            Ton compte contient déjà une sauvegarde du {when}, et cet appareil a
            ses propres données. Tu peux garder ce que tu as ici et l&apos;envoyer
            par-dessus&nbsp;: les 10 dernières sauvegardes sont conservées, donc
            rien n&apos;est perdu définitivement.
          </>
        ) : (
          <>
            Ton compte contient une sauvegarde du {when}, mais cet appareil est
            vide. Récupérer une sauvegarde arrive dans la prochaine mise à jour
            de l&apos;app&nbsp;: déconnecte-toi et attends-la, sinon tu repartiras
            de zéro.
          </>
        )
      }
      confirmLabel={
        conflict.localHasData
          ? 'Garder cet appareil'
          : 'Repartir de zéro ici'
      }
      cancelLabel="Me déconnecter"
      destructive={!conflict.localHasData}
      onConfirm={() => void keepThisDevice()}
      onCancel={() => void abortSignIn()}
    />
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
