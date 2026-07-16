import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface TabDef {
  readonly to: string;
  readonly label: string;
}

// Conv #49 — onglets renommés : « Séances »→« Accueil », « Catalogue »→« Exercices »
// (titres d'en-tête synchronisés dans `Header.tsx`).
// Conv #66 — exporté : `TabbedLayout` s'en sert pour connaître le SENS d'une
// navigation (aller vers un onglet à droite → la page entre par la droite).
export const TABS: readonly TabDef[] = [
  { to: '/programme', label: 'Accueil' },
  { to: '/progres', label: 'Progrès' },
  { to: '/catalogue', label: 'Exercices' },
  { to: '/profil', label: 'Profil' },
];

/**
 * Rang de l'onglet correspondant à une route, ou −1 hors barre d'onglets
 * (séance, bilan…). Même règle de correspondance que `NavLink` : égalité, ou
 * préfixe suivi d'un `/` — `startsWith` nu ferait matcher `/progres-truc`.
 */
export function tabIndexOf(pathname: string): number {
  return TABS.findIndex(
    (t) => pathname === t.to || pathname.startsWith(`${t.to}/`),
  );
}

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
  const { pathname } = useLocation();
  const activeIdx = tabIndexOf(pathname);
  const cellPct = 100 / TABS.length;

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-sang-700/30 bg-graphite-950"
      aria-label="Navigation principale"
    >
      <ul className="relative flex h-12">
        {/* Conv #66 — la barre active est un élément UNIQUE porté par la liste,
            plus un span rendu dans chaque onglet actif : c'est ce qui lui permet
            de glisser d'un onglet à l'autre au lieu de disparaître ici et
            réapparaître là. Les marges reproduisent l'ancien `inset-x-3`. */}
        {activeIdx >= 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-[3px] rounded-b bg-gradient-to-r from-sang-700 via-sang-500 to-sang-700 shadow-glow-sang motion-safe:transition-[left] motion-safe:duration-300 motion-safe:ease-out"
            style={{
              left: `calc(${activeIdx * cellPct}% + 0.75rem)`,
              width: `calc(${cellPct}% - 1.5rem)`,
            }}
          />
        )}
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
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
