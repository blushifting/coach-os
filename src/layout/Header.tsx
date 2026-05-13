import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/programme': 'Programme',
  '/cycle-bilan': 'Bilan de cycle',
  '/seance': 'Séance',
  '/progres': 'Progrès',
  '/catalogue': 'Catalogue',
  '/profil': 'Profil',
};

export function Header() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Coach OS';

  return (
    <header
      className="sticky top-0 z-10 flex items-center bg-anthracite-950/90 px-5 backdrop-blur"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
    >
      <div className="flex h-12 w-full items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>
    </header>
  );
}
