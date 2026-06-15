import { ChargeType } from '@/engine/models';
import { cn } from '@/lib/cn';

/**
 * Note pédagogique sur la mécanique de charge — Bloc F (Conv #31).
 *
 * Explique les charges contre-intuitives (le point clé : en machine assistée,
 * le poids affiché est **retiré**, pas soulevé). Renvoie `null` pour les
 * charges « normales » (barre/haltères/machine/poulie) où il n'y a rien à
 * clarifier. Couleur bleue = information (grille sémantique de l'app).
 *
 * Wording validé via le skill ux-writer-coach-os.
 */
const NOTE_BY_CHARGE: Partial<Record<ChargeType, string>> = {
  [ChargeType.BODYWEIGHT_ASSISTED]:
    'Exercice assisté : le poids que tu règles est retiré, pas soulevé. Plus tu en mets, plus le mouvement est facile.',
  [ChargeType.BODYWEIGHT_LOADED]:
    'Exercice lesté : le poids que tu règles s’ajoute à ton poids de corps.',
  [ChargeType.BODYWEIGHT]:
    'Au poids du corps : il n’y a pas de charge à régler.',
};

export function chargeMechanicNote(charge: ChargeType): string | null {
  return NOTE_BY_CHARGE[charge] ?? null;
}

interface ChargeMechanicNoteProps {
  readonly charge: ChargeType;
  readonly className?: string;
}

export function ChargeMechanicNote({ charge, className }: ChargeMechanicNoteProps) {
  const note = chargeMechanicNote(charge);
  if (note === null) return null;
  return (
    <p
      data-testid="charge-mechanic-note"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-blue-800/40 bg-blue-950/30 px-3 py-2 text-xs leading-snug text-blue-200',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px shrink-0 text-blue-400"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 7.5h.01" />
      </svg>
      <span>{note}</span>
    </p>
  );
}
