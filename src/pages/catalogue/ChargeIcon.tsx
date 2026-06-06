/**
 * Picto catégorie d'équipement (Conv #23, item P).
 *
 * 5 catégories rendues distinctes au coup d'œil sur la fiche exo :
 *   - Barre (BARBELL)              — barre olympique avec disques
 *   - Haltères (DUMBBELL)          — haltère courte
 *   - Machine (MACHINE_STACK)      — stack de plaques carré
 *   - Poulie (CABLE)               — poulie + câble descendant
 *   - Poids du corps (BW / lesté / assisté) — silhouette stylisée
 *
 * DA : sang sur fond anthracite, pas d'autre couleur. Le picto est le
 * différenciateur principal ; le texte du chip reste lisible derrière
 * pour l'accessibilité (couleur jamais seule).
 */

import { ChargeType } from '@/engine/models';

interface ChargeIconProps {
  readonly charge: ChargeType;
  /** Taille en pixels. Default = 14 (inline dans un chip). */
  readonly size?: number;
  readonly className?: string;
}

export function ChargeIcon({ charge, size = 14, className }: ChargeIconProps) {
  const baseProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  switch (charge) {
    case ChargeType.BARBELL:
      // Barre olympique : long bar horizontal + 2 disques de chaque côté
      return (
        <svg {...baseProps}>
          {/* disques gauche (gros + petit) */}
          <line x1="2.5" y1="7" x2="2.5" y2="17" />
          <line x1="5" y1="5" x2="5" y2="19" />
          {/* barre */}
          <line x1="6.5" y1="12" x2="17.5" y2="12" />
          {/* disques droite */}
          <line x1="19" y1="5" x2="19" y2="19" />
          <line x1="21.5" y1="7" x2="21.5" y2="17" />
        </svg>
      );

    case ChargeType.DUMBBELL:
      // Haltère courte : barre courte + 2 disques compacts
      return (
        <svg {...baseProps}>
          <line x1="4" y1="7" x2="4" y2="17" />
          <line x1="6.5" y1="5" x2="6.5" y2="19" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="17.5" y1="5" x2="17.5" y2="19" />
          <line x1="20" y1="7" x2="20" y2="17" />
        </svg>
      );

    case ChargeType.MACHINE_STACK:
      // Stack de plaques : carré + lignes horizontales (4 plaques)
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <line x1="6.5" y1="8" x2="17.5" y2="8" />
          <line x1="6.5" y1="11.5" x2="17.5" y2="11.5" />
          <line x1="6.5" y1="15" x2="17.5" y2="15" />
        </svg>
      );

    case ChargeType.CABLE:
      // Poulie : cercle en haut + câble qui descend + barre/poignée en bas
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="6" r="2.5" />
          <line x1="12" y1="8.5" x2="12" y2="17" />
          <line x1="8.5" y1="17" x2="15.5" y2="17" />
          <line x1="14.5" y1="6" x2="20" y2="6" />
        </svg>
      );

    case ChargeType.BODYWEIGHT:
    case ChargeType.BODYWEIGHT_LOADED:
    case ChargeType.BODYWEIGHT_ASSISTED:
      // Silhouette stylisée : tête + tronc + bras + jambes
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="5.5" r="2" />
          <line x1="12" y1="7.5" x2="12" y2="15" />
          <line x1="6.5" y1="11" x2="17.5" y2="11" />
          <line x1="12" y1="15" x2="8" y2="20.5" />
          <line x1="12" y1="15" x2="16" y2="20.5" />
        </svg>
      );

    default:
      return null;
  }
}
