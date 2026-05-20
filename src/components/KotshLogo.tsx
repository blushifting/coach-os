/**
 * Logotype Kotsh (Conv #14a-3).
 *
 * Le `o` de "Kotsh" est remplacé par un anneau ouvert sang dont l'épaisseur
 * fait écho au trait des lettres voisines. Utilisé en gros sur l'écran de
 * bienvenue, et en petit/discret en pied de page du Profil.
 *
 * La taille suit la police d'environnement (`em`) — le composant prend la
 * `className` pour fixer la taille via Tailwind sur le `<span>` racine.
 */

import { cn } from '@/lib/cn';

interface KotshLogoProps {
  /** Classes appliquées au wrapper (texte). Permet d'ajuster taille, poids, casse. */
  readonly className?: string;
  /** `text-sang-500` par défaut — couleur de l'anneau du `o`. */
  readonly ringClassName?: string;
}

export function KotshLogo({
  className,
  ringClassName = 'text-sang-500',
}: KotshLogoProps) {
  return (
    <span
      className={cn(
        'font-display font-bold leading-none tracking-tight text-white',
        className,
      )}
    >
      K
      <svg
        viewBox="0 0 100 100"
        className={cn(
          'inline-block h-[0.62em] w-[0.62em] align-baseline',
          ringClassName,
        )}
        aria-hidden="true"
        focusable="false"
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
  );
}
