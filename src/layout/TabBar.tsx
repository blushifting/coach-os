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
 *
 * Bloc I (Conv #34) — PLUS de `padding-bottom: env(safe-area-inset-bottom)`.
 * Ce padding (ajouté Conv #29/#30) « remontait » la barre et laissait une bande
 * de graphite vide de ~34 px sous les libellés sur iOS (la zone home-indicator),
 * perçue comme une 2ᵉ barre. On colle désormais la barre (48 px) au bas physique
 * de l'écran (`sticky bottom-0` dans le shell `fixed inset-0`) : son fond
 * graphite va jusqu'au bord et le home indicator iOS flotte par-dessus, sous le
 * texte — exactement comme la barre gestuelle Android (où `safe-area = 0`). Les
 * libellés redeviennent les éléments les plus bas de l'écran.
 */
export function TabBar() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-sang-700/30 bg-graphite-950"
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
