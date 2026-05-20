/**
 * Comparateur de polices titres (Conv #14a-4).
 *
 * Charge dynamiquement 3 polices candidates via Google Fonts en plus
 * d'Oswald (actuelle), puis affiche le même échantillon (mini-WelcomeScreen
 * + mini-Header + valeurs typiques) côte à côte pour qu'Azur juge au rendu.
 *
 * Polices testées :
 *   - Oswald (actuelle, référence)
 *   - Big Shoulders Display (très condensée, géométrique, sportive)
 *   - Barlow Condensed (condensée moderne, plus douce qu'Oswald)
 *   - Inter Tight Bold (non condensée, contrepoint serré)
 *
 * Page dev-only (route `/dev/fonts`, exclue du build prod via `isDev`).
 */

import { useEffect } from 'react';
import { Card } from '@/components/Card';

interface FontCandidate {
  /** Identifiant CSS (font-family fallback chain). */
  readonly stack: string;
  /** Nom lisible pour l'utilisateur. */
  readonly label: string;
  /** Note descriptive (1 phrase). */
  readonly note: string;
}

const CANDIDATES: ReadonlyArray<FontCandidate> = [
  {
    stack: "'Oswald', Inter, sans-serif",
    label: 'Oswald (actuelle)',
    note: 'Condensée brutaliste, vibe "salle russe".',
  },
  {
    stack: "'Big Shoulders Display', Inter, sans-serif",
    label: 'Big Shoulders Display',
    note: 'Très condensée, géométrique, signature "sportive moderne".',
  },
  {
    stack: "'Barlow Condensed', Inter, sans-serif",
    label: 'Barlow Condensed',
    note: 'Condensée douce, lecture confortable, moins agressive.',
  },
  {
    stack: "'Inter Tight', Inter, sans-serif",
    label: 'Inter Tight',
    note: 'Non condensée, serrée, contrepoint sobre.',
  },
];

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Big+Shoulders+Display:wght@500;700',
    'family=Barlow+Condensed:wght@500;700',
    'family=Inter+Tight:wght@500;700',
  ].join('&') +
  '&display=swap';

export default function DevFontsPage() {
  // Injecte les Google Fonts au mount, retire au unmount.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    link.dataset.devFonts = '1';
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold">Polices titres — comparateur</h1>
        <p className="mt-1 text-sm text-anthracite-300">
          4 polices côte à côte, même échantillon. Choisis celle qui colle au
          rendu attendu, puis applique-la dans <code>tailwind.config.ts</code>{' '}
          (clé <code>fontFamily.display</code>) + <code>src/index.css</code>{' '}
          (import Fontsource).
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {CANDIDATES.map((c) => (
          <FontSample key={c.label} candidate={c} />
        ))}
      </div>
    </div>
  );
}

function FontSample({ candidate }: { readonly candidate: FontCandidate }) {
  const display = { fontFamily: candidate.stack };
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{candidate.label}</h2>
        <span className="text-[11px] text-anthracite-300">{candidate.note}</span>
      </div>

      {/* Mini-Header (sticky-style uppercase) */}
      <div
        className="mb-4 flex h-12 items-center justify-between rounded-lg border-b border-sang-700/25 bg-graphite-950/85 px-4"
        style={display}
      >
        <span className="text-2xl uppercase leading-none tracking-[0.06em] text-white">
          Séances
        </span>
      </div>

      {/* Mini-WelcomeScreen — logotype Kotsh + tagline */}
      <div className="mb-4 flex flex-col items-center gap-2 rounded-lg bg-graphite-900 py-6">
        <span
          className="text-6xl font-bold leading-none tracking-tight text-white"
          style={display}
        >
          K
          <svg
            viewBox="0 0 100 100"
            className="inline-block h-[0.62em] w-[0.62em] align-baseline text-sang-500"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="31"
              fill="none"
              stroke="currentColor"
              strokeWidth="38"
            />
          </svg>
          tsh
        </span>
        <span className="text-xs text-anthracite-300">
          Ta muscu, ajustée à ton effort réel.
        </span>
      </div>

      {/* Valeurs typiques tabular-nums (charges, %, etc.) */}
      <div className="grid grid-cols-3 gap-3 text-center" style={display}>
        <div>
          <div className="text-3xl font-bold tabular-nums text-white">
            245.0
          </div>
          <div className="text-[11px] text-anthracite-300">kg</div>
        </div>
        <div>
          <div className="text-3xl font-bold tabular-nums text-white">
            12/20
          </div>
          <div className="text-[11px] text-anthracite-300">séries</div>
        </div>
        <div>
          <div className="text-3xl font-bold tabular-nums text-white">
            +4.2%
          </div>
          <div className="text-[11px] text-anthracite-300">vs début</div>
        </div>
      </div>
    </Card>
  );
}
