/**
 * Bannière d'accueil — Conv #12b.
 *
 * Affichée sur `/programme` à la 1re visite (post-onboarding), tant que
 * l'utilisateur n'a pas dismissé OU pas encore fait une séance. Remplace
 * l'ancien écran récap post-Séance 0.
 *
 * Persistance dismiss : `localStorage[coach-os.welcome-dismissed]`. Si
 * l'utilisateur reset l'app, le flag est conservé — mais comme c'est le
 * même appareil, c'est attendu (il a déjà vu le tuto).
 */

import { useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { enterDemoMode } from '@/lib/demo';
import { resetDemoDismissals } from '@/components/DemoMode';

const DISMISS_KEY = 'coach-os.welcome-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // pas grave (mode privé, etc.) — au pire le banner réapparaîtra.
  }
}

interface WelcomeBannerProps {
  /** Nombre de feedbacks complétés — si > 0, on cache même sans dismiss. */
  readonly feedbackCount: number;
}

export function WelcomeBanner({ feedbackCount }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (feedbackCount > 0 || dismissed) return null;

  function dismiss() {
    persistDismissed();
    setDismissed(true);
  }

  async function startDemo() {
    resetDemoDismissals();
    await enterDemoMode();
  }

  return (
    <Card
      accent
      data-testid="welcome-banner"
      className="relative flex flex-col gap-2"
    >
      <button
        type="button"
        aria-label="Masquer la bienvenue"
        data-testid="btn-dismiss-welcome"
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-anthracite-300 hover:text-white"
      >
        ×
      </button>
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
        Bienvenue
      </span>
      <h2 className="pr-8 font-display text-2xl leading-tight tracking-wide text-white">
        Ton programme est prêt
      </h2>
      <p className="text-justify text-sm leading-relaxed text-anthracite-200 hyphens-auto">
        Pour lancer ta première séance, tape la case{' '}
        <span className="font-medium text-white">d'aujourd'hui</span> dans le
        calendrier (en rouge).
      </p>
      <p className="text-justify rounded-lg border border-sang-800/50 bg-sang-900/15 px-3 py-2 text-[12px] leading-relaxed text-anthracite-100 hyphens-auto">
        <span className="font-medium text-sang-300">Comment ça marche&nbsp;: </span>
        Kotsh te suggère une charge et des reps à chaque série.{' '}
        <span className="font-medium text-white">C'est un objectif, pas une obligation.</span>{' '}
        Note ce que tu as vraiment fait&nbsp;: ton programme se règle alors tout
        seul sur ton niveau réel — la bonne charge à chaque séance, sans avoir
        à la deviner.
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        <Button
          variant="primary"
          onClick={() => void startDemo()}
          data-testid="btn-start-demo-from-welcome"
        >
          Voir la démo
        </Button>
        <p className="px-1 text-xs text-anthracite-300">
          Un exemple&nbsp;: une séance et un bilan déjà remplis.
        </p>
      </div>
    </Card>
  );
}
