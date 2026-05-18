import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { HelpProvider } from '@/components/help-context';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { useCoachOsStore } from '@/store';
import { bootstrap } from '@/hooks/useEngine';

export function AppShell() {
  const bootstrapped = useCoachOsStore((s) => s.bootstrapped);

  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <HelpProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-anthracite-950 text-white">
        {bootstrapped ? <Outlet /> : <SplashScreen />}
        <BrandWatermark />
        <UpdatePrompt />
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
 */
function BrandWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-3 z-50 flex h-12 items-center"
      style={{ top: 'max(env(safe-area-inset-top), 0.5rem)' }}
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
