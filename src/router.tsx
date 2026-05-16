import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { TabbedLayout } from '@/layout/TabbedLayout';
import WelcomeScreen from '@/pages/WelcomeScreen';
import OnboardingPage from '@/pages/OnboardingPage';
import Seance0Page from '@/pages/seance-0/Seance0Page';
import ProgrammePage from '@/pages/programme/ProgrammePage';
import CycleBilanPage from '@/pages/cycle-bilan/CycleBilanPage';
import SeancePage from '@/pages/seance/SeancePage';
import ProgresPage from '@/pages/ProgresPage';
import CataloguePage from '@/pages/CataloguePage';
import ProfilPage from '@/pages/ProfilPage';
import DevPage from '@/pages/DevPage';

const isDev = import.meta.env.DEV;

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/programme" replace /> },
        { path: 'welcome', element: <WelcomeScreen /> },
        { path: 'onboarding', element: <OnboardingPage /> },
        { path: 'seance-0', element: <Seance0Page /> },
        {
          element: <TabbedLayout />,
          children: [
            { path: 'programme', element: <ProgrammePage /> },
            { path: 'cycle-bilan', element: <CycleBilanPage /> },
            { path: 'seance', element: <SeancePage /> },
            { path: 'progres', element: <ProgresPage /> },
            { path: 'catalogue', element: <CataloguePage /> },
            { path: 'profil', element: <ProfilPage /> },
          ],
        },
        ...(isDev ? [{ path: 'dev', element: <DevPage /> }] : []),
        { path: '*', element: <Navigate to="/programme" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
