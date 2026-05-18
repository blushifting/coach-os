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
 * Filigrane logo K en haut-droit, présent sur tous les écrans (#11f item 7).
 * `pointer-events-none` pour ne jamais bloquer l'UI dessous. `z-50` pour
 * passer au-dessus du Header sticky qui est en z-10, sinon il serait masqué
 * sur les pages avec TabbedLayout.
 */
function BrandWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-2 z-50"
      style={{ top: 'max(env(safe-area-inset-top), 0.5rem)' }}
      data-testid="brand-watermark"
    >
      <img
        src={`${import.meta.env.BASE_URL}icon.svg`}
        alt=""
        className="h-7 w-7 opacity-[0.32] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
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
