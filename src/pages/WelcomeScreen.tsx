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
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import {
  hasNativeInstallPrompt,
  isInstalledOrDev,
  isIOS,
  subscribeInstallPrompt,
  triggerInstall,
} from '@/lib/install-prompt';

export default function WelcomeScreen() {
  const navigate = useNavigate();
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
          {/* Conv #11c — "Kotsh" en Oswald, le 'o' en rouge sang évoque le
              disque de poids (clin d'œil discret à la muscu, sans gimmick). */}
          <h1 className="font-display text-7xl font-bold leading-none tracking-tight text-white">
            K<span className="text-sang-500">o</span>tsh
          </h1>
          <p className="text-lg font-medium text-anthracite-100">
            Ta muscu, ajustée à ton effort réel.
          </p>
          <p className="text-sm leading-relaxed text-anthracite-300">
            Programme autorégulé qui calibre les charges séance après séance.
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 pb-4">
        {installed ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/onboarding')}
            data-testid="welcome-start"
          >
            Commencer
          </Button>
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
