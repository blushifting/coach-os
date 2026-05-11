import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface TabDef {
  readonly to: string;
  readonly label: string;
}

const TABS: readonly TabDef[] = [
  { to: '/programme', label: 'Programme' },
  { to: '/seance', label: 'Séance' },
  { to: '/progres', label: 'Progrès' },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/profil', label: 'Profil' },
];

export function TabBar() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-anthracite-800 bg-anthracite-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <ul className="flex h-14">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                cn(
                  'flex h-full w-full items-center justify-center text-xs font-medium transition',
                  isActive ? 'text-sang-500' : 'text-anthracite-500 hover:text-white',
                )
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
