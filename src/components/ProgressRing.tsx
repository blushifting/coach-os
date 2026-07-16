/**
 * Anneau de progression circulaire (Conv #11i).
 *
 * Trois usages, tous globaux — il n'y a PAS d'anneau par exo (le commentaire
 * d'origine le disait, c'était vrai en #11i seulement) : l'anneau de séance de
 * `SessionRunner`, et les widgets « Cette semaine » / « Cycle » de l'accueil.
 *
 * Pure SVG : le remplissage passe par une transition CSS sur `stroke-dasharray`,
 * rejouée à chaque re-render.
 *
 * Conv #66 — pas de remplissage depuis 0 au montage, décision assumée : ces trois
 * anneaux sont lus sur des écrans qu'on OUVRE (accueil, séance). Les faire monter
 * de 0 à leur valeur raconterait une progression qui n'a pas eu lieu à cette
 * ouverture — on n'avance pas ses séries en arrivant sur l'accueil.
 */

import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';

interface ProgressRingProps {
  /** Numérateur (séries cochées). */
  readonly value: number;
  /** Dénominateur (séries totales). 0 → ring vide. */
  readonly total: number;
  /** Taille en px (diamètre extérieur). */
  readonly size?: number;
  /** Épaisseur du trait en px. */
  readonly strokeWidth?: number;
  /** Classe optionnelle. */
  readonly className?: string;
  /** Affiche `done/total` au centre (text-[10px]). */
  readonly showLabel?: boolean;
}

export function ProgressRing({
  value,
  total,
  size = 32,
  strokeWidth = 3,
  className,
  showLabel = false,
}: ProgressRingProps) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const isComplete = total > 0 && value >= total;
  const dash = c * ratio;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={total}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Track — 1.16 : halo VERT quand accompli (« c'est fait »), plus de
            doré (le doré vire au jaune/warning en digital). green-500. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={isComplete ? 'rgba(22,163,74,0.16)' : 'none'}
          stroke={isComplete ? '#16a34a' : 'rgba(38,42,48,0.9)'}
          strokeWidth={strokeWidth}
        />
        {/* Progress — masqué quand accompli (l'anneau vert du track sert de complet). */}
        {ratio > 0 && !isComplete && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#b62a3a"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{
              transition: `stroke-dasharray ${MOTION.ring}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        )}
        {/* Pas d'animation d'accomplissement : la transition rouge → anneau
            vert ci-dessus suffit comme signal visuel. */}
      </svg>
      {showLabel && (
        <span
          className={cn(
            'absolute font-display text-[10px] leading-none tabular-nums',
            isComplete ? 'text-green-400' : 'text-white',
          )}
        >
          {value}/{total}
        </span>
      )}
    </div>
  );
}
