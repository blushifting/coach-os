import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { TabbedLayout } from '@/layout/TabbedLayout';
import WelcomeScreen from '@/pages/WelcomeScreen';
import OnboardingPage from '@/pages/OnboardingPage';
import ProgrammePage from '@/pages/programme/ProgrammePage';
import CycleBilanPage from '@/pages/cycle-bilan/CycleBilanPage';
import SeancePage from '@/pages/seance/SeancePage';
import ProgresPage from '@/pages/ProgresPage';
import CataloguePage from '@/pages/CataloguePage';
import ProfilPage from '@/pages/ProfilPage';
import DevPage from '@/pages/DevPage';
import DevFontsPage from '@/pages/DevFontsPage';

const isDev = import.meta.env.DEV;

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/programme" replace /> },
        { path: 'welcome', element: <WelcomeScreen /> },
        { path: 'onboarding', element: <OnboardingPage /> },
        {
          element: <TabbedLayout />,
          children: [
            { path: 'programme', element: <ProgrammePage /> },
            { path: 'cycle-bilan', element: <CycleBilanPage /> },
            { path: 'progres', element: <ProgresPage /> },
            { path: 'catalogue', element: <CataloguePage /> },
            { path: 'profil', element: <ProfilPage /> },
          ],
        },
        // Conv #14b-1 — Le runner sort de l'onglet "Séance" (supprimé de la
        // TabBar) et vit sur sa propre route plein écran. L'ancien `/seance`
        // redirige vers `/programme` pour compat des liens externes.
        { path: 'seance', element: <Navigate to="/programme" replace /> },
        { path: 'seance/runner', element: <SeancePage /> },
        ...(isDev
          ? [
              { path: 'dev', element: <DevPage /> },
              { path: 'dev/fonts', element: <DevFontsPage /> },
            ]
          : []),
        { path: '*', element: <Navigate to="/programme" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
