/**
 * Badge catégorie d'équipement (Conv #23 retour Azur).
 *
 * Combine le picto `ChargeIcon` et une couleur de fond **distincte par
 * catégorie**, choisie dans la palette anthracite étendue avec teintes
 * métalliques désaturées :
 *
 *  - Barre           → bleu acier (slate) — métal froid
 *  - Haltère         → bronze (amber très sombre) — fonte chaude
 *  - Machine guidée  → vert métallique (teal sombre) — gun metal
 *  - Câble / poulie  → violet métallique (indigo très sombre)
 *  - Poids du corps  → sang dilué — accent de marque
 *
 * Toutes ces couleurs sont assez désaturées pour ne pas s'éloigner de
 * la DA anthracite + sang ; elles donnent juste une teinte distincte
 * suffisante pour catégoriser au coup d'œil sans relire le texte.
 *
 * Le picto reste le différenciateur principal pour l'accessibilité
 * (couleur jamais seule).
 */

import { ChargeType } from '@/engine/models';
import { ChargeIcon } from './ChargeIcon';

interface ChargeBadgeProps {
  readonly charge: ChargeType;
  /** Taille du badge en pixels (carré). Default 28. */
  readonly size?: number;
  readonly className?: string;
}

const BG_BY_CHARGE: Record<ChargeType, string> = {
  // Bleu acier — barre olympique métallique
  [ChargeType.BARBELL]: 'bg-slate-700/70 ring-1 ring-inset ring-slate-500/40 text-slate-100',
  // Bronze / cuivre désaturé — haltères en fonte
  [ChargeType.DUMBBELL]: 'bg-amber-950/70 ring-1 ring-inset ring-amber-700/40 text-amber-100',
  // Vert métallique — machines guidées
  [ChargeType.MACHINE_STACK]: 'bg-teal-950/70 ring-1 ring-inset ring-teal-700/40 text-teal-100',
  // Violet métallique — câbles
  [ChargeType.CABLE]: 'bg-indigo-950/70 ring-1 ring-inset ring-indigo-700/40 text-indigo-100',
  // Sang dilué — poids du corps (accent de marque)
  [ChargeType.BODYWEIGHT]: 'bg-sang-900/40 ring-1 ring-inset ring-sang-700/40 text-sang-100',
  [ChargeType.BODYWEIGHT_LOADED]: 'bg-sang-900/40 ring-1 ring-inset ring-sang-700/40 text-sang-100',
  [ChargeType.BODYWEIGHT_ASSISTED]: 'bg-sang-900/40 ring-1 ring-inset ring-sang-700/40 text-sang-100',
};

const LABEL_BY_CHARGE: Record<ChargeType, string> = {
  [ChargeType.BARBELL]: 'Barre',
  [ChargeType.DUMBBELL]: 'Haltères',
  [ChargeType.MACHINE_STACK]: 'Machine',
  [ChargeType.CABLE]: 'Poulie',
  [ChargeType.BODYWEIGHT]: 'Poids du corps',
  [ChargeType.BODYWEIGHT_LOADED]: 'Lesté',
  [ChargeType.BODYWEIGHT_ASSISTED]: 'Assisté',
};

export function ChargeBadge({
  charge,
  size = 28,
  className,
}: ChargeBadgeProps) {
  const iconSize = Math.round(size * 0.6);
  return (
    <span
      title={LABEL_BY_CHARGE[charge]}
      aria-label={LABEL_BY_CHARGE[charge]}
      data-testid={`charge-badge-${charge}`}
      className={`inline-flex items-center justify-center rounded-lg ${BG_BY_CHARGE[charge]} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ChargeIcon charge={charge} size={iconSize} />
    </span>
  );
}

export { BG_BY_CHARGE, LABEL_BY_CHARGE };
