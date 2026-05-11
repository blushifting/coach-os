import { Outlet } from 'react-router-dom';
import { HelpProvider } from '@/components/help-context';

export function AppShell() {
  return (
    <HelpProvider>
      <div className="flex min-h-dvh flex-col bg-anthracite-950 text-white">
        <Outlet />
      </div>
    </HelpProvider>
  );
}
