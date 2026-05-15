/**
 * Mini-silhouette placeholder pour les cards Catalogue (Conv #6b).
 *
 * Refonte propre en Conv #8 (silhouette anatomique muscle-par-muscle).
 * Pour l'instant : SVG schématique à 3 zones (haut / tronc / bas) qui
 * s'allument selon les muscles primaires de l'exo. Taille fixe 24×40 pour
 * garantir qu'on ne déborde jamais du cadre de la card.
 */

import { cn } from '@/lib/cn';

const UPPER_MUSCLES: ReadonlySet<string> = new Set([
  'pectoraux',
  'dos_largeur',
  'dos_epaisseur',
  'trapezes_hauts',
  'deltos_lateraux',
  'deltos_posterieurs',
  'biceps',
  'triceps',
]);

const CORE_MUSCLES: ReadonlySet<string> = new Set([
  'abdos',
  'obliques',
  'lombaires',
]);

const LOWER_MUSCLES: ReadonlySet<string> = new Set([
  'quadriceps',
  'ischios',
  'fessiers',
  'mollets',
]);

export type SilhouetteZone = 'upper' | 'core' | 'lower';

export function silhouetteZonesFor(muscles: readonly string[]): Set<SilhouetteZone> {
  const out = new Set<SilhouetteZone>();
  for (const m of muscles) {
    if (UPPER_MUSCLES.has(m)) out.add('upper');
    else if (CORE_MUSCLES.has(m)) out.add('core');
    else if (LOWER_MUSCLES.has(m)) out.add('lower');
  }
  return out;
}

interface MiniSilhouetteProps {
  readonly muscles: readonly string[];
}

export function MiniSilhouette({ muscles }: MiniSilhouetteProps) {
  const zones = silhouetteZonesFor(muscles);
  const on = 'fill-sang-900';
  const off = 'fill-anthracite-700';

  return (
    <svg
      viewBox="0 0 24 40"
      width="24"
      height="40"
      aria-hidden="true"
      data-testid="mini-silhouette"
      className="shrink-0"
    >
      {/* tête (toujours neutre) */}
      <circle cx="12" cy="4" r="3" className="fill-anthracite-600" />
      {/* haut du corps : torse + bras schématiques */}
      <rect
        x="4"
        y="8"
        width="16"
        height="11"
        rx="2"
        data-testid="silhouette-upper"
        data-on={zones.has('upper')}
        className={cn(zones.has('upper') ? on : off)}
      />
      {/* tronc / abdos */}
      <rect
        x="7"
        y="20"
        width="10"
        height="6"
        rx="1.5"
        data-testid="silhouette-core"
        data-on={zones.has('core')}
        className={cn(zones.has('core') ? on : off)}
      />
      {/* bas du corps : jambes schématiques */}
      <rect
        x="5"
        y="27"
        width="14"
        height="11"
        rx="2"
        data-testid="silhouette-lower"
        data-on={zones.has('lower')}
        className={cn(zones.has('lower') ? on : off)}
      />
    </svg>
  );
}
