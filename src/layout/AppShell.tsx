import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { HelpProvider } from '@/components/help-context';
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
      </div>
    </HelpProvider>
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
