import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface TabDef {
  readonly to: string;
  readonly label: string;
}

const TABS: readonly TabDef[] = [
  { to: '/programme', label: 'Séances' },
  { to: '/progres', label: 'Progrès' },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/profil', label: 'Profil' },
];

/**
 * TabBar bas — Conv #11c : tab actif marqué par une barre haute en gradient
 * sang (3 px) + fond légèrement rouge + label en font-medium. Effet "ligne de
 * vie rouge" en bas d'écran pour identifier l'onglet courant au coup d'œil.
 */
export function TabBar() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-sang-700/30 bg-graphite-950"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <ul className="flex h-12">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full w-full items-center justify-center text-xs transition-colors',
                  isActive
                    ? 'bg-gradient-to-b from-sang-900/30 to-transparent font-medium text-sang-400'
                    : 'font-medium text-anthracite-300 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3 top-0 h-[3px] rounded-b bg-gradient-to-r from-sang-700 via-sang-500 to-sang-700 shadow-glow-sang"
                    />
                  )}
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
