import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { CloudConflictDialog } from '@/components/CloudConflictDialog';
import { HelpProvider } from '@/components/help-context';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { DemoModeProvider } from '@/components/DemoMode';
import { useCoachOsStore } from '@/store';
import { bootstrap } from '@/hooks/useEngine';
import { initAuth } from '@/lib/auth';

export function AppShell() {
  const bootstrapped = useCoachOsStore((s) => s.bootstrapped);

  useEffect(() => {
    // Chantier F-1 — `initAuth` APRÈS `bootstrap` : la réconciliation a besoin
    // de savoir si cet appareil porte déjà des données, ce que seul le store
    // moteur hydraté peut dire. Inerte si la couche cloud n'est pas configurée.
    void bootstrap().then(() => initAuth());
  }, []);

  return (
    <HelpProvider>
      {/* Bloc B 1.17 — shell ancré en `fixed inset-0` plutôt que `h-dvh`. En
          PWA standalone iOS (status-bar black-translucent + viewport-fit=cover),
          `height: 100dvh` se calcule trop court et laissait une bande du fond
          <body> visible sous l'app en bas d'écran (« trou » safe-area présent
          partout). `fixed inset-0` remplit l'écran physique bord à bord ; seul
          <main> scrolle à l'intérieur. Identique sur desktop/Android. Sert aussi
          de bloc conteneur pour le BrandWatermark passé en `absolute`. */}
      {/* Conv #29 — fond du shell aligné sur le body (graphite-950, chaud) au
          lieu d'anthracite-950 (froid, plus sombre). Évite qu'une bande du
          shell apparaisse « plus sombre » sous la TabBar en PWA iOS, et donne
          le contraste fond chaud / cards froides voulu par le design. */}
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-graphite-950 text-white">
        {bootstrapped ? <Outlet /> : <SplashScreen />}
        <BrandWatermark />
        <UpdatePrompt />
        <DemoModeProvider />
        <CloudConflictDialog />
      </div>
    </HelpProvider>
  );
}

/**
 * Filigrane logo K en haut-gauche, présent sur tous les écrans (#11f item 7,
 * repositionné #11h : à gauche pour libérer le coin haut-droit et être centré
 * sur la même ligne que les titres de page). `pointer-events-none` pour ne
 * jamais bloquer l'UI dessous. `z-50` pour passer au-dessus du Header sticky
 * (z-10), sinon il serait masqué sur les pages avec TabbedLayout.
 *
 * Le Header décale son titre via `pl-12` pour laisser de la place. L'opacity
 * 0.32 et le drop-shadow assurent qu'on distingue toujours bien le filigrane
 * du titre adjacent (titre = opacity 1.0, filigrane = 0.32).
 *
 * Bloc B 1.17 — anciennement `position: fixed`. Sur iPhone, un élément `fixed`
 * suit le viewport VISUEL tandis que le Header `sticky` suit le flux ; quand
 * les barres d'outils iOS s'animent, les deux référentiels se désynchronisent
 * et le K dérivait par-dessus le texte (OK sur Android). Passé en `absolute`
 * dans l'AppShell `relative` (qui remplit `h-dvh` et ne scrolle pas) : même
 * référentiel que le Header sticky → plus de dérive, rendu identique ailleurs.
 */
function BrandWatermark() {
  return (
    <div
      aria-hidden="true"
      // Conv #15-1 — hauteur réduite (h-10 = 40px au lieu de h-12 = 48px) et
      // top remonté à 0.4rem pour aligner verticalement le K avec la barre du
      // StepIndicator de l'onboarding (qui est nettement plus haute que le
      // précédent centre du Header). `flex items-center` centre le K dans
      // l'espace réduit.
      className="pointer-events-none absolute left-3 z-50 flex h-10 items-center"
      style={{ top: 'max(env(safe-area-inset-top), 0.4rem)' }}
      data-testid="brand-watermark"
    >
      <img
        src={`${import.meta.env.BASE_URL}icon.svg`}
        alt=""
        className="h-8 w-8 opacity-[0.32] drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      />
    </div>
  );
}

function SplashScreen() {
  return (
    <div
      className="flex flex-1 items-center justify-center"
      data-testid="app-splash"
      aria-busy="true"
      aria-label="Chargement"
    >
      <img
        src={`${import.meta.env.BASE_URL}icon.svg`}
        alt=""
        className="h-16 w-16 animate-pulse"
      />
    </div>
  );
}
