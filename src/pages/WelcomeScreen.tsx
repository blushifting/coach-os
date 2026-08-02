/**
 * Écran de bienvenue — premier lancement ou après reset.
 *
 * Affiché quand `userState === null`. Trois modes selon le contexte :
 *
 * 1. App installée (`isInstalledOrDev`) → bouton "Commencer" → /onboarding.
 * 2. Navigateur avec prompt natif (Chrome/Android, `beforeinstallprompt`
 *    capturé) → bouton "Installer l'app" → déclenche le prompt natif.
 * 3. Navigateur sans prompt natif (iOS Safari surtout) → bouton
 *    "Installer l'app" → ouvre un sheet avec les instructions manuelles.
 *
 * Le bouton "Commencer" n'est pas accessible tant que l'app n'est pas
 * installée — choix produit pour pousser l'usage en standalone (cf. retours
 * Conv #10a : "on dirait juste que l'app est un navigateur ouvert sur un
 * site").
 *
 * Chantier F-1 — le compte se propose **ici**, avant l'onboarding : c'est le
 * seul endroit où la redirection pleine page vers Google ne coûte rien (aucune
 * saisie en cours à perdre), et c'est aussi là que l'app retombe au retour,
 * puisque `/programme` renvoie sur cet écran tant qu'il n'y a pas de programme.
 * C'est donc également ici que s'affiche un éventuel refus d'allowlist.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { KotshLogo } from '@/components/KotshLogo';
import { Sheet } from '@/components/Sheet';
import {
  hasNativeInstallPrompt,
  isInstalledOrDev,
  isIOS,
  subscribeInstallPrompt,
  triggerInstall,
} from '@/lib/install-prompt';
import { signInWithGoogle } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  // Chantier F-1 — inerte (et donc invisible) sans couche cloud configurée.
  const cloudEnabled = isSupabaseConfigured();
  const email = useAuthStore((s) => s.email);
  const signedIn = useAuthStore((s) => s.userId !== null);
  const authBusy = useAuthStore((s) => s.busy);
  const authError = useAuthStore((s) => s.error);
  const [installed, setInstalled] = useState<boolean>(() => isInstalledOrDev());
  const [hasPrompt, setHasPrompt] = useState<boolean>(() =>
    hasNativeInstallPrompt(),
  );
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [showGenericHelp, setShowGenericHelp] = useState(false);

  useEffect(() => {
    return subscribeInstallPrompt(() => {
      setInstalled(isInstalledOrDev());
      setHasPrompt(hasNativeInstallPrompt());
    });
  }, []);

  async function handleInstallClick() {
    if (hasPrompt) {
      const outcome = await triggerInstall();
      if (outcome === 'accepted') {
        // L'événement `appinstalled` mettra à jour `installed` via le
        // subscribe. Rien à faire ici — l'utilisateur sera invité à
        // rouvrir l'app depuis son écran d'accueil.
        return;
      }
      // Si refusé/indispo, on tombe sur les instructions manuelles.
      if (isIOS()) setShowIOSHelp(true);
      else setShowGenericHelp(true);
      return;
    }
    if (isIOS()) setShowIOSHelp(true);
    else setShowGenericHelp(true);
  }

  return (
    <section
      className="flex flex-1 flex-col items-center justify-between px-6 text-center"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 2.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
      }}
      data-testid="welcome-screen"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          className="h-32 w-32 rounded-3xl shadow-lg"
        />
        <div className="flex flex-col gap-4">
          <h1 className="text-7xl">
            <KotshLogo />
          </h1>
          <p className="text-lg font-medium text-anthracite-100">
            Ton programme de muscu sur mesure.
          </p>
          <p className="text-sm leading-relaxed text-anthracite-300">
            Il s'adapte à toi, séance après séance.
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 pb-4">
        {/* Chantier F-1 — c'est ici qu'atterrit un refus d'allowlist : la
            redirection de Google revient sur cet écran, pas sur celui d'où
            l'utilisateur est parti. */}
        {cloudEnabled && authError !== null && (
          <div
            role="alert"
            data-testid="welcome-auth-error"
            className="rounded-xl border border-sang-700 bg-sang-900/30 px-3 py-2 text-left text-sm text-sang-300"
          >
            {authError}
          </div>
        )}
        {installed ? (
          <>
            {cloudEnabled && !signedIn && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => void signInWithGoogle()}
                  disabled={authBusy}
                  data-testid="welcome-signin"
                >
                  Continuer avec Google
                </Button>
                <p className="text-justify text-xs leading-relaxed text-anthracite-400">
                  Un compte met ta progression à l&apos;abri&nbsp;: elle est
                  sauvegardée en ligne toute seule. Sans compte, tout reste sur
                  ce téléphone et rien ne sera récupérable si tu le perds ou si
                  tu désinstalles l&apos;app.
                </p>
              </>
            )}
            {cloudEnabled && signedIn && (
              <p
                className="text-xs text-anthracite-400"
                data-testid="welcome-signed-in"
              >
                Connecté avec {email ?? 'ton compte Google'}.
              </p>
            )}
            <Button
              variant={cloudEnabled && !signedIn ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              onClick={() => navigate('/onboarding')}
              data-testid="welcome-start"
            >
              {cloudEnabled && !signedIn ? 'Commencer sans compte' : 'Commencer'}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleInstallClick}
              data-testid="welcome-install"
            >
              Installer l'app
            </Button>
            <p className="text-xs text-anthracite-400">
              Kotsh fonctionne mieux installée sur ton téléphone.
            </p>
          </>
        )}
      </div>

      <Sheet
        open={showIOSHelp}
        onClose={() => setShowIOSHelp(false)}
        title="Installer Kotsh sur iPhone"
      >
        <ol className="space-y-3 text-sm text-anthracite-200">
          <li>
            <span className="font-semibold text-white">1.</span> Touche le
            bouton{' '}
            <span className="font-semibold text-white">Partager</span> en bas
            de Safari (le carré avec une flèche vers le haut).
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> Fais défiler
            et choisis{' '}
            <span className="font-semibold text-white">
              "Sur l'écran d'accueil"
            </span>
            .
          </li>
          <li>
            <span className="font-semibold text-white">3.</span> Touche{' '}
            <span className="font-semibold text-white">Ajouter</span>, puis
            ouvre l'icône Kotsh depuis ton écran d'accueil.
          </li>
        </ol>
        <p className="mt-4 text-xs text-anthracite-400">
          L'installation doit se faire depuis Safari (pas Chrome iOS).
        </p>
      </Sheet>

      <Sheet
        open={showGenericHelp}
        onClose={() => setShowGenericHelp(false)}
        title="Installer Kotsh"
      >
        <ol className="space-y-3 text-sm text-anthracite-200">
          <li>
            <span className="font-semibold text-white">1.</span> Ouvre le
            menu du navigateur (les trois points en haut à droite).
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> Choisis{' '}
            <span className="font-semibold text-white">
              "Installer l'application"
            </span>{' '}
            ou{' '}
            <span className="font-semibold text-white">
              "Ajouter à l'écran d'accueil"
            </span>
            .
          </li>
          <li>
            <span className="font-semibold text-white">3.</span> Confirme,
            puis ouvre Kotsh depuis ton écran d'accueil.
          </li>
        </ol>
      </Sheet>
    </section>
  );
}
