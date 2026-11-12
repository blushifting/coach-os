/**
 * Dump 2.4, étape 3 — **la** barre de volume, la même sur tous les écrans
 * (bilan de séance, Progrès > Volume, bilan de cycle, aperçu du programme).
 *
 * Anatomie (invariant n° 3 : tous les muscles ont la même) :
 *   - la piste va de 0 à l'échelle commune de l'écran (`volumeScale`) : 20
 *     séries pondérées, la zone haute, font le bout de la barre ; l'échelle ne
 *     s'allonge que si un muscle dépasse 20, et un trait ambre marque alors 20 ;
 *   - **un seul repère** : le seuil de croissance pour un muscle à développer,
 *     le plancher d'entretien pour un muscle à entretenir, aucun sans objectif ;
 *   - le remplissage prend la couleur du statut (cf. `classifyVolume`).
 *
 * Maquette : `Kotsh/maquettes/etape3_volume.html`.
 */

import { cn } from '@/lib/cn';
import { easeOutProgressAt, MOTION } from '@/lib/motion';
import { useAnimateOnMount, useDelayedFlag } from '@/hooks/useMotion';
import { VOLUME_HIGH_MARK } from '@/engine/volume';
import { MuscleIntention } from '@/engine/models';
import type { CoverageStatus } from '@/lib/progress';

/** Couleur du remplissage par statut. */
export const VOLUME_FILL: Record<CoverageStatus, string> = {
  non_travaille: 'bg-anthracite-500',
  sous_repere: 'bg-sang-500',
  ok: 'bg-emerald-500',
  eleve: 'bg-amber-500',
  sans_objectif: 'bg-anthracite-400',
};

/** Couleur du chiffre de séries par statut. */
export const VOLUME_TEXT: Record<CoverageStatus, string> = {
  non_travaille: 'text-anthracite-400',
  sous_repere: 'text-sang-400',
  ok: 'text-emerald-400',
  eleve: 'text-amber-400',
  sans_objectif: 'text-anthracite-200',
};

/** Séries pondérées sans arrondi trompeur (#11) : une décimale si non entier, virgule française. */
export function formatSets(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

/** « seuil 10 » ou « plancher 5 » : le repère de la barre, dit en clair. `null` sans objectif. */
export function markLabel(
  intention: MuscleIntention | null,
  mark: number | null,
): string | null {
  if (mark === null || intention === null) return null;
  const word = intention === MuscleIntention.DEVELOPPER ? 'seuil' : 'plancher';
  return `${word} ${formatSets(mark)}`;
}

/** Libellé court d'un statut, selon l'intention du muscle. `null` quand il n'y a rien à dire. */
export function statusLabel(
  status: CoverageStatus,
  intention: MuscleIntention | null,
): string | null {
  switch (status) {
    case 'non_travaille':
      return intention === null ? null : 'pas travaillé';
    case 'sous_repere':
      return intention === MuscleIntention.ENTRETENIR ? 'sous le plancher' : 'sous le seuil';
    case 'ok':
      return intention === MuscleIntention.ENTRETENIR ? 'entretenu' : 'dans la cible';
    case 'eleve':
      return 'volume élevé';
    case 'sans_objectif':
      return null;
  }
}

const pctOf = (v: number, scale: number): number =>
  scale > 0 ? Math.max(0, Math.min(100, (v / scale) * 100)) : 0;

interface VolumeBarProps {
  /** Séries pondérées à afficher. */
  readonly sets: number;
  /** Repère (seuil ou plancher), `null` sans objectif. */
  readonly mark: number | null;
  readonly status: CoverageStatus;
  /** Échelle commune de l'écran (`volumeScale`). */
  readonly scale: number;
  /** Barre plus épaisse (cartes de Progrès). */
  readonly size?: 'sm' | 'md';
  /**
   * Bilan de séance (conv #66) : séries apportées par la séance. La barre part
   * de son niveau d'avant-séance et pousse jusqu'au total ; la part du jour est
   * éclaircie le temps de sa course, puis se fond. Le repère flashe quand la
   * séance le fait franchir.
   */
  readonly gained?: number;
  /** Décalage de l'animation (cascade du bilan). */
  readonly delayMs?: number;
  /** La barre se remplit depuis 0 à l'ouverture (bilan de cycle : une moyenne, pas un ajout). */
  readonly fillOnMount?: boolean;
  readonly testId?: string;
}

export function VolumeBar({
  sets,
  mark,
  status,
  scale,
  size = 'sm',
  gained = 0,
  delayMs = 0,
  fillOnMount = false,
  testId,
}: VolumeBarProps) {
  const animated = gained > 0;
  const pctBefore = pctOf(sets - gained, scale);
  const pctAfter = pctOf(sets, scale);
  const pctMark = mark === null ? null : pctOf(mark, scale);

  const gainedWidth = useAnimateOnMount(0, Math.max(0, pctAfter - pctBefore));
  const staticWidth = useAnimateOnMount(fillOnMount ? 0 : pctAfter, pctAfter);
  const merged = useDelayedFlag(delayMs + MOTION.fill);
  const crossesMark =
    animated && pctMark !== null && pctBefore < pctMark && pctMark <= pctAfter;
  const markHit = useDelayedFlag(
    crossesMark
      ? delayMs +
          MOTION.fill * easeOutProgressAt((pctMark! - pctBefore) / (pctAfter - pctBefore))
      : 0,
  );
  const fill = VOLUME_FILL[status];

  return (
    // Enveloppe NON rognée : le repère dépasse de la piste.
    <div
      className={cn('relative', size === 'md' ? 'h-4' : 'h-3.5')}
      data-testid={testId}
      data-status={status}
      aria-hidden="true"
    >
      <div
        className={cn(
          'absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-anthracite-700',
          size === 'md' ? 'h-2' : 'h-1.5',
        )}
      >
        {animated ? (
          <>
            {/* Acquis avant la séance : statique, c'est le point de départ. */}
            <div
              className={cn('absolute inset-y-0 left-0', fill)}
              style={{ width: `${pctBefore}%` }}
            />
            {/* Gagné aujourd'hui : pousse depuis le niveau précédent. */}
            <div
              className={cn(
                'absolute inset-y-0 motion-safe:transition-[width] motion-safe:ease-out',
                fill,
              )}
              style={{
                left: `${pctBefore}%`,
                width: `${gainedWidth}%`,
                transitionDuration: `${MOTION.fill}ms`,
                transitionDelay: `${delayMs}ms`,
              }}
            >
              <div
                className={cn(
                  'h-full w-full bg-white/30 motion-safe:transition-opacity motion-safe:duration-500',
                  merged && 'opacity-0',
                )}
              />
            </div>
          </>
        ) : (
          // Glisse quand la valeur change sous les yeux (jauges du programme à la
          // main, changement de semaine). Remplissage depuis 0 au montage
          // seulement si demandé (bilan de cycle, conv #66).
          <div
            className={cn(
              'absolute inset-y-0 left-0 motion-safe:transition-[width] motion-safe:ease-out',
              fill,
            )}
            style={{
              width: `${staticWidth}%`,
              transitionDuration: `${fillOnMount ? MOTION.fill : 300}ms`,
              transitionDelay: fillOnMount ? `${delayMs}ms` : undefined,
            }}
          />
        )}
      </div>
      {pctMark !== null && (
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pctMark}%` }}
          data-testid={testId === undefined ? undefined : `${testId}-mark`}
        >
          {/* Le trait porte l'animation, pas l'enveloppe : `vmin-hit` anime
              `transform`, il écraserait les translations de centrage. */}
          <div
            className={cn(
              'w-0.5 rounded-full bg-anthracite-200',
              size === 'md' ? 'h-3.5' : 'h-3',
              crossesMark && markHit && 'motion-safe:animate-vmin-hit',
            )}
          />
        </div>
      )}
      {scale > VOLUME_HIGH_MARK + 0.05 && (
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/80"
          style={{ left: `${pctOf(VOLUME_HIGH_MARK, scale)}%` }}
        />
      )}
    </div>
  );
}
