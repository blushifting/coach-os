/**
 * Étoile de favori — Bloc F (Conv #31).
 *
 * Icône seule (pas de bouton). `filled` = favori actif (étoile pleine, à
 * colorer en doré par le parent via `text-amber-400`) ; sinon contour. La
 * couleur suit `currentColor` pour rester cohérente avec le contexte.
 */
interface FavoriteStarProps {
  readonly filled: boolean;
  /** Taille en pixels (carré). Default 20. */
  readonly size?: number;
  readonly className?: string;
}

export function FavoriteStar({ filled, size = 20, className }: FavoriteStarProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2.8l2.8 6 6.5.55-4.95 4.35 1.5 6.4L12 16.6l-5.85 3.5 1.5-6.4L2.7 9.35l6.5-.55z" />
    </svg>
  );
}
