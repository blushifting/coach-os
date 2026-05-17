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
  const title = TITLES[pathname] ?? 'Kotsh';

  return (
    <header
      // Conv #11c — header sticky avec backdrop-blur sur fond translucide
      // graphite (matche le body chaud). Filet rouge sang sous la bordure
      // basse pour marquer l'identité visuelle.
      className="sticky top-0 z-10 flex items-center border-b border-sang-700/25 bg-graphite-950/85 px-5 backdrop-blur-md"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
    >
      <div className="flex h-12 w-full items-center justify-between">
        <h1 className="font-display text-2xl uppercase leading-none tracking-[0.06em] text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}
